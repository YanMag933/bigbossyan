window.BossChat = {
  MIN_PRICE: 500,
  MODEL: "gemini-3.6-flash",

  hasKey(state) {
    return !!(state && state.ai && state.ai.geminiKey && state.ai.geminiKey.trim());
  },

  async ask(message, projectId, state) {
    if (!this.hasKey(state)) {
      return {
        reply:
          "Чтобы чат реально думал, нужен бесплатный ключ Gemini — без него будет только автомат из заготовок, а это уже бесит.\n\n" +
          "1) Открой https://aistudio.google.com/apikey\n" +
          "2) Create API key\n" +
          "3) Вставь ключ в поле выше и нажми «Сохранить»\n\n" +
          "Ключ остаётся только на этом телефоне.",
        patches: [],
      };
    }

    const history = (state.chat[projectId] || []).slice(-12);
    const raw = await this.callGemini(message, projectId, state, history);
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
- Отвечай по-русски, спокойно и по делу: сначала вывод/разбор, потом конкретика. Без грубости и без канцелярита.
- Не раздувай ответ водой, но и не отвечай одной резкой фразой.

Правки плана (patches):
- По умолчанию patches = [].
- Патч ставь ТОЛЬКО если пользователь ЯВНО просит изменить данные в приложении
  (слова вроде: измени, поставь, примени, зафиксируй, обнови в плане) И назвал пакет + цену.
- Если сомневаешься — patches пустой, предложи формулировку для подтверждения.
- Никогда не ставь цену ниже 500 ₽ для пакетов.

Формат ответа — строго JSON без markdown:
{
  "reply": "текст человеку",
  "patches": []
}

Допустимые patches:
{"op":"setPrice","projectId":"lifeRpg|trailOn","package":"точное имя пакета из прайса","price":"12900 ₽"}
{"op":"setField","projectId":"...","field":"oneLiner|tagline|position|stage|name|short","value":"..."}
{"op":"setUnit","projectId":"...","label":"...","value":"...","note":"..."}
{"op":"addWin","projectId":"...","text":"..."}`;
  },

  async callGemini(message, projectId, state, history) {
    const key = state.ai.geminiKey.trim();
    const model = (state.ai && state.ai.model && String(state.ai.model).trim()) || this.MODEL;
    // старые сохранённые имена моделей подменяем на актуальную
    const resolved =
      /gemini-2\.0-flash|gemini-1\.5-flash|gemini-pro/i.test(model) ? this.MODEL : model;
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(resolved) +
      ":generateContent?key=" +
      encodeURIComponent(key);

    const contents = [];
    for (const m of history) {
      if (!m || !m.text) continue;
      if (m.role === "user") {
        contents.push({ role: "user", parts: [{ text: m.text }] });
      } else if (m.role === "assistant") {
        contents.push({ role: "model", parts: [{ text: m.text }] });
      }
    }
    // текущее сообщение уже добавлено в history как user до вызова — не дублируем, если последнее оно
    const last = contents[contents.length - 1];
    if (!last || last.role !== "user" || last.parts[0].text !== message) {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    const body = {
      systemInstruction: { parts: [{ text: this.buildSystemPrompt(projectId, state) }] },
      contents,
      generationConfig: {
        temperature: 0.55,
        topP: 0.9,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch (_) {}
      if (res.status === 400 || res.status === 403) {
        throw new Error(
          "Ключ отклонён или модель недоступна. Проверь ключ в AI Studio и что нет жёстких ограничений. " +
            String(detail).slice(0, 160)
        );
      }
      throw new Error("Gemini HTTP " + res.status + ": " + String(detail).slice(0, 180));
    }

    const data = await res.json();
    const parts =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts;
    if (!parts || !parts.length) {
      const block = data && data.promptFeedback && data.promptFeedback.blockReason;
      throw new Error(block ? "Запрос заблокирован: " + block : "Пустой ответ модели");
    }
    return parts.map((p) => p.text || "").join("");
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
      // если модель вернула текст — покажем его, без патчей
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
    // без явной команды на изменение — ничего не пишем в план
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
