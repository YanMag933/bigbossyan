window.BossChat = {
  MIN_PRICE: 500,

  OPENROUTER: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "deepseek/deepseek-chat-v3-0324:free",
    fallbacks: [
      "deepseek/deepseek-r1-0528:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-nano-9b-v2:free",
    ],
  },

  GEMINI: {
    models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.6-flash"],
  },

  provider(state) {
    const p = String((state && state.ai && state.ai.provider) || "openrouter").toLowerCase();
    return p === "gemini" ? "gemini" : "openrouter";
  },

  getKey(state) {
    if (!state || !state.ai) return "";
    if (this.provider(state) === "gemini") {
      return String(state.ai.geminiKey || "").trim();
    }
    const key = String(state.ai.apiKey || state.ai.openrouterKey || "").trim();
    if (!key || /^AIza/i.test(key)) return "";
    return key;
  },

  hasKey(state) {
    return !!this.getKey(state);
  },

  async ask(message, projectId, state) {
    const provider = this.provider(state);
    if (!this.hasKey(state)) {
      return {
        reply:
          provider === "gemini"
            ? "Нет ключа Gemini.\n\n1) aistudio.google.com/apikey\n2) Create API key\n3) Вставь выше → «Сохранить»\n\nИз РФ Google иногда режет по локации — тогда переключись на OpenRouter."
            : "Нет ключа OpenRouter.\n\n1) openrouter.ai/keys\n2) Create key\n3) Вставь выше → «Сохранить»\n\nКлюч только на этом устройстве. Если удобнее Gemini — переключи провайдер выше.",
        patches: [],
      };
    }

    const history = (state.chat[projectId] || []).slice(-12);
    const raw =
      provider === "gemini"
        ? await this.callGemini(message, projectId, state, history)
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
        if (/404|rate|429|capacity|no longer|not found|insufficient/i.test(msg)) continue;
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

  async callGemini(message, projectId, state, history) {
    const key = this.getKey(state);
    const preferred = String((state.ai && state.ai.geminiModel) || this.GEMINI.models[0]).trim();
    const models = [preferred].concat(this.GEMINI.models.filter((m) => m !== preferred));
    const system = this.buildSystemPrompt(projectId, state);
    const contents = [];
    for (const m of history) {
      if (!m || !m.text) continue;
      if (m.role === "user") contents.push({ role: "user", parts: [{ text: m.text }] });
      else if (m.role === "assistant") contents.push({ role: "model", parts: [{ text: m.text }] });
    }
    const last = contents[contents.length - 1];
    if (!last || last.role !== "user" || last.parts[0].text !== message) {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    let lastErr = null;
    for (const model of models) {
      try {
        return await this.requestGemini(key, model, system, contents);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (/404|not found|NOT_FOUND|is not found/i.test(msg)) continue;
        throw e;
      }
    }
    throw lastErr || new Error("Модели Gemini недоступны");
  },

  async requestGemini(key, model, system, contents) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(key);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 1400,
          responseMimeType: "application/json",
        },
      }),
    });

    const detail = await res.text();
    if (!res.ok) {
      let parsed = detail;
      try {
        const j = JSON.parse(detail);
        parsed = (j.error && j.error.message) || detail;
      } catch (_) {}
      if (/location is not supported/i.test(String(parsed))) {
        throw new Error(
          "Gemini из твоего региона закрыт (location). Переключи провайдер на OpenRouter и вставь ключ оттуда."
        );
      }
      throw new Error(String(parsed).slice(0, 220));
    }

    let data;
    try {
      data = JSON.parse(detail);
    } catch (_) {
      throw new Error("Кривой ответ Gemini");
    }
    const content =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.map((p) => p.text || "").join("");
    if (!content) throw new Error("Пустой ответ Gemini");
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
