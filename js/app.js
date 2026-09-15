(function () {
  "use strict";

  const VER = "33";
  let state = Store.load();
  BossDocs.syncAll(state);
  Store.save(state);
  let deferredPrompt = null;
  let chatBusy = false;
  let lastDoc = null;
  let docsBusy = false;
  let themePacks = null;
  let themesLoading = false;
  let themeError = "";
  let themeBusyId = "";

  const app = document.getElementById("app");
  const topTitle = document.getElementById("top-title");
  const installBtn = document.getElementById("install-btn");
  const nav = document.getElementById("bottom-nav");

  const TAB_TITLES = {
    hq: "Штаб",
    plan: "План",
    analytics: "Аналитика",
    chat: "Секретарь",
    docs: "Документ",
    settings: "Настройки",
  };

  function project() {
    return ProjectLive.get(state.activeProject, state);
  }

  function save() {
    BossDocs.syncAll(state);
    Store.save(state);
  }

  function setTab(tab) {
    state.tab = tab;
    if (!state.ui) state.ui = {};
    if (tab !== "analytics") state.ui.analyticsDetail = null;
    save();
    render();
  }

  function setProject(id) {
    if (!BossData.projects[id]) return;
    state.activeProject = id;
    if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null };
    state.ui.notesMode = "closed";
    state.ui.editingNoteId = null;
    state.ui.analyticsDetail = null;
    save();
    render();
  }

  function formatNoteDate(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function notePreview(body) {
    const t = String(body || "").replace(/\s+/g, " ").trim();
    return t.length > 90 ? t.slice(0, 90) + "…" : t;
  }

  function renderNotesSection(projectId) {
    if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null };
    const mode = state.ui.notesMode || "closed";
    const list = Store.notesList(state, projectId);
    const n = list.length;

    if (mode === "edit") {
      const note = list.find((x) => x.id === state.ui.editingNoteId) || Store.ensureNotes(state, projectId).find((x) => x.id === state.ui.editingNoteId);
      if (!note) {
        state.ui.notesMode = "list";
        state.ui.editingNoteId = null;
        return renderNotesSection(projectId);
      }
      return `
      <div class="section-title">Заметки босса</div>
      <div class="panel notes-panel">
        <div class="row between wrap" style="gap:8px;margin-bottom:12px">
          <button type="button" class="btn secondary" id="notes-back" style="width:auto;padding:8px 12px">← К ленте</button>
          <button type="button" class="btn secondary" id="note-delete" style="width:auto;padding:8px 12px;color:#e8a0a0">Удалить</button>
        </div>
        <form id="note-edit-form" class="note-form">
          <label class="field">Заголовок
            <input type="text" id="note-edit-title" maxlength="80" value="${esc(note.title || "")}" autocomplete="off" />
          </label>
          <label class="field" style="margin-top:10px">Текст
            <textarea class="notes-area" id="note-edit-body" placeholder="Текст заметки…">${esc(note.body || "")}</textarea>
          </label>
          <button type="submit" class="btn block" style="margin-top:12px">Сохранить</button>
        </form>
      </div>`;
    }

    if (mode === "list") {
      return `
      <div class="section-title">Заметки босса</div>
      <div class="panel notes-panel">
        <div class="row between wrap" style="gap:8px;margin-bottom:12px">
          <button type="button" class="btn secondary" id="notes-back" style="width:auto;padding:8px 12px">← Закрыть</button>
          <span class="tag gold">${n}</span>
        </div>
        <div class="notes-feed">
          ${
            list.length
              ? list
                  .map(
                    (note) => `
            <button type="button" class="note-card" data-note-id="${esc(note.id)}">
              <div class="note-card-title">${esc(note.title || "Без названия")}</div>
              <div class="note-card-preview">${esc(notePreview(note.body))}</div>
              <div class="tiny muted note-card-date">${esc(formatNoteDate(note.updatedAt || note.at))}</div>
            </button>`
                  )
                  .join("")
              : '<div class="empty" style="padding:8px 0">Пока нет заметок — добавь ниже на штабе.</div>'
          }
        </div>
      </div>`;
    }

    return `
      <div class="section-title">Заметки босса</div>
      <div class="panel notes-panel">
        <button type="button" class="btn secondary block" id="notes-open">Заметки (${n})</button>
        <form id="note-new-form" class="note-form" style="margin-top:14px">
          <div class="tiny muted" style="margin-bottom:8px">Новая</div>
          <label class="field">Заголовок
            <input type="text" id="note-new-title" maxlength="80" placeholder="Например: цены / блокеры" autocomplete="off" />
          </label>
          <label class="field" style="margin-top:10px">Текст
            <textarea class="notes-area" id="note-new-body" placeholder="Мысли, цифры недели, блокеры…"></textarea>
          </label>
          <button type="submit" class="btn block" style="margin-top:12px">Сохранить</button>
        </form>
      </div>`;
  }

  function toggleTask(taskId) {
    const pid = state.activeProject;
    if (!state.done[pid]) state.done[pid] = {};
    if (state.done[pid][taskId]) delete state.done[pid][taskId];
    else state.done[pid][taskId] = Date.now();
    save();
    render();
  }

  function addWin(text) {
    const t = (text || "").trim();
    if (!t) return;
    state.wins.unshift({
      id: "w-" + Date.now(),
      text: t,
      projectId: state.activeProject,
      at: Date.now(),
    });
    if (state.wins.length > 40) state.wins.length = 40;
    save();
    render();
  }

  function removeWin(id) {
    state.wins = state.wins.filter((w) => w.id !== id);
    save();
    render();
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function checkIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
  }

  function projectSwitchHtml() {
    const a = ProjectLive.get("lifeRpg", state);
    const b = ProjectLive.get("trailOn", state);
    return `
      <div class="project-switch" role="tablist" aria-label="Проекты">
        <button type="button" class="project-btn ${state.activeProject === "lifeRpg" ? "active" : ""}" data-project="lifeRpg">
          <strong>${esc(a.name)}</strong>
          <span>${esc(a.short)}</span>
        </button>
        <button type="button" class="project-btn ${state.activeProject === "trailOn" ? "active" : ""}" data-project="trailOn">
          <strong>${esc(b.name)}</strong>
          <span>${esc(b.short)}</span>
        </button>
      </div>`;
  }

  function renderChatBubble(m) {
    const pending =
      m.role === "assistant" &&
      m.pendingPatches &&
      m.pendingPatches.length &&
      !m.applied &&
      !m.rejected;
    return `
      <div class="bubble ${m.role === "user" ? "me" : "bot"}">
        <div class="bubble-text">${esc(m.text)}</div>
        ${
          m.applied && m.applied.length
            ? `<div class="bubble-meta">Синхронизировано: ${esc(m.applied.join("; "))}</div>`
            : ""
        }
        ${m.rejected ? `<div class="bubble-meta muted">Правка отклонена</div>` : ""}
        ${
          pending
            ? `<div class="bubble-actions">
                <button type="button" class="btn" data-confirm-patch="${esc(String(m.at))}">Применить</button>
                <button type="button" class="btn secondary" data-reject-patch="${esc(String(m.at))}">Отклонить</button>
              </div>`
            : ""
        }
      </div>`;
  }

  function renderChat() {
    const p = project();
    const msgs = Store.getProjectChat(state, p.id).slice(-40);
    const empty =
      "Поиск: «цены», «оферта», «патент». Правка: «измени цену Стандарта на 10900» — подтверди «да».";
    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(22px,6.5vw,30px)">Чат секретарь</h2>
        <p>Поиск по проекту, замена с подтверждением, синхронизация плана и Word-документов.</p>
      </div>

      <div class="panel">
        <p class="small muted" style="margin:0;line-height:1.45">Секретарь не нейросеть: отвечает фактами из штаба. После «Применить» обновляются план, аналитика и тексты документов для генерации.</p>
      </div>

      <div class="section-title">Сообщения</div>
      <div class="chat-box panel" id="chat-box">
        ${
          msgs.length
            ? msgs.map((m) => renderChatBubble(m)).join("")
            : `<div class="empty">${empty}</div>`
        }
        ${
          chatBusy
            ? `<div class="bubble bot"><div class="bubble-text">Смотрю в проект…</div></div>`
            : ""
        }
      </div>

      <form class="chat-form" id="chat-form">
        <input type="text" id="chat-input" maxlength="1200" placeholder="Поиск или правка…" autocomplete="off" ${chatBusy ? "disabled" : ""} />
        <button type="submit" class="btn" ${chatBusy ? "disabled" : ""}>→</button>
      </form>

      <div class="section-title">Сброс</div>
      <div class="panel">
        <button type="button" class="btn secondary block" id="clear-chat">Очистить чат секретаря</button>
        <button type="button" class="btn secondary block" id="reset-btn" style="margin-top:8px">Сбросить весь прогресс</button>
      </div>
    `;
  }

  function taskHtml(task, phaseTitle) {
    const done = !!(state.done[state.activeProject] && state.done[state.activeProject][task.id]);
    return `
      <button type="button" class="task ${done ? "done" : ""}" data-task="${esc(task.id)}">
        <span class="check" aria-hidden="true">${done ? checkIcon() : ""}</span>
        <span>
          <div class="task-title">${esc(task.title)}</div>
          <div class="task-meta">${phaseTitle ? esc(phaseTitle) + " · " : ""}вес ${task.weight || 1}</div>
        </span>
      </button>`;
  }

  function renderHq() {
    const p = project();
    const prog = Store.progress(p.id, state);
    const next = Store.nextTasks(p.id, state, 5);
    const otherId = p.id === "lifeRpg" ? "trailOn" : "lifeRpg";
    const otherProg = Store.progress(otherId, state);
    const wins = state.wins.filter((w) => w.projectId === p.id).slice(0, 5);
    const circ = 2 * Math.PI * 44;
    const offset = circ - (prog.pct / 100) * circ;

    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <div class="row wrap" style="gap:8px;margin-bottom:10px">
          <span class="tag gold">${esc(p.stage)}</span>
          <span class="tag">${prog.done}/${prog.total} задач</span>
        </div>
        <h2>${esc(p.name)}</h2>
        <p>${esc(p.tagline)}</p>
      </div>

      <div class="panel">
        <div class="progress-ring-wrap">
          <div class="ring">
            <svg viewBox="0 0 108 108" aria-hidden="true">
              <circle class="ring-track" cx="54" cy="54" r="44"/>
              <circle class="ring-value" cx="54" cy="54" r="44"
                stroke-dasharray="${circ.toFixed(1)}"
                stroke-dashoffset="${offset.toFixed(1)}"/>
            </svg>
            <div class="ring-label">
              <strong>${prog.pct}%</strong>
              <span>прогресс</span>
            </div>
          </div>
          <div>
            <div class="tiny muted">Взвешенный прогресс плана</div>
            <div style="margin:8px 0 12px;font-size:14px;line-height:1.4">${esc(p.oneLiner)}</div>
            <div class="bar"><i style="width:${prog.pct}%"></i></div>
            <div class="small muted" style="margin-top:8px">Второй проект: ${esc(ProjectLive.get(otherId, state).name)} — ${otherProg.pct}%</div>
          </div>
        </div>
      </div>

      <div class="section-title">Сделать дальше</div>
      <div class="stack">
        ${
          next.length
            ? next.map((t) => taskHtml(t, t.phaseTitle)).join("")
            : '<div class="panel empty">Все задачи отмечены. Напиши секретарю или сгенерируй документ.</div>'
        }
      </div>

      <div class="section-title">Победы</div>
      <div class="panel">
        <form class="win-form" id="win-form">
          <input type="text" id="win-input" maxlength="160" placeholder="Что уже сделал по проекту…" autocomplete="off" />
          <button type="submit" class="btn block">Отметить успех</button>
        </form>
        <div class="win-list">
          ${
            wins.length
              ? wins
                  .map(
                    (w) => `
            <div class="win-item">
              <span>${esc(w.text)}<div class="tiny muted" style="margin-top:4px;text-transform:none;letter-spacing:0">${new Date(w.at).toLocaleDateString("ru-RU")}</div></span>
              <button type="button" data-del-win="${esc(w.id)}" aria-label="Удалить">×</button>
            </div>`
                  )
                  .join("")
              : '<div class="empty" style="padding:8px 0">Пока пусто — первая оплата, кейс, письмо юристу…</div>'
          }
        </div>
      </div>

      ${renderNotesSection(p.id)}
    `;
  }

  function renderPlan() {
    const p = project();
    const prog = Store.progress(p.id, state);
    return `
      ${projectSwitchHtml()}
      <div class="panel">
        <div class="row between">
          <div>
            <div class="tiny muted">План масштабирования</div>
            <div style="font-family:var(--font-display);font-size:18px;margin-top:4px">${esc(p.name)}</div>
          </div>
          <span class="tag gold">${prog.pct}%</span>
        </div>
        <div class="bar" style="margin-top:12px"><i style="width:${prog.pct}%"></i></div>
        <p class="small muted" style="margin:10px 0 0;line-height:1.4">${esc(p.position)}</p>
      </div>
      <div class="stack" style="margin-top:12px">
        ${p.phases
          .map((phase) => {
            const pp = Store.phaseProgress(p.id, phase, state);
            return `
            <div class="panel">
              <div class="phase-head">
                <h3>${esc(phase.title)}</h3>
                <span class="tag ${pp.pct === 100 ? "ok" : ""}">${pp.done}/${pp.total}</span>
              </div>
              <div class="bar"><i style="width:${pp.pct}%"></i></div>
              <p class="phase-goal">${esc(phase.goal)}</p>
              <div class="stack">
                ${phase.tasks.map((t) => taskHtml(t, "")).join("")}
              </div>
            </div>`;
          })
          .join("")}
      </div>
    `;
  }

  function renderAnalytics() {
    const p = project();
    const a = p.analytics;
    const detail = state.ui && state.ui.analyticsDetail;
    if (detail) return renderAnalyticsDetail(p, a, detail);

    const openBtn = (section, index, label) =>
      `<button type="button" class="metric metric-btn" data-analytics-open="${esc(section)}" data-analytics-index="${index}">
        ${label}
        <span class="metric-more">Открыть →</span>
      </button>`;

    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(24px,7vw,32px)">Аналитика</h2>
        <p>${esc(p.oneLiner)}</p>
        <p class="small muted" style="margin:10px 0 0;line-height:1.45">Жми на блок — развёрнутый отчёт. Там золотые слова из глоссария Word открывают определение.</p>
      </div>

      <div class="section-title">Рынок и позиция</div>
      <div class="metric-grid">
        ${a.market
          .map(
            (m, i) =>
              openBtn(
                "market",
                i,
                `<div class="label">${esc(m.label)}</div>
                 <div class="value">${esc(m.value)}</div>
                 ${m.note ? `<div class="note">${esc(m.note)}</div>` : ""}`
              )
          )
          .join("")}
      </div>

      <div class="section-title">Юнит / прайс</div>
      <div class="panel">
        <div class="metric-grid" style="margin-bottom:8px">
          ${a.unit
            .map(
              (m, i) =>
                openBtn(
                  "unit",
                  i,
                  `<div class="label">${esc(m.label)}</div>
                   <div class="value" style="font-size:15px">${esc(m.value)}</div>
                   ${m.note ? `<div class="note">${esc(m.note)}</div>` : ""}`
                )
            )
            .join("")}
        </div>
        ${a.pricing
          .map(
            (pr, i) => `
          <button type="button" class="price-row price-btn" data-analytics-open="pricing" data-analytics-index="${i}">
            <span>${esc(pr.name)}<div class="tiny muted" style="margin-top:2px;text-transform:none;letter-spacing:0">${esc(pr.forWhom)}</div></span>
            <strong>${esc(pr.price)}</strong>
          </button>`
          )
          .join("")}
      </div>

      <div class="section-title">Сценарии</div>
      <div class="stack">
        ${a.scenarios
          .map(
            (s, i) => `
          <button type="button" class="scenario scenario-btn" data-analytics-open="scenario" data-analytics-index="${i}">
            <h4>${esc(s.name)}</h4>
            <p><strong style="color:var(--text)">Капитал:</strong> ${esc(s.capital)}</p>
            <p><strong style="color:var(--text)">Ориентир:</strong> ${esc(s.year1)}</p>
            <p>${esc(s.focus)}</p>
            <span class="metric-more">Развернуть →</span>
          </button>`
          )
          .join("")}
      </div>

      <div class="section-title">Воронка (цель)</div>
      <div class="panel funnel">
        ${a.funnel
          .map((f, i) => {
            const width = 100 - i * 12;
            return `
            <button type="button" class="funnel-row funnel-btn" data-analytics-open="funnel" data-analytics-index="${i}">
              <div class="funnel-bar" style="width:${width}%">${esc(f.step)}</div>
              <span class="muted small">${esc(f.n)}</span>
            </button>`;
          })
          .join("")}
      </div>

      <div class="section-title">Кому продавать</div>
      <div class="stack">
        ${a.personas
          .map(
            (pe, i) => `
          <button type="button" class="panel persona-btn" data-analytics-open="persona" data-analytics-index="${i}">
            <div class="tag gold">${esc(pe.name)}</div>
            <p class="small muted" style="margin:10px 0 0;line-height:1.45;text-align:left">${esc(pe.text)}</p>
            <span class="metric-more">Подробнее →</span>
          </button>`
          )
          .join("")}
      </div>

      <div class="section-title">SWOT</div>
      <div class="panel swot-grid">
        ${[
          ["strengths", "Сильные"],
          ["weaknesses", "Слабые"],
          ["opportunities", "Возможности"],
          ["threats", "Угрозы"],
        ]
          .map(
            ([key, title], i) => `
          <button type="button" class="swot-block swot-btn" data-analytics-open="swot" data-analytics-index="${i}" data-swot-key="${key}">
            <h4>${esc(title)}</h4>
            <ul>${(p.swot[key] || []).slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
            <span class="metric-more">Все пункты →</span>
          </button>`
          )
          .join("")}
      </div>

      <div class="section-title">Советы</div>
      <div class="stack">
        ${p.recommendations
          .map(
            (r, i) => `
          <button type="button" class="panel reco ${esc(r.priority)} reco-btn" data-analytics-open="rec" data-analytics-index="${i}">
            <div class="row between wrap">
              <h4>${esc(r.title)}</h4>
              <span class="tag ${r.priority === "high" ? "gold" : ""}">${esc(r.priority)}</span>
            </div>
            <p>${esc(r.body)}</p>
            <span class="metric-more">Разбор →</span>
          </button>`
          )
          .join("")}
      </div>
    `;
  }

  function gMark(text) {
    const pid = state.activeProject;
    if (window.BossGlossary && typeof window.BossGlossary.mark === "function") {
      return window.BossGlossary.mark(esc(text), pid);
    }
    return esc(text);
  }

  function showGlossPopup(term) {
    const found = window.BossGlossary && window.BossGlossary.find(term, state.activeProject);
    const title = (found && found.term) || term || "Термин";
    const body =
      (found && found.def) ||
      "Определения нет в глоссарии этого проекта. Термин попал в текст без карточки — добавим при следующем обновлении.";
    const old = document.getElementById("gloss-overlay");
    if (old) old.remove();
    const overlay = document.createElement("div");
    overlay.id = "gloss-overlay";
    overlay.className = "gloss-overlay";
    overlay.innerHTML = `
      <div class="gloss-card" role="dialog" aria-modal="true">
        <div class="gloss-term-title">${esc(title)}</div>
        <p class="gloss-def">${esc(body)}</p>
        <button type="button" class="btn block" id="gloss-close">Понятно</button>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    const closeBtn = document.getElementById("gloss-close");
    if (closeBtn) closeBtn.addEventListener("click", close);
  }

  function analyticsDetailBody(p, a, detail) {
    const section = detail.section;
    const i = Number(detail.index) || 0;
    const pid = p.id;

    if (section === "market") {
      const m = a.market[i];
      if (!m) return null;
      return {
        title: m.label,
        blocks: [
          { h: "Цифра", t: m.value },
          m.note ? { h: "Комментарий", t: m.note } : null,
          {
            h: "Что это значит для «" + p.name + "»",
            t:
              "Это ориентир рынка/позиции, а не обещание выручки. Сверяй с SOM и своими ближайшими шагами плана: сначала доказуемые оплаты/пилоты, потом масштаб.",
          },
          {
            h: "Связка с юнитом",
            t: (a.unit || []).map((u) => u.label + ": " + u.value).join(" · ") || "—",
          },
        ].filter(Boolean),
      };
    }
    if (section === "unit") {
      const m = a.unit[i];
      if (!m) return null;
      return {
        title: m.label,
        blocks: [
          { h: "Значение", t: m.value },
          m.note ? { h: "Пояснение", t: m.note } : null,
          {
            h: "Зачем считать",
            t: "Юнит показывает, жива ли сделка после комиссий, налогов и прямого времени. Если маржа тонкая — дорогой CAC и сторы убьют модель.",
          },
          {
            h: "Прайс рядом",
            t: (a.pricing || []).map((pr) => pr.name + " " + pr.price).join(" · "),
          },
        ].filter(Boolean),
      };
    }
    if (section === "pricing") {
      const pr = a.pricing[i];
      if (!pr) return null;
      return {
        title: "Пакет · " + pr.name,
        blocks: [
          { h: "Цена", t: pr.price },
          { h: "Для кого", t: pr.forWhom || "—" },
          {
            h: "Как читать",
            t: "Цена должна бить в портрет и в альтернативу клиента (коуч / текучка / Excel). Не сравнивай только с бесплатными трекерами.",
          },
          {
            h: "Сценарии капитала",
            t: (a.scenarios || []).map((s) => s.name + ": " + s.capital).join(" · "),
          },
        ],
      };
    }
    if (section === "scenario") {
      const s = a.scenarios[i];
      if (!s) return null;
      return {
        title: "Сценарий · " + s.name,
        blocks: [
          { h: "Капитал", t: s.capital },
          { h: "Ориентир года 1", t: s.year1 },
          { h: "Фокус", t: s.focus },
          {
            h: "Правило выбора",
            t: "Не прыгай в Seed/стор, пока Bootstrap не дал сигнал (оплаты или платящие пилоты). Сценарий — развилка ресурсов, не прогноз Excel.",
          },
        ],
      };
    }
    if (section === "funnel") {
      const f = a.funnel[i];
      if (!f) return null;
      const prev = a.funnel[i - 1];
      const next = a.funnel[i + 1];
      return {
        title: "Этап воронки · " + f.step,
        blocks: [
          { h: "Цель / объём", t: String(f.n) },
          prev ? { h: "Предыдущий шаг", t: prev.step + " → " + prev.n } : null,
          next ? { h: "Следующий шаг", t: next.step + " → " + next.n } : null,
          {
            h: "Как использовать",
            t: "Смотри, где отвал максимальный. Узкое место чини оффером, скоростью ответа или критерием пилота — не «ещё контента ради контента».",
          },
        ].filter(Boolean),
      };
    }
    if (section === "persona") {
      const pe = a.personas[i];
      if (!pe) return null;
      return {
        title: pe.name,
        blocks: [
          { h: "Портрет", t: pe.text },
          {
            h: "Что продавать",
            t: "Говори языком боли портрета. Пакет и канал должны совпадать: иначе трафик будет, а оплаты — нет.",
          },
          {
            h: "Связь с прайсом",
            t: (a.pricing || []).map((pr) => pr.name + " — " + (pr.forWhom || pr.price)).join("\n"),
          },
        ],
      };
    }
    if (section === "swot") {
      const keys = ["strengths", "weaknesses", "opportunities", "threats"];
      const titles = { strengths: "Сильные", weaknesses: "Слабые", opportunities: "Возможности", threats: "Угрозы" };
      const key = detail.swotKey || keys[i];
      const list = (p.swot && p.swot[key]) || [];
      return {
        title: "SWOT · " + (titles[key] || key),
        blocks: [
          { h: "Все пункты", t: list.map((x, n) => n + 1 + ". " + x).join("\n") },
          {
            h: "Как читать",
            t:
              key === "threats" || key === "weaknesses"
                ? "Это не «минусы для стыда», а список работ: что закрыть договором, продуктом или фокусом недели."
                : "Сильные стороны и возможности — топливо оффера и кейса. Усиливай их в документе для инвестора/команды.",
          },
        ],
      };
    }
    if (section === "rec") {
      const r = p.recommendations[i];
      if (!r) return null;
      return {
        title: r.title,
        blocks: [
          { h: "Приоритет", t: String(r.priority || "—") },
          { h: "Суть", t: r.body },
          {
            h: "Как применить",
            t: "Перенеси в ближайшие задачи плана или скажи секретарю: «отметь задачу …» / уточни формулировку в Word для нужной аудитории.",
          },
        ],
      };
    }
    return null;
  }

  function renderAnalyticsDetail(p, a, detail) {
    const body = analyticsDetailBody(p, a, detail);
    if (!body) {
      return `
        ${projectSwitchHtml()}
        <div class="panel">
          <p>Не нашёл блок. <button type="button" class="linkish" data-analytics-back>Назад к аналитике</button></p>
        </div>`;
    }
    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <button type="button" class="btn secondary" data-analytics-back style="margin-bottom:12px">← К аналитике</button>
        <h2 style="font-size:clamp(22px,6.5vw,30px)">${gMark(body.title)}</h2>
        <p class="small muted" style="margin:8px 0 0;line-height:1.45">Золотые термины из глоссария Word — нажми, чтобы увидеть определение.</p>
      </div>
      <div class="stack">
        ${body.blocks
          .map(
            (b) => `
          <div class="panel analytics-detail-block">
            <div class="tiny muted" style="margin-bottom:8px">${esc(b.h)}</div>
            <div class="detail-prose">${gMark(b.t).replace(/\n/g, "<br>")}</div>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  function openDocPreview(audienceId) {
    BossDocs.syncArchive(state, state.activeProject);
    const spec = BossDocs.buildSections(state.activeProject, audienceId || state.docs.audience || "investor", state);
    if (!state.ui) state.ui = {};
    state.ui.docPreview = {
      audience: audienceId || state.docs.audience || "investor",
      title: spec.title,
      blocks: spec.blocks || [],
    };
    save();
    render();
  }

  function closeDocPreview() {
    if (!state.ui) state.ui = {};
    state.ui.docPreview = null;
    save();
    render();
  }

  function renderDocPreview(preview) {
    const blocks = preview.blocks || [];
    return `
      <div class="doc-viewer">
        <div class="doc-viewer-bar">
          <button type="button" class="btn secondary" id="doc-preview-close">← Назад</button>
          <button type="button" class="btn" id="doc-generate-from-preview" ${docsBusy ? "disabled" : ""}>Скачать .docx</button>
        </div>
        <article class="doc-viewer-paper">
          <h2 class="doc-viewer-title">${esc(preview.title || "Документ")}</h2>
          ${blocks
            .map((line) => {
              if (line === "") return "<div class='doc-gap'></div>";
              const isHead =
                /^\d+\.\s/.test(line) ||
                /^(Сильные|Слабые|Возможности|Угрозы|Что регистрировать|Как сделать|Сколько стоит)/.test(line) ||
                /Интеллектуальные права/.test(line);
              if (isHead) return `<h3 class="doc-h">${esc(line)}</h3>`;
              return `<p class="doc-p">${esc(line)}</p>`;
            })
            .join("")}
        </article>
      </div>`;
  }

  function renderDocs() {
    const preview = state.ui && state.ui.docPreview;
    if (preview) return renderDocPreview(preview);

    const p = project();
    const aud = state.docs.audience || "investor";
    const list = Object.values(BossDocs.audiences);
    const archived = Store.docsList(state, p.id);
    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(22px,6.5vw,30px)">Документ</h2>
        <p>Смотри текст на телефоне или скачай .docx. Секретарь после правок сам обновляет базу документов.</p>
      </div>

      <div class="panel">
        <div class="tiny muted" style="margin-bottom:8px">Для кого</div>
        <div class="seg" id="doc-audience">
          ${list
            .map(
              (a) => `
            <button type="button" class="seg-btn ${aud === a.id ? "active" : ""}" data-audience="${esc(a.id)}">
              ${esc(a.title)}
            </button>`
            )
            .join("")}
        </div>
        <p class="small muted" style="margin:12px 0 0;line-height:1.4">${esc(BossDocs.audiences[aud].subtitle)} · проект «${esc(p.name)}»</p>
      </div>

      <div class="panel">
        <button type="button" class="btn block" id="doc-preview-open">Смотреть на телефоне</button>
        <button type="button" class="btn secondary block" id="doc-generate" style="margin-top:8px" ${docsBusy ? "disabled" : ""}>
          ${docsBusy ? "Собираю Word…" : "Сгенерировать .docx"}
        </button>
        <p class="small muted" style="margin:10px 0 0;line-height:1.4">Просмотр — прямо здесь, без Word и сторонних сайтов. Скачивание — если нужно отправить файл.</p>
        ${
          lastDoc
            ? `<div class="stack" style="margin-top:12px">
                <p class="small" style="margin:0;line-height:1.4">Файл: <strong>${esc(lastDoc.filename)}</strong></p>
                <button type="button" class="btn secondary block" id="doc-download">Скачать</button>
                <button type="button" class="btn secondary block" id="doc-share">Поделиться / мессенджер</button>
                <a class="btn ghost block" id="doc-mail" href="${BossDocs.mailtoLink(lastDoc.title)}" style="text-align:center;text-decoration:none">Открыть почту</a>
              </div>`
            : ""
        }
      </div>

      <div class="section-title">В базе (${archived.length})</div>
      <div class="panel">
        ${
          archived.length
            ? `<div class="stack">${archived
                .slice(0, 12)
                .map(
                  (d) => `
              <button type="button" class="btn secondary block doc-arch-btn" data-preview-audience="${esc(d.audience || "")}">
                ${esc(d.title)}
              </button>`
                )
                .join("")}</div>`
            : `<p class="small muted" style="margin:0">Пока пусто — открой просмотр или сгенерируй Word.</p>`
        }
      </div>

      <div class="section-title">Что внутри</div>
      <div class="panel">
        <ul class="doc-preview">
          <li>Название и позиция проекта</li>
          <li>Прайс, юнит, прогресс ${Store.progress(p.id, state).pct}%</li>
          <li>ИС / патент / регистрация прав</li>
          <li>Победы и следующий шаг</li>
        </ul>
      </div>
    `;
  }

  function renderSettings() {
    if (!themePacks && !themesLoading) {
      themesLoading = true;
      themeError = "";
      BossThemes.listPacks()
        .then((list) => {
          themePacks = list;
          themesLoading = false;
          if (state.tab === "settings") render();
        })
        .catch((e) => {
          themeError = String((e && e.message) || e || "Ошибка списка тем");
          themePacks = [BossThemes.builtinMeta()];
          themesLoading = false;
          if (state.tab === "settings") render();
        });
    }

    const active = BossThemes.activeId(state);
    const packs = themePacks || [];

    return `
      <div class="hero-block">
        <h2 style="font-size:clamp(22px,6.5vw,30px)">Настройки</h2>
        <p>Дизайны штаба. Classic уже внутри. Остальные — скачай по одной с облака, потом включи.</p>
      </div>

      <div class="section-title">Темы оформления</div>
      ${
        themeError
          ? `<div class="panel"><p class="small" style="margin:0;color:var(--danger)">${esc(themeError)}</p>
               <button type="button" class="btn secondary block" id="themes-reload" style="margin-top:10px">Обновить список</button></div>`
          : ""
      }
      ${
        !packs.length
          ? `<div class="panel empty">${themesLoading ? "Загружаю каталог тем…" : "Список пуст"}</div>`
          : `<div class="theme-grid">
              ${packs
                .map((p) => {
                  const installed = BossThemes.isInstalled(state, p.id);
                  const isActive = active === p.id;
                  const busy = themeBusyId === p.id;
                  const preview = BossThemes.previewSrc(p, state);
                  return `
                <article class="theme-card ${isActive ? "active" : ""}" data-theme-id="${esc(p.id)}">
                  <div class="theme-preview-wrap">
                    <img class="theme-preview" src="${esc(preview)}" alt="" width="320" height="200" loading="lazy" />
                    ${isActive ? `<span class="theme-badge">Активна</span>` : ""}
                  </div>
                  <div class="theme-meta">
                    <h3>${esc(p.name)}</h3>
                    <p>${esc(p.blurb || "")}</p>
                    <div class="tiny muted" style="text-transform:none;letter-spacing:0;margin-top:6px">
                      ${p.builtin ? "Встроена" : installed ? "Скачана · " + BossThemes.formatBytes(p.bytes) : "В облаке · " + BossThemes.formatBytes(p.bytes)}
                    </div>
                  </div>
                  <div class="theme-actions">
                    ${
                      p.builtin
                        ? `<button type="button" class="btn block" data-theme-apply="${esc(p.id)}" ${isActive || busy ? "disabled" : ""}>${isActive ? "Уже включена" : busy ? "…" : "Включить"}</button>`
                        : installed
                          ? `<button type="button" class="btn block" data-theme-apply="${esc(p.id)}" ${isActive || busy ? "disabled" : ""}>${isActive ? "Уже включена" : busy ? "…" : "Включить"}</button>
                             <button type="button" class="btn secondary block" data-theme-remove="${esc(p.id)}" ${busy || isActive ? "disabled" : ""} style="margin-top:8px">Удалить с телефона</button>`
                          : `<button type="button" class="btn block" data-theme-download="${esc(p.id)}" ${busy ? "disabled" : ""}>${busy ? "Скачиваю…" : "Скачать тему"}</button>`
                    }
                  </div>
                </article>`;
                })
                .join("")}
            </div>`
      }

      <div class="section-title">Приложение</div>
      <div class="panel">
        <p class="small muted" style="margin:0 0 12px;line-height:1.45">Версия интерфейса: v${esc(VER)}. Темы хранятся в кэше браузера и работают офлайн после скачивания.</p>
        <button type="button" class="btn secondary block" id="themes-reload">Обновить каталог тем</button>
      </div>
    `;
  }

  function render() {
    topTitle.textContent = TAB_TITLES[state.tab] || "Штаб";
    nav.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === state.tab);
    });

    let html = "";
    if (state.tab === "hq") html = renderHq();
    else if (state.tab === "plan") html = renderPlan();
    else if (state.tab === "analytics") html = renderAnalytics();
    else if (state.tab === "chat") html = renderChat();
    else if (state.tab === "docs") html = renderDocs();
    else if (state.tab === "settings") html = renderSettings();
    else html = renderHq();

    app.innerHTML = html;
    bindView();

    if (state.tab === "chat") {
      const box = document.getElementById("chat-box");
      if (box) box.scrollTop = box.scrollHeight;
    }
  }

  function resolvePendingByAt(thread, at) {
    const key = String(at);
    return thread.find(
      (m) =>
        m &&
        m.role === "assistant" &&
        String(m.at) === key &&
        m.pendingPatches &&
        m.pendingPatches.length &&
        !m.applied &&
        !m.rejected
    );
  }

  function applyPendingMessage(msg) {
    if (!msg || !msg.pendingPatches) return [];
    const applied = ProjectLive.applyPatches(state, msg.pendingPatches);
    msg.applied = applied;
    msg.pendingPatches = null;
    msg.text = (msg.text || "").replace(/\n\nПодтверди «да» или нажми «Применить»\./, "");
    if (applied.length && window.BossDocs) {
      BossDocs.syncArchive(state, state.activeProject);
    }
    if (applied.length) {
      msg.text =
        (msg.text ? msg.text + "\n\n" : "") +
        "Готово. Обновил штаб и документы (инвестор / команда / КП) — при следующей генерации будут новые цифры.";
    }
    return applied;
  }

  function rejectPendingMessage(msg) {
    if (!msg) return;
    msg.rejected = true;
    msg.pendingPatches = null;
  }

  function sendProjectChat(text) {
    const msg = (text || "").trim();
    if (!msg || chatBusy) return;
    const pid = state.activeProject;
    const thread = Store.getProjectChat(state, pid);
    thread.push({ role: "user", text: msg, at: Date.now() });

    const result = BossProjectChat.ask(msg, pid, state);

    if (result.confirmPendingId != null) {
      const pending = resolvePendingByAt(thread, result.confirmPendingId);
      const applied = applyPendingMessage(pending);
      thread.push({
        role: "assistant",
        text: applied.length
          ? "Применил: " + applied.join("; ") + ".\nСинхронизировал план, аналитику и Word-документы."
          : "Нечего применять.",
        applied,
        at: Date.now(),
        via: "secretary",
      });
    } else if (result.rejectPendingId != null) {
      rejectPendingMessage(resolvePendingByAt(thread, result.rejectPendingId));
      thread.push({
        role: "assistant",
        text: result.reply || "Правка отклонена.",
        rejected: true,
        at: Date.now(),
        via: "secretary",
      });
    } else if (result.needsConfirm && result.patches && result.patches.length) {
      thread.push({
        role: "assistant",
        text: result.reply,
        pendingPatches: result.patches,
        at: Date.now(),
        via: "secretary",
      });
    } else {
      thread.push({
        role: "assistant",
        text: result.reply,
        at: Date.now(),
        via: "secretary",
      });
    }

    if (thread.length > 60) Store.setProjectChat(state, pid, thread.slice(-60));
    save();
    render();
  }

  function sendChat(text) {
    sendProjectChat(text);
  }

  async function generateDoc() {
    if (docsBusy) return;
    docsBusy = true;
    render();
    try {
      const out = await BossDocs.createDocxBlob(state.activeProject, state.docs.audience || "investor", state);
      lastDoc = out;
      state.docs.lastFile = out.filename;
      save();
    } catch (e) {
      alert("Не удалось собрать документ: " + String(e.message || e));
    }
    docsBusy = false;
    render();
  }

  function bindView() {
    app.querySelectorAll("[data-project]").forEach((btn) => {
      btn.addEventListener("click", () => setProject(btn.dataset.project));
    });
    app.querySelectorAll("[data-task]").forEach((btn) => {
      btn.addEventListener("click", () => toggleTask(btn.dataset.task));
    });
    app.querySelectorAll("[data-del-win]").forEach((btn) => {
      btn.addEventListener("click", () => removeWin(btn.dataset.delWin));
    });

    app.querySelectorAll("[data-analytics-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.ui) state.ui = {};
        state.ui.analyticsDetail = {
          section: btn.dataset.analyticsOpen,
          index: Number(btn.dataset.analyticsIndex) || 0,
          swotKey: btn.dataset.swotKey || null,
        };
        save();
        render();
        window.scrollTo(0, 0);
      });
    });
    app.querySelectorAll("[data-analytics-back]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.ui) state.ui = {};
        state.ui.analyticsDetail = null;
        save();
        render();
      });
    });
    app.querySelectorAll("[data-gloss]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showGlossPopup(btn.dataset.gloss);
      });
    });

    const form = document.getElementById("win-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("win-input");
        addWin(input && input.value);
      });
    }

    const notesOpen = document.getElementById("notes-open");
    if (notesOpen) {
      notesOpen.addEventListener("click", () => {
        if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null };
        state.ui.notesMode = "list";
        state.ui.editingNoteId = null;
        save();
        render();
      });
    }

    const notesBack = document.getElementById("notes-back");
    if (notesBack) {
      notesBack.addEventListener("click", () => {
        if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null };
        if (state.ui.notesMode === "edit") {
          state.ui.notesMode = "list";
          state.ui.editingNoteId = null;
        } else {
          state.ui.notesMode = "closed";
          state.ui.editingNoteId = null;
        }
        save();
        render();
      });
    }

    app.querySelectorAll("[data-note-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null };
        state.ui.notesMode = "edit";
        state.ui.editingNoteId = btn.dataset.noteId;
        save();
        render();
      });
    });

    const noteNewForm = document.getElementById("note-new-form");
    if (noteNewForm) {
      noteNewForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const titleEl = document.getElementById("note-new-title");
        const bodyEl = document.getElementById("note-new-body");
        const created = Store.addNote(
          state,
          state.activeProject,
          titleEl && titleEl.value,
          bodyEl && bodyEl.value
        );
        if (!created) {
          alert("Нужен текст заметки");
          return;
        }
        if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null };
        state.ui.notesMode = "list";
        state.ui.editingNoteId = null;
        save();
        render();
      });
    }

    const noteEditForm = document.getElementById("note-edit-form");
    if (noteEditForm) {
      noteEditForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const titleEl = document.getElementById("note-edit-title");
        const bodyEl = document.getElementById("note-edit-body");
        const id = state.ui && state.ui.editingNoteId;
        if (!id) return;
        const updated = Store.updateNote(
          state,
          state.activeProject,
          id,
          titleEl && titleEl.value,
          bodyEl && bodyEl.value
        );
        if (!updated || !String(bodyEl && bodyEl.value || "").trim()) {
          alert("Нужен текст заметки");
          return;
        }
        state.ui.notesMode = "list";
        state.ui.editingNoteId = null;
        save();
        render();
      });
    }

    const noteDelete = document.getElementById("note-delete");
    if (noteDelete) {
      noteDelete.addEventListener("click", () => {
        const id = state.ui && state.ui.editingNoteId;
        if (!id) return;
        if (!confirm("Удалить эту заметку?")) return;
        Store.removeNote(state, state.activeProject, id);
        state.ui.notesMode = "list";
        state.ui.editingNoteId = null;
        save();
        render();
      });
    }

    const clearChat = document.getElementById("clear-chat");
    if (clearChat) {
      clearChat.addEventListener("click", () => {
        Store.setProjectChat(state, state.activeProject, []);
        save();
        render();
      });
    }

    const chatForm = document.getElementById("chat-form");
    if (chatForm) {
      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("chat-input");
        sendChat(input && input.value);
      });
    }

    app.querySelectorAll("[data-confirm-patch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const thread = Store.getProjectChat(state, state.activeProject);
        const pending = resolvePendingByAt(thread, btn.dataset.confirmPatch);
        const applied = applyPendingMessage(pending);
        if (applied.length) {
          thread.push({
            role: "assistant",
            text: "Применил: " + applied.join("; ") + ".\nСинхронизировал план, аналитику и Word-документы.",
            applied,
            at: Date.now(),
            via: "secretary",
          });
        }
        save();
        render();
      });
    });

    app.querySelectorAll("[data-reject-patch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const thread = Store.getProjectChat(state, state.activeProject);
        rejectPendingMessage(resolvePendingByAt(thread, btn.dataset.rejectPatch));
        thread.push({
          role: "assistant",
          text: "Правка отклонена.",
          rejected: true,
          at: Date.now(),
          via: "secretary",
        });
        save();
        render();
      });
    });

    app.querySelectorAll("[data-audience]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.docs.audience = btn.dataset.audience;
        save();
        render();
      });
    });

    const gen = document.getElementById("doc-generate");
    if (gen) gen.addEventListener("click", () => generateDoc());

    const genPrev = document.getElementById("doc-generate-from-preview");
    if (genPrev) {
      genPrev.addEventListener("click", async () => {
        const aud = (state.ui && state.ui.docPreview && state.ui.docPreview.audience) || state.docs.audience;
        if (aud) state.docs.audience = aud;
        await generateDoc();
      });
    }

    const previewOpen = document.getElementById("doc-preview-open");
    if (previewOpen) {
      previewOpen.addEventListener("click", () => openDocPreview(state.docs.audience || "investor"));
    }

    const previewClose = document.getElementById("doc-preview-close");
    if (previewClose) previewClose.addEventListener("click", () => closeDocPreview());

    app.querySelectorAll("[data-preview-audience]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.previewAudience;
        if (a) state.docs.audience = a;
        openDocPreview(a || state.docs.audience);
      });
    });

    const dl = document.getElementById("doc-download");
    if (dl && lastDoc) {
      dl.addEventListener("click", () => BossDocs.downloadBlob(lastDoc.blob, lastDoc.filename));
    }
    const share = document.getElementById("doc-share");
    if (share && lastDoc) {
      share.addEventListener("click", async () => {
        try {
          await BossDocs.share(lastDoc.blob, lastDoc.filename, lastDoc.title);
        } catch (e) {
          if (String(e.name) !== "AbortError") BossDocs.downloadBlob(lastDoc.blob, lastDoc.filename);
        }
      });
    }

    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("Сбросить прогресс, победы, правки цен и чат?")) {
          Store.reset();
          state = Store.load();
          lastDoc = null;
          render();
        }
      });
    }
    app.querySelectorAll("[data-theme-download]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.themeDownload;
        if (!id || themeBusyId) return;
        themeBusyId = id;
        render();
        try {
          await BossThemes.download(id);
          await BossThemes.markInstalled(state, id);
          save();
        } catch (e) {
          alert("Не скачалось: " + ((e && e.message) || e));
        }
        themeBusyId = "";
        render();
      });
    });

    app.querySelectorAll("[data-theme-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.themeApply;
        if (!id || themeBusyId) return;
        themeBusyId = id;
        render();
        try {
          await BossThemes.apply(id, state);
          save();
        } catch (e) {
          alert("Не включилось: " + ((e && e.message) || e));
        }
        themeBusyId = "";
        render();
      });
    });

    app.querySelectorAll("[data-theme-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.themeRemove;
        if (!id || themeBusyId) return;
        if (!confirm("Удалить тему с телефона? Потом можно скачать снова.")) return;
        themeBusyId = id;
        render();
        try {
          await BossThemes.remove(id, state);
          save();
        } catch (e) {
          alert("Не удалилось: " + ((e && e.message) || e));
        }
        themeBusyId = "";
        render();
      });
    });

    const themesReload = document.getElementById("themes-reload");
    if (themesReload) {
      themesReload.addEventListener("click", () => {
        themePacks = null;
        themeError = "";
        themesLoading = false;
        BossThemes._manifest = null;
        render();
      });
    }
  }

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-btn");
    if (!btn) return;
    setTab(btn.dataset.tab);
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!state.installDismissed) installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=" + VER).catch(() => {});
  }

  BossThemes.boot(state)
    .then(() => {
      Store.save(state);
    })
    .catch(() => {})
    .finally(() => {
      render();
    });
})();
