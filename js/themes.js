window.BossThemes = {
  CACHE: "bigbossyan-themes-v3",
  STYLE_ID: "boss-theme-pack",
  MANIFEST_URL: "./themes/manifest.json",
  BUILTIN: "classic",
  PACK_REV: 5,

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
    return new URL("./themes/packs/" + encodeURIComponent(id) + "/" + file, location.href).href;
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
      state.ui.themes = { active: this.BUILTIN, installed: [], rev: 0 };
    }
    if (!Array.isArray(state.ui.themes.installed)) state.ui.themes.installed = [];
    if (!state.ui.themes.active) state.ui.themes.active = this.BUILTIN;
    if (typeof state.ui.themes.rev !== "number") state.ui.themes.rev = 0;
    return state.ui.themes;
  },

  needsRefresh(state) {
    return this.ensureState(state).rev < this.PACK_REV;
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

  async hasTexture(id) {
    const cache = await this.openCache();
    return !!(await cache.match(this.packUrl(id, "texture.jpg")));
  },

  revokeTexture() {
    if (this._textureUrl) {
      try {
        URL.revokeObjectURL(this._textureUrl);
      } catch (_) {}
      this._textureUrl = null;
    }
    const layer = document.getElementById("boss-theme-texture");
    if (layer) layer.remove();
    try {
      const root = document.documentElement;
      [
        "--surface-overlay",
        "--surface-opacity",
        "--surface-blend",
        "--texture-url",
        "--texture-btn-opacity",
        "--texture-panel-opacity",
        "--texture-icon-opacity",
      ].forEach((k) => root.style.removeProperty(k));
    } catch (_) {}
  },

  paintTexture(blobUrl, opacity) {
    const root = document.documentElement;
    const op = opacity == null ? 0.9 : opacity;
    const url = 'url("' + blobUrl + '")';
    root.style.setProperty("--texture-url", url);
    root.style.setProperty("--surface-overlay", url);
    root.style.setProperty("--surface-opacity", String(op));
    root.style.setProperty("--surface-blend", "overlay");
    root.style.setProperty("--texture-btn-opacity", "0.55");
    root.style.setProperty("--texture-panel-opacity", "0.3");
    root.style.setProperty("--texture-icon-opacity", "0.5");

    let layer = document.getElementById("boss-theme-texture");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "boss-theme-texture";
      layer.setAttribute("aria-hidden", "true");
      document.body.insertBefore(layer, document.body.firstChild);
    }
    layer.style.backgroundImage = url;
    layer.style.opacity = String(op);
    layer.style.mixBlendMode = "overlay";
  },

  async readCachedBlob(id, file) {
    const cache = await this.openCache();
    const url = this.packUrl(id, file);
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
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
      const man = await this.loadManifest(true);
      const pack = (man.packs || []).find((p) => p.id === id);
      if (!pack) throw new Error("Тема не найдена в облаке");
      const files = pack.files && pack.files.length ? pack.files : ["theme.css", "preview.svg", "texture.jpg"];
      const cache = await this.openCache();
      let done = 0;
      for (const file of files) {
        const url = this.packUrl(id, file);
        const res = await fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
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
    const needle = "/themes/packs/" + id + "/";
    await Promise.all(
      keys
        .filter((req) => {
          try {
            return new URL(req.url).pathname.indexOf(needle) >= 0;
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
    t.rev = this.PACK_REV;
  },

  async readCss(id) {
    if (id === this.BUILTIN) return "";
    const cache = await this.openCache();
    const url = this.packUrl(id, "theme.css");
    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
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

    // Старые пакеты без текстуры / устаревший rev — тихо перекачать
    if (!(await this.hasTexture(id)) || this.needsRefresh(state)) {
      try {
        await this.download(id);
        await this.markInstalled(state, id);
      } catch (_) {
        /* offline — покажем что есть */
      }
    }

    let css = await this.readCss(id);
    const texBlob = await this.readCachedBlob(id, "texture.jpg");
    if (texBlob && texBlob.size > 0) {
      this._textureUrl = URL.createObjectURL(texBlob);
      this.paintTexture(this._textureUrl, 0.9);
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
