window.BossChat = {
  MIN_PRICE: 500,
  timeoutMs: 35000,

  FREE_MODELS: [
    {
      id: "auto",
      label: "Авто · перебор бесплатных",
      routes: ["openaiCompat", "fast", "openai", "oss", "legacy", "get"],
    },
    {
      id: "fast",
      label: "GPT-OSS · быстро",
      routes: ["fast", "openaiCompat", "get", "legacy"],
    },
    {
      id: "openai",
      label: "OpenAI-proxy · бесплатно",
      routes: ["openaiCompat", "openai", "legacy", "get"],
    },
    {
      id: "oss",
      label: "GPT-OSS 20B",
      routes: ["oss", "fast", "get"],
    },
    {
      id: "legacy",
      label: "Классика · запасной канал",
      routes: ["legacy", "get", "openaiCompat"],
    },
  ],

  ROUTES: {
    openaiCompat: {
      url: "https://text.pollinations.ai/openai",
      model: "openai-fast",
    },
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
    get: {
      url: "https://text.pollinations.ai/",
      model: "openai-fast",
      get: true,
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
    const history = Store.getChat(state, projectId).slice(-4);
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
    return String(message).trim() + "\n[Цены в контексте — факт. Предложи другие цифры.]";
  },

  buildSystemPrompt(projectId, state, slim) {
    const ctx = slim || this.slimContext(projectId, state);
    return (
      "Ты бизнес-советник BigBossYan для Яна. Отвечай по-русски коротко: анализ + совет. " +
      "Контекст проекта: " +
      JSON.stringify(ctx) +
      " Ответь обычным текстом. Не выдумывай факты вне контекста."
    );
  },

  slimContext(projectId, state, tiny) {
    const ctx = window.ProjectLive.contextForAi(projectId, state);
    if (tiny) {
      return {
        name: ctx.name,
        stage: ctx.stage,
        pct: ctx.progressPct,
        pricing: (ctx.pricing || []).slice(0, 2).map((r) => r.name + ": " + r.price),
        next: (ctx.nextTasks || []).slice(0, 2).map((t) => t.title),
      };
    }
    return {
      name: ctx.name,
      stage: ctx.stage,
      progressPct: ctx.progressPct,
      pricing: (ctx.pricing || []).slice(0, 4),
      nextTasks: (ctx.nextTasks || []).slice(0, 3).map((t) => t.title),
      recs: (ctx.recommendations || []).slice(0, 2).map((r) => r.title),
    };
  },

  buildMessages(message, projectId, state, history, tiny) {
    const messages = [
      { role: "system", content: this.buildSystemPrompt(projectId, state, this.slimContext(projectId, state, tiny)) },
    ];
    for (const m of (history || []).slice(tiny ? -1 : -2)) {
      if (!m || !m.text) continue;
      if (m.role === "assistant" && /^Не получилось/i.test(String(m.text || ""))) continue;
      if (m.role === "user") messages.push({ role: "user", content: String(m.text).slice(0, tiny ? 280 : 500) });
      else if (m.role === "assistant")
        messages.push({ role: "assistant", content: String(m.text).slice(0, tiny ? 320 : 600) });
    }
    messages.push({ role: "user", content: String(message).slice(0, tiny ? 400 : 700) });
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
    const routeIds = sel.routes || ["openaiCompat", "fast", "legacy", "get"];
    let lastErr = null;

    // сначала короткий контекст (меньше 402), потом полный
    for (const tiny of [true, false]) {
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
        }
      }
    }

    throw (
      lastErr ||
      new Error("Бесплатные модели сейчас перегружены. Подожди минуту или переключи модель.")
    );
  },

  flattenPrompt(messages) {
    return (messages || [])
      .map((m) => (m.role === "system" ? "Система: " : m.role === "assistant" ? "Ассистент: " : "Ян: ") + m.content)
      .join("\n")
      .slice(0, 1400);
  },

  async fetchRoute(route, messages) {
    if (route.get) {
      const prompt = this.flattenPrompt(messages);
      const url =
        "https://text.pollinations.ai/" +
        encodeURIComponent(prompt) +
        "?model=" +
        encodeURIComponent(route.model || "openai-fast") +
        "&seed=" +
        Math.floor(Math.random() * 100000);
      let res;
      try {
        res = await fetch(url, {
          method: "GET",
          headers: { Accept: "text/plain, application/json, */*" },
          cache: "no-store",
          mode: "cors",
          credentials: "omit",
        });
      } catch (e) {
        throw new Error("Сеть: не удалось связаться с бесплатной нейросетью");
      }
      const raw = await res.text();
      if (res.status === 402) throw new Error("402");
      if (res.status === 401) throw new Error("401");
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (!raw || !String(raw).trim()) throw new Error("Пустой ответ");
      return raw;
    }

    const bodyObj = {
      model: route.model,
      messages,
      temperature: 0.55,
    };

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
        mode: "cors",
        credentials: "omit",
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
    if (/Сеть|Load failed|Failed to fetch|NetworkError|связаться/i.test(msg)) {
      return "Связь с бесплатной нейросетью оборвалась. Проверь интернет/VPN, подожди минуту и нажми снова. Режим «Авто» перебирает запасные каналы.";
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
