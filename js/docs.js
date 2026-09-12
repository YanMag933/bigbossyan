window.BossDocs = {
  audiences: {
    investor: {
      id: "investor",
      title: "Инвестор",
      subtitle: "Меморандум / обзор возможности",
    },
    teammate: {
      id: "teammate",
      title: "В команду",
      subtitle: "Оффер коллеге / партнёру",
    },
    buyer: {
      id: "buyer",
      title: "Покупатель",
      subtitle: "Коммерческое предложение",
    },
  },

  buildSections(projectId, audienceId, state) {
    const p = window.ProjectLive.get(projectId, state);
    const prog = window.Store.progress(projectId, state);
    const wins = (state.wins || []).filter((w) => w.projectId === projectId).slice(0, 6);
    const next = window.Store.nextTasks(projectId, state, 5);
    const date = new Date().toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const commonHead = [
      `BigBossYan · ${p.name}`,
      date,
      `Прогресс плана основателя: ${prog.pct}% (${prog.done}/${prog.total} задач)`,
    ];

    if (audienceId === "investor") {
      return {
        filename: `${p.name}_для_инвестора.docx`,
        title: `${p.name} — инвестиционный обзор`,
        blocks: [
          ...commonHead,
          "",
          "1. Суть",
          p.oneLiner,
          p.position,
          "",
          "2. Стадия",
          p.stage,
          `Текущий прогресс исполнения плана основателя: ${prog.pct}%.`,
          "",
          "3. Модель денег",
          ...p.analytics.pricing.map((x) => `• ${x.name}: ${x.price} — ${x.forWhom}`),
          "",
          "4. Юнит / ориентиры",
          ...p.analytics.unit.map((x) => `• ${x.label}: ${x.value}${x.note ? " (" + x.note + ")" : ""}`),
          "",
          "5. Сценарии",
          ...p.analytics.scenarios.map(
            (s) => `• ${s.name}: капитал ${s.capital}; ориентир ${s.year1}; фокус — ${s.focus}`
          ),
          "",
          "6. Рынок",
          ...p.analytics.market.map((m) => `• ${m.label}: ${m.value}${m.note ? " — " + m.note : ""}`),
          "",
          "7. SWOT",
          "Сильные:",
          ...p.swot.strengths.map((x) => `• ${x}`),
          "Слабые:",
          ...p.swot.weaknesses.map((x) => `• ${x}`),
          "Возможности:",
          ...p.swot.opportunities.map((x) => `• ${x}`),
          "Угрозы:",
          ...p.swot.threats.map((x) => `• ${x}`),
          "",
          "8. Тяга (честно)",
          wins.length
            ? "Зафиксированные успехи основателя:\n" + wins.map((w) => `• ${w.text}`).join("\n")
            : "Публичной выручки в файле может ещё не быть — смотрите стадию и план до первых чеков.",
          "",
          "9. Запрос",
          "Не деньги «на идею в вакууме». Нужны тёплые интро в целевую аудиторию, жёсткая критика оффера и капитал — после доказанных оплат/пилотов.",
          "",
          "Документ сгенерирован в BigBossYan по актуальным данным плана. Не является офертой ценных бумаг.",
        ],
      };
    }

    if (audienceId === "teammate") {
      return {
        filename: `${p.name}_для_команды.docx`,
        title: `${p.name} — приглашение в команду`,
        blocks: [
          ...commonHead,
          "",
          "1. Что мы строим",
          p.tagline,
          p.oneLiner,
          "",
          "2. Где мы сейчас",
          p.stage,
          `План основателя выполнен на ${prog.pct}%.`,
          "",
          "3. Ближайшие задачи (где нужна помощь)",
          ...next.map((t) => `• ${t.title} — ${t.phaseTitle}`),
          "",
          "4. Как зарабатываем",
          ...p.analytics.pricing.map((x) => `• ${x.name}: ${x.price}`),
          "",
          "5. Почему сейчас",
          ...p.recommendations.slice(0, 4).map((r) => `• ${r.title}: ${r.body}`),
          "",
          "6. Что ищем в человеке",
          "Ответственность за кусок продукта или продаж, честность по срокам, готовность работать в ранней стадии без корпоративного комфорта.",
          "",
          "7. Формат",
          "Обсуждаем роль, зону ответственности, долю/оплату и ритм. Этот документ — карта проекта, не трудовой договор.",
          "",
          wins.length ? "Уже сделано:\n" + wins.map((w) => `• ${w.text}`).join("\n") : "",
        ],
      };
    }

    // buyer
    return {
      filename: `${p.name}_КП.docx`,
      title: `${p.name} — коммерческое предложение`,
      blocks: [
        ...commonHead,
        "",
        "Для кого этот документ",
        audienceId === "buyer" && projectId === "lifeRpg"
          ? "Людям, которым нужна личная система жизни в формате RPG, а не очередной трекер."
          : "Сетям и управляющим, которым нужна адаптация стажёров на точке с контролем дисциплины.",
        "",
        "1. Боль",
        p.position,
        "",
        "2. Решение",
        p.oneLiner,
        p.tagline,
        "",
        "3. Что получаете",
        ...p.analytics.pricing.map((x) => `• ${x.name}: ${x.price} — ${x.forWhom}`),
        "",
        "4. Как это работает",
        ...p.analytics.funnel.map((f) => `• ${f.step}: ${f.n}`),
        "",
        "5. Кому особенно заходит",
        ...p.analytics.personas.map((pe) => `• ${pe.name}: ${pe.text}`),
        "",
        "6. Почему сейчас",
        `Основатель ведёт план развития: ${prog.pct}% ключевых шагов уже закрыто.`,
        wins.length ? "Недавние результаты:\n" + wins.map((w) => `• ${w.text}`).join("\n") : "",
        "",
        "7. Следующий шаг",
        projectId === "lifeRpg"
          ? "Заполнить анкету / запросить демо сборки. Ответ по срокам сборки — в переписке."
          : "Согласовать пилот на 1–3 точках на 14–30 дней с критерием успеха заранее.",
        "",
        "Цены и формулировки актуальны на дату документа и могут обновляться.",
      ],
    };
  },

  escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  paragraphsToDocumentXml(title, blocks) {
    const paras = [];
    paras.push(
      `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="B8870B"/></w:rPr><w:t>${this.escapeXml(title)}</w:t></w:r></w:p>`
    );
    for (const line of blocks) {
      if (line === "") {
        paras.push("<w:p/>");
        continue;
      }
      const isHead = /^\d+\.\s/.test(line) || /^(Сильные|Слабые|Возможности|Угрозы):$/.test(line);
      if (isHead) {
        paras.push(
          `<w:p><w:pPr><w:spacing w:before="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1A1A1A"/></w:rPr><w:t>${this.escapeXml(line)}</w:t></w:r></w:p>`
        );
      } else {
        paras.push(
          `<w:p><w:r><w:rPr><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">${this.escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paras.join("\n")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
  </w:body>
</w:document>`;
  },

  async createDocxBlob(projectId, audienceId, state) {
    if (!window.JSZip) throw new Error("JSZip не загружен");
    const spec = this.buildSections(projectId, audienceId, state);
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip.folder("_rels").file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    const word = zip.folder("word");
    word.file("document.xml", this.paragraphsToDocumentXml(spec.title, spec.blocks));
    word.folder("_rels").file(
      "document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
    );
    const blob = await zip.generateAsync({ type: "blob" });
    return { blob, filename: spec.filename.replace(/\s+/g, "_"), title: spec.title };
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  async share(blob, filename, title) {
    const file = new File([blob], filename, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text: title });
      return "shared";
    }
    this.downloadBlob(blob, filename);
    return "downloaded";
  },

  mailtoLink(title) {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(
      "Во вложении документ BigBossYan. Если письмо открыто с телефона — приложи скачанный .docx вручную.\n\n" + title
    );
    return `mailto:?subject=${subject}&body=${body}`;
  },
};
