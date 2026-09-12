window.BossChat = {
  MIN_PRICE: 500,

  OPENROUTER: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    /** Актуальный список: старые deepseek*:free больше не существуют */
    models: [
      "openrouter/free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3.5-lightning:free",
      "thinkingmachines/inkling:free",
      "poolside/laguna-s-2.1:free",
      "nex-agi/nex-n2.5-mini:free",
      "deepseek/deepseek-chat-v3-0324",
    ],
  },

  FREE: {
    endpoint: "https://text.pollinations.ai/openai",
    models: ["openai-fast", "openai", "mistral", "gemini-fast"],
  },

  provider(state) {
    const p = String((state && state.ai && state.ai.provider) || "free").toLowerCase();
    if (p === "gemini" || p === "openrouter") return "openrouter";
    if (p === "free" || p === "pollinations") return "free";
    return "free";
  },

  getKey(state) {
    if (!state || !state.ai) return "";
    if (this.provider(state) === "free") return "";
    const key = String(state.ai.apiKey || state.ai.openrouterKey || "").trim();
    if (!key || /^AIza/i.test(key)) return "";
    return key;
  },

  hasKey(state) {
    if (this.provider(state) === "free") return true;
    return !!this.getKey(state);
  },

  async ask(message, projectId, state) {
    const provider = this.provider(state);
    if (provider === "openrouter" && !this.getKey(state)) {
      return {
        reply:
          "Нет ключа OpenRouter.\n\n1) openrouter.ai/keys → Create key\n2) Вставь выше → «Сохранить»\n\nИли переключись на «Бесплатный» — там отдельный чат без ключа.",
        patches: [],
      };
    }

    const history = Store.getChat(state, projectId, provider).slice(-12);
    const raw =
      provider === "free"
        ? await this.callFree(message, projectId, state, history)
        : await this.callOpenRouter(message, projectId, state, history);
    const parsed = this.parseModelJson(raw);
    parsed.patches = this.sanitizePatches(parsed.patches || [], projectId, message);
    return parsed;
  },

  buildSystemPrompt(projectId, state) {
    const ctx = window.ProjectLive.contextForAi(projectId, state);
    const otherId = projectId === "lifeRpg" ? "trailOn" : "lifeRpg";
    const other = window.ProjectLive.contextForAi(otherId, state);

    return `Ты — умный бизнес-советник внутри приложения BigBossYan для основателя Яна.
Ты НЕ шаблонный бот. Сначала пойми вопрос, потом ответь по существу.

Контекст текущего проекта:
${JSON.stringify(ctx, null, 2)}

Кратко второй проект (для сравнения, если уместно):
${JSON.stringify(
  {
    projectId: other.projectId,
    name: other.name,
    progressPct: other.progressPct,
    pricing: other.pricing,
    stage: other.stage,
  },
  null,
  2
)}

Как думать:
- Прочитай вопрос буквально. «Предложи 3 варианта цены» = совет и сравнение, НЕ смена цены в плане.
- Число «3» в таком вопросе — количество вариантов, НЕ цена 3 ₽.
- Цены пакетов — обычно тысячи рублей (Life RPG ~5–25 тыс., TrailOn подписка ~3–7 тыс./точка).
- Опирайся на прайс, прогресс, SWOT и рекомендации из контекста. Не выдумывай выручку, которой нет.
- Отвечай по-русски, спокойно и по делу: сначала вывод/разбор, потом конкретика.
- Не раздувай ответ водой, но и не отвечай одной резкой фразой.

Правки плана (patches):
- По умолчанию patches = [].
- Патч ставь ТОЛЬКО если пользователь ЯВНО просит изменить данные в приложении
  (слова: измени, поставь, примени, зафиксируй, обнови в плане) И назвал пакет + цену.
- Если сомневаешься — patches пустой, предложи формулировку для подтверждения.
- Никогда не ставь цену ниже 500 ₽ для пакетов.

Формат ответа — строго JSON без markdown:
{"reply":"текст человеку","patches":[]}

Допустимые patches:
{"op":"setPrice","projectId":"lifeRpg|trailOn","package":"точное имя пакета из прайса","price":"12900 ₽"}
{"op":"setField","projectId":"...","field":"oneLiner|tagline|position|stage|name|short","value":"..."}
{"op":"setUnit","projectId":"...","label":"...","value":"...","note":"..."}
{"op":"addWin","projectId":"...","text":"..."}`;
  },

  buildMessages(message, projectId, state, history) {
    const messages = [{ role: "system", content: this.buildSystemPrompt(projectId, state) }];
    for (const m of history) {
      if (!m || !m.text) continue;
      if (m.role === "user") messages.push({ role: "user", content: m.text });
      else if (m.role === "assistant") messages.push({ role: "assistant", content: m.text });
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user" || last.content !== message) {
      messages.push({ role: "user", content: message });
    }
    return messages;
  },

  openRouterModels(state) {
    const dead = /deepseek.*:free|deepseek-chat-v3-0324:free/i;
    const preferred = String((state.ai && state.ai.openrouterModel) || "").trim();
    const list = [];
    if (preferred && !dead.test(preferred)) list.push(preferred);
    for (const m of this.OPENROUTER.models) {
      if (!list.includes(m) && !dead.test(m)) list.push(m);
    }
    return list.length ? list : ["openrouter/free"];
  },

  extractAltSlug(errMsg) {
    const m = String(errMsg || "").match(/use this slug instead:\s*([a-z0-9_.:/-]+)/i);
    return m ? m[1].trim() : "";
  },

  async callOpenRouter(message, projectId, state, history) {
    const key = this.getKey(state);
    const models = this.openRouterModels(state).slice(0, 5);
    const messages = this.buildMessages(message, projectId, state, history);
    const tried = new Set();
    let lastErr = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      if (!model || tried.has(model)) continue;
      tried.add(model);
      try {
        return await this.requestOpenRouter(key, model, messages);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        const alt = this.extractAltSlug(msg);
        if (alt && !tried.has(alt)) models.push(alt);
        // Пробуем следующую модель почти при любой ошибке провайдера
        continue;
      }
    }
    throw lastErr || new Error("Все модели OpenRouter недоступны сейчас");
  },

  async fetchTimeout(url, options, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 35000);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("Таймаут ответа модели (" + Math.round((ms || 35000) / 1000) + "с)");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  async requestOpenRouter(key, model, messages) {
    const res = await this.fetchTimeout(
      this.OPENROUTER.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://yanmag933.github.io/bigbossyan/",
          "X-Title": "BigBossYan",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.55,
          max_tokens: 1400,
        }),
      },
      40000
    );

    const detail = await res.text();
    if (!res.ok) {
      let parsed = detail;
      try {
        const j = JSON.parse(detail);
        if (j.error) {
          if (typeof j.error === "string") parsed = j.error;
          else parsed = j.error.message || JSON.stringify(j.error);
        }
      } catch (_) {}
      throw new Error(String(parsed).slice(0, 280));
    }

    let data;
    try {
      data = JSON.parse(detail);
    } catch (_) {
      throw new Error("Кривой ответ OpenRouter");
    }
    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    if (!content) throw new Error("Пустой ответ модели");
    return content;
  },

  async callFree(message, projectId, state, history) {
    const messages = this.buildMessages(message, projectId, state, history);
    if (messages[0] && messages[0].role === "system") {
      const short = messages[0].content;
      if (short.length > 6000) messages[0].content = short.slice(0, 6000) + "\n…";
    }
    const hist = messages.filter((m) => m.role !== "system").slice(-8);
    const payloadMessages = [messages[0]].concat(hist);

    let lastErr = null;
    for (const model of this.FREE.models) {
      try {
        return await this.requestFree(model, payloadMessages);
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    throw lastErr || new Error("Бесплатная модель сейчас недоступна.");
  },

  async requestFree(model, messages) {
    const res = await this.fetchTimeout(
      this.FREE.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: "https://yanmag933.github.io/bigbossyan/",
        },
        body: JSON.stringify({
          model,
          messages,
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
        parsed =
          (j.error && (j.error.message || j.error)) ||
          (j.details && j.details.error && j.details.error.message) ||
          detail;
      } catch (_) {}
      throw new Error(String(parsed).slice(0, 220));
    }

    let data;
    try {
      data = JSON.parse(detail);
    } catch (_) {
      if (detail && detail.trim()) return detail.trim();
      throw new Error("Кривой ответ бесплатной модели");
    }

    if (typeof data === "string") return data;
    const content =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
      data.content ||
      data.text ||
      data.reply;
    if (!content) throw new Error("Пустой ответ бесплатной модели");
    return content;
  },

  parseModelJson(raw) {
    let text = String(raw || "").trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
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
