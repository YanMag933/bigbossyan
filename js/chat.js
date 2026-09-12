window.BossChat = {
  MIN_PRICE: 500,
  _state: null,

  FREE: {
    label: "Вшитый советник · без регистрации",
  },

  provider() {
    return "main";
  },

  mode() {
    return "local";
  },

  hasKey() {
    return true;
  },

  modelLabel() {
    return this.FREE.label;
  },

  async ask(message, projectId, state) {
    this._state = state;
    const userMsg = this.enrichUserMessage(message);
    const result = this.advise(userMsg, projectId, state);
    result.patches = this.sanitizePatches(result.patches || [], projectId, message);
    return result;
  },

  isPriceAdviceQuestion(message) {
    const lower = String(message || "").toLowerCase();
    return /вариант\w*\s+цен|цен\w*\s+вариант|предложи.*цен|пересмотр.*цен|альтернатив\w*\s+цен|дешевле|дороже/.test(
      lower
    );
  },

  enrichUserMessage(message) {
    if (!this.isPriceAdviceQuestion(message)) return message;
    return String(message).trim();
  },

  ctx(projectId, state) {
    return window.ProjectLive.contextForAi(projectId, state);
  },

  live(projectId, state) {
    return window.ProjectLive.get(projectId, state || this._state);
  },

  advise(message, projectId, state) {
    const text = String(message || "").trim();
    const lower = text.toLowerCase().replace(/ё/g, "е");
    const c = this.ctx(projectId, state);
    const patches = [];

    if (this.wantsMutation(text)) {
      const mut = this.tryMutationAdvice(text, projectId, c);
      if (mut) return mut;
    }

    if (/что\s+делать|следующ|приоритет|первым|с\s+чего\s+начать|план\s+на|фокус/.test(lower)) {
      return { reply: this.replyNext(c), patches };
    }
    if (/прогресс|сколько\s+сделан|процент|как\s+идем|как\s+идём/.test(lower)) {
      return { reply: this.replyProgress(c), patches };
    }
    if (/цен|прайс|тариф|пакет|сколько\s+стоит|чеки/.test(lower)) {
      if (this.isPriceAdviceQuestion(text)) return { reply: this.replyPriceVariants(c), patches: [] };
      return { reply: this.replyPricing(c), patches };
    }
    if (/юнит|марж|экономик/.test(lower)) {
      return { reply: this.replyUnit(c), patches };
    }
    if (/воронк|конверс/.test(lower)) {
      return { reply: this.replyFunnel(projectId, state), patches };
    }
    if (/сценар|капитал|инвест|деньг\w*\s+нужн|раунд/.test(lower)) {
      return { reply: this.replyScenarios(projectId, state), patches };
    }
    if (/swot|силн|слаб|угроз|риск|возможност/.test(lower)) {
      return { reply: this.replySwot(projectId, state, lower), patches };
    }
    if (/рекоменд|совет|не\s+лезь|позицион/.test(lower)) {
      return { reply: this.replyRecs(c), patches };
    }
    if (/портрет|персон|аудитор|кому\s+прода/.test(lower)) {
      return { reply: this.replyPersonas(projectId, state), patches };
    }
    if (/питч|о\s+проекте|суть|one.?liner|позици|слоган|расскажи/.test(lower)) {
      return { reply: this.replyPitch(c), patches };
    }
    if (/побед|успех|что\s+уже/.test(lower)) {
      return { reply: this.replyWins(c), patches };
    }
    if (/заметк/.test(lower)) {
      return { reply: this.replyNotes(c), patches };
    }
    if (/документ|ворд|docx|меморандум|кп\b/.test(lower)) {
      return { reply: this.replyDocs(projectId, state), patches };
    }
    if (/сравни|vs|против|лучше/.test(lower)) {
      return { reply: this.replyCompare(c), patches };
    }

    return { reply: this.replyGeneral(c, text), patches };
  },

  tryMutationAdvice(text, projectId, c) {
    const n = Number(String(text).replace(/[^\d]/g, ""));
    const priceHint = /цен|прайс|тариф|пакет/.test(text.toLowerCase());
    if (priceHint && Number.isFinite(n) && n >= this.MIN_PRICE) {
      const lower = text.toLowerCase();
      const pkg =
        (c.pricing || []).find((p) => lower.includes(String(p.name).toLowerCase().slice(0, 4))) ||
        (c.pricing || [])[0];
      if (!pkg) return null;
      const price = n.toLocaleString("ru-RU") + " ₽";
      return {
        reply: `Ок, зафиксирую в плане: «${pkg.name}» → ${price}.\nБыло: ${pkg.price}. Проверь на вкладке Аналитика.`,
        patches: [{ op: "setPrice", projectId, package: pkg.name, price, forWhom: pkg.forWhom || "" }],
      };
    }
    return null;
  },

  replyNext(c) {
    const tasks = c.nextTasks || [];
    const rec = (c.recommendations || []).slice(0, 2);
    const lines = [`${c.name}: прогресс ${c.progressPct}%. Стадия — ${c.stage}.`, "", "Сейчас важнее всего:"];
    if (tasks.length) tasks.slice(0, 4).forEach((t, i) => lines.push(`${i + 1}. ${t.title} (${t.phase})`));
    else lines.push("Открытых задач в плане нет — обнови фазы или зафиксируй победу.");
    if (rec.length) {
      lines.push("", "Держи в голове:");
      rec.forEach((r) => lines.push(`• ${r.title}: ${r.body}`));
    }
    lines.push("", "Не распыляйся: один приоритет на неделю, остальное в очередь.");
    return lines.join("\n");
  },

  replyProgress(c) {
    return [
      `${c.name}: ${c.progressPct}% плана (${c.tasksDone}/${c.tasksTotal}).`,
      `Стадия: ${c.stage}.`,
      (c.nextTasks || [])[0] ? `Следующий шаг: ${c.nextTasks[0].title}.` : "Очередь задач пуста.",
      (c.recentWins || []).length
        ? "Недавние победы:\n" + c.recentWins.slice(0, 3).map((w) => `• ${w}`).join("\n")
        : "Побед пока мало — отмечай даже мелкие, это топливо.",
    ].join("\n");
  },

  replyPricing(c) {
    const rows = c.pricing || [];
    return [
      `Прайс «${c.name}» (факт из плана):`,
      ...rows.map((r) => `• ${r.name}: ${r.price}${r.forWhom ? " — " + r.forWhom : ""}`),
      "",
      "Поменять цифру лучше в чате «Проект» с подтверждением.",
      "Другие варианты цен: спроси «предложи варианты цен».",
    ].join("\n");
  },

  replyPriceVariants(c) {
    const rows = c.pricing || [];
    const base = rows[0];
    const n = Number(String((base && base.price) || "9900").replace(/[^\d]/g, "")) || 9900;
    const soft = Math.round(n * 0.8);
    const premium = Math.round(n * 1.25);
    return [
      "Варианты пересмотра (гипотезы, не текущий прайс):",
      `• Мягкий вход: ~${soft.toLocaleString("ru-RU")} ₽ — быстрее первые оплаты.`,
      `• База как сейчас: ~${n.toLocaleString("ru-RU")} ₽ — если конверсия живая.`,
      `• Премиум: ~${premium.toLocaleString("ru-RU")} ₽ — только с сопровождением/результатом.`,
      "",
      "Не режь цену без гипотезы. Сначала разговоры/анкеты — потом цифра.",
    ].join("\n");
  },

  replyUnit(c) {
    return ["Юнит / экономика:", ...(c.unit || []).map((r) => `• ${r.label}: ${r.value}${r.note ? " · " + r.note : ""}`)].join(
      "\n"
    );
  },

  replyFunnel(projectId, state) {
    const funnel = (this.live(projectId, state).analytics || {}).funnel || [];
    if (!funnel.length) return "Воронка в данных проекта пуста.";
    return ["Воронка (модель):", ...funnel.map((x) => `• ${x.step}: ${x.n}`), "", "Ищи узкое горло — где сильнее отвал."].join(
      "\n"
    );
  },

  replyScenarios(projectId, state) {
    const rows = (this.live(projectId, state).analytics || {}).scenarios || [];
    return [
      "Сценарии капитала:",
      ...rows.map((s) => `• ${s.name}: ${s.capital} → ${s.year1}. Фокус: ${s.focus}`),
      "",
      "Пока нет оплат — сценарий A. Капитал «на идею» не проси.",
    ].join("\n");
  },

  replySwot(projectId, state, lower) {
    const sw = this.live(projectId, state).swot || {};
    const pick = (arr, n) => (arr || []).slice(0, n).map((x) => `• ${x}`);
    if (/угроз|риск/.test(lower)) return ["Угрозы:", ...pick(sw.threats, 6)].join("\n");
    if (/слаб/.test(lower)) return ["Слабые стороны:", ...pick(sw.weaknesses, 6)].join("\n");
    if (/силн/.test(lower)) return ["Сильные стороны:", ...pick(sw.strengths, 6)].join("\n");
    if (/возможност/.test(lower)) return ["Возможности:", ...pick(sw.opportunities, 6)].join("\n");
    return [
      "SWOT коротко:",
      "Сильные:",
      ...pick(sw.strengths, 3),
      "Слабые:",
      ...pick(sw.weaknesses, 3),
      "Возможности:",
      ...pick(sw.opportunities, 2),
      "Угрозы:",
      ...pick(sw.threats, 2),
    ].join("\n");
  },

  replyRecs(c) {
    return [
      "Рекомендации из штаба:",
      ...(c.recommendations || []).map((r) => `• [${r.priority || "mid"}] ${r.title}: ${r.body}`),
    ].join("\n");
  },

  replyPersonas(projectId, state) {
    const rows = (this.live(projectId, state).analytics || {}).personas || [];
    return ["Портреты:", ...rows.map((x) => `• ${x.name}: ${x.text}`)].join("\n");
  },

  replyPitch(c) {
    return [
      c.name + (c.short ? ` (${c.short})` : ""),
      c.tagline,
      "",
      c.oneLiner,
      "",
      "Позиция:",
      c.position,
      "",
      `Стадия: ${c.stage}. Прогресс плана: ${c.progressPct}%.`,
    ].join("\n");
  },

  replyWins(c) {
    const wins = c.recentWins || [];
    if (!wins.length) return "Побед в штабе пока нет. Запиши первую на главной — даже мелкую.";
    return ["Победы:", ...wins.map((w) => `• ${w}`)].join("\n");
  },

  replyNotes(c) {
    const notes = c.notes || [];
    if (!notes.length) return "Заметок нет. Открой Штаб → Заметки.";
    return ["Последние заметки:", ...notes.map((n) => `• ${n.title}: ${String(n.body || "").slice(0, 160)}`)].join("\n");
  },

  replyDocs(projectId, state) {
    const list = window.Store.docsList(state, projectId);
    if (!list.length) {
      return "В базе ещё нет сохранённых Word. Сгенерируй на вкладке «Док» — текст попадёт в поиск.";
    }
    return [
      `Документов в базе: ${list.length}.`,
      ...list.slice(0, 8).map((d) => `• ${d.title} (${d.audience || "—"})`),
      "",
      "Детали ищи в режиме «Проект».",
    ].join("\n");
  },

  replyCompare(c) {
    const rows = c.pricing || [];
    if (rows.length < 2) return this.replyPricing(c);
    return [
      "Сравнение пакетов:",
      ...rows.map((r) => `• ${r.name} — ${r.price}${r.forWhom ? " · " + r.forWhom : ""}`),
      "",
      "Верхний чек — кому дороже время. Нижний — для скорости первых оплат.",
    ].join("\n");
  },

  replyGeneral(c, text) {
    const tasks = (c.nextTasks || []).slice(0, 2);
    const rec = (c.recommendations || [])[0];
    return [
      `Вшитый советник BigBossYan по «${c.name}» — всё внутри приложения, без регистрации.`,
      "",
      `Сейчас: ${c.stage}, план ${c.progressPct}%.`,
      tasks.length ? `Ближайшее: ${tasks.map((t) => t.title).join("; ")}.` : "",
      rec ? `Опора: ${rec.title} — ${rec.body}` : "",
      "",
      "Спроси: «что делать», «цены», «риски», «сценарии», «питч», «воронка», «документы».",
      text.length > 80 ? "Свободный поиск по Word и цифрам — в чате «Проект»." : "",
    ]
      .filter(Boolean)
      .join("\n");
  },

  friendlyError(err) {
    return String((err && err.message) || err || "Ошибка советника").slice(0, 260);
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
