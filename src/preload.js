
// ==== codex-skins (preload): a themed scene behind the Codex desktop app's main window + accent color swap ====
// The scene is a z-index:-1 canvas under the whole UI. Large opaque panels that cover it (the main surface — found by
// grid-sampling elementsFromPoint plus an area scan) are turned into the same color at partial alpha, so the art shows
// through and the page's own backdrop-filter glass actually blurs it. Cards and inputs stay as they are.
// Image bytes come from the main process (main.js) and are decoded with createImageBitmap: no CSP img-src needed.
// Accents: Codex has its own theme engine (accent / ink / surface / contrast → a full set of variables). The accent is
// --codex-base-accent; every :root variable whose value contains it (or one of its shades, e.g. the composer's
// send button) gets the theme's hue and saturation while keeping its lightness, and the accent-tinted backgrounds are
// re-mixed with color-mix. If Codex renames its variables nothing breaks — the accent just stops changing.
// Keys: Ctrl+Alt+T cycles themes (incl. off), Ctrl+Alt+Shift+T cycles intensity, Ctrl+Alt+P toggles stage mode
// (for screen recordings: sidebar contents, the tab strip titles and "private": true themes are hidden).
// Choices persist in localStorage.
// Diagnostics: <userData>/codex-skins/probe.json.
(function codexSkins() {
  "use strict";
  try {
    if (!process.isMainFrame) return;
    // the main window, the avatar overlay (?initialRoute=/avatar-overlay) and detached windows (detached-window.html)
    // share this preload; only the main window gets a theme
    if (!globalThis.__CODEX_SKINS_TEST__) {
      if (location.protocol !== "app:" || location.host !== "-" || location.pathname !== "/index.html") return;
      if (new URLSearchParams(location.search).has("initialRoute")) return;
    }
  } catch {
    return;
  }
  const { ipcRenderer } = require("electron");

  const ZH = /^zh/i.test(navigator.language || "");
  const T = ZH
    ? { off: "已关闭", level: "浓度", levels: ["淡", "中", "浓"], stageOn: "录屏模式：开（侧栏和标题已隐藏，Ctrl+Alt+P 关闭）", stageOff: "录屏模式：关", hint: "codex-skins：Ctrl+Alt+T 换主题 · Ctrl+Alt+Shift+T 调浓度 · Ctrl+Alt+P 录屏模式" }
    : { off: "off", level: "Intensity", levels: ["low", "medium", "high"], stageOn: "Stage mode on — sidebar and titles hidden (Ctrl+Alt+P to turn off)", stageOff: "Stage mode off", hint: "codex-skins: Ctrl+Alt+T theme · Ctrl+Alt+Shift+T intensity · Ctrl+Alt+P stage mode" };
  // macOS: show the keys as the Mac keyboard labels them (the handler matches physical keys via e.code, so Option
  // turning T into † does not matter)
  if (/Mac/i.test(navigator.platform || "")) for (const k of Object.keys(T)) if (typeof T[k] === "string") T[k] = T[k].replace(/Ctrl\+Alt\+Shift\+/g, "⌃⌥⇧").replace(/Ctrl\+Alt\+/g, "⌃⌥");
  const nameOf = (skin) => (typeof skin.name === "string" ? skin.name : (skin.name && (ZH ? skin.name.zh : skin.name.en)) || skin.id);

  let SKINS = [];
  const OFF = { id: "off", name: "off" };
  // intensity = how much opacity the big panels keep (smaller = more scene shows through)
  const ALPHAS = [0.78, 0.62, 0.46];
  const KEY_SKIN = "codex-skins.id";
  const KEY_LEVEL = "codex-skins.level";
  const KEY_STAGE = "codex-skins.stage";
  const KEY_HINTS = "codex-skins.hints";
  const BASE_ACCENT = "--codex-base-accent";
  // accent mixed into the surface (selected rows, accent buttons): re-mixed with color-mix
  const ACCENT_BG = /^--(app-color-background-accent|codex-theme-accent-background)/;
  const ACCENT_BG_MIX = 38;
  // shades of the accent (the composer's send / voice button is one step darker): keep each one's lightness
  const ACCENT_SHADE = /^--color-background-accent-action/;

  const store = {
    get(key, fallback) {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  };

  const state = {
    skin: OFF,
    level: Math.min(ALPHAS.length - 1, Math.max(0, Number(store.get(KEY_LEVEL, "1")) || 0)),
    layer: null,
    canvas: null,
    line: null,
    bitmaps: new Map(),
    sheet: null,
    styleEl: null,
    accents: [],
    drawToken: 0,
    marked: new Map(),
    stage: store.get(KEY_STAGE, "0") === "1",
    stageHidden: new Set(),
  };

  // Theme manifests come from the main process. Unknown / malformed fields fall back to safe defaults.
  function normalize(m) {
    const hue = Number(m.hue), sat = Number(m.sat);
    return {
      ...m,
      hue: isFinite(hue) ? hue : 220,
      sat: isFinite(sat) ? sat : 60,
      line: typeof m.line === "string" ? m.line : `hsl(${hue} ${sat}% 65%)`,
      background: typeof m.background === "string" ? m.background : null,
    };
  }
  async function loadSkins() {
    try {
      const list = await ipcRenderer.invoke("codex-skins:list");
      SKINS = (Array.isArray(list) ? list : []).filter((m) => m && m.id).map(normalize);
    } catch {
      SKINS = [];
    }
    const want = store.get(KEY_SKIN, null);
    state.skin = want === "off" ? OFF : SKINS.find((s) => s.id === want) ?? SKINS.find((s) => s.default) ?? SKINS[0] ?? OFF;
  }

  // ---------- colors ----------
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
  }
  // returns {l, fmt}; fmt: "triplet" (Tailwind-style "H S% L%") or "color" (a full color value). null if unknown.
  function parseColor(value) {
    const v = value.trim();
    let m = v.match(/^(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%$/);
    if (m) return { l: +m[3], fmt: "triplet" };
    m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
      const n = parseInt(hex, 16);
      return { l: rgbToHsl(n >> 16, (n >> 8) & 255, n & 255)[2], fmt: "color" };
    }
    m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (m) return { l: rgbToHsl(+m[1], +m[2], +m[3])[2], fmt: "color" };
    m = v.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
    if (m) return { l: +m[3], fmt: "color" };
    return null;
  }

  // ---------- accent ----------
  function setSheet(css) {
    try {
      if (!state.sheet) {
        state.sheet = new CSSStyleSheet();
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, state.sheet];
      }
      state.sheet.replaceSync(css);
      return;
    } catch {}
    if (!state.styleEl) {
      state.styleEl = document.createElement("style");
      state.styleEl.setAttribute("data-cskin", "");
      (document.head || document.documentElement).append(state.styleEl);
    }
    state.styleEl.textContent = css;
  }

  // a color can appear in computed values as #rrggbb or rgb(r, g, b): compare against both
  function colorForms(value) {
    const v = value.trim().toLowerCase();
    const forms = [v];
    const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (m) {
      const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
      const n = parseInt(hex, 16);
      forms.push(`#${hex}`, `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`);
    }
    return [...new Set(forms)];
  }

  // Read with our override removed: the accent is --codex-base-accent plus its shades (ACCENT_SHADE). Every :root
  // variable whose value contains one of them is swapped (--codex-theme-accent-*, rings, focus, the composer button,
  // color-mix() that references it); accent backgrounds (ACCENT_BG) are re-mixed. Re-read whenever the user changes
  // the accent in Codex settings.
  function readAccents() {
    const cs = getComputedStyle(document.documentElement);
    const base = cs.getPropertyValue(BASE_ACCENT).trim();
    const parsed = base && parseColor(base);
    if (!parsed) return { base: null, l: 0, colors: [], list: [] };
    const colors = [{ forms: colorForms(base), l: parsed.l }];
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (!ACCENT_SHADE.test(name)) continue;
      const value = cs.getPropertyValue(name).trim();
      const p = parseColor(value);
      if (p && !colors.some((c) => c.forms.includes(value.toLowerCase()))) colors.push({ forms: colorForms(value), l: p.l });
    }
    const list = [];
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (!name.startsWith("--")) continue;
      const value = cs.getPropertyValue(name).trim();
      const low = value.toLowerCase();
      if (ACCENT_BG.test(name)) list.push({ name, value, kind: "bg" });
      else if (colors.some((c) => c.forms.some((f) => low.includes(f)))) list.push({ name, value, kind: "replace" });
    }
    return { base, l: parsed.l, colors, list };
  }

  function applyAccent() {
    setSheet("");
    if (state.skin === OFF) {
      state.accents = [];
      return;
    }
    const { hue, sat } = state.skin;
    const found = readAccents();
    if (!found.base) {
      state.accents = [];
      return;
    }
    // keep the user's own accent lightness (and each shade's); only hue / saturation change
    const hsl = (l) => `hsl(${hue} ${sat}% ${l.toFixed(1)}%)`;
    const next = hsl(found.l);
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const swaps = found.colors.map((c) => ({ re: new RegExp(c.forms.map(esc).join("|"), "gi"), to: hsl(c.l) }));
    state.accents = found.list.map((a) => ({
      ...a,
      next: a.kind === "bg" ? `color-mix(in oklab, ${next} ${ACCENT_BG_MIX}%, var(--codex-base-surface, #181818))` : swaps.reduce((v, sw) => v.replace(sw.re, sw.to), a.value),
    }));
    const decls = state.accents.map((a) => `${a.name}: ${a.next} !important;`).join("\n  ");
    // the variables are defined on :root[data-theme] and again on any element with data-theme: cover both
    setSheet(decls ? `:root, :root [data-theme] {\n  ${decls}\n}` : "");
  }

  // ---------- scene ----------
  // computed colors come as rgb()/rgba(), and some panels use color(srgb r g b / a) (0..1)
  function parseRgba(text) {
    const alphaOf = (v) => (v === undefined ? 1 : v.endsWith("%") ? parseFloat(v) / 100 : +v);
    let m = String(text).match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: alphaOf(m[4]) };
    m = String(text).match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?/);
    if (m) return { r: Math.round(m[1] * 255), g: Math.round(m[2] * 255), b: Math.round(m[3] * 255), a: alphaOf(m[4]) };
    return null;
  }

  // The Codex window background is transparent (the OS Mica material shows through), so body / html have no color to
  // read: use html[data-theme], else the lightness of --codex-base-surface.
  function isDark() {
    const theme = document.documentElement.dataset.theme;
    if (theme === "dark") return true;
    if (theme === "light") return false;
    const v = getComputedStyle(document.documentElement).getPropertyValue("--codex-base-surface").trim();
    const m = v.match(/^#([0-9a-f]{6})$/i);
    const n = m ? parseInt(m[1], 16) : 0;
    const c = m ? { r: n >> 16, g: (n >> 8) & 255, b: n & 255 } : parseRgba(v);
    return c ? (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 < 0.5 : true;
  }

  function imp(el, styles) {
    for (const [k, v] of Object.entries(styles)) el.style.setProperty(k, v, "important");
  }

  function ensureLayer() {
    if (state.layer && state.layer.isConnected && state.line.isConnected) return state.layer;
    state.layer?.remove();
    state.line?.remove();
    const layer = document.createElement("div");
    layer.setAttribute("data-cskin", "layer");
    layer.setAttribute("aria-hidden", "true");
    // page CSS may hide or restyle foreign nodes: every key style is inline !important
    imp(layer, { position: "fixed", inset: "0", "z-index": "-1", "pointer-events": "none", display: "block", visibility: "visible", transition: "opacity .6s ease", opacity: "0", margin: "0", padding: "0", background: "none", transform: "none", filter: "none" });
    const canvas = document.createElement("canvas");
    imp(canvas, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", visibility: "visible", "max-width": "none", "max-height": "none" });
    layer.append(canvas);
    // a thin accent line along the top edge, above everything
    const line = document.createElement("div");
    line.setAttribute("data-cskin", "line");
    line.setAttribute("aria-hidden", "true");
    imp(line, { position: "fixed", left: "0", right: "0", top: "0", height: "2px", "z-index": "2147482000", "pointer-events": "none", display: "block", visibility: "visible", transition: "opacity .6s ease", opacity: "0" });
    // first child of body (not under html: some pages hide everything under html except head / body).
    // As long as body creates no stacking context, z-index:-1 lands in the root context, under all content.
    (document.body || document.documentElement).prepend(layer);
    (document.body || document.documentElement).append(line);
    state.layer = layer;
    state.canvas = canvas;
    state.line = line;
    return layer;
  }

  async function bitmapFor(skin) {
    const key = skin.id + "/" + skin.background;
    if (state.bitmaps.has(key)) return state.bitmaps.get(key);
    const bytes = skin.background ? await ipcRenderer.invoke("codex-skins:asset", skin.id, skin.background) : null;
    const bitmap = bytes ? await createImageBitmap(new Blob([bytes])) : null;
    state.bitmaps.set(key, bitmap);
    return bitmap;
  }

  function hideScene() {
    if (state.layer) state.layer.style.setProperty("opacity", "0", "important");
    if (state.line) state.line.style.setProperty("opacity", "0", "important");
    restoreSeeThrough(new Set());
  }

  // Themes without a background image get a generated gradient in their own hue.
  function paintGradient(ctx, w, h, skin) {
    const { hue, sat } = skin;
    ctx.fillStyle = `hsl(${hue} ${Math.min(sat, 40)}% 6%)`;
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, r, l, a] of [[0.1, 1, 0.7, 30, 0.55], [0.92, 0.95, 0.6, 26, 0.45], [0.5, 1.15, 0.5, 22, 0.35]]) {
      const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
      g.addColorStop(0, `hsl(${hue} ${sat}% ${l}% / ${a})`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  async function draw() {
    const token = ++state.drawToken;
    ensureLayer();
    if (state.skin === OFF || !isDark()) {
      hideScene();
      return;
    }
    const skin = state.skin;
    let bitmap;
    try {
      bitmap = await bitmapFor(skin);
    } catch {
      bitmap = null;
    }
    if (token !== state.drawToken) return;
    // physical pixels so it stays sharp on high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(innerWidth * dpr));
    const h = Math.max(1, Math.round(innerHeight * dpr));
    const canvas = state.canvas;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (bitmap) {
      // cover the window, bottom-aligned (the horizon / details live at the bottom)
      const scale = Math.max(w / bitmap.width, h / bitmap.height);
      const dw = bitmap.width * scale;
      const dh = bitmap.height * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, (w - dw) / 2, h - dh, dw, dh);
    } else {
      paintGradient(ctx, w, h, skin);
    }
    state.line.style.background = `linear-gradient(90deg, transparent, ${skin.line} 22%, ${skin.line} 78%, transparent)`;
    state.layer.style.setProperty("opacity", "1", "important");
    state.line.style.setProperty("opacity", ".85", "important");
    seeThrough();
  }

  // ---------- see-through: big opaque panels over the scene become the same color at partial alpha ----------
  const INNER_ALPHA = 0.3; // a panel nested inside another see-through panel (the sidebar)
  const MIN_AREA = 0.06; // share of the viewport; the sidebar is ~10%, cards and inputs are far smaller
  function seeThrough() {
    if (state.skin === OFF || !state.layer || state.layer.style.getPropertyValue("opacity") !== "1") return;
    const alpha = ALPHAS[state.level];
    const vw = innerWidth, vh = innerHeight;
    const found = new Set();
    const consider = (el, needsVisibleCheck) => {
      if (el === document.documentElement || found.has(el) || el.closest("[data-cskin]")) return;
      if (state.marked.has(el)) {
        found.add(el);
        return;
      }
      const r = el.getBoundingClientRect();
      if ((r.width * r.height) / (vw * vh) < MIN_AREA) return;
      if (needsVisibleCheck && (r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw)) return;
      const cs = getComputedStyle(el);
      if (needsVisibleCheck && (cs.opacity === "0" || cs.visibility === "hidden" || cs.display === "none")) return;
      const c = parseRgba(cs.backgroundColor);
      if (!c || c.a < 0.9 || cs.backgroundImage !== "none") return;
      state.marked.set(el, { inline: el.style.getPropertyValue("background-color"), priority: el.style.getPropertyPriority("background-color"), rgb: c });
      found.add(el);
    };
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 6; j++) {
        for (const el of document.elementsFromPoint(((i + 0.5) / 9) * vw, ((j + 0.5) / 6) * vh)) consider(el, false);
      }
    }
    // elementsFromPoint skips pointer-events:none elements (some backing panels are): scan the whole page by area too
    for (const el of document.querySelectorAll("body *")) consider(el, true);
    restoreSeeThrough(found);
    // These panels nest (body > page grid > sidebar). Each one half-transparent multiplies back to opaque, so:
    // a shell about as big as a selected descendant becomes fully transparent; the outermost remaining one gets
    // the intensity alpha; ones inside it (the sidebar) keep only a thin tint.
    const list = [...found];
    const area = (el) => {
      const r = el.getBoundingClientRect();
      return r.width * r.height;
    };
    const covers = (big, small) => {
      const a = big.getBoundingClientRect(), b = small.getBoundingClientRect();
      return a.width * a.height > b.width * b.height * 1.05 && a.left <= b.left + 1 && a.top <= b.top + 1 && a.right >= b.right - 1 && a.bottom >= b.bottom - 1;
    };
    const shell = new Set(list.filter((el) => list.some((o) => o !== el && el.contains(o) && area(o) >= area(el) * 0.95)));
    for (const el of found) {
      const { rgb } = state.marked.get(el);
      let a = alpha;
      if (shell.has(el)) a = 0;
      // "inside" is judged by screen rectangles: the full-page panel and the sidebar are often siblings
      else if (list.some((o) => o !== el && !shell.has(o) && covers(o, el))) a = INNER_ALPHA;
      el.style.setProperty("background-color", a ? `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${a})` : "transparent", "important");
    }
  }

  function restoreSeeThrough(keep) {
    for (const [el, orig] of state.marked) {
      if (keep.has(el)) continue;
      if (orig.inline) el.style.setProperty("background-color", orig.inline, orig.priority);
      else el.style.removeProperty("background-color");
      state.marked.delete(el);
    }
  }

  // ---------- toast ----------
  let toastTimer = 0;
  function toast(text, ms = 1600) {
    let el = document.querySelector("[data-cskin=toast]");
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("data-cskin", "toast");
      Object.assign(el.style, {
        position: "fixed", left: "50%", top: "56px", transform: "translateX(-50%)", zIndex: "2147483600",
        padding: "8px 16px", borderRadius: "10px", font: "500 13px/1.4 system-ui, sans-serif",
        color: "#f2efe9", background: "rgba(16,16,18,.88)", border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 8px 24px rgba(0,0,0,.45)", pointerEvents: "none", transition: "opacity .25s ease", opacity: "0",
      });
      document.documentElement.append(el);
    }
    el.textContent = text;
    el.style.borderColor = state.skin === OFF ? "rgba(255,255,255,.12)" : state.skin.line;
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.style.opacity = "0"), ms);
  }

  // ---------- flow ----------
  // decoration layer (deco.js): mascot, banner, glass, particles; it tears itself down when the theme is off or light
  let decoApi = null;
  function deco() {
    if (decoApi) return decoApi;
    try {
      decoApi = codexSkinsDeco({
        getAsset: (file) => (state.skin === OFF || !file ? Promise.resolve(null) : ipcRenderer.invoke("codex-skins:asset", state.skin.id, file)),
        skin: () => (state.skin !== OFF && isDark() ? state.skin : null),
        name: nameOf,
        zh: ZH,
        cycle: () => cycleSkin(),
      });
    } catch {}
    return decoApi;
  }

  function applyAll() {
    try {
      applyAccent();
    } catch {}
    draw()
      .catch(() => {})
      .then(() => deco()?.apply())
      .catch(() => {});
  }

  // report what was actually found once the page CSS has loaded
  function probe() {
    ipcRenderer.invoke("codex-skins:probe", {
      skin: state.skin.id,
      stored: store.get(KEY_SKIN, null),
      stage: state.stage,
      skins: SKINS.map((s) => `${s.id}:${s.source}`),
      level: ALPHAS[state.level],
      dark: isDark(),
      dataTheme: document.documentElement.dataset.theme,
      accents: state.accents.map(({ name, kind, value, next }) => ({ name, kind, value, next })),
      sheet: state.sheet ? "adopted" : state.styleEl ? "style" : "none",
      layer: !!(state.layer && state.layer.isConnected),
      dpr: window.devicePixelRatio,
      viewport: [innerWidth, innerHeight],
      hooks: {
        accent: getComputedStyle(document.documentElement).getPropertyValue(BASE_ACCENT).trim() || null,
        composer: !!document.querySelector("[data-composer-body]"),
        sidebar: !!document.querySelector("[data-sidebar-navigation-root]"),
        sidebarNav: !!document.querySelector("[data-sidebar-navigation-root] nav [data-app-action-sidebar-scroll]"),
        mainSurface: !!document.querySelector("main[data-app-shell-main-surface]"),
      },
      seeThrough: [...state.marked].map(([el, o]) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 120), rect: [r.x, r.y, r.width, r.height].map(Math.round), bg: `rgb(${o.rgb.r},${o.rgb.g},${o.rgb.b})` };
      }),
    }).catch(() => {});
  }

  // themes offered right now: stage mode leaves out the ones marked "private" (e.g. a company-internal pack)
  const offered = () => (state.stage ? SKINS.filter((s) => !s.private) : SKINS);
  function cycleSkin() {
    const all = [...offered(), OFF];
    state.skin = all[(all.indexOf(state.skin) + 1) % all.length];
    store.set(KEY_SKIN, state.skin.id);
    applyAll();
    setTimeout(probe, 1500);
    toast(`codex-skins · ${state.skin === OFF ? T.off : nameOf(state.skin)}`);
  }

  function cycleLevel() {
    state.level = (state.level + 1) % ALPHAS.length;
    store.set(KEY_LEVEL, String(state.level));
    seeThrough();
    toast(`${T.level}: ${T.levels[state.level]}`);
  }

  // ---------- stage mode ----------
  // Sidebar (nav rail + chat list, projects, account): everything but the theme banner is made invisible (layout
  // unchanged, nothing reflows). Tab strip: any element with its own text in the top STAGE_STRIP px right of the
  // sidebar is hidden too (conversation titles); icon-only buttons stay. A private theme is swapped for the first public one.
  const STAGE_STRIP = 100;
  const STAGE_CSS = `
html[data-cskin-stage] :where(#app-shell-sidebar) * { visibility: hidden !important; }
html[data-cskin-stage] [data-cskin=banner][data-cskin=banner][data-cskin=banner] { visibility: visible !important; }
`;
  let stageSheet = null;
  function ownText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  function stageScan() {
    const keep = new Set();
    if (state.stage) {
      const side = document.querySelector("#app-shell-sidebar");
      const left = side ? side.getBoundingClientRect().right : 0;
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest("[data-cskin]") || el.closest("[data-composer-body]") || !ownText(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.top < STAGE_STRIP && r.bottom <= STAGE_STRIP + 16 && r.left >= left - 1) keep.add(el);
      }
    }
    for (const el of state.stageHidden) if (!keep.has(el)) el.style.removeProperty("visibility");
    for (const el of keep) el.style.setProperty("visibility", "hidden", "important");
    state.stageHidden = keep;
  }
  function applyStage() {
    const html = document.documentElement;
    if (state.stage) html.setAttribute("data-cskin-stage", "");
    else html.removeAttribute("data-cskin-stage");
    try {
      if (!stageSheet) {
        stageSheet = new CSSStyleSheet();
        stageSheet.replaceSync(STAGE_CSS);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, stageSheet];
      }
    } catch {}
    if (state.stage && state.skin !== OFF && state.skin.private) {
      state.skin = offered()[0] ?? OFF;
      store.set(KEY_SKIN, state.skin.id);
      applyAll();
    }
    stageScan();
  }
  function toggleStage() {
    state.stage = !state.stage;
    store.set(KEY_STAGE, state.stage ? "1" : "0");
    applyStage();
    toast(state.stage ? T.stageOn : T.stageOff);
  }

  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || !e.altKey || e.metaKey) return;
    if (e.code === "KeyP" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      return toggleStage();
    }
    if (e.code !== "KeyT") return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) cycleLevel();
    else cycleSkin();
  }, true);

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => draw().catch(() => {}), 150);
  });

  async function start() {
    await loadSkins();
    if (state.stage && state.skin.private) {
      state.skin = offered()[0] ?? OFF;
      store.set(KEY_SKIN, state.skin.id);
    }
    applyAll();
    applyStage();
    // the first few starts remind the user of the shortcuts (stage mode has its own reminder)
    const shown = Number(store.get(KEY_HINTS, "0")) || 0;
    if (state.stage) setTimeout(() => toast(T.stageOn, 4000), 1200);
    else if (shown < 3 && SKINS.length) {
      store.set(KEY_HINTS, String(shown + 1));
      setTimeout(() => toast(T.hint, 6000), 2500);
    }
    // light / dark switches change html class / data-*: re-read the original accents and re-decide the scene
    let pending = 0;
    new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(applyAll, 120);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode"] });
    // navigation and sidebar toggles replace the big containers: look for see-through panels again
    let stTimer = 0;
    new MutationObserver(() => {
      clearTimeout(stTimer);
      if (state.stage) stageScan();
      stTimer = setTimeout(seeThrough, 300);
    }).observe(document.body, { childList: true, subtree: true });
    // the SPA sometimes rebuilds nodes: put the layer back; accent variables need the page CSS, so retry a few times
    let tries = 0;
    setInterval(() => {
      if (state.stage || state.stageHidden.size) stageScan();
      if (!state.layer || !state.layer.isConnected || !state.line.isConnected) draw().catch(() => {});
      else seeThrough();
      if (tries < 5 && state.skin !== OFF && state.accents.length === 0) {
        tries++;
        try {
          applyAccent();
        } catch {}
      }
    }, 2000);
    setTimeout(probe, 8000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => start(), { once: true });
  else start();
})();
