window.BossChat = {
  MIN_PRICE: 500,
  timeoutMs: 45000,

  // Проверенные бесплатные маршруты без API-ключей (Pollinations)
  FREE_MODELS: [
    {
      id: "auto",
      label: "Авто · перебор бесплатных",
      routes: ["fast", "openai", "oss", "legacy"],
    },
    {
      id: "fast",
      label: "GPT-OSS · быстро",
      routes: ["fast", "legacy"],
    },
    {
      id: "openai",
      label: "OpenAI-proxy · бесплатно",
      routes: ["openai", "legacy"],
    },
    {
      id: "oss",
      label: "GPT-OSS 20B",
      routes: ["oss", "fast"],
    },
    {
      id: "legacy",
      label: "Классика · запасной канал",
      routes: ["legacy", "fast"],
    },
  ],

  ROUTES: {
    fast: {
      url: "https://text.pollinations.ai/v1/chat/completions",
      model: "openai-fast",
    },
    openai: {
      url: "https://text.pollinations.ai/v1/chat/completions",
      model: "openai",
    },
    oss: {
      url: "https://text.pollinations.ai/v1/chat/completions",
      model: "gpt-oss",
    },
    legacy: {
      url: "https://text.pollinations.ai/",
      model: "openai",
      legacy: true,
    },
  },

  provider() {
    return "free";
  },

  mode() {
    return "free";
  },

  hasKey() {
    return true;
  },

  selectedId(state) {
    const id = state && state.ai && state.ai.freeModel;
    if (this.FREE_MODELS.some((m) => m.id === id)) return id;
    return "auto";
  },

  selected(state) {
    const id = this.selectedId(state);
    return this.FREE_MODELS.find((m) => m.id === id) || this.FREE_MODELS[0];
  },

  modelLabel(state) {
    return "Бесплатно · " + this.selected(state).label;
  },

  async ask(message, projectId, state) {
    const history = Store.getChat(state, projectId).slice(-6);
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
    return String(message).trim() + "\n[Цены в контексте — факт. Предложи другие цифры. patches=[].]";
  },

  buildSystemPrompt(projectId, state, slim) {
    const ctx = slim || this.slimContext(projectId, state);
    return (
      "Ты бизнес-советник BigBossYan для Яна. По-русски, коротко, с анализом и советом. " +
      "Контекст: " +
      JSON.stringify(ctx) +
      ' Ответ строго JSON: {"reply":"текст","patches":[]}. patches=[] если не просят менять план/цену.'
    );
  },

  slimContext(projectId, state, tiny) {
    const ctx = window.ProjectLive.contextForAi(projectId, state);
    if (tiny) {
      return {
        name: ctx.name,
        stage: ctx.stage,
        pct: ctx.progressPct,
        pricing: (ctx.pricing || []).slice(0, 3),
        next: (ctx.nextTasks || []).slice(0, 2).map((t) => t.title),
      };
    }
    return {
      name: ctx.name,
      stage: ctx.stage,
      progressPct: ctx.progressPct,
      pricing: ctx.pricing,
      nextTasks: (ctx.nextTasks || []).slice(0, 3).map((t) => t.title),
      recs: (ctx.recommendations || []).slice(0, 2).map((r) => r.title),
      ip: ctx.ipRights ? String(ctx.ipRights.summary || "").slice(0, 220) : null,
    };
  },

  buildMessages(message, projectId, state, history, tiny) {
    const messages = [
      { role: "system", content: this.buildSystemPrompt(projectId, state, this.slimContext(projectId, state, tiny)) },
    ];
    for (const m of (history || []).slice(tiny ? -2 : -4)) {
      if (!m || !m.text) continue;
      if (m.role === "assistant" && /^Не получилось/i.test(String(m.text || ""))) continue;
      if (m.role === "user") messages.push({ role: "user", content: String(m.text).slice(0, tiny ? 400 : 700) });
      else if (m.role === "assistant")
        messages.push({ role: "assistant", content: String(m.text).slice(0, tiny ? 500 : 900) });
    }
    messages.push({ role: "user", content: String(message).slice(0, tiny ? 500 : 900) });
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

  async callFree(message, projectId, state, history) {
    const sel = this.selected(state);
    const routeIds = sel.routes || ["fast", "openai", "legacy"];
    let lastErr = null;

    // полный контекст → урезанный при 402
    for (const tiny of [false, true]) {
      const messages = this.buildMessages(message, projectId, state, history, tiny);
      for (const rid of routeIds) {
        const route = this.ROUTES[rid];
        if (!route) continue;
        try {
          const text = await this.withTimeout(this.fetchRoute(route, messages), this.timeoutMs);
          if (text && String(text).trim()) {
            if (state && state.ai) state.ai.lastFreeRoute = rid;
            return String(text).trim();
          }
        } catch (e) {
          lastErr = e;
          const msg = String((e && e.message) || e || "");
          if (/402|quota|Payment|UNAUTHORIZED|401/i.test(msg)) continue;
          if (/404|model/i.test(msg)) continue;
          continue;
        }
      }
    }

    throw (
      lastErr ||
      new Error("Бесплатные модели сейчас перегружены. Подожди минуту или переключи модель.")
    );
  },

  async fetchRoute(route, messages) {
    const bodyObj = route.legacy
      ? { model: route.model, messages, temperature: 0.55 }
      : { model: route.model, messages, temperature: 0.55 };

    let res;
    try {
      res = await fetch(route.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
        },
        body: JSON.stringify(bodyObj),
        cache: "no-store",
      });
    } catch (e) {
      throw new Error("Сеть: не удалось связаться с бесплатной нейросетью");
    }

    const raw = await res.text();
    if (res.status === 402) throw new Error("402");
    if (res.status === 401) throw new Error("401");
    if (!res.ok) throw new Error("HTTP " + res.status);

    if (!raw || !String(raw).trim()) throw new Error("Пустой ответ");

    try {
      const obj = JSON.parse(raw);
      const choice = obj.choices && obj.choices[0] && obj.choices[0].message && obj.choices[0].message.content;
      if (choice) return String(choice);
      if (obj.reply) return String(obj.reply);
      if (typeof obj === "string") return obj;
    } catch (_) {}

    return raw;
  },

  friendlyError(err) {
    const msg = String((err && err.message) || err || "");
    if (/402|quota|Payment|перегруж/i.test(msg)) {
      return "Бесплатный лимит на сейчас. Подожди 30–60 сек или выбери другую модель сверху.";
    }
    if (/401|UNAUTHORIZED/i.test(msg)) {
      return "Этот бесплатный маршрут сейчас закрыт. Переключи модель (Авто / GPT-OSS).";
    }
    if (/Таймаут/i.test(msg)) return msg + ". Повтори — бесплатные модели иногда тормозят.";
    if (/Сеть|Load failed|Failed to fetch|NetworkError/i.test(msg)) {
      return "Сеть оборвалась. Проверь интернет и повтори.";
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
