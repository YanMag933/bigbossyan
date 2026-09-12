window.BossChat = {
  MIN_PRICE: 500,

  FREE: {
    label: "Puter AI · бесплатно",
    models: ["gpt-5-nano", "gpt-4.1-nano", "claude-haiku-4.5", "gemini-2.5-flash"],
    timeoutMs: 35000,
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
    const raw = await this.callPuter(userMsg, projectId, state, history);
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
      notes: (ctx.notes || []).slice(0, 4),
    };
    return (
      "Ты бизнес-советник BigBossYan для основателя Яна. Отвечай по-русски, коротко и по делу. " +
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
      if (m.role === "user") messages.push({ role: "user", content: String(m.text).slice(0, 800) });
      else if (m.role === "assistant") messages.push({ role: "assistant", content: String(m.text).slice(0, 1200) });
    }
    messages.push({ role: "user", content: String(message).slice(0, 1200) });
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

  ensurePuter() {
    if (typeof window.puter === "undefined" || !window.puter.ai || !window.puter.ai.chat) {
      throw new Error(
        "Puter AI не загрузился. Проверь интернет / блокировщик рекламы и обнови через reset.html"
      );
    }
  },

  extractPuterText(res) {
    if (res == null) return "";
    if (typeof res === "string") return res;
    if (typeof res === "number" || typeof res === "boolean") return String(res);
    if (res.message) {
      if (typeof res.message === "string") return res.message;
      if (typeof res.message.content === "string") return res.message.content;
      if (Array.isArray(res.message.content)) {
        return res.message.content
          .map((p) => (typeof p === "string" ? p : p && (p.text || p.content) || ""))
          .join("");
      }
    }
    if (typeof res.content === "string") return res.content;
    if (typeof res.text === "string") return res.text;
    if (typeof res.toString === "function") {
      const s = res.toString();
      if (s && s !== "[object Object]") return s;
    }
    try {
      return JSON.stringify(res);
    } catch (_) {
      return "";
    }
  },

  async callPuter(message, projectId, state, history) {
    this.ensurePuter();
    const messages = this.buildMessages(message, projectId, state, history);
    let lastErr = null;

    for (const model of this.FREE.models) {
      try {
        const res = await this.withTimeout(
          window.puter.ai.chat(messages, { model, temperature: 0.55 }),
          this.FREE.timeoutMs
        );
        const text = this.extractPuterText(res).trim();
        if (!text) throw new Error("Пустой ответ Puter");
        return text;
      } catch (e) {
        lastErr = e;
        const msg = String((e && e.message) || e || "");
        // auth / popup cancelled — сразу понятная ошибка
        if (/auth|login|sign.?in|cancelled|denied|permission/i.test(msg)) {
          throw new Error(
            "Нужен бесплатный вход в Puter (откроется окно). Войди и отправь сообщение ещё раз."
          );
        }
        continue;
      }
    }

    throw lastErr || new Error("Puter AI недоступен сейчас");
  },

  friendlyError(err) {
    const msg = String((err && err.message) || err || "");
    if (/Puter AI не загрузился/i.test(msg)) return msg;
    if (/вход в Puter|auth|login|sign.?in/i.test(msg)) return msg;
    if (/Таймаут/i.test(msg)) return msg + ". Попробуй ещё раз — иногда Puter отвечает дольше.";
    if (/Load failed|Failed to fetch|NetworkError|network/i.test(msg)) {
      return "Сеть оборвала запрос к Puter. Проверь интернет и повтори.";
    }
    if (/402|Payment|quota|credit/i.test(msg)) {
      return "Лимит бесплатного Puter на сейчас. Подожди немного или войди в аккаунт Puter.";
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
