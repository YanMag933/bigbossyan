window.BossChat = {
  MIN_PRICE: 500,

  OPENROUTER: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    /** openrouter/free сам выбирает живую бесплатную модель */
    model: "openrouter/free",
    fallbacks: [
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3.5-lightning:free",
      "thinkingmachines/inkling:free",
      "poolside/laguna-s-2.1:free",
      "deepseek/deepseek-chat-v3-0324",
    ],
  },

  FREE: {
    endpoint: "https://text.pollinations.ai/openai",
    models: ["openai-fast", "openai", "gemini-fast", "mistral"],
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
          "Нет ключа OpenRouter.\n\n1) openrouter.ai/keys → Create key\n2) Вставь выше → «Сохранить»\n\nИли переключись на «Бесплатный» — там ключ не нужен.",
        patches: [],
      };
    }

    const history = (state.chat[projectId] || []).slice(-12);
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

  async callOpenRouter(message, projectId, state, history) {
    const key = this.getKey(state);
    const preferred =
      String((state.ai && state.ai.openrouterModel) || this.OPENROUTER.model).trim() || this.OPENROUTER.model;
    const models = [preferred].concat(this.OPENROUTER.fallbacks.filter((m) => m !== preferred));
    const messages = this.buildMessages(message, projectId, state, history);

    let lastErr = null;
    for (const model of models) {
      try {
        return await this.requestOpenRouter(key, model, messages);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (/404|rate|429|capacity|no longer|not found|insufficient|unavailable for free|Payment Required|402/i.test(msg))
          continue;
        throw e;
      }
    }
    throw lastErr || new Error("Все модели OpenRouter недоступны сейчас");
  },

  async requestOpenRouter(key, model, messages) {
    const res = await fetch(this.OPENROUTER.endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": location.origin || "https://yanmag933.github.io",
        "X-Title": "BigBossYan",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.55,
        max_tokens: 1400,
      }),
    });

    const detail = await res.text();
    if (!res.ok) {
      let parsed = detail;
      try {
        const j = JSON.parse(detail);
        parsed = (j.error && (j.error.message || j.error)) || detail;
      } catch (_) {}
      throw new Error(String(parsed).slice(0, 220));
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
    // Укорачиваем system: бесплатный лимит часто жёсткий
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
        const msg = String(e.message || e);
        if (/402|429|rate|capacity|not found|404|Payment|budget/i.test(msg)) continue;
        throw e;
      }
    }
    throw lastErr || new Error("Бесплатная модель сейчас недоступна. Попробуй OpenRouter.");
  },

  async requestFree(model, messages) {
    // Без Authorization — иначе Pollinations думает, что ключ есть и требует бюджет
    const res = await fetch(this.FREE.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: location.href || "https://yanmag933.github.io/bigbossyan/",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.55,
      }),
    });

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
      // иногда приходит plain text
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
