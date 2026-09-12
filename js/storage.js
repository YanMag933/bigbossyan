window.Store = {
  KEY: "bigbossyan-v1",

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.blank();
      const parsed = JSON.parse(raw);
      return {
        ...this.blank(),
        ...parsed,
        done: { ...this.blank().done, ...(parsed.done || {}) },
        notes: { ...this.blank().notes, ...(parsed.notes || {}) },
      };
    } catch {
      return this.blank();
    }
  },

  blank() {
    return {
      activeProject: "lifeRpg",
      tab: "hq",
      done: { lifeRpg: {}, onboardOps: {} },
      notes: { lifeRpg: "", onboardOps: "" },
      wins: [],
      installDismissed: false,
    };
  },

  save(state) {
    localStorage.setItem(this.KEY, JSON.stringify(state));
  },

  reset() {
    localStorage.removeItem(this.KEY);
  },

  progress(projectId, state) {
    const project = window.BossData.projects[projectId];
    if (!project) return { done: 0, total: 0, pct: 0, weightedDone: 0, weightedTotal: 0 };
    let weightedTotal = 0;
    let weightedDone = 0;
    let total = 0;
    let done = 0;
    const map = (state.done && state.done[projectId]) || {};
    for (const phase of project.phases) {
      for (const task of phase.tasks) {
        const w = task.weight || 1;
        weightedTotal += w;
        total += 1;
        if (map[task.id]) {
          weightedDone += w;
          done += 1;
        }
      }
    }
    const pct = weightedTotal ? Math.round((weightedDone / weightedTotal) * 100) : 0;
    return { done, total, pct, weightedDone, weightedTotal };
  },

  phaseProgress(projectId, phase, state) {
    const map = (state.done && state.done[projectId]) || {};
    let weightedTotal = 0;
    let weightedDone = 0;
    let total = 0;
    let done = 0;
    for (const task of phase.tasks) {
      const w = task.weight || 1;
      weightedTotal += w;
      total += 1;
      if (map[task.id]) {
        weightedDone += w;
        done += 1;
      }
    }
    const pct = weightedTotal ? Math.round((weightedDone / weightedTotal) * 100) : 0;
    return { done, total, pct };
  },

  nextTasks(projectId, state, limit) {
    const project = window.BossData.projects[projectId];
    const map = (state.done && state.done[projectId]) || {};
    const out = [];
    for (const phase of project.phases) {
      for (const task of phase.tasks) {
        if (!map[task.id]) {
          out.push({ ...task, phaseTitle: phase.title, phaseId: phase.id });
          if (out.length >= (limit || 5)) return out;
        }
      }
    }
    return out;
  },
};
