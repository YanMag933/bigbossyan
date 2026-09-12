window.BossChat = {
  MIN_PRICE: 500,

  FREE: {
    label: "Бесплатный ИИ",
    // gen.pollinations.ai уже требует ключ; анонимно живёт text.pollinations.ai
    getBases: ["https://text.pollinations.ai/"],
    postEndpoints: ["https://text.pollinations.ai/openai"],
    models: ["openai", "openai-large", "mistral"],
    cooldownMs: 16000,
    lastCallAt: 0,
  },

  provider() {
    return "main";
  },

  mode() {
    return "free";
  },

  hasKey() {
    return true;
  },

  modelLabel() {
    return this.FREE.label;
  },

  async ask(message, projectId, state) {
    const history = Store.getChat(state, projectId).slice(-8);
    const userMsg = this.enrichUserMessage(message);
    const raw = await this.callFree(userMsg, projectId, state, history);
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
      "\n\n[Текущие цены в контексте — факт. Предложи ДРУГИЕ цифры, не копируй прайс. patches=[].]"
    );
  },

  buildSystemPrompt(projectId, state) {
    const ctx = window.ProjectLive.contextForAi(projectId, state);
    const slim = {
      name: ctx.name,
      stage: ctx.stage,
      progressPct: ctx.progressPct,
      pricing: ctx.pricing,
      nextTasks: (ctx.nextTasks || []).slice(0, 3),
      notes: (ctx.notes || []).slice(0, 3),
    };
    return (
      "Ты бизнес-советник BigBossYan для Яна. Отвечай по-русски коротко и по делу. " +
      "Контекст: " +
      JSON.stringify(slim) +
      ' Ответ строго JSON: {"reply":"текст","patches":[]}. patches только если явно просят изменить план.'
    ).slice(0, 1800);
  },

  buildMessages(message, projectId, state, history) {
    const messages = [{ role: "system", content: this.buildSystemPrompt(projectId, state) }];
    for (const m of (history || []).slice(-4)) {
      if (!m || !m.text) continue;
      if (m.role === "user") messages.push({ role: "user", content: String(m.text).slice(0, 500) });
      else if (m.role === "assistant") messages.push({ role: "assistant", content: String(m.text).slice(0, 700) });
    }
    messages.push({ role: "user", content: String(message).slice(0, 900) });
    return messages;
  },

  async fetchTimeout(url, options, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 45000);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } catch (e) {
      if (e && e.name === "AbortError") {
        throw new Error("Таймаут (" + Math.round((ms || 45000) / 1000) + "с). Повтори через пару секунд.");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  async callFree(message, projectId, state, history) {
    const wait = this.FREE.cooldownMs - (Date.now() - (this.FREE.lastCallAt || 0));
    if (wait > 0) {
      throw new Error("Подожди " + Math.ceil(wait / 1000) + " сек — бесплатный канал ограничивает частоту.");
    }

    const messages = this.buildMessages(message, projectId, state, history);
    const errors = [];

    try {
      const out = await this.requestFreeGet(messages);
      this.FREE.lastCallAt = Date.now();
      return out;
    } catch (e) {
      errors.push(this.friendlyError(e));
    }

    for (const endpoint of this.FREE.postEndpoints) {
      for (const model of this.FREE.models) {
        try {
          const out = await this.requestFreePost(endpoint, model, messages);
          this.FREE.lastCallAt = Date.now();
          return out;
        } catch (e) {
          errors.push(this.friendlyError(e));
        }
      }
    }

    throw new Error(
      errors.filter(Boolean).slice(-2).join(" · ") ||
        "Бесплатный ИИ сейчас недоступен. Подожди минуту и попробуй снова."
    );
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
    return parts.join("\n\n").slice(0, 3200);
  },

  async requestFreeGet(messages) {
    const prompt = this.flattenPrompt(messages);
    let lastErr = null;
    for (const base of this.FREE.getBases) {
      for (const model of this.FREE.models) {
        let url = base + encodeURIComponent(prompt);
        // text.pollinations.ai принимает ?model=
        url += (url.indexOf("?") >= 0 ? "&" : "?") + "model=" + encodeURIComponent(model);
        try {
          const res = await this.fetchTimeout(
            url,
            { method: "GET", headers: { Accept: "text/plain, application/json, */*" } },
            50000
          );
          const text = await res.text();
          if (!res.ok) throw new Error(String(text || res.status).slice(0, 200));
          if (!text || !String(text).trim()) throw new Error("Пустой ответ");
          return String(text).trim();
        } catch (e) {
          lastErr = e;
        }
      }
    }
    throw lastErr || new Error("GET failed");
  },

  async requestFreePost(endpoint, model, messages) {
    const res = await this.fetchTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model,
          messages: messages.slice(-5),
          temperature: 0.5,
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
      throw new Error(String(parsed).slice(0, 200));
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
      return "Лимит бесплатного канала. Подожди 20–60 сек и напиши снова.";
    }
    if (/Load failed|Failed to fetch|NetworkError|network/i.test(msg)) {
      return "Сеть оборвала запрос. Проверь интернет и повтори.";
    }
    if (/Incorrect API key|InvalidApiKey|401|Unauthorized/i.test(msg)) {
      return "Ключ не нужен для этого чата. Обнови приложение через reset и пиши снова.";
    }
    if (/Таймаут|Подожди/i.test(msg)) return msg;
    return msg.slice(0, 220);
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
