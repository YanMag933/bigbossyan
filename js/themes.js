window.BossThemes = {
  CACHE: "bigbossyan-themes-v2",
  STYLE_ID: "boss-theme-pack",
  MANIFEST_URL: "./themes/manifest.json",
  BUILTIN: "classic",

  _manifest: null,
  _busy: null,
  _textureUrl: null,

  builtinMeta() {
    return {
      id: "classic",
      name: "Classic Gold",
      blurb: "Текущий штаб: чёрный графит и золото. Уже в приложении.",
      builtin: true,
      bytes: 0,
      preview: "./themes/packs/classic/preview.svg",
    };
  },

  async openCache() {
    return caches.open(this.CACHE);
  },

  packUrl(id, file) {
    return "./themes/packs/" + encodeURIComponent(id) + "/" + file;
  },

  async loadManifest(force) {
    if (this._manifest && !force) return this._manifest;
    const res = await fetch(this.MANIFEST_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить список тем (" + res.status + ")");
    const data = await res.json();
    this._manifest = data;
    return data;
  },

  async listPacks() {
    const man = await this.loadManifest();
    const packs = Array.isArray(man.packs) ? man.packs.slice() : [];
    return [this.builtinMeta(), ...packs];
  },

  ensureState(state) {
    if (!state.ui) state.ui = {};
    if (!state.ui.themes) {
      state.ui.themes = { active: this.BUILTIN, installed: [] };
    }
    if (!Array.isArray(state.ui.themes.installed)) state.ui.themes.installed = [];
    if (!state.ui.themes.active) state.ui.themes.active = this.BUILTIN;
    return state.ui.themes;
  },

  isInstalled(state, id) {
    if (id === this.BUILTIN) return true;
    const t = this.ensureState(state);
    return t.installed.indexOf(id) >= 0;
  },

  activeId(state) {
    return this.ensureState(state).active || this.BUILTIN;
  },

  async isCached(id) {
    if (id === this.BUILTIN) return true;
    const cache = await this.openCache();
    const hit = await cache.match(this.packUrl(id, "theme.css"));
    return !!hit;
  },

  revokeTexture() {
    if (this._textureUrl) {
      try {
        URL.revokeObjectURL(this._textureUrl);
      } catch (_) {}
      this._textureUrl = null;
    }
  },

  async readCachedBlob(id, file) {
    const cache = await this.openCache();
    const url = this.packUrl(id, file);
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      await cache.put(url, res.clone());
    }
    return res.blob();
  },

  async download(id, onProgress) {
    if (id === this.BUILTIN) return;
    if (this._busy) throw new Error("Уже качается другая тема");
    this._busy = id;
    try {
      const man = await this.loadManifest();
      const pack = (man.packs || []).find((p) => p.id === id);
      if (!pack) throw new Error("Тема не найдена в облаке");
      const files = pack.files && pack.files.length ? pack.files : ["theme.css", "preview.svg", "texture.jpg"];
      const cache = await this.openCache();
      let done = 0;
      for (const file of files) {
        const url = this.packUrl(id, file);
        const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error("Ошибка файла " + file + " (" + res.status + ")");
        await cache.put(url, res.clone());
        done += 1;
        if (onProgress) onProgress(done, files.length);
      }
    } finally {
      this._busy = null;
    }
  },

  async remove(id, state) {
    if (id === this.BUILTIN) return;
    const cache = await this.openCache();
    const keys = await cache.keys();
    const prefix = "/themes/packs/" + id + "/";
    await Promise.all(
      keys
        .filter((req) => {
          try {
            return new URL(req.url).pathname.indexOf(prefix) >= 0;
          } catch (_) {
            return false;
          }
        })
        .map((req) => cache.delete(req))
    );
    const t = this.ensureState(state);
    t.installed = t.installed.filter((x) => x !== id);
    if (t.active === id) {
      t.active = this.BUILTIN;
      await this.apply(this.BUILTIN, state);
    }
  },

  async markInstalled(state, id) {
    const t = this.ensureState(state);
    if (id !== this.BUILTIN && t.installed.indexOf(id) < 0) t.installed.push(id);
  },

  async readCss(id) {
    if (id === this.BUILTIN) return "";
    const cache = await this.openCache();
    const url = this.packUrl(id, "theme.css");
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Тема не скачана");
      await cache.put(url, res.clone());
    }
    return res.text();
  },

  previewSrc(pack, state) {
    if (pack.builtin) return pack.preview;
    if (this.isInstalled(state, pack.id)) {
      return this.packUrl(pack.id, "preview.svg");
    }
    return pack.preview || this.packUrl(pack.id, "preview.svg");
  },

  async apply(id, state) {
    const t = this.ensureState(state);
    const root = document.documentElement;
    const old = document.getElementById(this.STYLE_ID);
    if (old) old.remove();
    this.revokeTexture();

    if (!id || id === this.BUILTIN) {
      root.setAttribute("data-theme", "classic");
      t.active = this.BUILTIN;
      this.syncThemeColor("#070707");
      return;
    }

    if (!this.isInstalled(state, id) && !(await this.isCached(id))) {
      throw new Error("Сначала скачай тему");
    }

    let css = await this.readCss(id);
    const texBlob = await this.readCachedBlob(id, "texture.jpg");
    if (texBlob) {
      this._textureUrl = URL.createObjectURL(texBlob);
      css +=
        '\nhtml[data-theme="' +
        id +
        '"]{--surface-overlay:url("' +
        this._textureUrl +
        '") center / cover no-repeat;}';
    }

    const style = document.createElement("style");
    style.id = this.STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
    root.setAttribute("data-theme", id);
    t.active = id;
    await this.markInstalled(state, id);

    const meta = ((this._manifest && this._manifest.packs) || []).find((p) => p.id === id);
    this.syncThemeColor((meta && meta.themeColor) || "#070707");
  },

  syncThemeColor(color) {
    const el = document.querySelector('meta[name="theme-color"]');
    if (el) el.setAttribute("content", color);
  },

  async boot(state) {
    this.ensureState(state);
    const id = this.activeId(state);
    try {
      if (id !== this.BUILTIN) {
        const ok = this.isInstalled(state, id) || (await this.isCached(id));
        if (!ok) {
          state.ui.themes.active = this.BUILTIN;
          await this.apply(this.BUILTIN, state);
          return;
        }
        if (!this.isInstalled(state, id)) await this.markInstalled(state, id);
      }
      await this.apply(id, state);
    } catch (_) {
      state.ui.themes.active = this.BUILTIN;
      await this.apply(this.BUILTIN, state);
    }
  },

  formatBytes(n) {
    const x = Number(n) || 0;
    if (x < 1024) return x + " Б";
    if (x < 1024 * 1024) return Math.round(x / 102.4) / 10 + " КБ";
    return Math.round(x / 104857.6) / 10 + " МБ";
  },
};
