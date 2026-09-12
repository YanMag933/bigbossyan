window.Store = {
  KEY: "bigbossyan-v2",

  load() {
    try {
      let raw = localStorage.getItem(this.KEY);
      if (!raw) {
        const legacy = localStorage.getItem("bigbossyan-v1");
        if (legacy) raw = legacy;
      }
      if (!raw) return this.blank();
      const parsed = JSON.parse(raw);
      const state = {
        ...this.blank(),
        ...parsed,
        done: { ...this.blank().done, ...(parsed.done || {}) },
        notes: { ...this.blank().notes, ...(parsed.notes || {}) },
        overrides: { ...this.blank().overrides, ...(parsed.overrides || {}) },
        chat: { ...this.blank().chat, ...(parsed.chat || {}) },
        ai: { ...this.blank().ai, ...(parsed.ai || {}) },
        docs: { ...this.blank().docs, ...(parsed.docs || {}) },
      };
      this.migrate(state);
      return state;
    } catch {
      return this.blank();
    }
  },

  migrateBucket(obj, fromKeys, toKey) {
    if (!obj) return;
    for (const from of fromKeys) {
      if (obj[from] == null) {
        if (from !== toKey) delete obj[from];
        continue;
      }
      const target = obj[toKey];
      const targetEmpty =
        target == null ||
        target === "" ||
        (Array.isArray(target) && target.length === 0) ||
        (typeof target === "object" && !Array.isArray(target) && !Object.keys(target).length);
      if (targetEmpty) obj[toKey] = obj[from];
      if (from !== toKey) delete obj[from];
    }
  },

  migrate(state) {
    const oldIds = ["onboardOps", "smenaStart"];
    if (oldIds.includes(state.activeProject)) state.activeProject = "trailOn";

    this.migrateBucket(state.done, oldIds, "trailOn");
    this.migrateBucket(state.notes, oldIds, "trailOn");
    this.migrateBucket(state.overrides, oldIds, "trailOn");
    this.migrateBucket(state.chat, oldIds, "trailOn");

    (state.wins || []).forEach((w) => {
      if (oldIds.includes(w.projectId)) w.projectId = "trailOn";
    });
    if (state.tab === "boss") state.tab = "chat";
    if (state.ai) {
      state.ai.openrouterModel = "openrouter/free";
      if (state.ai.provider === "gemini") state.ai.provider = "openrouter";
      if (!state.ai.provider || state.ai.provider === "pollinations") state.ai.provider = "free";
      if (state.ai.apiKey && /^AIza/i.test(state.ai.apiKey)) {
        state.ai.apiKey = "";
      }
    }

    // Старые чаты были одним списком → переносим в «Бесплатный», OpenRouter пустой
    if (!state.chat || typeof state.chat !== "object") state.chat = {};
    for (const pid of ["lifeRpg", "trailOn"]) {
      const bucket = state.chat[pid];
      if (Array.isArray(bucket)) {
        state.chat[pid] = { free: bucket, openrouter: [] };
      } else if (!bucket || typeof bucket !== "object") {
        state.chat[pid] = { free: [], openrouter: [] };
      } else {
        if (!Array.isArray(bucket.free)) bucket.free = [];
        if (!Array.isArray(bucket.openrouter)) bucket.openrouter = [];
      }
    }
  },

  blank() {
    return {
      activeProject: "lifeRpg",
      tab: "hq",
      done: { lifeRpg: {}, trailOn: {} },
      notes: { lifeRpg: "", trailOn: "" },
      overrides: { lifeRpg: {}, trailOn: {} },
      wins: [],
      installDismissed: false,
      chat: {
        lifeRpg: { free: [], openrouter: [] },
        trailOn: { free: [], openrouter: [] },
      },
      ai: {
        provider: "free",
        apiKey: "",
        openrouterModel: "openrouter/free",
      },
      docs: { audience: "investor", lastFile: null },
    };
  },

  chatProvider(state) {
    const p = String((state && state.ai && state.ai.provider) || "free").toLowerCase();
    return p === "openrouter" || p === "gemini" ? "openrouter" : "free";
  },

  ensureChat(state, projectId) {
    if (!state.chat) state.chat = {};
    if (!state.chat[projectId] || Array.isArray(state.chat[projectId])) {
      const legacy = Array.isArray(state.chat[projectId]) ? state.chat[projectId] : [];
      state.chat[projectId] = { free: legacy, openrouter: [] };
    }
    if (!Array.isArray(state.chat[projectId].free)) state.chat[projectId].free = [];
    if (!Array.isArray(state.chat[projectId].openrouter)) state.chat[projectId].openrouter = [];
    return state.chat[projectId];
  },

  getChat(state, projectId, provider) {
    const bucket = this.ensureChat(state, projectId);
    const key = provider === "openrouter" ? "openrouter" : "free";
    return bucket[key];
  },

  setChat(state, projectId, provider, messages) {
    const bucket = this.ensureChat(state, projectId);
    const key = provider === "openrouter" ? "openrouter" : "free";
    bucket[key] = messages;
  },

  save(state) {
    localStorage.setItem(this.KEY, JSON.stringify(state));
  },

  reset() {
    localStorage.removeItem(this.KEY);
    localStorage.removeItem("bigbossyan-v1");
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
