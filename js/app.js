(function () {
  "use strict";

  const VER = "29";
  let state = Store.load();
  BossDocs.syncAll(state);
  Store.save(state);
  let deferredPrompt = null;
  let chatBusy = false;
  let lastDoc = null;
  let docsBusy = false;

  const app = document.getElementById("app");
  const topTitle = document.getElementById("top-title");
  const installBtn = document.getElementById("install-btn");
  const nav = document.getElementById("bottom-nav");

  const TAB_TITLES = {
    hq: "Штаб",
    plan: "План",
    analytics: "Аналитика",
    chat: "Чат",
    docs: "Документ",
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
    save();
    render();
  }

  function setProject(id) {
    if (!BossData.projects[id]) return;
    state.activeProject = id;
    if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null };
    state.ui.notesMode = "closed";
    state.ui.editingNoteId = null;
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

  function chatModeSwitchHtml() {
    const mode = chatMode();
    return `
      <div class="project-switch chat-mode-switch" role="tablist" aria-label="Режим чата">
        <button type="button" class="project-btn ${mode === "ai" ? "active" : ""}" data-chat-mode="ai">
          <strong>ИИ</strong>
          <span>ChatGPT · советы</span>
        </button>
        <button type="button" class="project-btn ${mode === "project" ? "active" : ""}" data-chat-mode="project">
          <strong>Проект</strong>
          <span>поиск и правки</span>
        </button>
      </div>`;
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
            : '<div class="panel empty">Все задачи отмечены. Напиши в Чат или сгенерируй документ.</div>'
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
    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(24px,7vw,32px)">Аналитика</h2>
        <p>${esc(p.oneLiner)}</p>
      </div>

      <div class="section-title">Рынок и позиция</div>
      <div class="metric-grid">
        ${a.market
          .map(
            (m) => `
          <div class="metric">
            <div class="label">${esc(m.label)}</div>
            <div class="value">${esc(m.value)}</div>
            ${m.note ? `<div class="note">${esc(m.note)}</div>` : ""}
          </div>`
          )
          .join("")}
      </div>

      <div class="section-title">Юнит / прайс</div>
      <div class="panel">
        <div class="metric-grid" style="margin-bottom:8px">
          ${a.unit
            .map(
              (m) => `
            <div class="metric">
              <div class="label">${esc(m.label)}</div>
              <div class="value" style="font-size:15px">${esc(m.value)}</div>
              ${m.note ? `<div class="note">${esc(m.note)}</div>` : ""}
            </div>`
            )
            .join("")}
        </div>
        ${a.pricing
          .map(
            (pr) => `
          <div class="price-row">
            <span>${esc(pr.name)}<div class="tiny muted" style="margin-top:2px;text-transform:none;letter-spacing:0">${esc(pr.forWhom)}</div></span>
            <strong>${esc(pr.price)}</strong>
          </div>`
          )
          .join("")}
      </div>

      <div class="section-title">Сценарии</div>
      <div class="stack">
        ${a.scenarios
          .map(
            (s) => `
          <div class="scenario">
            <h4>${esc(s.name)}</h4>
            <p><strong style="color:var(--text)">Капитал:</strong> ${esc(s.capital)}</p>
            <p><strong style="color:var(--text)">Ориентир:</strong> ${esc(s.year1)}</p>
            <p>${esc(s.focus)}</p>
          </div>`
          )
          .join("")}
      </div>

      <div class="section-title">Воронка (цель)</div>
      <div class="panel funnel">
        ${a.funnel
          .map((f, i) => {
            const width = 100 - i * 12;
            return `
            <div class="funnel-row">
              <div class="funnel-bar" style="width:${width}%">${esc(f.step)}</div>
              <span class="muted small">${esc(f.n)}</span>
            </div>`;
          })
          .join("")}
      </div>

      <div class="section-title">Кому продавать</div>
      <div class="stack">
        ${a.personas
          .map(
            (pe) => `
          <div class="panel">
            <div class="tag gold">${esc(pe.name)}</div>
            <p class="small muted" style="margin:10px 0 0;line-height:1.45">${esc(pe.text)}</p>
          </div>`
          )
          .join("")}
      </div>

      <div class="section-title">SWOT</div>
      <div class="panel swot-grid">
        <div class="swot-block"><h4>Сильные</h4><ul>${p.swot.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="swot-block"><h4>Слабые</h4><ul>${p.swot.weaknesses.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="swot-block"><h4>Возможности</h4><ul>${p.swot.opportunities.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="swot-block"><h4>Угрозы</h4><ul>${p.swot.threats.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </div>

      <div class="section-title">Советы</div>
      <div class="stack">
        ${p.recommendations
          .map(
            (r) => `
          <div class="panel reco ${esc(r.priority)}">
            <div class="row between wrap">
              <h4>${esc(r.title)}</h4>
              <span class="tag ${r.priority === "high" ? "gold" : ""}">${esc(r.priority)}</span>
            </div>
            <p>${esc(r.body)}</p>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  function chatMode() {
    return state.ui && state.ui.chatMode === "project" ? "project" : "ai";
  }

  function renderChatBubble(m, mode) {
    const pending =
      mode === "project" &&
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
            ? `<div class="bubble-meta">Изменено: ${esc(m.applied.join("; "))}</div>`
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
    const mode = chatMode();
    const msgs =
      mode === "project"
        ? Store.getProjectChat(state, p.id).slice(-40)
        : Store.getChat(state, p.id).slice(-40);
    const hasKey = BossChat.hasKey(state);
    const showKey = !!(state.ai && state.ai.showKeyEditor) || !hasKey;
    const empty =
      mode === "project"
        ? "Спроси точно: «цены», «патент», «прогресс». Или: «измени цену Стандарта на 10900»."
        : hasKey
          ? "Спроси совет: «что важнее на этой неделе?», «риски оффера», «нужен ли патент?»…"
          : "Сначала вставь OpenAI API key (sk-…) — ChatGPT заработает. В РФ включи VPN.";
    return `
      ${projectSwitchHtml()}
      ${chatModeSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(22px,6.5vw,30px)">${mode === "project" ? "Чат проекта" : "Чат ИИ"}</h2>
        <p>${
          mode === "project"
            ? "Точные факты из плана, Word и ИС — без лишнего шума, правки с подтверждением."
            : "ChatGPT через OpenAI API: анализ и советы. VPN — если api.openai.com недоступен."
        }</p>
      </div>

      <div class="panel">
        ${
          mode === "ai"
            ? `<p class="small" style="margin:0;line-height:1.45;color:var(--gold,#d4af37)">${esc(BossChat.modelLabel(state))}</p>
               ${
                 hasKey
                   ? `<p class="small muted" style="margin:8px 0 0;line-height:1.45">Ключ: ${esc(BossChat.keyHint(BossChat.getKey(state)))}. <button type="button" class="linkish" id="toggle-openai-key">Сменить</button></p>
                      <label class="field" style="margin-top:10px">Модель
                        <select id="openai-model-select">
                          ${BossChat.MODELS.map(
                            (m) =>
                              `<option value="${esc(m)}" ${BossChat.model(state) === m ? "selected" : ""}>${esc(m)}</option>`
                          ).join("")}
                        </select>
                      </label>
                      <p class="tiny muted" style="margin:8px 0 0;line-height:1.4;text-transform:none;letter-spacing:0">Если «лимит/биллинг» — пополни OpenAI Billing. Если 404 — смени модель. VPN включи до отправки.</p>`
                   : `<p class="small muted" style="margin:8px 0 0;line-height:1.45">Ключ: platform.openai.com → API keys. Нужен баланс в Billing. В РФ — VPN.</p>`
               }
               ${
                 showKey
                   ? `<form id="openai-key-form" class="stack" style="margin-top:12px">
                        <label class="field">OpenAI API key
                          <input type="password" id="openai-key-input" placeholder="sk-… или sk-proj-…" autocomplete="off" maxlength="300" />
                        </label>
                        <button type="submit" class="btn block">Сохранить ключ</button>
                      </form>`
                   : ""
               }`
            : `<p class="small muted" style="margin:0;line-height:1.45">Отвечает коротко по теме запроса. Правки — только после «да» / кнопки.</p>`
        }
      </div>

      <div class="section-title">Сообщения</div>
      <div class="chat-box panel" id="chat-box">
        ${
          msgs.length
            ? msgs.map((m) => renderChatBubble(m, mode)).join("")
            : `<div class="empty">${empty}</div>`
        }
        ${
          chatBusy
            ? `<div class="bubble bot"><div class="bubble-text">${
                mode === "project" ? "Смотрю в проект…" : "Думаю над ответом…"
              }</div></div>`
            : ""
        }
      </div>

      <form class="chat-form" id="chat-form">
        <input type="text" id="chat-input" maxlength="1200" placeholder="${
          mode === "project" ? "Поиск или правка…" : "Сообщение…"
        }" autocomplete="off" ${chatBusy ? "disabled" : ""} />
        <button type="submit" class="btn" ${chatBusy ? "disabled" : ""}>→</button>
      </form>

      <div class="section-title">Сброс</div>
      <div class="panel">
        <button type="button" class="btn secondary block" id="clear-chat">Очистить этот чат</button>
        <button type="button" class="btn secondary block" id="reset-btn" style="margin-top:8px">Сбросить весь прогресс</button>
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
        <p>Смотри текст на телефоне внутри приложения — или скачай .docx. База для чата «Проект» обновляется сама.</p>
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
    else html = renderDocs();

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
    if (applied.length) msg.text = (msg.text ? msg.text + "\n\n" : "") + "Готово.";
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
        text: applied.length ? "Применил: " + applied.join("; ") : "Нечего применять.",
        applied,
        at: Date.now(),
        via: "project",
      });
    } else if (result.rejectPendingId != null) {
      rejectPendingMessage(resolvePendingByAt(thread, result.rejectPendingId));
      thread.push({
        role: "assistant",
        text: result.reply || "Правка отклонена.",
        rejected: true,
        at: Date.now(),
        via: "project",
      });
    } else if (result.needsConfirm && result.patches && result.patches.length) {
      thread.push({
        role: "assistant",
        text: result.reply,
        pendingPatches: result.patches,
        at: Date.now(),
        via: "project",
      });
    } else {
      thread.push({
        role: "assistant",
        text: result.reply,
        at: Date.now(),
        via: "project",
      });
    }

    if (thread.length > 60) Store.setProjectChat(state, pid, thread.slice(-60));
    save();
    render();
  }

  async function sendAiChat(text) {
    const msg = (text || "").trim();
    if (!msg || chatBusy) return;
    if (!BossChat.hasKey(state)) {
      if (!state.ai) state.ai = {};
      state.ai.showKeyEditor = true;
      save();
      render();
      return;
    }
    const pid = state.activeProject;
    const thread = Store.getChat(state, pid);
    thread.push({ role: "user", text: msg, at: Date.now() });
    chatBusy = true;
    save();
    render();

    try {
      const result = await BossChat.ask(msg, pid, state);
      const applied = ProjectLive.applyPatches(state, result.patches || []);
      thread.push({
        role: "assistant",
        text: result.reply,
        applied,
        at: Date.now(),
        via: BossChat.mode(),
      });
      if (thread.length > 60) Store.setChat(state, pid, thread.slice(-60));
    } catch (e) {
      thread.push({
        role: "assistant",
        text: "Не получилось: " + BossChat.friendlyError(e),
        at: Date.now(),
      });
    }
    chatBusy = false;
    save();
    render();
  }

  function sendChat(text) {
    if (chatMode() === "project") sendProjectChat(text);
    else sendAiChat(text);
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
        if (chatMode() === "project") Store.setProjectChat(state, state.activeProject, []);
        else Store.setChat(state, state.activeProject, []);
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

    const keyForm = document.getElementById("openai-key-form");
    if (keyForm) {
      keyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("openai-key-input");
        const key = String((input && input.value) || "").trim();
        if (!state.ai) state.ai = {};
        if (!/^sk-[A-Za-z0-9_\-]{16,}$/.test(key)) {
          alert("Ключ должен начинаться с sk- или sk-proj-. Возьми API key на platform.openai.com");
          return;
        }
        state.ai.openaiKey = key;
        state.ai.apiKey = key;
        state.ai.keyOk = true;
        state.ai.showKeyEditor = false;
        state.ai.provider = "openai";
        if (!state.ai.openaiModel) state.ai.openaiModel = "gpt-4o-mini";
        save();
        render();
      });
    }

    const toggleKey = document.getElementById("toggle-openai-key");
    if (toggleKey) {
      toggleKey.addEventListener("click", () => {
        if (!state.ai) state.ai = {};
        state.ai.showKeyEditor = !state.ai.showKeyEditor;
        save();
        render();
      });
    }

    const modelSelect = document.getElementById("openai-model-select");
    if (modelSelect) {
      modelSelect.addEventListener("change", () => {
        if (!state.ai) state.ai = {};
        state.ai.openaiModel = modelSelect.value || "gpt-4o-mini";
        save();
        render();
      });
    }

    app.querySelectorAll("[data-chat-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.ui) state.ui = { notesMode: "closed", editingNoteId: null, chatMode: "ai" };
        state.ui.chatMode = btn.dataset.chatMode === "project" ? "project" : "ai";
        save();
        render();
      });
    });

    app.querySelectorAll("[data-confirm-patch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const thread = Store.getProjectChat(state, state.activeProject);
        const pending = resolvePendingByAt(thread, btn.dataset.confirmPatch);
        const applied = applyPendingMessage(pending);
        if (applied.length) {
          thread.push({
            role: "assistant",
            text: "Применил: " + applied.join("; "),
            applied,
            at: Date.now(),
            via: "project",
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
          via: "project",
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

  render();
})();
