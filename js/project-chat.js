window.BossProjectChat = {
  STOP: new Set(
    "а и или но что как это тот та те в во на по за из у к ко от до для без про при о об обо же ли бы не ни да нет мне мой моя моё мои тебе ваш ваша ещё еще уже только просто скажи покажи найди дай выведи".split(
      " "
    )
  ),

  MUTATE_RE:
    /\b(измени|изменить|поставь|поставить|сделай|сделать|обнови|обновить|смени|сменить|замени|заменить|поправь|поправить|запиши|отметь|отметить|закрой|закрыть|примени|применить)\b/i,

  CONFIRM_RE: /^(да|ок|окей|хорошо|подтверждаю|примени|применить|согласен|согласна|yes|y)\b/i,
  REJECT_RE: /^(нет|отмена|отменить|отклони|отклонить|не надо|cancel|no)\b/i,

  ask(message, projectId, state) {
    const text = String(message || "").trim();
    if (!text) return { reply: "Пустой запрос.", patches: null };

    // Актуальные тексты Word перед поиском/правкой
    if (window.BossDocs && typeof window.BossDocs.syncArchive === "function") {
      window.BossDocs.syncArchive(state, projectId);
    }

    const pending = this.findPending(state, projectId);
    if (pending) {
      if (this.CONFIRM_RE.test(text)) {
        return {
          reply: "Применяю правку.",
          patches: pending.pendingPatches,
          confirmPendingId: pending.at,
        };
      }
      if (this.REJECT_RE.test(text)) {
        return {
          reply: "Ок, правку не применяю.",
          patches: null,
          rejectPendingId: pending.at,
        };
      }
    }

    if (this.MUTATE_RE.test(text)) {
      const proposal = this.parseMutation(text, projectId, state);
      if (proposal) return proposal;
      return {
        reply:
          "Похоже, хочешь что-то изменить, но не разобрал запрос.\n\nПримеры:\n• измени цену Стандарта на 10900\n• поставь стадию MVP live\n• отметь задачу «лендинг»",
        patches: null,
      };
    }

    return this.search(text, projectId, state);
  },

  findPending(state, projectId) {
    const thread = window.Store.getProjectChat(state, projectId);
    for (let i = thread.length - 1; i >= 0; i--) {
      const m = thread[i];
      if (m && m.role === "assistant" && m.pendingPatches && m.pendingPatches.length && !m.applied && !m.rejected) {
        return m;
      }
    }
    return null;
  },

  tokens(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .split(/[^a-zа-я0-9+]+/i)
      .filter((t) => t && t.length > 1 && !this.STOP.has(t));
  },

  score(hay, toks) {
    const h = String(hay || "")
      .toLowerCase()
      .replace(/ё/g, "е");
    if (!h || !toks.length) return 0;
    let s = 0;
    for (const t of toks) {
      if (h.includes(t)) s += t.length >= 4 ? 3 : 2;
    }
    return s;
  },

  index(projectId, state) {
    const p = window.ProjectLive.get(projectId, state);
    if (!p) return [];
    const items = [];
    const push = (topic, title, body, extra) => {
      items.push({ topic, title, body: String(body || ""), ...(extra || {}) });
    };

    push("project", "Проект", `${p.name} · ${p.short}\n${p.stage}\n${p.tagline}\n${p.oneLiner}\n${p.position}`);
    push("stage", "Стадия", p.stage);
    push("tagline", "Слоган", p.tagline);
    push("oneLiner", "One-liner", p.oneLiner);
    push("position", "Позиция", p.position);

    (p.analytics.pricing || []).forEach((row) => {
      push("pricing", `Цена · ${row.name}`, `${row.price}${row.forWhom ? " — " + row.forWhom : ""}`, {
        package: row.name,
        price: row.price,
      });
    });
    (p.analytics.unit || []).forEach((row) => {
      push("unit", `Юнит · ${row.label}`, `${row.value}${row.note ? " · " + row.note : ""}`, {
        label: row.label,
        value: row.value,
      });
    });
    (p.analytics.market || []).forEach((row) => {
      push("market", row.label, `${row.value}${row.note ? " · " + row.note : ""}`);
    });
    (p.analytics.scenarios || []).forEach((row) => {
      push(
        "scenario",
        `Сценарий ${row.name}`,
        `Капитал: ${row.capital}\nГод 1: ${row.year1}\nФокус: ${row.focus}`
      );
    });
    (p.analytics.funnel || []).forEach((row) => {
      push("funnel", `Воронка · ${row.step}`, String(row.n));
    });
    (p.analytics.personas || []).forEach((row) => {
      push("persona", row.name, row.text);
    });
    (p.recommendations || []).forEach((row) => {
      push("rec", row.title, `${row.body}${row.priority ? " [" + row.priority + "]" : ""}`);
    });
    if (p.swot) {
      ["strengths", "weaknesses", "opportunities", "threats"].forEach((k) => {
        const labels = {
          strengths: "Сильные",
          weaknesses: "Слабые",
          opportunities: "Возможности",
          threats: "Угрозы",
        };
        (p.swot[k] || []).forEach((line, i) => push("swot", `${labels[k]} ${i + 1}`, line));
      });
    }

    const prog = window.Store.progress(projectId, state);
    push("progress", "Прогресс плана", `${prog.pct}% · ${prog.done}/${prog.total} задач`);

    const doneMap = (state.done && state.done[projectId]) || {};
    (p.phases || []).forEach((phase) => {
      (phase.tasks || []).forEach((t) => {
        const done = !!doneMap[t.id];
        push(
          "task",
          `Задача · ${t.title}`,
          `${done ? "Сделано" : "Открыта"} · фаза: ${phase.title} · вес ${t.weight || 1}`,
          { taskId: t.id, done }
        );
      });
    });

    (state.wins || [])
      .filter((w) => w.projectId === projectId)
      .slice(0, 30)
      .forEach((w) => push("win", "Победа", w.text));

    window.Store.notesList(state, projectId)
      .slice(0, 40)
      .forEach((n) => push("note", `Заметка · ${n.title}`, n.body, { noteId: n.id }));

    // Документы индексируем целиком, без нарезки строк и без шапки с датой/прогрессом
    window.Store.docsList(state, projectId).forEach((d) => {
      const clean = String(d.text || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(
          (line) =>
            line &&
            !/^BigBossYan/i.test(line) &&
            !/^\d{1,2}\s+\S+\s+\d{4}/i.test(line) &&
            !/Прогресс плана/i.test(line) &&
            !/План основателя выполнен/i.test(line)
        )
        .join("\n");
      push("doc", `Документ · ${d.title}`, clean.slice(0, 1200), { docId: d.id, audience: d.audience || "doc" });
    });

    if (p.ipRights) {
      push("ip", "ИС · кратко", p.ipRights.summary || "");
      (p.ipRights.what || []).forEach((line, i) => push("ip", `ИС · что ${i + 1}`, line));
      (p.ipRights.how || []).forEach((line, i) => push("ip", `ИС · как ${i + 1}`, line));
      (p.ipRights.costs || []).forEach((line, i) => push("ip", `ИС · стоимость ${i + 1}`, line));
      if (p.ipRights.note) push("ip", "ИС · примечание", p.ipRights.note);
    }

    return items;
  },

  detectTopic(text) {
    const t = String(text || "").toLowerCase().replace(/ё/g, "е");
    if (/патент|роспатент|фипс|товарн\w*\s+знак|интеллект|авторск|программ\w*\s+для\s+эвм|\bис\b|регистрац\w*\s+прав/.test(t))
      return "ip";
    if (/цен|прайс|тариф|пакет|сколько\s+стоит/.test(t)) return "pricing";
    if (/юнит|марж/.test(t)) return "unit";
    if (/прогресс|процент|сколько\s+сделан/.test(t)) return "progress";
    if (/задач|следующ|что\s+делать|открыт\w*\s+шаг/.test(t)) return "task";
    if (/заметк/.test(t)) return "note";
    if (/побед/.test(t)) return "win";
    if (/воронк/.test(t)) return "funnel";
    if (/сценар|капитал/.test(t)) return "scenario";
    if (/рынок|tam|sam|som/.test(t)) return "market";
    if (/портрет|персон|аудитор/.test(t)) return "persona";
    if (/swot|силн|слаб|угроз|риск|возможност/.test(t)) return "swot";
    if (/рекоменд/.test(t)) return "rec";
    if (/документ|ворд|docx|меморандум|инвестор|команд|покупател|\bкп\b/.test(t)) return "doc";
    if (/стади|этап/.test(t)) return "stage";
    if (/слоган|позиц|one.?liner|о\s+проекте|суть/.test(t)) return "project";
    return null;
  },

  topicBoost(text, item) {
    const topic = this.detectTopic(text);
    let b = 0;
    if (topic && item.topic === topic) b += 24;
    if (topic === "doc" && item.topic === "doc") {
      const t = text.toLowerCase();
      if (/инвестор/.test(t) && /инвестор/i.test(item.title + item.body)) b += 8;
      if (/команд/.test(t) && /команд/i.test(item.title + item.body)) b += 8;
      if (/покупател|кп\b/.test(t) && /(покупател|кп|коммерческ)/i.test(item.title + item.body)) b += 8;
    }
    if (topic && item.topic !== topic) b -= 14;
    // Документы и прогресс не лезут в обычный поиск
    if (item.topic === "doc" && topic !== "doc") b -= 30;
    if (item.topic === "progress" && topic !== "progress") b -= 40;
    if (item.topic === "project" && topic && topic !== "project") b -= 8;
    return b;
  },

  isBareTaskQuery(text) {
    const t = String(text || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .trim();
    return /^(задачи|задача|следующие|следующее|что делать|открытые задачи|план задач)[?.!]*$/i.test(t);
  },

  formatTaskHit(item) {
    return `• ${item.title}\n  ${this.short(item.body, 160)}`;
  },

  search(text, projectId, state) {
    const toks = this.tokens(text);
    const topic = this.detectTopic(text);
    const p = window.ProjectLive.get(projectId, state);
    const items = this.index(projectId, state);

    if (topic === "pricing") {
      const rows = (p.analytics && p.analytics.pricing) || [];
      return {
        reply: ["Прайс «" + p.name + "»:", ...rows.map((r) => `• ${r.name}: ${r.price}${r.forWhom ? " — " + r.forWhom : ""}`)].join(
          "\n"
        ),
        patches: null,
      };
    }
    if (topic === "progress") {
      const prog = window.Store.progress(projectId, state);
      const next = window.Store.nextTasks(projectId, state, 3);
      return {
        reply: [
          `Прогресс «${p.name}»: ${prog.pct}% (${prog.done}/${prog.total}).`,
          `Стадия: ${p.stage}.`,
          next.length ? "Дальше:\n" + next.map((t) => `• ${t.title}`).join("\n") : "Открытых задач нет.",
        ].join("\n"),
        patches: null,
      };
    }
    if (topic === "ip" && p.ipRights) {
      const ip = p.ipRights;
      return {
        reply: [
          "Интеллектуальные права · " + p.name,
          ip.summary,
          "",
          "Что фиксировать:",
          ...(ip.what || []).slice(0, 4).map((x) => "• " + x),
          "",
          "Деньги (ориентир):",
          ...(ip.costs || []).slice(0, 3).map((x) => "• " + x),
          ip.note ? "\n" + ip.note : "",
        ]
          .filter(Boolean)
          .join("\n"),
        patches: null,
      };
    }
    if (topic === "task") {
      if (this.isBareTaskQuery(text)) {
        const next = window.Store.nextTasks(projectId, state, 5);
        return {
          reply: next.length
            ? ["Следующие задачи:", ...next.map((t) => `• ${t.title}\n  Открыта · фаза: ${t.phaseTitle} · вес ${t.weight || 1}`)].join(
                "\n"
              )
            : "Открытых задач нет.",
          patches: null,
        };
      }
      const taskHits = items
        .filter((it) => it.topic === "task")
        .map((item) => ({ item, score: this.score(item.title + " " + item.body, toks) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      if (taskHits.length) {
        return {
          reply: taskHits.map((x) => this.formatTaskHit(x.item)).join("\n"),
          patches: null,
        };
      }
      const next = window.Store.nextTasks(projectId, state, 3);
      return {
        reply: next.length
          ? "Точного совпадения нет. Ближайшие открытые:\n" +
            next.map((t) => `• Задача · ${t.title}\n  Открыта · фаза: ${t.phaseTitle} · вес ${t.weight || 1}`).join("\n")
          : "Открытых задач нет.",
        patches: null,
      };
    }
    if (topic === "unit") {
      const rows = (p.analytics && p.analytics.unit) || [];
      return {
        reply: ["Юнит:", ...rows.map((r) => `• ${r.label}: ${r.value}`)].join("\n"),
        patches: null,
      };
    }

    // Обычный поиск: без документов/прогресса, пока явно не спросили
    const pool =
      topic === "doc"
        ? items
        : items.filter((it) => it.topic !== "doc" && it.topic !== "progress");

    let scored = pool
      .map((item) => ({
        item,
        score: this.score(item.title + " " + item.body, toks) + this.topicBoost(text, item),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (topic) {
      const focused = scored.filter((x) => x.item.topic === topic);
      if (focused.length) scored = focused;
    }

    if (!scored.length) {
      return {
        reply:
          "Ничего точного не нашёл. Примеры: «оферта», «цены», «прогресс», «патент», «следующие задачи», «документ инвестор».",
        patches: null,
      };
    }

    // Одна тема — как у лучшего попадания (без свалки Word + задач)
    const leadTopic = scored[0].item.topic;
    scored = scored.filter((x) => x.item.topic === leadTopic);

    const best = scored[0].score;
    const cutoff = Math.max(best * 0.72, best - 6);
    const seen = new Set();
    const top = [];
    for (const x of scored) {
      if (x.score < cutoff) continue;
      const key = x.item.topic + "|" + this.short(x.item.title + " " + x.item.body, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      top.push(x);
      if (top.length >= (leadTopic === "task" ? 3 : leadTopic === "doc" ? 1 : 2)) break;
    }

    if (leadTopic === "task") {
      return { reply: top.map((x) => this.formatTaskHit(x.item)).join("\n"), patches: null };
    }

    if (top.length === 1) {
      const it = top[0].item;
      if (it.topic === "doc") {
        return {
          reply: `${it.title}\n${this.short(it.body, 280)}`,
          patches: null,
        };
      }
      return {
        reply: `${it.title}\n${this.short(it.body, 320)}`,
        patches: null,
      };
    }

    const lines = top.map((x) => `• ${x.item.title}\n  ${this.short(x.item.body, 140)}`);
    return {
      reply: lines.join("\n"),
      patches: null,
    };
  },

  short(s, n) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (t.length <= n) return t;
    return t.slice(0, n - 1) + "…";
  },

  parsePriceNumber(raw) {
    const m = String(raw || "").replace(/\s/g, "").match(/(\d[\d]*)/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  },

  formatRub(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
  },

  findPricing(nameHint, projectId, state) {
    const p = window.ProjectLive.get(projectId, state);
    const rows = (p && p.analytics && p.analytics.pricing) || [];
    if (!rows.length) return null;
    const hint = String(nameHint || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .trim();
    if (!hint) return rows[0];
    let best = null;
    let bestScore = 0;
    for (const row of rows) {
      const name = String(row.name).toLowerCase().replace(/ё/g, "е");
      let s = 0;
      if (name === hint) s = 100;
      else if (name.includes(hint) || hint.includes(name)) s = 50;
      else {
        const toks = this.tokens(hint);
        s = this.score(name, toks);
      }
      if (s > bestScore) {
        bestScore = s;
        best = row;
      }
    }
    return bestScore > 0 ? best : null;
  },

  parseMutation(text, projectId, state) {
    const lower = text.toLowerCase().replace(/ё/g, "е");

    // цена / прайс
    if (/цен|прайс|тариф|пакет/.test(lower) || /\d/.test(lower)) {
      const priceMatch = text.match(
        /(?:на|в|=|:)\s*([\d\s]+)\s*(?:₽|руб|р\.?)?|(?:цен[ауеи]?\s+(?:на\s+)?)?([\d\s]{3,})\s*(?:₽|руб)?/i
      );
      let priceRaw = null;
      if (priceMatch) priceRaw = priceMatch[1] || priceMatch[2];
      const n = this.parsePriceNumber(priceRaw);
      if (n) {
        let pkgHint = "";
        const named = text.match(
          /(?:цен[ауеи]?\s+(?:пакета\s+|тарифа\s+)?)["«]?([A-Za-zА-Яа-яЁё0-9][^"»\n]{0,40}?)["»]?\s+(?:на|в|=|:|→|->)/i
        );
        const named2 = text.match(
          /(?:пакет[ае]?\s+|тариф[ае]?\s+|цен[ауеи]?\s+)["«]?([A-Za-zА-Яа-яЁё][\wА-Яа-яЁё\s-]{0,30}?)["»]?\s+(?:на|в|=|:)/i
        );
        if (named) pkgHint = named[1].trim();
        else if (named2) pkgHint = named2[1].trim();
        else {
          const after = text.match(
            /(?:измени|поставь|сделай|обнови|смени|замени)\s+(?:цен[ауеи]?\s+)?["«]?([A-Za-zА-Яа-яЁё][\wА-Яа-яЁё\s-]{1,30}?)["»]?\s+(?:на|в|=)/i
          );
          if (after) pkgHint = after[1].replace(/^цен[ауеи]?\s+/i, "").trim();
        }

        const row = this.findPricing(pkgHint, projectId, state);
        if (!row) {
          return {
            reply: "Не нашёл пакет в прайсе. Скажи имя пакета, например: «измени цену Стандарта на 10900».",
            patches: null,
          };
        }
        const newPrice = this.formatRub(n);
        const patch = {
          op: "setPrice",
          projectId,
          package: row.name,
          price: newPrice,
          forWhom: row.forWhom || "",
        };
        return {
          reply: `Сейчас: «${row.name}» — ${row.price}.\nПредлагаю: ${newPrice}.\n\nПодтверди «да» или нажми «Применить».`,
          patches: [patch],
          needsConfirm: true,
        };
      }
    }

    // стадия / слоган / позиция / oneLiner / name / short
    const fieldMap = [
      { re: /стади[яию]|этап/, field: "stage", label: "стадия" },
      { re: /слоган|tagline/, field: "tagline", label: "слоган" },
      { re: /позици/, field: "position", label: "позиция" },
      { re: /one.?liner|ванлайнер|кратк(ое|ий)\s+описан/, field: "oneLiner", label: "one-liner" },
      { re: /коротк(ое|ое\s+имя)|short/, field: "short", label: "короткое имя" },
      { re: /назван|имя\s+проект/, field: "name", label: "название" },
    ];
    for (const f of fieldMap) {
      if (!f.re.test(lower)) continue;
      const m =
        text.match(/(?:на|в|=|:)\s*["«]?(.+?)["»]?\s*$/i) ||
        text.match(new RegExp(f.label + "\\s+(?:на|в|=|:)\\s*[\"«]?(.+?)[\"»]?\\s*$", "i"));
      if (!m) continue;
      const value = String(m[1] || "").trim();
      if (!value || value.length < 2) continue;
      const p = window.ProjectLive.get(projectId, state);
      const cur = p[f.field] || "—";
      return {
        reply: `Сейчас ${f.label}: ${cur}\nПредлагаю: ${value}\n\nПодтверди «да» или нажми «Применить».`,
        patches: [{ op: "setField", projectId, field: f.field, value }],
        needsConfirm: true,
      };
    }

    // юнит
    if (/юнит/.test(lower)) {
      const m = text.match(/юнит[ае]?\s+["«]?([^"»\n]+?)["»]?\s+(?:на|=|:)\s*(.+)$/i);
      if (m) {
        const label = m[1].trim();
        const value = m[2].trim();
        return {
          reply: `Юнит «${label}» → ${value}\n\nПодтверди «да» или нажми «Применить».`,
          patches: [{ op: "setUnit", projectId, label, value }],
          needsConfirm: true,
        };
      }
    }

    // победа
    if (/побед|записать\s+побед|запиши\s+побед/.test(lower)) {
      const m = text.match(/(?:побед[уеа]\s+|запиши\s+)["«]?(.+?)["»]?\s*$/i);
      const winText = m ? m[1].trim() : "";
      if (winText.length > 2) {
        return {
          reply: `Записать победу:\n«${winText}»\n\nПодтверди «да» или нажми «Применить».`,
          patches: [{ op: "addWin", projectId, text: winText }],
          needsConfirm: true,
        };
      }
    }

    // отметить задачу
    if (/отметь|закрой\s+задач|выполн/.test(lower)) {
      const hint =
        (text.match(/задач[уиеа]?\s+["«]?(.+?)["»]?\s*$/i) ||
          text.match(/(?:отметь|закрой)\s+["«]?(.+?)["»]?\s*$/i) ||
          [])[1] || "";
      const tasks = window.Store.nextTasks(projectId, state, 40);
      const toks = this.tokens(hint || text);
      let best = null;
      let bestScore = 0;
      for (const t of tasks) {
        const s = this.score(t.title + " " + t.phaseTitle, toks);
        if (s > bestScore) {
          bestScore = s;
          best = t;
        }
      }
      if (best && bestScore > 0) {
        return {
          reply: `Отметить задачу:\n«${best.title}» (${best.phaseTitle})\n\nПодтверди «да» или нажми «Применить».`,
          patches: [{ op: "completeTask", projectId, taskId: best.id }],
          needsConfirm: true,
        };
      }
      return {
        reply: "Не нашёл открытую задачу по запросу. Напиши точнее название из плана.",
        patches: null,
      };
    }

    return null;
  },
};
