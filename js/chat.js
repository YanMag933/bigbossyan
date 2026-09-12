window.BossChat = {
  MIN_PRICE: 500,
  DEFAULT_MODEL: "gpt-4o-mini",
  timeoutMs: 60000,
  MODELS: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o", "gpt-3.5-turbo"],

  provider() {
    return "openai";
  },

  mode() {
    return "chatgpt";
  },

  getKey(state) {
    const k = (state && state.ai && (state.ai.openaiKey || state.ai.apiKey)) || "";
    return String(k).trim();
  },

  hasKey(state) {
    const k = this.getKey(state);
    // sk-... и sk-proj-...
    return /^sk-[A-Za-z0-9_\-]{16,}$/.test(k);
  },

  model(state) {
    return (state && state.ai && state.ai.openaiModel) || this.DEFAULT_MODEL;
  },

  modelQueue(state) {
    const preferred = this.model(state);
    const rest = this.MODELS.filter((m) => m !== preferred);
    return [preferred].concat(rest);
  },

  modelLabel(state) {
    if (!this.hasKey(state)) return "ChatGPT · нужен API-ключ OpenAI";
    return "ChatGPT · " + this.model(state);
  },

  keyHint(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    if (k.length < 10) return k;
    return k.slice(0, 8) + "…" + k.slice(-4);
  },

  async ask(message, projectId, state) {
    if (!this.hasKey(state)) {
      throw new Error(
        "Нет ключа OpenAI. Вставь API key (sk-… / sk-proj-…) ниже. В РФ включи VPN."
      );
    }
    const history = Store.getChat(state, projectId).slice(-8);
    const userMsg = this.enrichUserMessage(message);
    const raw = await this.callOpenAI(userMsg, projectId, state, history);
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
      nextTasks: (ctx.nextTasks || []).slice(0, 4),
      notes: (ctx.notes || []).slice(0, 3),
      recommendations: (ctx.recommendations || []).slice(0, 3).map((r) => r.title + ": " + r.body),
      ip: ctx.ipRights
        ? { summary: ctx.ipRights.summary, costs: ctx.ipRights.costs, what: ctx.ipRights.what }
        : null,
    };
    return (
      "Ты бизнес-советник BigBossYan для основателя Яна. Отвечай по-русски: коротко, с анализом и конкретными советами. " +
      "Рассуждай, сравнивай варианты, указывай риски. Не копируй базу списком — дай вывод. " +
      "Контекст проекта: " +
      JSON.stringify(slim) +
      ' Ответ — JSON объект: {"reply":"текст человеку","patches":[]}. ' +
      "patches=[] по умолчанию; патч только если явно просят изменить план/цену."
    );
  },

  buildMessages(message, projectId, state, history) {
    const messages = [{ role: "system", content: this.buildSystemPrompt(projectId, state) }];
    for (const m of (history || []).slice(-6)) {
      if (!m || !m.text) continue;
      // не тащим старые ошибки в контекст модели
      if (m.role === "assistant" && /^Не получилось/i.test(String(m.text || ""))) continue;
      if (m.role === "user") messages.push({ role: "user", content: String(m.text).slice(0, 1000) });
      else if (m.role === "assistant") messages.push({ role: "assistant", content: String(m.text).slice(0, 1500) });
    }
    messages.push({ role: "user", content: String(message).slice(0, 1500) });
    return messages;
  },

  withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Таймаут " + Math.round(ms / 1000) + "с")), ms);
      promise.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        }
      );
    });
  },

  mapOpenAIError(status, data, raw) {
    const apiMsg = (data && data.error && data.error.message) || "";
    const code = (data && data.error && (data.error.code || data.error.type)) || "";
    const blob = (apiMsg + " " + code + " " + (raw || "")).toLowerCase();

    if (status === 401) return new Error("Неверный API-ключ OpenAI. Смени ключ (Сменить).");
    if (status === 403) {
      return new Error("Доступ запрещён. Включи VPN и проверь, что ключ не ограничен по IP/проекту.");
    }
    if (status === 429) {
      if (/insufficient_quota|billing|exceeded.*quota|payment/i.test(blob)) {
        return new Error(
          "На аккаунте OpenAI нет квоты/денег. Пополни Billing: platform.openai.com → Settings → Billing, подожди 1–2 мин и повтори."
        );
      }
      return new Error("Слишком много запросов (rate limit). Подожди 20–40 сек и повтори.");
    }
    if (status === 404 || /model_not_found|does not exist|invalid model/i.test(blob)) {
      return new Error("MODEL_404");
    }
    return new Error(apiMsg || "HTTP " + status);
  },

  async requestOnce(key, model, messages) {
    let res;
    try {
      res = await this.withTimeout(
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify({
            model,
            temperature: 0.55,
            messages,
            response_format: { type: "json_object" },
          }),
          cache: "no-store",
        }),
        this.timeoutMs
      );
    } catch (e) {
      const msg = String((e && e.message) || e || "");
      if (/Таймаут/i.test(msg)) throw e;
      throw new Error("Сеть до OpenAI не прошла. Включи VPN (api.openai.com) и повтори.");
    }

    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_) {}

    if (!res.ok) throw this.mapOpenAIError(res.status, data, raw);

    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    if (!content || !String(content).trim()) throw new Error("Пустой ответ ChatGPT");
    return { text: String(content).trim(), model };
  },

  async callOpenAI(message, projectId, state, history) {
    const messages = this.buildMessages(message, projectId, state, history);
    const key = this.getKey(state);
    const queue = this.modelQueue(state);
    let lastErr = null;

    for (const model of queue) {
      try {
        const out = await this.requestOnce(key, model, messages);
        // запоминаем рабочую модель
        if (state && state.ai && state.ai.openaiModel !== out.model) {
          state.ai.openaiModel = out.model;
        }
        return out.text;
      } catch (e) {
        lastErr = e;
        const msg = String((e && e.message) || e || "");
        // модель недоступна — пробуем следующую
        if (msg === "MODEL_404" || /MODEL_404|model_not_found|404/i.test(msg)) continue;
        // биллинг / ключ / сеть — сразу наружу
        throw e;
      }
    }

    throw (
      lastErr ||
      new Error(
        "Ни одна модель ChatGPT не ответила для этого ключа. В OpenAI Project проверь доступ к моделям или выбери gpt-3.5-turbo."
      )
    );
  },

  friendlyError(err) {
    const msg = String((err && err.message) || err || "");
    if (msg === "MODEL_404") {
      return "Модель недоступна для ключа. Выбери другую модель ниже или открой доступ в OpenAI Project.";
    }
    if (/ключ|API key|sk-/i.test(msg)) return msg;
    if (/VPN|api\.openai|Сеть до OpenAI|Billing|квот|rate limit|биллинг/i.test(msg)) return msg;
    if (/Таймаут/i.test(msg)) return msg + ". При VPN иногда дольше — повтори.";
    if (/Load failed|Failed to fetch|NetworkError/i.test(msg)) {
      return "Сеть оборвалась. Включи VPN и проверь api.openai.com.";
    }
    return msg.slice(0, 320);
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
