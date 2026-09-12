(function () {
  "use strict";

  const VER = "1";
  let state = Store.load();
  let deferredPrompt = null;

  const app = document.getElementById("app");
  const topTitle = document.getElementById("top-title");
  const installBtn = document.getElementById("install-btn");
  const nav = document.getElementById("bottom-nav");

  const TAB_TITLES = {
    hq: "Штаб",
    plan: "План",
    analytics: "Аналитика",
    boss: "Советы",
  };

  function project() {
    return BossData.projects[state.activeProject];
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
    if (state.done[pid][taskId]) {
      delete state.done[pid][taskId];
    } else {
      state.done[pid][taskId] = Date.now();
    }
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
    const a = BossData.projects.lifeRpg;
    const b = BossData.projects.onboardOps;
    return `
      <div class="project-switch" role="tablist" aria-label="Проекты">
        <button type="button" class="project-btn ${state.activeProject === "lifeRpg" ? "active" : ""}" data-project="lifeRpg">
          <strong>${esc(a.name)}</strong>
          <span>${esc(a.short)}</span>
        </button>
        <button type="button" class="project-btn ${state.activeProject === "onboardOps" ? "active" : ""}" data-project="onboardOps">
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
    const otherId = p.id === "lifeRpg" ? "onboardOps" : "lifeRpg";
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
            <div class="small muted" style="margin-top:8px">Второй проект: ${esc(BossData.projects[otherId].name)} — ${otherProg.pct}%</div>
          </div>
        </div>
      </div>

      <div class="section-title">Сделать дальше</div>
      <div class="stack">
        ${
          next.length
            ? next.map((t) => taskHtml(t, t.phaseTitle)).join("")
            : '<div class="panel empty">Все задачи отмечены. Добавь победу ниже или открой Аналитику.</div>'
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
        <div class="swot-block">
          <h4>Сильные</h4>
          <ul>${p.swot.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        <div class="swot-block">
          <h4>Слабые</h4>
          <ul>${p.swot.weaknesses.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        <div class="swot-block">
          <h4>Возможности</h4>
          <ul>${p.swot.opportunities.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        <div class="swot-block">
          <h4>Угрозы</h4>
          <ul>${p.swot.threats.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
      </div>
    `;
  }

  function renderBoss() {
    const p = project();
    return `
      ${projectSwitchHtml()}
      <div class="hero-block">
        <h2 style="font-size:clamp(24px,7vw,32px)">Советы босса</h2>
        <p>Приоритеты из бизнес-планов. Высокий — делай раньше фич «для красоты».</p>
      </div>
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
      <div class="section-title">Сброс</div>
      <div class="panel">
        <p class="small muted" style="margin:0 0 12px;line-height:1.4">Данные только на этом устройстве (localStorage). Сброс очистит галочки, заметки и победы.</p>
        <button type="button" class="btn secondary block" id="reset-btn">Сбросить прогресс</button>
      </div>
    `;
  }

  function render() {
    const titles = TAB_TITLES;
    topTitle.textContent = titles[state.tab] || "Штаб";
    nav.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === state.tab);
    });

    let html = "";
    if (state.tab === "hq") html = renderHq();
    else if (state.tab === "plan") html = renderPlan();
    else if (state.tab === "analytics") html = renderAnalytics();
    else html = renderBoss();

    app.innerHTML = html;
    bindView();
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
      notes.addEventListener("change", () => {
        state.notes[state.activeProject] = notes.value;
        save();
      });
      notes.addEventListener("blur", () => {
        state.notes[state.activeProject] = notes.value;
        save();
      });
    }

    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("Сбросить весь прогресс BigBossYan на этом устройстве?")) {
          Store.reset();
          state = Store.load();
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
