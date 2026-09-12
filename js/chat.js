window.BossChat = {
  parseLocal(message, projectId, state) {
    const text = String(message || "").trim();
    const lower = text.toLowerCase();
    const patches = [];
    let reply = "";

    const priceMatch = text.match(
      /(?:цен[уыае]|прайс|стоимость|пакет)\s*[«"]?([А-Яа-яA-Za-z0-9+.\-\s]{2,40})[»"]?\s*(?:на|→|=|поставь|сделай|измени|поменять|поменяй)?\s*(\d[\d\s]*)\s*(₽|руб(?:лей|ля)?)?/i
    );
    const priceMatch2 = text.match(
      /(?:поставь|измени|поменяй|сделай)\s+(?:цен[уыае]\s+)?[«"]?([А-Яа-яA-Za-z0-9+.\-\s]{2,30})[»"]?\s*(?:на|=)\s*(\d[\d\s]*)\s*(₽|руб)?/i
    );
    const m = priceMatch || priceMatch2;

    if (m) {
      const pkg = m[1].replace(/\s+/g, " ").trim();
      const num = m[2].replace(/\s+/g, "");
      const price = num + " ₽";
      const ctx = window.ProjectLive.contextForAi(projectId, state);
      const advice = this.priceAdvice(ctx, pkg, Number(num));
      patches.push({ op: "setPrice", projectId, package: this.normalizePackage(pkg, ctx), price });
      reply =
        advice +
        `\n\nГотово: в плане проекта обновляю пакет «${this.normalizePackage(pkg, ctx)}» на ${price}. Открой «Аналитика» — там уже новая цена.`;
      return { reply, patches };
    }

    if (/что\s+дальше|следующ|приоритет|с чего начать/.test(lower)) {
      const next = window.Store.nextTasks(projectId, state, 3);
      const p = window.ProjectLive.get(projectId, state);
      reply =
        `По «${p.name}» сейчас важнее всего:\n` +
        next.map((t, i) => `${i + 1}. ${t.title} (${t.phaseTitle})`).join("\n") +
        `\n\nВысокий приоритет из советов:\n` +
        p.recommendations
          .filter((r) => r.priority === "high")
          .slice(0, 2)
          .map((r) => `• ${r.title}: ${r.body}`)
          .join("\n");
      return { reply, patches };
    }

    if (/прогресс|сколько\s+сделано|процент/.test(lower)) {
      const prog = window.Store.progress(projectId, state);
      reply = `Прогресс «${window.ProjectLive.get(projectId, state).name}»: ${prog.pct}% (${prog.done} из ${prog.total} задач, с учётом веса).`;
      return { reply, patches };
    }

    if (/побед|успех|запомни/.test(lower)) {
      const winText = text.replace(/.*(победа|успех|запомни)[:\s-]*/i, "").trim() || text;
      patches.push({ op: "addWin", projectId, text: winText.slice(0, 160) });
      reply = "Записал в победы по текущему проекту.";
      return { reply, patches };
    }

    const p = window.ProjectLive.get(projectId, state);
    const hit = p.recommendations.find((r) =>
      lower.split(/\s+/).some((w) => w.length > 4 && (r.title + r.body).toLowerCase().includes(w))
    );
    if (hit) {
      reply = `${hit.title}\n\n${hit.body}\n\nЕсли нужно поменять цену в плане — напиши, например: «измени цену Стандарт на 12900».`;
      return { reply, patches };
    }

    reply =
      `Я локальный босс по «${p.name}». Могу:\n` +
      `• посоветовать следующий шаг («что дальше?»)\n` +
      `• разобрать и поменять цену («измени цену Стандарт на 12900»)\n` +
      `• записать победу («победа: первая оплата»)\n` +
      `• ответить глубже, если в Настройках чата включишь Gemini API-ключ.\n\n` +
      `Сейчас в прайсе: ` +
      p.analytics.pricing.map((x) => `${x.name} — ${x.price}`).join("; ") +
      `.`;
    return { reply, patches };
  },

  normalizePackage(pkg, ctx) {
    const names = (ctx.pricing || []).map((p) => p.name);
    const found = names.find((n) => n.toLowerCase().includes(pkg.toLowerCase()) || pkg.toLowerCase().includes(n.toLowerCase()));
    if (found) return found;
    const map = {
      стандарт: "Стандарт",
      штаб: "Штаб",
      год: "Живой год",
      коуч: "Коуч (позже)",
      точка: "Точка / мес",
      внедрение: "Внедрение",
      пилот: "Пилот",
      партнёр: "Партнёр",
      партнер: "Партнёр",
    };
    const key = Object.keys(map).find((k) => pkg.toLowerCase().includes(k));
    return key ? map[key] : pkg;
  },

  priceAdvice(ctx, pkg, num) {
    if (!num || Number.isNaN(num)) return "Цифру цены не разобрал.";
    const lines = [];
    if (ctx.projectId === "lifeRpg") {
      if (/стандарт/i.test(pkg)) {
        if (num < 4900) lines.push("Ниже ~5 тыс. ставит тебя рядом с курсом на Infоhit и обесценивает ручную сборку.");
        else if (num > 19900) lines.push("Выше ~20 тыс. без кейсов и сопровождения сложно закрывать холодным.");
        else if (num >= 9900 && num <= 12900) lines.push("Это сильный коридор: дорогое приложение / дешёвый месяц коуча. Ок.");
        else if (num < 9900) lines.push("Чуть ниже текущего якоря 9 900 — можно как акцию, но не как постоянный прайс, пока сборка ручная.");
        else lines.push("Между Стандартом и Штабом — нормально, если добавишь ощутимую ценность (разборы/созвоны).");
      } else if (/штаб/i.test(pkg)) {
        if (num < 15000) lines.push("Штаб не должен быть почти как Стандарт — иначе все возьмут дешёвый пакет.");
        else lines.push("Штаб = сопровождение. Цена должна чувствоваться как «месяц коуча в кармане».");
      }
    } else {
      if (/точк/i.test(pkg) || /подписк/i.test(pkg)) {
        if (num < 2900) lines.push("Слишком дёшево для B2B с внедрением — потом трудно поднимать.");
        else if (num > 7900) lines.push("Высоко для старта без кейса ROI — пилот может не закрыться.");
        else lines.push("Коридор 3 900–5 900 ₽/точка/мес — рабочий для сетей.");
      }
    }
    if (!lines.length) lines.push("Сравнил с текущим прайсом проекта и рыночной логикой плана — правку могу внести.");
    return lines.join(" ");
  },

  buildSystemPrompt(projectId, state) {
    const ctx = window.ProjectLive.contextForAi(projectId, state);
    const otherId = projectId === "lifeRpg" ? "trailOn" : "lifeRpg";
    const other = window.ProjectLive.contextForAi(otherId, state);
    return `Ты — бизнес-помощник BigBossYan для основателя Яна. Отвечай по-русски, коротко и по делу, премиальный тон без воды.

Текущий проект в фокусе:
${JSON.stringify(ctx, null, 2)}

Второй проект (для сравнения):
${JSON.stringify({ projectId: other.projectId, name: other.name, progressPct: other.progressPct, pricing: other.pricing }, null, 2)}

Правила:
1) Давай советы по монетизации, приоритетам, рискам.
2) Если пользователь хочет изменить данные плана (цены, формулировки) — сначала кратко разбери идею (выше/ниже/ок), затем верни патчи.
3) Ответ ВСЕГДА в JSON без markdown:
{"reply":"текст пользователю","patches":[...]}
4) Патчи:
- {"op":"setPrice","projectId":"lifeRpg|trailOn","package":"имя пакета","price":"12900 ₽","forWhom":"опционально"}
- {"op":"setField","projectId":"...","field":"oneLiner|tagline|position|stage|name|short","value":"..."}
- {"op":"setUnit","projectId":"...","label":"...","value":"...","note":"..."}
- {"op":"addWin","projectId":"...","text":"..."}
- {"op":"completeTask","projectId":"...","taskId":"..."}
5) Не выдумывай taskId. Не обещай юридические гарантии. patches может быть [].`;
  },

  async askGemini(message, projectId, state, settings) {
    const key = (settings && settings.geminiKey) || "";
    if (!key) throw new Error("NO_KEY");
    const model = (settings && settings.model) || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      systemInstruction: { parts: [{ text: this.buildSystemPrompt(projectId, state) }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err.slice(0, 240) || "Gemini error");
    }
    const data = await res.json();
    const raw =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.map((p) => p.text).join("");
    return this.parseModelJson(raw);
  },

  parseModelJson(raw) {
    let text = String(raw || "").trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    try {
      const obj = JSON.parse(text);
      return {
        reply: obj.reply || obj.message || text,
        patches: Array.isArray(obj.patches) ? obj.patches : [],
      };
    } catch {
      return { reply: text || "Не смог разобрать ответ модели.", patches: [] };
    }
  },

  async ask(message, projectId, state, settings) {
    const mode = (settings && settings.mode) || "local";
    if (mode === "gemini" && settings && settings.geminiKey) {
      try {
        return await this.askGemini(message, projectId, state, settings);
      } catch (e) {
        const local = this.parseLocal(message, projectId, state);
        return {
          reply:
            `Gemini недоступен (${String(e.message || e).slice(0, 120)}). Ответил локально:\n\n` +
            local.reply,
          patches: local.patches,
        };
      }
    }
    return this.parseLocal(message, projectId, state);
  },
};
