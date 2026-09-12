window.BossChat = {
  MIN_PRICE: 500,

  QWEN: {
    label: "Qwen",
    models: ["qwen-plus", "qwen-turbo", "qwen-flash", "qwen2.5-72b-instruct", "qwen-max"],
    endpoints: [
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    ],
  },

  FREE: {
    label: "Бесплатный",
    // GET text — стабильнее POST с телефона (меньше 402 / CORS сюрпризов)
    getBases: ["https://gen.pollinations.ai/text/", "https://text.pollinations.ai/"],
    postEndpoint: "https://gen.pollinations.ai/v1/chat/completions",
    models: ["openai", "openai-fast", "mistral"],
    cooldownMs: 8000,
    lastCallAt: 0,
  },

  /** Режим: qwen (ключ DashScope) или free (без ключа). */
  mode(state) {
    return this.getQwenKey(state) ? "qwen" : "free";
  },

  provider(state) {
    // совместимость со старым кодом (один поток чата)
    return "main";
  },

  getQwenKey(state) {
    if (!state || !state.ai) return "";
    const key = String(state.ai.apiKey || state.ai.qwenKey || "").trim();
    if (!key) return "";
    // OpenRouter-ключи сюда не пускаем
    if (/^sk-or-/i.test(key) || /^AIza/i.test(key)) return "";
    if (!/^sk-/i.test(key)) return "";
    return key;
  },

  hasKey(state) {
    // чат всегда доступен: без ключа = бесплатный канал
    return true;
  },

  modelLabel(state) {
    if (this.mode(state) === "qwen") {
      const m = (state.ai && state.ai.qwenModel) || this.QWEN.models[0];
      return "Qwen · " + m;
    }
    return "Бесплатный · без ключа";
  },

  async ask(message, projectId, state) {
    const history = Store.getChat(state, projectId).slice(-10);
    const userMsg = this.enrichUserMessage(message);
    let raw;
    const errors = [];

    if (this.mode(state) === "qwen") {
      try {
        raw = await this.callQwen(userMsg, projectId, state, history);
      } catch (e) {
        errors.push("Qwen: " + this.friendlyError(e));
        try {
          raw = await this.callFree(userMsg, projectId, state, history);
        } catch (e2) {
          errors.push("Free: " + this.friendlyError(e2));
          throw new Error(errors.join("\n"));
        }
      }
    } else {
      raw = await this.callFree(userMsg, projectId, state, history);
    }

    const parsed = this.parseModelJson(raw);
    parsed.patches = this.sanitizePatches(parsed.patches || [], projectId, message);
    return parsed;
  },

  isPriceAdviceQuestion(message) {
    const lower = String(message || "").toLowerCase();
    return /вариант\w*\s+цен|цен\w*\s+вариант|предложи.*цен|пересмотр.*цен|альтернатив\w*\s+цен|дешевле|дороже/.test(
      lower
    );
  },

  enrichUserMessage(message) {
    if (!this.isPriceAdviceQuestion(message)) return message;
    return (
      String(message).trim() +
      "\n\n[Важно: текущие цены в контексте — факт «как сейчас». Предложи ДРУГИЕ цифры, не копируй текущий прайс. Патчи в план не ставь.]"
    );
  },

  buildSystemPrompt(projectId, state, compact) {
    const ctx = window.ProjectLive.contextForAi(projectId, state);
    const slim = {
      projectId: ctx.projectId,
      name: ctx.name,
      stage: ctx.stage,
      progressPct: ctx.progressPct,
      pricing: ctx.pricing,
      nextTasks: (ctx.nextTasks || []).slice(0, 4),
      notes: (ctx.notes || []).slice(0, 4),
      recommendations: (ctx.recommendations || []).slice(0, 3),
    };

    const base = `Ты бизнес-советник BigBossYan для основателя Яна. Отвечай по-русски, по делу.
Контекст: ${JSON.stringify(slim)}
Правила:
- pricing = текущие цены (факт). «N вариантов цены» = N ДРУГИХ сценариев, не копипаст прайса.
- patches=[] по умолчанию. Патч только если явно: измени/поставь/примени + пакет + цена (≥500₽).
Ответ строго JSON без markdown: {"reply":"текст","patches":[]}`;

    if (compact && base.length > 2200) return base.slice(0, 2200) + "…";
    return base;
  },

  buildMessages(message, projectId, state, history, compact) {
    const messages = [{ role: "system", content: this.buildSystemPrompt(projectId, state, compact) }];
    for (const m of (history || []).slice(-6)) {
      if (!m || !m.text) continue;
      if (m.role === "user") messages.push({ role: "user", content: m.text });
      else if (m.role === "assistant") messages.push({ role: "assistant", content: m.text });
    }
    messages.push({ role: "user", content: message });
    return messages;
  },

  async fetchTimeout(url, options, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 40000);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } catch (e) {
      if (e && e.name === "AbortError") {
        throw new Error("Таймаут ответа модели (" + Math.round((ms || 40000) / 1000) + "с)");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  async callQwen(message, projectId, state, history) {
    const key = this.getQwenKey(state);
    const messages = this.buildMessages(message, projectId, state, history, false);
    const preferred = String((state.ai && state.ai.qwenModel) || "").trim();
    const models = [];
    if (preferred) models.push(preferred);
    for (const m of this.QWEN.models) if (!models.includes(m)) models.push(m);

    let lastErr = null;
    for (const endpoint of this.QWEN.endpoints) {
      for (const model of models.slice(0, 4)) {
        try {
          const content = await this.requestChatCompletions(endpoint, key, model, messages);
          state.ai.qwenModel = model;
          state.ai.qwenEndpoint = endpoint;
          return content;
        } catch (e) {
          lastErr = e;
          const msg = String(e.message || e);
          // неверный ключ — сразу стоп
          if (/401|Unauthorized|invalid.*key|InvalidApiKey/i.test(msg)) throw e;
          continue;
        }
      }
    }
    throw lastErr || new Error("Qwen сейчас недоступен");
  },

  async requestChatCompletions(endpoint, key, model, messages) {
    const res = await this.fetchTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.55,
          max_tokens: 1400,
        }),
      },
      45000
    );

    const detail = await res.text();
    if (!res.ok) {
      let parsed = detail;
      try {
        const j = JSON.parse(detail);
        parsed =
          (j.error && (j.error.message || j.error.code || j.error)) ||
          j.message ||
          detail;
      } catch (_) {}
      throw new Error(String(parsed).slice(0, 280));
    }

    let data;
    try {
      data = JSON.parse(detail);
    } catch (_) {
      throw new Error("Кривой ответ Qwen");
    }
    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    if (!content) throw new Error("Пустой ответ Qwen");
    return content;
  },

  async callFree(message, projectId, state, history) {
    const wait = this.FREE.cooldownMs - (Date.now() - (this.FREE.lastCallAt || 0));
    if (wait > 0) {
      throw new Error("Подожди " + Math.ceil(wait / 1000) + " сек и повтори.");
    }

    const messages = this.buildMessages(message, projectId, state, history, true);
    let lastErr = null;

    // 1) простой GET — лучше проходит с телефона
    try {
      const out = await this.requestFreeGet(messages);
      this.FREE.lastCallAt = Date.now();
      return out;
    } catch (e) {
      lastErr = e;
    }

    // 2) POST chat completions без ключа
    for (const model of this.FREE.models) {
      try {
        const out = await this.requestFreePost(model, messages);
        this.FREE.lastCallAt = Date.now();
        return out;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Бесплатный канал недоступен");
  },

  flattenPrompt(messages) {
    const parts = [];
    for (const m of messages || []) {
      if (!m || !m.content) continue;
      if (m.role === "system") parts.push("SYSTEM:\n" + m.content);
      else if (m.role === "user") parts.push("USER:\n" + m.content);
      else if (m.role === "assistant") parts.push("ASSISTANT:\n" + m.content);
    }
    parts.push('Ответь одним JSON: {"reply":"...","patches":[]}');
    return parts.join("\n\n").slice(0, 3500);
  },

  async requestFreeGet(messages) {
    const prompt = this.flattenPrompt(messages);
    let lastErr = null;
    for (const base of this.FREE.getBases) {
      for (const model of this.FREE.models) {
        const url =
          base +
          encodeURIComponent(prompt) +
          (base.includes("gen.pollinations") ? "?model=" + encodeURIComponent(model) : "");
        try {
          const res = await this.fetchTimeout(url, { method: "GET" }, 50000);
          const text = await res.text();
          if (!res.ok) {
            throw new Error(String(text || res.status).slice(0, 220));
          }
          if (!text || !text.trim()) throw new Error("Пустой ответ");
          return text.trim();
        } catch (e) {
          lastErr = e;
        }
      }
    }
    throw lastErr || new Error("GET free failed");
  },

  async requestFreePost(model, messages) {
    const res = await this.fetchTimeout(
      this.FREE.postEndpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: messages.slice(-5),
          temperature: 0.55,
        }),
      },
      45000
    );
    const detail = await res.text();
    if (!res.ok) {
      let parsed = detail;
      try {
        const j = JSON.parse(detail);
        parsed = (j.error && (j.error.message || j.error)) || detail;
      } catch (_) {}
      throw new Error(String(parsed).slice(0, 220));
    }
    try {
      const data = JSON.parse(detail);
      const content =
        (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
        data.content ||
        data.text;
      if (!content) throw new Error("Пустой ответ");
      return content;
    } catch (e) {
      if (detail && detail.trim()) return detail.trim();
      throw e;
    }
  },

  friendlyError(err) {
    const msg = String((err && err.message) || err || "");
    if (/402|Payment Required|budget|pollen|Insufficient/i.test(msg)) {
      return "Лимит бесплатного канала. Подожди минуту или вставь ключ Qwen (Model Studio).";
    }
    if (/Load failed|Failed to fetch|NetworkError|network/i.test(msg)) {
      return "Сеть оборвала запрос. Попробуй ещё раз; для Qwen иногда нужен VPN.";
    }
    if (/401|Unauthorized|InvalidApiKey|invalid.*key/i.test(msg)) {
      return "Ключ Qwen не принят. Создай новый на home.qwencloud.com → API Keys.";
    }
    if (/Model not exist|not found|InvalidParameter/i.test(msg)) {
      return "Модель недоступна на этом регионе — пробую другие автоматически. Если снова ошибка: смени ключ/регион.";
    }
    if (/Таймаут|подожди/i.test(msg)) return msg;
    return msg.slice(0, 280);
  },

  keyFingerprint(key) {
    const k = String(key || "").trim();
    if (k.length < 12) return k;
    return k.slice(0, 8) + "…" + k.slice(-4);
  },

  async verifyQwenKey(key) {
    const clean = String(key || "").trim();
    if (!clean || !/^sk-/i.test(clean) || /^sk-or-/i.test(clean)) {
      throw new Error("Нужен ключ DashScope / Qwen Cloud вида sk-… (не OpenRouter sk-or-)");
    }

    let lastErr = null;
    for (const endpoint of this.QWEN.endpoints) {
      try {
        await this.requestChatCompletions(endpoint, clean, this.QWEN.models[0], [
          { role: "user", content: 'Ответь строго JSON: {"reply":"ок","patches":[]}' },
        ]);
        return { ok: true, fingerprint: this.keyFingerprint(clean), endpoint };
      } catch (e) {
        lastErr = e;
        if (/401|Unauthorized|InvalidApiKey|invalid.*key/i.test(String(e.message || e))) {
          // пробуем второй регион — ключ может быть только для CN или только для intl
          continue;
        }
      }
    }
    throw lastErr || new Error("Ключ не прошёл проверку");
  },

  // старое имя — чтобы не ломать вызовы в app.js
  async verifyOpenRouterKey(key) {
    return this.verifyQwenKey(key);
  },

  parseModelJson(raw) {
    let text = String(raw || "").trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    const inline = text.match(/\{[\s\S]*"reply"[\s\S]*\}/);
    if (inline) {
      try {
        const obj = JSON.parse(inline[0]);
        return {
          reply: String(obj.reply || obj.message || "").trim() || "Пустой ответ.",
          patches: Array.isArray(obj.patches) ? obj.patches : [],
        };
      } catch (_) {}
    }
    try {
      const obj = JSON.parse(text);
      return {
        reply: String(obj.reply || obj.message || "").trim() || "Пустой ответ.",
        patches: Array.isArray(obj.patches) ? obj.patches : [],
      };
    } catch (_) {
      return { reply: text || "Не разобрал ответ модели.", patches: [] };
    }
  },

  wantsMutation(message) {
    const lower = String(message || "").toLowerCase();
    return /(?:^|\s)(измени|поставь|примени|зафиксируй|обнови\s+в\s+плане|поменяй|внеси\s+в\s+план)/.test(
      lower
    );
  },

  parsePriceAmount(price) {
    const n = Number(String(price || "").replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  },

  sanitizePatches(patches, projectId, userMessage) {
    if (!Array.isArray(patches) || !patches.length) return [];
    if (!this.wantsMutation(userMessage)) return [];

    const out = [];
    for (const p of patches) {
      if (!p || !p.op) continue;
      const pid = p.projectId || projectId;
      if (p.op === "setPrice") {
        const amount = this.parsePriceAmount(p.price);
        if (!Number.isFinite(amount) || amount < this.MIN_PRICE) continue;
        const pkg = String(p.package || p.name || "").trim();
        if (!pkg) continue;
        out.push({
          op: "setPrice",
          projectId: pid,
          package: pkg,
          price: amount.toLocaleString("ru-RU") + " ₽",
          forWhom: p.forWhom || "",
        });
      } else if (["setField", "setUnit", "addWin", "completeTask"].includes(p.op)) {
        out.push({ ...p, projectId: pid });
      }
    }
    return out;
  },
};
