window.BossChat = {
  MIN_PRICE: 500,
  /** OpenRouter — работает из РФ; прямой Gemini AI Studio часто режется по локации */
  ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",
  MODEL: "deepseek/deepseek-chat-v3-0324:free",
  FALLBACK_MODELS: [
    "deepseek/deepseek-r1-0528:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/nemotron-nano-9b-v2:free",
  ],

  getKey(state) {
    if (!state || !state.ai) return "";
    const key = String(state.ai.apiKey || state.ai.openrouterKey || "").trim();
    // Старый ключ Gemini (AIza…) из РФ здесь не подходит
    if (!key || /^AIza/i.test(key)) return "";
    return key;
  },

  hasKey(state) {
    return !!this.getKey(state);
  },

  async ask(message, projectId, state) {
    if (!this.hasKey(state)) {
      return {
        reply:
          "Прямой Gemini из РФ часто не пускает (ошибка location). Поэтому чат идёт через OpenRouter — модель думает на их сервере.\n\n" +
          "1) Зайди на https://openrouter.ai/keys\n" +
          "2) Create key (можно с бесплатными моделями)\n" +
          "3) Вставь ключ выше → «Сохранить»\n\n" +
          "Ключ хранится только на этом устройстве.",
        patches: [],
      };
    }

    const history = (state.chat[projectId] || []).slice(-12);
    const raw = await this.callOpenRouter(message, projectId, state, history);
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
    const preferred = String((state.ai && state.ai.model) || this.MODEL).trim() || this.MODEL;
    const models = [preferred].concat(this.FALLBACK_MODELS.filter((m) => m !== preferred));
    const messages = this.buildMessages(message, projectId, state, history);

    let lastErr = null;
    for (const model of models) {
      try {
        return await this.requestModel(key, model, messages);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        // пробуем другую бесплатную модель, если эта кончилась / недоступна
        if (/404|rate|429|capacity|no longer|not found|insufficient/i.test(msg)) continue;
        throw e;
      }
    }
    throw lastErr || new Error("Все модели OpenRouter недоступны сейчас");
  },

  async requestModel(key, model, messages) {
    const res = await fetch(this.ENDPOINT, {
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
      if (/location is not supported/i.test(String(parsed))) {
        throw new Error(
          "Прямой Google из твоего региона закрыт. Нужен ключ OpenRouter (openrouter.ai/keys), не Gemini AI Studio."
        );
      }
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
