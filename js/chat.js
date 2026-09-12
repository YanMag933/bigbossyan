window.BossChat = {
  MIN_PRICE: 500,

  FREE: {
    label: "Нейросеть · анализ и советы",
    models: ["openai", "mistral", "gemini"],
    timeoutMs: 45000,
  },

  provider() {
    return "main";
  },

  mode() {
    return "neural";
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
    const raw = await this.callNeural(userMsg, projectId, state, history);
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
      "Ты бизнес-советник BigBossYan для основателя Яна. Отвечай по-русски: анализ, приоритеты, жёсткие советы. " +
      "Не будь поисковиком по базе — рассуждай, сравнивай варианты, предупреждай о рисках. " +
      "Контекст проекта: " +
      JSON.stringify(slim) +
      ' Формат ответа — строго JSON без markdown: {"reply":"текст человеку","patches":[]}. ' +
      "patches=[] по умолчанию; патч только если явно просят изменить план/цену."
    );
  },

  buildPrompt(message, projectId, state, history) {
    const parts = [this.buildSystemPrompt(projectId, state), ""];
    for (const m of (history || []).slice(-4)) {
      if (!m || !m.text) continue;
      if (m.role === "user") parts.push("User: " + String(m.text).slice(0, 500));
      else if (m.role === "assistant") parts.push("Assistant: " + String(m.text).slice(0, 700));
    }
    parts.push("User: " + String(message).slice(0, 1000));
    parts.push('Assistant JSON: {"reply":');
    return parts.join("\n");
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

  async callNeural(message, projectId, state, history) {
    const messages = this.buildMessages(message, projectId, state, history);
    let lastErr = null;

    for (const model of this.FREE.models) {
      try {
        const text = await this.withTimeout(this.fetchPollinations(messages, model), this.FREE.timeoutMs);
        if (text && text.trim()) return text.trim();
        throw new Error("Пустой ответ модели");
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    throw lastErr || new Error("Нейросеть сейчас недоступна");
  },

  buildMessages(message, projectId, state, history) {
    const messages = [{ role: "system", content: this.buildSystemPrompt(projectId, state) }];
    for (const m of (history || []).slice(-4)) {
      if (!m || !m.text) continue;
      if (m.role === "user") messages.push({ role: "user", content: String(m.text).slice(0, 800) });
      else if (m.role === "assistant") messages.push({ role: "assistant", content: String(m.text).slice(0, 1200) });
    }
    messages.push({ role: "user", content: String(message).slice(0, 1200) });
    return messages;
  },

  async fetchPollinations(messages, model) {
    const body = JSON.stringify({
      messages,
      model: model || "openai",
      temperature: 0.55,
    });

    let res;
    try {
      res = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
      });
    } catch (e) {
      throw new Error("Сеть: не удалось связаться с нейросетью");
    }

    if (res.status === 402) throw new Error("402");
    if (!res.ok) throw new Error("HTTP " + res.status);

    const text = await res.text();
    if (!text || !String(text).trim()) throw new Error("Пустой ответ");

    // Иногда OpenAI-формат JSON
    try {
      const obj = JSON.parse(text);
      const choice = obj.choices && obj.choices[0] && obj.choices[0].message && obj.choices[0].message.content;
      if (choice) return String(choice);
      if (obj.reply) return String(obj.reply);
    } catch (_) {}

    return text;
  },

  friendlyError(err) {
    const msg = String((err && err.message) || err || "");
    if (/Таймаут/i.test(msg)) return msg + ". Попробуй ещё раз — модель иногда отвечает дольше.";
    if (/402|Payment|quota/i.test(msg)) return "Лимит бесплатной нейросети на сейчас. Подожди минуту и повтори.";
    if (/Load failed|Failed to fetch|NetworkError|Сеть/i.test(msg)) {
      return "Сеть оборвала запрос к нейросети. Проверь интернет и повтори.";
    }
    return msg.slice(0, 260);
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
      // модель иногда отвечает текстом без JSON
      const cleaned = text.replace(/^Assistant JSON:\s*/i, "").trim();
      return { reply: cleaned || "Не разобрал ответ модели.", patches: [] };
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
