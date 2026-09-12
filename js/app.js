(function () {
  "use strict";

  const VER = "5";
  let state = Store.load();
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
    save();
    render();
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

      <div class="section-title">Заметки босса</div>
      <div class="panel">
        <textarea class="notes-area" id="notes" placeholder="Мысли, цифры недели, блокеры…">${esc(state.notes[p.id] || "")}</textarea>
      </div>
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

  function renderChat() {
    const p = project();
    const msgs = (state.chat[p.id] || []).slice(-40);
    const hasKey = BossChat.hasKey(state);
    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(22px,6.5vw,30px)">Чат босса</h2>
        <p>Через OpenRouter — из РФ прямой Gemini часто блокируют по локации.</p>
      </div>

      <div class="panel">
        <label class="field">Ключ OpenRouter
          <input type="password" id="ai-key" value="${esc((state.ai && (state.ai.apiKey || state.ai.openrouterKey)) || "")}" placeholder="sk-or-…" autocomplete="off" />
        </label>
        <button type="button" class="btn secondary block" id="save-ai-key" style="margin-top:10px">Сохранить ключ</button>
        <p class="small muted" style="margin:10px 0 0;line-height:1.45">
          ${
            hasKey
              ? "Ключ сохранён. Модель видит прайс, прогресс и историю чата."
              : "1) openrouter.ai/keys → Create key  2) вставь сюда. Бесплатные модели с суффиксом :free."
          }
        </p>
      </div>

      <div class="chat-box panel" id="chat-box">
        ${
          msgs.length
            ? msgs
                .map(
                  (m) => `
          <div class="bubble ${m.role === "user" ? "me" : "bot"}">
            <div class="bubble-text">${esc(m.text)}</div>
            ${m.applied && m.applied.length ? `<div class="bubble-meta">Изменено в плане: ${esc(m.applied.join("; "))}</div>` : ""}
          </div>`
                )
                .join("")
            : `<div class="empty">${
                hasKey
                  ? "Спроси по делу: «предложи 3 варианта цены Стандарт и почему» — план сам не тронет, пока не скажешь «примени…»."
                  : "Сначала сохрани ключ OpenRouter — потом пиши вопросы."
              }</div>`
        }
        ${chatBusy ? '<div class="bubble bot"><div class="bubble-text">Думаю над ответом…</div></div>' : ""}
      </div>

      <form class="chat-form" id="chat-form">
        <input type="text" id="chat-input" maxlength="1200" placeholder="${hasKey ? "Сообщение…" : "Сначала ключ OpenRouter"}" autocomplete="off" ${chatBusy || !hasKey ? "disabled" : ""} />
        <button type="submit" class="btn" ${chatBusy || !hasKey ? "disabled" : ""}>→</button>
      </form>

      <div class="section-title">Сброс</div>
      <div class="panel">
        <button type="button" class="btn secondary block" id="clear-chat">Очистить чат проекта</button>
        <button type="button" class="btn secondary block" id="reset-btn" style="margin-top:8px">Сбросить весь прогресс</button>
      </div>
    `;
  }

  function renderDocs() {
    const p = project();
    const aud = state.docs.audience || "investor";
    const list = Object.values(BossDocs.audiences);
    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(22px,6.5vw,30px)">Документ</h2>
        <p>Word по актуальным ценам, прогрессу и победам. Три аудитории — три разных текста.</p>
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
        <button type="button" class="btn block" id="doc-generate" ${docsBusy ? "disabled" : ""}>
          ${docsBusy ? "Собираю Word…" : "Сгенерировать .docx"}
        </button>
        ${
          lastDoc
            ? `<div class="stack" style="margin-top:12px">
                <p class="small" style="margin:0;line-height:1.4">Готово: <strong>${esc(lastDoc.filename)}</strong></p>
                <button type="button" class="btn secondary block" id="doc-download">Скачать</button>
                <button type="button" class="btn secondary block" id="doc-share">Поделиться / мессенджер</button>
                <a class="btn ghost block" id="doc-mail" href="${BossDocs.mailtoLink(lastDoc.title)}" style="text-align:center;text-decoration:none">Открыть почту</a>
                <p class="tiny muted" style="margin:0;line-height:1.4;text-transform:none;letter-spacing:0">На iPhone «Поделиться» откроет Telegram / Max / Files. Письмо — приложи файл вручную.</p>
              </div>`
            : ""
        }
      </div>

      <div class="section-title">Что попадёт внутрь</div>
      <div class="panel">
        <ul class="doc-preview">
          <li>Название и позиция проекта</li>
          <li>Прайс и юнит (включая твои правки из чата)</li>
          <li>Прогресс плана ${Store.progress(p.id, state).pct}%</li>
          <li>Победы и следующий шаг под аудиторию</li>
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

  async function sendChat(text) {
    const msg = (text || "").trim();
    if (!msg || chatBusy) return;
    if (!BossChat.hasKey(state)) {
      render();
      return;
    }
    const pid = state.activeProject;
    if (!state.chat[pid]) state.chat[pid] = [];
    state.chat[pid].push({ role: "user", text: msg, at: Date.now() });
    chatBusy = true;
    save();
    render();

    try {
      const result = await BossChat.ask(msg, pid, state);
      const applied = ProjectLive.applyPatches(state, result.patches || []);
      state.chat[pid].push({
        role: "assistant",
        text: result.reply,
        applied,
        at: Date.now(),
      });
      if (state.chat[pid].length > 60) state.chat[pid] = state.chat[pid].slice(-60);
    } catch (e) {
      state.chat[pid].push({
        role: "assistant",
        text: "Не получилось достучаться до модели: " + String(e.message || e),
        at: Date.now(),
      });
    }
    chatBusy = false;
    save();
    render();
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

    const notes = document.getElementById("notes");
    if (notes) {
      const persist = () => {
        state.notes[state.activeProject] = notes.value;
        save();
      };
      notes.addEventListener("change", persist);
      notes.addEventListener("blur", persist);
    }

    app.querySelectorAll("[data-ai-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.ai.mode = btn.dataset.aiMode;
        save();
        render();
      });
    });

    const geminiKey = document.getElementById("ai-key") || document.getElementById("gemini-key");
    if (geminiKey) {
      geminiKey.addEventListener("change", () => {
        state.ai.apiKey = geminiKey.value.trim();
        save();
      });
    }

    const saveGemini = document.getElementById("save-ai-key") || document.getElementById("save-gemini");
    if (saveGemini) {
      saveGemini.addEventListener("click", () => {
        const input = document.getElementById("ai-key") || document.getElementById("gemini-key");
        state.ai.apiKey = (input && input.value ? input.value : "").trim();
        state.ai.model = "deepseek/deepseek-chat-v3-0324:free";
        save();
        render();
      });
    }

    const clearChat = document.getElementById("clear-chat");
    if (clearChat) {
      clearChat.addEventListener("click", () => {
        state.chat[state.activeProject] = [];
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

    app.querySelectorAll("[data-audience]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.docs.audience = btn.dataset.audience;
        save();
        render();
      });
    });

    const gen = document.getElementById("doc-generate");
    if (gen) gen.addEventListener("click", () => generateDoc());

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
