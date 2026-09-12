window.BossChat = {
  MIN_PRICE: 500,
  DEFAULT_MODEL: "gpt-4o-mini",
  timeoutMs: 60000,

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
    return /^sk-[A-Za-z0-9_\-]{20,}$/.test(k);
  },

  model(state) {
    return (state && state.ai && state.ai.openaiModel) || this.DEFAULT_MODEL;
  },

  modelLabel(state) {
    if (!this.hasKey(state)) return "ChatGPT · нужен API-ключ OpenAI";
    return "ChatGPT · " + this.model(state);
  },

  keyHint(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    if (k.length < 10) return k;
    return k.slice(0, 7) + "…" + k.slice(-4);
  },

  async ask(message, projectId, state) {
    if (!this.hasKey(state)) {
      throw new Error(
        "Нет ключа OpenAI. Вставь API key (sk-…) ниже. В РФ обычно нужен VPN до api.openai.com."
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
      ' Формат ответа — строго JSON без markdown: {"reply":"текст человеку","patches":[]}. ' +
      "patches=[] по умолчанию; патч только если явно просят изменить план/цену."
    );
  },

  buildMessages(message, projectId, state, history) {
    const messages = [{ role: "system", content: this.buildSystemPrompt(projectId, state) }];
    for (const m of (history || []).slice(-6)) {
      if (!m || !m.text) continue;
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

  async callOpenAI(message, projectId, state, history) {
    const messages = this.buildMessages(message, projectId, state, history);
    const key = this.getKey(state);
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
            model: this.model(state),
            temperature: 0.55,
            messages,
          }),
          cache: "no-store",
        }),
        this.timeoutMs
      );
    } catch (e) {
      const msg = String((e && e.message) || e || "");
      if (/Таймаут/i.test(msg)) throw e;
      throw new Error(
        "Сеть до OpenAI не прошла. Включи VPN (доступ к api.openai.com) и повтори."
      );
    }

    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_) {}

    if (!res.ok) {
      const errMsg =
        (data && data.error && data.error.message) || raw.slice(0, 180) || "HTTP " + res.status;
      if (res.status === 401) throw new Error("Неверный API-ключ OpenAI.");
      if (res.status === 429) throw new Error("Лимит OpenAI. Подожди немного или проверь биллинг.");
      if (res.status === 403) throw new Error("Доступ запрещён. Нужен VPN или доступ к api.openai.com.");
      throw new Error(errMsg);
    }

    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    if (!content || !String(content).trim()) throw new Error("Пустой ответ ChatGPT");
    return String(content).trim();
  },

  friendlyError(err) {
    const msg = String((err && err.message) || err || "");
    if (/ключ|API key|sk-/i.test(msg)) return msg;
    if (/VPN|api\.openai|Сеть до OpenAI/i.test(msg)) return msg;
    if (/Таймаут/i.test(msg)) return msg + ". При VPN иногда дольше — повтори.";
    if (/429|Лимит/i.test(msg)) return msg;
    if (/Load failed|Failed to fetch|NetworkError/i.test(msg)) {
      return "Сеть оборвалась. Включи VPN и проверь, что api.openai.com открывается.";
    }
    return msg.slice(0, 280);
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
