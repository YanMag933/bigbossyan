window.ProjectLive = {
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  get(projectId, state) {
    const base = window.BossData.projects[projectId];
    if (!base) return null;
    const live = this.deepClone(base);
    const ov = (state && state.overrides && state.overrides[projectId]) || {};

    if (ov.name) live.name = ov.name;
    if (ov.short) live.short = ov.short;
    if (ov.tagline) live.tagline = ov.tagline;
    if (ov.oneLiner) live.oneLiner = ov.oneLiner;
    if (ov.position) live.position = ov.position;
    if (ov.stage) live.stage = ov.stage;

    if (ov.pricing && live.analytics && live.analytics.pricing) {
      live.analytics.pricing = live.analytics.pricing.map((row) => {
        const patch = ov.pricing.find(
          (p) => String(p.name).toLowerCase() === String(row.name).toLowerCase()
        );
        return patch ? { ...row, ...patch } : row;
      });
      ov.pricing.forEach((p) => {
        const exists = live.analytics.pricing.some(
          (r) => String(r.name).toLowerCase() === String(p.name).toLowerCase()
        );
        if (!exists) live.analytics.pricing.push({ ...p });
      });
    }

    if (ov.unit && live.analytics && live.analytics.unit) {
      live.analytics.unit = live.analytics.unit.map((row) => {
        const patch = ov.unit.find(
          (p) => String(p.label).toLowerCase() === String(row.label).toLowerCase()
        );
        return patch ? { ...row, ...patch } : row;
      });
    }

    if (ov.recommendations) live.recommendations = ov.recommendations;
    if (ov.swot) live.swot = { ...live.swot, ...ov.swot };
    return live;
  },

  listIds() {
    return Object.keys(window.BossData.projects);
  },

  applyPatches(state, patches) {
    if (!state.overrides) state.overrides = {};
    const applied = [];
    for (const patch of patches || []) {
      const pid = patch.projectId || state.activeProject;
      if (!window.BossData.projects[pid]) continue;
      if (!state.overrides[pid]) state.overrides[pid] = {};
      const ov = state.overrides[pid];

      if (patch.op === "setPrice" || patch.op === "set_pricing") {
        if (!ov.pricing) ov.pricing = [];
        const name = patch.package || patch.name;
        const price = patch.price;
        if (!name || !price) continue;
        const idx = ov.pricing.findIndex(
          (p) => String(p.name).toLowerCase() === String(name).toLowerCase()
        );
        const row = {
          name,
          price: String(price),
          forWhom: patch.forWhom || (idx >= 0 ? ov.pricing[idx].forWhom : ""),
        };
        if (idx >= 0) ov.pricing[idx] = { ...ov.pricing[idx], ...row };
        else ov.pricing.push(row);
        applied.push(`Цена «${name}» → ${row.price} (${window.BossData.projects[pid].name})`);
      } else if (patch.op === "setField" || patch.op === "set_field") {
        const field = patch.field;
        if (["name", "short", "tagline", "oneLiner", "position", "stage"].includes(field) && patch.value != null) {
          ov[field] = String(patch.value);
          applied.push(`${field} обновлён`);
        }
      } else if (patch.op === "setUnit" || patch.op === "set_unit") {
        if (!ov.unit) ov.unit = [];
        const label = patch.label;
        if (!label) continue;
        const idx = ov.unit.findIndex(
          (u) => String(u.label).toLowerCase() === String(label).toLowerCase()
        );
        const row = { label, value: String(patch.value || ""), note: patch.note || "" };
        if (idx >= 0) ov.unit[idx] = { ...ov.unit[idx], ...row };
        else ov.unit.push(row);
        applied.push(`Юнит «${label}» → ${row.value}`);
      } else if (patch.op === "addWin" || patch.op === "add_win") {
        if (patch.text) {
          state.wins = state.wins || [];
          state.wins.unshift({
            id: "w-" + Date.now() + Math.random().toString(16).slice(2, 6),
            text: String(patch.text),
            projectId: pid,
            at: Date.now(),
          });
          applied.push("Победа записана");
        }
      } else if (patch.op === "completeTask" || patch.op === "complete_task") {
        if (!state.done[pid]) state.done[pid] = {};
        if (patch.taskId) {
          state.done[pid][patch.taskId] = Date.now();
          applied.push("Задача отмечена");
        }
      }
    }
    return applied;
  },

  contextForAi(projectId, state) {
    const p = this.get(projectId, state);
    const prog = window.Store.progress(projectId, state);
    const wins = (state.wins || []).filter((w) => w.projectId === projectId).slice(0, 8);
    return {
      projectId: p.id,
      name: p.name,
      short: p.short,
      stage: p.stage,
      tagline: p.tagline,
      oneLiner: p.oneLiner,
      position: p.position,
      progressPct: prog.pct,
      tasksDone: prog.done,
      tasksTotal: prog.total,
      pricing: p.analytics.pricing,
      unit: p.analytics.unit,
      scenarios: p.analytics.scenarios,
      recommendations: p.recommendations,
      swot: p.swot,
      nextTasks: window.Store.nextTasks(projectId, state, 6).map((t) => ({
        id: t.id,
        title: t.title,
        phase: t.phaseTitle,
      })),
      recentWins: wins.map((w) => w.text),
      notes: (state.notes && state.notes[projectId]) || "",
    };
  },
};
