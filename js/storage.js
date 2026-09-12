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
        ui: { ...this.blank().ui, ...(parsed.ui || {}) },
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
      if (state.ai.provider === "gemini" || state.ai.provider === "openrouter" || state.ai.provider === "pollinations") {
        state.ai.provider = "auto";
      }
      if (!state.ai.provider) state.ai.provider = "auto";
      if (state.ai.apiKey && /^AIza/i.test(state.ai.apiKey)) {
        state.ai.apiKey = "";
        state.ai.keyOk = false;
      }
      // старый OpenRouter ключ больше не основной канал
      if (state.ai.apiKey && /^sk-or-/i.test(state.ai.apiKey)) {
        state.ai.openrouterKeyLegacy = state.ai.apiKey;
        state.ai.apiKey = "";
        state.ai.keyOk = false;
        state.ai.keyFp = "";
        state.ai.keyStatus = "Нужен ключ Qwen (sk-…), не OpenRouter.";
        state.ai.showKeyEditor = true;
      }
      if (!state.ai.qwenModel) state.ai.qwenModel = "qwen-plus";
    }

    // Один общий чат на проект (склеиваем старые free + openrouter)
    if (!state.chat || typeof state.chat !== "object") state.chat = {};
    for (const pid of ["lifeRpg", "trailOn"]) {
      const bucket = state.chat[pid];
      if (Array.isArray(bucket)) {
        state.chat[pid] = bucket;
      } else if (bucket && typeof bucket === "object") {
        const merged = []
          .concat(Array.isArray(bucket.main) ? bucket.main : [])
          .concat(Array.isArray(bucket.free) ? bucket.free : [])
          .concat(Array.isArray(bucket.openrouter) ? bucket.openrouter : [])
          .concat(Array.isArray(bucket.qwen) ? bucket.qwen : []);
        merged.sort((a, b) => (a.at || 0) - (b.at || 0));
        state.chat[pid] = merged.slice(-80);
      } else {
        state.chat[pid] = [];
      }
    }

    // Заметки: строка → массив карточек
    if (!state.notes || typeof state.notes !== "object") state.notes = {};
    for (const pid of ["lifeRpg", "trailOn"]) {
      const n = state.notes[pid];
      if (typeof n === "string") {
        const body = n.trim();
        state.notes[pid] = body
          ? [
              {
                id: "legacy-" + pid,
                title: "Из старых заметок",
                body,
                at: Date.now(),
                updatedAt: Date.now(),
              },
            ]
          : [];
      } else if (!Array.isArray(n)) {
        state.notes[pid] = [];
      }
    }

    if (!state.ui || typeof state.ui !== "object") {
      state.ui = { notesMode: "closed", editingNoteId: null };
    } else {
      if (!state.ui.notesMode) state.ui.notesMode = "closed";
      if (state.ui.editingNoteId === undefined) state.ui.editingNoteId = null;
    }
  },

  blank() {
    return {
      activeProject: "lifeRpg",
      tab: "hq",
      done: { lifeRpg: {}, trailOn: {} },
      notes: { lifeRpg: [], trailOn: [] },
      overrides: { lifeRpg: {}, trailOn: {} },
      wins: [],
      installDismissed: false,
      chat: {
        lifeRpg: [],
        trailOn: [],
      },
      ai: {
        provider: "auto",
        apiKey: "",
        qwenModel: "qwen-plus",
        keyOk: false,
        keyFp: "",
        keyStatus: "",
        showKeyEditor: true,
      },
      ui: { notesMode: "closed", editingNoteId: null },
      docs: { audience: "investor", lastFile: null },
    };
  },

  ensureNotes(state, projectId) {
    if (!state.notes) state.notes = {};
    if (typeof state.notes[projectId] === "string") {
      const body = String(state.notes[projectId] || "").trim();
      state.notes[projectId] = body
        ? [{ id: "legacy-" + projectId, title: "Из старых заметок", body, at: Date.now(), updatedAt: Date.now() }]
        : [];
    }
    if (!Array.isArray(state.notes[projectId])) state.notes[projectId] = [];
    return state.notes[projectId];
  },

  notesList(state, projectId) {
    return this.ensureNotes(state, projectId)
      .slice()
      .sort((a, b) => (b.updatedAt || b.at || 0) - (a.updatedAt || a.at || 0));
  },

  addNote(state, projectId, title, body) {
    const list = this.ensureNotes(state, projectId);
    const now = Date.now();
    const note = {
      id: "n" + now.toString(36) + Math.random().toString(36).slice(2, 7),
      title: String(title || "").trim() || "Без названия",
      body: String(body || "").trim(),
      at: now,
      updatedAt: now,
    };
    if (!note.body) return null;
    list.unshift(note);
    return note;
  },

  updateNote(state, projectId, noteId, title, body) {
    const list = this.ensureNotes(state, projectId);
    const note = list.find((n) => n.id === noteId);
    if (!note) return null;
    note.title = String(title || "").trim() || "Без названия";
    note.body = String(body || "").trim();
    note.updatedAt = Date.now();
    return note;
  },

  removeNote(state, projectId, noteId) {
    const list = this.ensureNotes(state, projectId);
    const idx = list.findIndex((n) => n.id === noteId);
    if (idx < 0) return false;
    list.splice(idx, 1);
    return true;
  },

  notesForAi(state, projectId, limit) {
    return this.notesList(state, projectId)
      .slice(0, limit || 6)
      .map((n) => ({ title: n.title, body: n.body }));
  },

  ensureChat(state, projectId) {
    if (!state.chat) state.chat = {};
    const bucket = state.chat[projectId];
    if (Array.isArray(bucket)) return bucket;
    if (bucket && typeof bucket === "object") {
      const merged = []
        .concat(Array.isArray(bucket.main) ? bucket.main : [])
        .concat(Array.isArray(bucket.free) ? bucket.free : [])
        .concat(Array.isArray(bucket.openrouter) ? bucket.openrouter : [])
        .concat(Array.isArray(bucket.qwen) ? bucket.qwen : []);
      state.chat[projectId] = merged;
      return state.chat[projectId];
    }
    state.chat[projectId] = [];
    return state.chat[projectId];
  },

  getChat(state, projectId) {
    return this.ensureChat(state, projectId);
  },

  setChat(state, projectId, messages) {
    if (!state.chat) state.chat = {};
    state.chat[projectId] = Array.isArray(messages) ? messages : [];
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
