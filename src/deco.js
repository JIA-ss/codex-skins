
// ==== codex-skins (deco): mascot, sidebar banner, glass and particles on top of the scene ====
//   - Composer mascot: a die-cut sticker peeking over the top edge of the input box. Every keystroke it nods and takes a
//     step (faster typing = faster walking, combos, crits), Enter makes it jump; click it, drag it anywhere, double-click
//     to send it home (see the mascot section below).
//   - Sidebar banner: theme name + "day N", with the theme's badge sticker; click to switch themes.
//   - Glass: composer, code blocks and popups become translucent + backdrop blur + a thin accent ring.
//   - Accent details: selection, focus ring, scrollbar, glow on the send button.
//   - Particles: snow / petals / embers / rain / spores under the UI, 30 fps, paused when unfocused or reduced-motion.
// Only talks to the api object (assets, current theme, cycle) and shares html[data-cskin*] attributes with preload.js.
function codexSkinsDeco(api) {
  "use strict";
  // 只用 createElement / canvas / shadow root，不拼 HTML（页面有 Trusted Types）
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const deco = { sheet: null, peek: null, peekCanvas: null, banner: null, fx: null, fxCanvas: null, imgs: new Map(), skinKey: "" };

  // ---------- 素材 ----------
  async function bitmap(file) {
    const skin = api.skin();
    const id = (skin ? skin.id : "") + "/" + file;
    if (deco.imgs.has(id)) return deco.imgs.get(id);
    const p = api.getAsset(file).then((bytes) => (bytes ? createImageBitmap(new Blob([bytes])) : null)).catch(() => null);
    deco.imgs.set(id, p);
    return p;
  }
  // Optional theme font: "font": "title.woff2" in skin.json. Used for the banner title, speech bubbles and combo counter.
  const fontFaces = new Map();
  async function themeFont(skin) {
    if (!skin.font) return null;
    const family = "cs-theme-" + skin.id;
    if (!fontFaces.has(family)) {
      fontFaces.set(family, (async () => {
        try {
          const bytes = await api.getAsset(skin.font);
          if (!bytes) return null;
          const face = new FontFace(family, bytes);
          await face.load();
          document.fonts.add(face);
          return family;
        } catch {
          return null;
        }
      })());
    }
    return fontFaces.get(family);
  }
  function paint(canvas, bmp, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!bmp) return;
    const s = Math.min(canvas.width / bmp.width, canvas.height / bmp.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, (canvas.width - bmp.width * s) / 2, canvas.height - bmp.height * s, bmp.width * s, bmp.height * s);
  }

  // ---------- 样式 ----------
  const CSS = `
html[data-cskin-on] {
  --cs-font: var(--cs-theme-font, "Segoe UI Variable Display"), "Segoe UI Variable Display", "Segoe UI", "SF Pro Rounded", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --cs-glass: rgb(30 30 33 / .56);
  --cs-glass-2: rgb(40 40 44 / .58);
  --cs-ring: color-mix(in srgb, var(--cs-a) 36%, transparent);
  --cs-glow: color-mix(in srgb, var(--cs-a) 42%, transparent);
}
html[data-cskin-on] [data-composer-body] {
  background-color: var(--cs-glass) !important;
  -webkit-backdrop-filter: blur(22px) saturate(1.35) !important;
  backdrop-filter: blur(22px) saturate(1.35) !important;
  box-shadow: 0 0 0 1px var(--cs-ring), 0 18px 48px -18px var(--cs-glow) !important;
  transition: box-shadow .3s ease;
}
html[data-cskin-on] [data-composer-body]:focus-within {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--cs-a) 70%, transparent), 0 20px 56px -14px color-mix(in srgb, var(--cs-a) 58%, transparent) !important;
}
html[data-cskin-grab=grab], html[data-cskin-grab=grab] * { cursor: grab !important; }
html[data-cskin-grab=grabbing], html[data-cskin-grab=grabbing] * { cursor: grabbing !important; user-select: none !important; }
html[data-cskin-on] main pre {
  background-color: rgb(16 16 18 / .62) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  backdrop-filter: blur(12px) !important;
  border-left: 2px solid var(--cs-ring) !important;
}
html[data-cskin-on] [role=menu], html[data-cskin-on] [role=listbox], html[data-cskin-on] [role=dialog] {
  -webkit-backdrop-filter: blur(26px) saturate(1.3) !important;
  backdrop-filter: blur(26px) saturate(1.3) !important;
}
html[data-cskin-on] ::selection { background: color-mix(in srgb, var(--cs-a) 40%, transparent); }
html[data-cskin-on] :focus-visible { outline-color: var(--cs-a) !important; }
html[data-cskin-on] ::-webkit-scrollbar-thumb { background-color: color-mix(in srgb, var(--cs-a) 34%, transparent) !important; border-radius: 8px; }
html[data-cskin-on] ::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--cs-a) 60%, transparent) !important; }
html[data-cskin-on] [data-composer-body] button.size-token-button-composer {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--cs-a) 50%, transparent), 0 0 18px -2px var(--cs-glow) !important;
}
@media (prefers-reduced-motion: reduce) { html[data-cskin-on] [data-cskin] { transition: none !important; } }
`;
  function ensureSheet() {
    if (deco.sheet) return;
    try {
      deco.sheet = new CSSStyleSheet();
      deco.sheet.replaceSync(CSS);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, deco.sheet];
    } catch {
      const st = document.createElement("style");
      st.setAttribute("data-cskin", "deco-style");
      st.textContent = CSS;
      (document.head || document.documentElement).append(st);
      deco.sheet = st;
    }
  }

  function imp(el, styles) {
    for (const [k, v] of Object.entries(styles)) el.style.setProperty(k, v, "important");
  }

  // ---------- 输入框探头贴纸 ----------
  // 平时扒在输入框上沿（home），可以拖到屏幕任意位置（free），拖回输入框上沿附近会吸回去，双击也回家。
  // 动画全靠变形（挤压拉伸、摆动、跳），一张贴纸图就够：
  //   打字：每个键点头 + 迈一步，打得越快走得越快，走到头掉头；连击计数、暴击、档位喊话、纪录；回车起跳。
  //   点击：随机弹一下 / 摇头 / 跳，冒台词气泡和皮肤色小点；连点三下转圈晕倒。
  //   拖动：抓住的位置当支点，按拖动速度像钟摆一样甩；松手落地压扁一下。
  // 外层一直是 pointer-events:none，命中由 window 捕获阶段按贴纸像素的 alpha 判断，透明区域的点击照常落到页面上。
  const PEEK_W = 120;
  const PEEK_H = 96;
  const PEEK_GRIP = 3;
  // At home only the bottom edge clips, so it can duck behind the composer while tall ears, nods and hops still
  // poke out above the box.
  const CLIP_HOME = "inset(-400px -400px 0 -400px)"; // 贴纸底边压进输入框上沿的像素
  // Speech lines. A theme can override any group with "lines": { "click": [...], ... } (or { "zh": {...}, "en": {...} }).
  const TEXT = api.zh
    ? {
        click: ["嘿!", "别戳我~", "在写啥呢?", "加油!", "摸鱼被发现了", "好耶!", "今天也很棒"],
        drag: ["放我下来!", "飞起来啦!", "晕了晕了"],
        send: ["发送!", "冲!", "好耶!"],
        dizzy: ["晕了~"],
        home: ["回家啦~"],
        tiers: ["连击!", "手速起飞!", "键盘冒烟!", "无双!"],
        crit: ["暴击!"],
        record: (n) => `新纪录 ×${n}!`,
        day: (n) => `第 ${n} 天`,
        cycle: "点一下换主题（Ctrl+Alt+T）",
      }
    : {
        click: ["Hey!", "Boop!", "Whatcha writing?", "You got this!", "Hehe", "Yay!"],
        drag: ["Put me down!", "Wheee!", "So dizzy"],
        send: ["Sent!", "Go!", "Yay!"],
        dizzy: ["Dizzy~"],
        home: ["Home!"],
        tiers: ["Combo!", "On fire!", "Keyboard smoking!", "Unstoppable!"],
        crit: ["CRIT!"],
        record: (n) => `New record ×${n}!`,
        day: (n) => `Day ${n}`,
        cycle: "Click to switch theme (Ctrl+Alt+T)",
      };
  function lines(kind) {
    const skin = api.skin();
    let own = skin && skin.lines;
    if (own && (own.zh || own.en)) own = api.zh ? own.zh : own.en;
    const list = own && Array.isArray(own[kind]) && own[kind].length ? own[kind] : TEXT[kind];
    return list;
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const peek = { mode: "home", pos: null, alpha: null, down: null, drag: null, clicks: [], busy: 0, duck: false, typeStart: 0, typeLast: 0, tilt: 1, sway: { a: 0, v: 0, target: 0, raf: 0 } };
  // 沿输入框上沿走：x = 外框左边相对输入框左边的距离（null = 默认靠右），v = 速度 px/s，dir = 方向，phase = 步伐相位
  const walk = { x: null, tx: null, dir: -1, last: 0, raf: 0, combo: 0, lastKey: 0, m: 0 };
  try {
    const f = Number(localStorage.getItem("codex-skins.peekHomeX"));
    if (localStorage.getItem("codex-skins.peekHomeX") !== null && isFinite(f)) walk.frac = f;
  } catch {}
  try {
    const p = JSON.parse(localStorage.getItem("codex-skins.peekPos") || "null");
    if (p && isFinite(p.x) && isFinite(p.y)) {
      peek.mode = "free";
      peek.pos = p;
    }
  } catch {}
  function composerCard() {
    let best = null, bestArea = 0;
    for (const el of document.querySelectorAll("[data-composer-body]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 24 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      if (r.width * r.height > bestArea) {
        best = el;
        bestArea = r.width * r.height;
      }
    }
    return best;
  }
  function layer(name, styles) {
    const d = document.createElement("div");
    d.setAttribute("data-cskin", name);
    imp(d, styles);
    return d;
  }
  function ensurePeek() {
    if (deco.peek && deco.peek.isConnected) return deco.peek;
    const el = layer("peek", { position: "fixed", "z-index": "2147481000", "pointer-events": "none", display: "none", width: PEEK_W + "px", height: PEEK_H + "px", "clip-path": CLIP_HOME });
    el.setAttribute("aria-hidden", "true");
    const inner = layer("peek-inner", { position: "absolute", inset: "0", transition: "transform .35s cubic-bezier(.3,1.4,.5,1)", transform: "translateY(0)" });
    const sway = layer("peek-sway", { position: "absolute", inset: "0", "transform-origin": "50% 100%" });
    const step = layer("peek-walk", { position: "absolute", inset: "0", "transform-origin": "50% 100%" });
    const body = layer("peek-body", { position: "absolute", inset: "0", "transform-origin": "50% 100%" });
    const breath = layer("peek-breath", { position: "absolute", inset: "0", "transform-origin": "50% 100%" });
    const c = document.createElement("canvas");
    imp(c, { position: "absolute", left: "0", bottom: "0", display: "block", filter: "drop-shadow(0 4px 5px rgb(0 0 0 / .35))" });
    breath.append(c);
    body.append(breath);
    step.append(body);
    sway.append(step);
    inner.append(sway);
    el.append(inner);
    document.documentElement.append(el);
    Object.assign(deco, { peek: el, peekInner: inner, peekSway: sway, peekWalk: step, peekBody: body, peekCanvas: c });
    if (!reduceMotion.matches) {
      breath.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.012,1.025)" }], { duration: 1300, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
    }
    return el;
  }
  function paintPeek(bmp) {
    paint(deco.peekCanvas, bmp, PEEK_W, PEEK_H);
    try {
      const c = deco.peekCanvas;
      peek.alpha = { w: c.width, h: c.height, data: c.getContext("2d").getImageData(0, 0, c.width, c.height).data };
    } catch {
      peek.alpha = null;
    }
  }
  function homeRect() {
    const card = composerCard();
    if (!card) return null;
    const r = card.getBoundingClientRect();
    if (r.width < 200 || r.bottom <= 0 || r.top >= innerHeight) return null;
    // 裁剪框底边对齐输入框上沿（只压进 PEEK_GRIP，手扒在边上）：缩下去时整只移出裁剪框，像躲到了输入框后面。
    // 不能压太多：裁剪框和输入框重叠的那一截画在输入框上面，缩下去的贴纸会从输入框里露出来。默认贴着右侧圆角（扒在框外，不挡框里的按钮）
    // 走动的范围：输入框左右各留 16 px；位置按比例记住，输入框变宽变窄时跟着走
    const lo = 16, hi = Math.max(lo, r.width - PEEK_W - 16);
    if (walk.x === null) walk.x = walk.frac != null ? lo + walk.frac * (hi - lo) : Math.min(hi, r.width - PEEK_W - 24);
    walk.x = Math.min(Math.max(walk.x, lo), hi);
    walk.lo = lo;
    walk.hi = hi;
    return { left: Math.round(r.left + walk.x), top: Math.round(r.top - PEEK_H + PEEK_GRIP), card: r };
  }
  function setBox(left, top) {
    deco.peek.style.setProperty("left", Math.round(left) + "px", "important");
    deco.peek.style.setProperty("top", Math.round(top) + "px", "important");
    if (followers.size) placeFollowers(); // keep up within the same frame, not one frame behind
  }
  function placePeek() {
    const el = deco.peek;
    if (!el || peek.drag) return;
    const skin = api.skin();
    const home = homeRect();
    const hide = () => el.style.setProperty("display", "none", "important");
    if (!skin || !skin.peek) return hide();
    if (peek.mode === "free" && peek.pos) {
      el.style.setProperty("clip-path", "none", "important");
      setBox(Math.min(Math.max(peek.pos.x * innerWidth, 0), innerWidth - PEEK_W), Math.min(Math.max(peek.pos.y * innerHeight, 0), innerHeight - PEEK_H));
    } else {
      if (!home) return hide();
      el.style.setProperty("clip-path", CLIP_HOME, "important");
      setBox(home.left, home.top);
    }
    el.style.setProperty("display", "block", "important");
  }
  function setDuck(on) {
    if (peek.duck === on || !deco.peekInner) return;
    peek.duck = on;
    deco.peekInner.style.setProperty("transform", on ? "translateY(104%)" : "translateY(0)", "important");
  }

  // ---- 动作 ----
  function act(frames, opts) {
    const body = deco.peekBody;
    if (!body || reduceMotion.matches) return null;
    body.getAnimations().forEach((a) => a.cancel());
    return body.animate(frames, { easing: "cubic-bezier(.3,.7,.4,1)", ...opts });
  }
  const ACTS = {
    // 每个键一下：先压扁（落脚）再弹起，左右交替歪头；短而脆，连打时一下接一下
    nod: (dir) => act([{ transform: "none" }, { transform: `scale(1.07,.9) rotate(${2 * dir}deg)`, offset: 0.25 }, { transform: `translateY(-6px) rotate(${4 * dir}deg) scale(.97,1.04)`, offset: 0.6 }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.9,.3,1)" }),
    boing: () => act([{ transform: "none" }, { transform: "scale(1.18,.78)" }, { transform: "scale(.88,1.16)" }, { transform: "scale(1.06,.95)" }, { transform: "none" }], { duration: 560 }),
    shake: () => act([{ transform: "none" }, { transform: "rotate(-11deg)" }, { transform: "rotate(10deg)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(4deg)" }, { transform: "none" }], { duration: 620 }),
    hop: (h = 22) => act([{ transform: "none" }, { transform: "scale(1.1,.86)", offset: 0.15 }, { transform: `translateY(-${h}px) scale(.94,1.08)`, offset: 0.5 }, { transform: "scale(1.12,.86)", offset: 0.82 }, { transform: "none" }], { duration: 640 }),
    spin: () => act([{ transform: "none" }, { transform: "translateY(-14px) rotate(180deg) scale(.9)" }, { transform: "translateY(0) rotate(360deg)" }, { transform: "rotate(372deg) scale(1.08,.9)" }, { transform: "rotate(360deg)" }], { duration: 900 }),
    crit: (dir) => act([{ transform: "none" }, { transform: `scale(1.25,.72) rotate(${-6 * dir}deg)`, offset: 0.2 }, { transform: `translateY(-14px) scale(.88,1.18) rotate(${10 * dir}deg)`, offset: 0.5 }, { transform: "scale(1.1,.9)", offset: 0.8 }, { transform: "none" }], { duration: 360, easing: "cubic-bezier(.2,.9,.3,1)" }),
    land: () => act([{ transform: "scale(1.16,.8)" }, { transform: "scale(.94,1.06)" }, { transform: "none" }], { duration: 380 }),
    look: () => act([{ transform: "none" }, { transform: `rotate(${(Math.random() < 0.5 ? -1 : 1) * 5}deg)`, offset: 0.3 }, { transform: `rotate(${(Math.random() < 0.5 ? -1 : 1) * 5}deg)`, offset: 0.7 }, { transform: "none" }], { duration: 1800, easing: "ease-in-out" }),
  };
  // Floating text that follows the mascot (speech bubble, combo counter): re-placed every frame from the
  // outer box, which only moves when walking / dragging, so the nod wobble is not carried over.
  const followers = new Map(); // el -> (box) => [left, top]
  let followRaf = 0;
  function placeFollowers() {
    const box = deco.peek && deco.peek.getBoundingClientRect();
    for (const [e, f] of followers) {
      if (!e.isConnected) {
        followers.delete(e);
        continue;
      }
      if (!box) continue;
      const [l, t] = f(box);
      e.style.setProperty("left", Math.round(l) + "px", "important");
      e.style.setProperty("top", Math.round(t) + "px", "important");
    }
  }
  function follow(el, at) {
    followers.set(el, at);
    const tick = () => {
      placeFollowers();
      followRaf = followers.size ? requestAnimationFrame(tick) : 0;
    };
    if (!followRaf) followRaf = requestAnimationFrame(tick);
    placeFollowers();
  }
  function canvasRect() {
    return deco.peekCanvas ? deco.peekCanvas.getBoundingClientRect() : null;
  }
  // 台词气泡：用游戏标题字，主色描边玻璃底
  // kind：普通 / crit（黄橙大字，抖一下）/ tier（主色大字，停得久）
  function say(text, kind) {
    const r = canvasRect();
    if (!r || !text) return;
    const b = layer("peek-say", { position: "fixed", "z-index": "2147481001", "pointer-events": "none", left: Math.round(r.left + r.width / 2) + "px", top: Math.round(r.top - 6) + "px", transform: "translate(-50%,-100%)", padding: "5px 10px 6px", "border-radius": "10px", font: "700 14px/1 var(--cs-font)", color: "#f4f1ea", "white-space": "nowrap", background: "rgb(20 18 24 / .72)", border: "1px solid var(--cs-a, #c08cff)", "box-shadow": "0 4px 14px rgb(0 0 0 / .35)", "backdrop-filter": "blur(10px)" });
    b.textContent = text;
    if (kind === "crit") imp(b, { "font-size": "20px", color: "#ffd25a", background: "rgb(40 16 8 / .78)", border: "1px solid #ff9a3c", "box-shadow": "0 0 18px rgb(255 140 40 / .55)" });
    if (kind === "tier") imp(b, { "font-size": "22px", padding: "6px 12px 7px", "box-shadow": "0 0 22px var(--cs-a, #c08cff)" });
    document.querySelectorAll("[data-cskin=peek-say]").forEach((x) => x.remove());
    document.documentElement.append(b);
    follow(b, (box) => [box.left + box.width / 2, box.top - 6]);
    if (kind === "crit") {
      b.animate([{ opacity: 0, transform: "translate(-50%,-70%) scale(1.8) rotate(-10deg)" }, { opacity: 1, transform: "translate(-50%,-100%) scale(1) rotate(-4deg)", offset: 0.12 }, { transform: "translate(-48%,-100%) rotate(3deg)", offset: 0.2 }, { transform: "translate(-52%,-100%) rotate(-3deg)", offset: 0.28 }, { opacity: 1, transform: "translate(-50%,-105%) rotate(0)", offset: 0.75 }, { opacity: 0, transform: "translate(-50%,-125%)" }], { duration: 900, easing: "ease-out" }).onfinish = () => b.remove();
      return;
    }
    b.animate([{ opacity: 0, transform: "translate(-50%,-80%) scale(.7)" }, { opacity: 1, transform: "translate(-50%,-100%) scale(1.06)", offset: 0.15 }, { opacity: 1, transform: "translate(-50%,-110%) scale(1)", offset: 0.8 }, { opacity: 0, transform: "translate(-50%,-125%) scale(.96)" }], { duration: kind === "tier" ? 1800 : 1500, easing: "ease-out" }).onfinish = () => b.remove();
  }
  function burst(x, y, n = 8) {
    if (reduceMotion.matches) return;
    const col = getComputedStyle(document.documentElement).getPropertyValue("--cs-a").trim() || "#c08cff";
    for (let i = 0; i < n; i++) {
      const s = 4 + Math.random() * 5;
      const d = layer("peek-dot", { position: "fixed", "z-index": "2147481001", "pointer-events": "none", left: x - s / 2 + "px", top: y - s / 2 + "px", width: s + "px", height: s + "px", "border-radius": "50%", background: col, "box-shadow": `0 0 8px ${col}` });
      document.documentElement.append(d);
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const dist = 26 + Math.random() * 34;
      d.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist + 18}px) scale(.3)`, opacity: 0 }], { duration: 650 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.4,1)" }).onfinish = () => d.remove();
    }
  }

  // ---- 命中：按像素 alpha，home 模式下还要在裁剪框里 ----
  function hit(x, y) {
    const el = deco.peek;
    if (!el || !peek.alpha || el.style.getPropertyValue("display") !== "block" || peek.duck) return false;
    if (peek.mode === "home") {
      const b = el.getBoundingClientRect();
      if (y > b.bottom) return false; // below the composer edge it is hidden behind the composer
    }
    const r = canvasRect();
    if (!r || x < r.left || x >= r.right || y < r.top || y >= r.bottom) return false;
    const { w, h, data } = peek.alpha;
    const px = Math.floor(((x - r.left) / r.width) * w);
    const py = Math.floor(((y - r.top) / r.height) * h);
    return data[(py * w + px) * 4 + 3] > 40;
  }
  function setGrabCursor(kind) {
    const html = document.documentElement;
    if (kind) html.setAttribute("data-cskin-grab", kind);
    else html.removeAttribute("data-cskin-grab");
  }
  function savePos() {
    try {
      if (peek.mode === "free" && peek.pos) localStorage.setItem("codex-skins.peekPos", JSON.stringify(peek.pos));
      else localStorage.removeItem("codex-skins.peekPos");
    } catch {}
  }
  // 钟摆：目标角度跟着拖动速度，松手后自己晃回 0
  function swayLoop() {
    const s = peek.sway;
    s.v += (s.target - s.a) * 0.18;
    s.v *= 0.78;
    s.a += s.v;
    if (!peek.drag) s.target = 0;
    deco.peekSway.style.setProperty("transform", `rotate(${s.a.toFixed(2)}deg)`, "important");
    if (peek.drag || Math.abs(s.a) > 0.05 || Math.abs(s.v) > 0.05) s.raf = requestAnimationFrame(swayLoop);
    else {
      s.raf = 0;
      s.a = s.v = 0;
      deco.peekSway.style.removeProperty("transform");
      deco.peekSway.style.setProperty("transform-origin", "50% 100%", "important");
    }
  }
  function startDrag(e) {
    const el = deco.peek;
    const box = el.getBoundingClientRect();
    setDuck(false);
    el.style.setProperty("clip-path", "none", "important");
    peek.mode = "free";
    // 支点用按下的位置，不用第一次移动的位置，否则贴纸会先跳一下
    peek.drag = { dx: peek.down.x - box.left, dy: peek.down.y - box.top, lx: e.clientX, lt: performance.now() };
    // 抓住的位置当支点（相对 sway 层，sway 和外框同大小）
    deco.peekSway.style.setProperty("transform-origin", `${peek.drag.dx}px ${peek.drag.dy}px`, "important");
    act([{ transform: "scale(.95,1.07)" }], { duration: 160, fill: "forwards" });
    setGrabCursor("grabbing");
    say(pick(lines("drag")));
    if (!peek.sway.raf) peek.sway.raf = requestAnimationFrame(swayLoop);
  }
  function moveDrag(e) {
    const d = peek.drag;
    const now = performance.now();
    const dt = Math.max(now - d.lt, 1);
    const vx = (e.clientX - d.lx) / dt; // px/ms
    d.lx = e.clientX;
    d.lt = now;
    peek.sway.target = Math.max(-38, Math.min(38, -vx * 22));
    setBox(Math.min(Math.max(e.clientX - d.dx, -PEEK_W / 2), innerWidth - PEEK_W / 2), Math.min(Math.max(e.clientY - d.dy, -PEEK_H / 2), innerHeight - PEEK_H / 2));
    document.querySelectorAll("[data-cskin=peek-say]").forEach((x) => x.remove());
  }
  function endDrag() {
    const el = deco.peek;
    peek.drag = null;
    setGrabCursor(null);
    const box = el.getBoundingClientRect();
    const home = homeRect();
    // 拖回输入框上沿附近（外框底边离上沿 ≤ 70 px，横向落在输入框内）就吸回去
    if (home && Math.abs(box.bottom - home.card.top) < 70 && box.left + PEEK_W / 2 > home.card.left && box.left + PEEK_W / 2 < home.card.right) {
      peek.mode = "home";
      peek.pos = null;
      walk.x = walk.tx = box.left - home.card.left; // 落在哪就扒在哪
      saveWalk();
      savePos();
      goHome(box);
      return;
    }
    peek.pos = { x: box.left / innerWidth, y: box.top / innerHeight };
    savePos();
    ACTS.land();
  }
  // 从当前框位置滑回 home（FLIP：先放到 home，再用 transform 从旧位置过渡回来）
  function goHome(from) {
    const el = deco.peek;
    peek.mode = "home";
    peek.pos = null;
    savePos();
    const old = from || el.getBoundingClientRect();
    placePeek();
    const now = el.getBoundingClientRect();
    if (!reduceMotion.matches && el.animate) {
      el.style.setProperty("clip-path", "none", "important");
      const a = el.animate([{ transform: `translate(${old.left - now.left}px,${old.top - now.top}px)` }, { transform: "translate(0,0)" }], { duration: 420, easing: "cubic-bezier(.3,1.25,.5,1)" });
      a.onfinish = () => {
        placePeek();
        ACTS.land();
        say(pick(lines("home")));
      };
    }
  }
  function onClick(x, y) {
    const now = performance.now();
    peek.clicks = peek.clicks.filter((t) => now - t < 600);
    peek.clicks.push(now);
    burst(x, y, peek.clicks.length >= 3 ? 14 : 8);
    if (peek.clicks.length >= 3) {
      peek.clicks = [];
      ACTS.spin();
      say(pick(lines("dizzy")));
      return;
    }
    pick([ACTS.boing, ACTS.shake, () => ACTS.hop()])();
    say(pick(lines("click")));
  }

  // window 捕获阶段：先于页面拿到事件；只在命中贴纸像素时吃掉，其余放行
  addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !api.skin() || !hit(e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    peek.down = { x: e.clientX, y: e.clientY };
  }, true);
  addEventListener("pointermove", (e) => {
    if (peek.down) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!peek.drag && Math.hypot(e.clientX - peek.down.x, e.clientY - peek.down.y) > 4) startDrag(e);
      if (peek.drag) moveDrag(e);
      return;
    }
    setGrabCursor(api.skin() && hit(e.clientX, e.clientY) ? "grab" : null);
  }, true);
  addEventListener("pointerup", (e) => {
    if (!peek.down) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const d = peek.down;
    peek.down = null;
    if (peek.drag) endDrag();
    else onClick(d.x, d.y);
    // 紧跟着的 mouseup / click 也不让页面拿到（只吃这一次）
    peek.eatUntil = performance.now() + 300;
  }, true);
  addEventListener("pointercancel", () => {
    if (peek.drag) endDrag();
    peek.down = null;
  }, true);
  for (const type of ["mousedown", "mouseup", "click", "auxclick", "contextmenu"]) {
    addEventListener(type, (e) => {
      const eat = peek.down || (type !== "mousedown" && performance.now() < (peek.eatUntil || 0)) || (type === "mousedown" && api.skin() && hit(e.clientX, e.clientY));
      if (!eat) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (type === "click") peek.eatUntil = 0;
    }, true);
  }
  addEventListener("dblclick", (e) => {
    if (!api.skin() || !hit(e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (peek.mode === "free") goHome();
  }, true);

  // 打字：每个键 = 点一下头 + 往前迈一步（位置向目标缓动，约 0.1 s 到位），每一步都看得见，不做连续抖动。
  // 加速感靠「冲劲」m（0~1）：键越密涨得越快，停顿就按间隔衰减；步长 4→16 px、身体前倾都跟 m 走，
  // 冲劲过半脚下扬灰。每连打 25 个键跳一下冒点（连击奖励）。
  // 走到头弹一下转身。不在 home（被拖出去了）时只点头。
  const STEP_MIN = 5, STEP_MAX = 20; // 每步 px（满冲劲 60 ms 一键约 330 px/s）
  const STEP_EASE = 16; // 位置缓动速率（越大越快到位）
  const COMBO_GAP = 700; // 两键间隔超过它就算断连（单词之间的停顿不算断）
  function saveWalk() {
    try {
      if (walk.hi > walk.lo) localStorage.setItem("codex-skins.peekHomeX", String((walk.x - walk.lo) / (walk.hi - walk.lo)));
    } catch {}
  }
  // 朝向 + 前倾（倾角跟冲劲，过渡 0.25 s，不逐帧改）
  function setFacing() {
    const w = deco.peekWalk;
    w.style.setProperty("transition", "transform .25s ease-out", "important");
    w.style.setProperty("transform", `rotate(${(walk.dir * 9 * walk.m).toFixed(1)}deg) scaleX(${walk.dir > 0 ? -1 : 1})`, "important");
  }
  function walkFrame(t) {
    const dt = Math.min((t - (walk.last || t)) / 1000, 0.05);
    walk.last = t;
    const home = peek.mode === "home" && !peek.drag ? homeRect() : null;
    if (!home || walk.tx === null) {
      walk.raf = walk.last = 0;
      return;
    }
    walk.x += (walk.tx - walk.x) * Math.min(1, dt * STEP_EASE);
    if (Math.abs(walk.tx - walk.x) < 0.3) walk.x = walk.tx;
    setBox(home.left, home.top);
    if (walk.x === walk.tx) {
      walk.raf = walk.last = 0;
      saveWalk();
      // 停下来一会儿冲劲归零、身体立直
      clearTimeout(walk.rest);
      walk.rest = setTimeout(() => {
        if (performance.now() - walk.lastKey < 500) return;
        walk.m = 0;
        setFacing();
      }, 500);
      return;
    }
    walk.raf = requestAnimationFrame(walkFrame);
  }
  function dust(x, y) {
    if (reduceMotion.matches) return;
    const sz = 5 + Math.random() * 6;
    const d = layer("peek-dot", { position: "fixed", "z-index": "2147480999", "pointer-events": "none", left: x - sz / 2 + "px", top: y - sz / 2 + "px", width: sz + "px", height: sz + "px", "border-radius": "50%", background: "rgb(220 214 205 / .55)" });
    document.documentElement.append(d);
    d.animate([{ transform: "translate(0,0) scale(.6)", opacity: 0.8 }, { transform: `translate(${-walk.dir * (8 + Math.random() * 14)}px,${-6 - Math.random() * 10}px) scale(1.6)`, opacity: 0 }], { duration: 500, easing: "ease-out" }).onfinish = () => d.remove();
  }
  // ---- 连击 / 暴击 ----
  // 连击数显示在贴纸右上角（×N，每键弹一下，档位越高越大越亮）；停手 0.7 s 断连，断连时破纪录会喊「新纪录」。
  // 连击 ≥ 8 后每键有暴击概率（4% + 冲劲 × 8%）：大字「暴击!」、步子 ×2.5、输入框边框闪一下。
  // 档位 20 / 50 / 100 / 之后每 100：喊档位名，转圈，大爆点，输入框闪光。
  // callouts at 20 / 50 / 100 / 200 (and every 100 after); a theme can rename them with lines.tiers (4 entries)
  const TIER_AT = [20, 50, 100, 200];
  let best = 0;
  try {
    best = Number(localStorage.getItem("codex-skins.bestCombo")) || 0;
  } catch {}
  let comboEl = null, comboEnd = 0;
  function tierName(n) {
    const names = lines("tiers");
    const i = TIER_AT.indexOf(n);
    if (i >= 0) return names[i] ?? TEXT.tiers[i];
    return n > 200 && n % 100 === 0 ? names[3] ?? TEXT.tiers[3] : null;
  }
  function flashComposer(strong) {
    const card = composerCard();
    if (!card || reduceMotion.matches) return;
    const col = getComputedStyle(document.documentElement).getPropertyValue("--cs-a").trim() || "#c08cff";
    card.animate([{ boxShadow: `0 0 0 ${strong ? 3 : 2}px ${col}, 0 0 ${strong ? 40 : 22}px ${col}` }, { boxShadow: "0 0 0 0 transparent" }], { duration: strong ? 700 : 380, easing: "ease-out" });
  }
  function showCombo(n, kind) {
    const r = canvasRect();
    if (!r) return;
    if (!comboEl || !comboEl.isConnected) {
      comboEl = layer("peek-combo", { position: "fixed", "z-index": "2147481002", "pointer-events": "none", font: "900 16px/1 var(--cs-font)", color: "#fff", "white-space": "nowrap", "text-shadow": "0 2px 0 rgb(0 0 0 / .55), 0 0 10px var(--cs-a, #c08cff)", "-webkit-text-stroke": "0.5px rgb(0 0 0 / .4)" });
      document.documentElement.append(comboEl);
      follow(comboEl, (box) => [box.right - 10, box.top + 4]);
    }
    const lvl = n >= 100 ? 3 : n >= 50 ? 2 : n >= 20 ? 1 : 0;
    imp(comboEl, { "font-size": 15 + lvl * 4 + "px", color: ["#fff", "#ffe27a", "#ffb04a", "#ff5a5a"][lvl] });
    comboEl.textContent = "×" + n;
    comboEl.getAnimations().forEach((a) => a.cancel());
    const s = kind === "crit" || kind === "tier" ? 1.7 : 1.25;
    comboEl.animate([{ transform: `translate(-50%,-50%) scale(${s}) rotate(${kind === "crit" ? -8 : 0}deg)` }, { transform: "translate(-50%,-50%) scale(1)" }], { duration: 220, easing: "cubic-bezier(.2,1.6,.4,1)", fill: "forwards" });
  }
  function endCombo() {
    const n = walk.combo;
    // Combo broken: the counter drifts up and fades, then is removed (the next combo builds a new one).
    // Inline opacity must not be !important, or it wins over this animation and ×N stays forever.
    if (comboEl) {
      const el = comboEl;
      comboEl = null;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([{ opacity: 1, transform: "translate(-50%,-50%) scale(1)" }, { opacity: 0, transform: "translate(-50%,-120%) scale(.8)" }], { duration: 450, easing: "ease-in", fill: "forwards" }).onfinish = () => el.remove();
    }
    if (n >= 20 && n > best) {
      best = n;
      try {
        localStorage.setItem("codex-skins.bestCombo", String(best));
      } catch {}
      say(TEXT.record(n), "tier");
      ACTS.hop(30);
      const r = canvasRect();
      if (r) burst(r.left + r.width / 2, r.top + r.height * 0.3, 16);
    }
    walk.combo = 0;
  }
  // 返回这一键的类型：tier / crit / null
  function comboHit() {
    clearTimeout(comboEnd);
    comboEnd = setTimeout(endCombo, COMBO_GAP);
    const n = walk.combo;
    const r = canvasRect();
    const tier = tierName(n);
    if (tier) {
      say(tier, "tier");
      if (r) burst(r.left + r.width / 2, r.top + r.height * 0.3, 20);
      flashComposer(true);
      showCombo(n, "tier");
      return "tier";
    }
    if (n >= 8 && Math.random() < 0.04 + 0.08 * walk.m) {
      say(pick(lines("crit")), "crit");
      if (r) burst(r.left + r.width / 2, r.top + r.height * 0.45, 12);
      flashComposer(false);
      showCombo(n, "crit");
      return "crit";
    }
    if (n >= 3) showCombo(n);
    return null;
  }
  function onType() {
    const now = performance.now();
    if (now < (peek.busyUntil || 0)) return; // 回车跳跃中，清空输入框引起的 input 不算
    const gap = now - walk.lastKey;
    walk.combo = gap < COMBO_GAP ? walk.combo + 1 : 1;
    walk.lastKey = now;
    // 冲劲：先按停顿衰减，再向这一键的密度靠拢（每键走 20%）：60 ms 一键约 10 键冲到 0.9，200 ms 一键只到 0.46
    const dense = Math.min(Math.max((320 - gap) / 260, 0), 1);
    walk.m *= Math.exp(-Math.max(gap - 150, 0) / 600);
    walk.m += (Math.max(dense, 0.15) - walk.m) * 0.2;
    if (peek.mode !== "home" || peek.drag) {
      ACTS.nod((peek.tilt = -peek.tilt));
      return;
    }
    setDuck(false);
    const kind = comboHit();
    if (kind === "tier") ACTS.spin();
    else if (kind === "crit") ACTS.crit((peek.tilt = -peek.tilt));
    else ACTS.nod((peek.tilt = -peek.tilt));
    if (reduceMotion.matches || !homeRect()) return;
    const step = (STEP_MIN + (STEP_MAX - STEP_MIN) * walk.m * walk.m) * (kind === "crit" ? 2.5 : 1);
    let tx = (walk.tx ?? walk.x) + walk.dir * step;
    if (tx <= walk.lo || tx >= walk.hi) {
      tx = Math.min(Math.max(tx, walk.lo), walk.hi);
      walk.dir = -walk.dir;
      setFacing();
      ACTS.boing();
    }
    walk.tx = tx;
    setFacing();
    if (walk.m > 0.5) {
      const r = homeRect();
      if (r) for (let i = 0; i < (walk.m > 0.85 ? 2 : 1); i++) dust(r.left + PEEK_W / 2 - walk.dir * 24, r.card.top - 2);
    }
    if (!walk.raf) walk.raf = requestAnimationFrame(walkFrame);
  }
  // 回车发送：蓄力下蹲 → 起跳（冲劲越大跳得越高，28~48 px）→ 空中转半圈后落地压扁，冒光点和台词。
  // 发送后输入框会被清空、紧跟一个 input 事件，跳的这 0.9 s 里打字不播点头，免得把跳跃动画顶掉。
  function onSend() {
    const h = Math.round(28 + 20 * walk.m);
    const spin = walk.m > 0.6 ? walk.dir * -360 : 0;
    peek.busyUntil = performance.now() + 900;
    setDuck(false);
    act([
      { transform: "none" },
      { transform: "scale(1.22,.74)", offset: 0.18 },
      { transform: `translateY(-${h}px) scale(.9,1.12) rotate(${spin / 2}deg)`, offset: 0.5 },
      { transform: `translateY(-${Math.round(h * 0.6)}px) rotate(${spin}deg)`, offset: 0.68 },
      { transform: `scale(1.2,.8) rotate(${spin}deg)`, offset: 0.86 },
      { transform: `rotate(${spin}deg)` },
    ], { duration: 820 });
    setTimeout(() => {
      const r = canvasRect();
      if (r) burst(r.left + r.width / 2, r.top + r.height * 0.3, 12);
      say(pick(lines("send")));
    }, 330);
    setTimeout(() => {
      const r = homeRect();
      if (r && peek.mode === "home") for (let i = 0; i < 4; i++) dust(r.left + PEEK_W / 2 + (i - 1.5) * 12, r.card.top - 2);
    }, 700);
    walk.m = 0;
    clearTimeout(comboEnd);
    endCombo();
    setTimeout(setFacing, 820);
  }

  // 空闲时偶尔歪一下头
  setInterval(() => {
    if (!api.skin() || peek.drag || peek.duck || document.hidden || Math.random() > 0.35) return;
    if (deco.peekBody && !deco.peekBody.getAnimations().length) ACTS.look();
  }, 7000);

  // ---------- 侧栏横幅 ----------
  function daysSince() {
    let since = 0;
    try {
      since = Number(localStorage.getItem("codex-skins.since")) || 0;
      if (!since) {
        since = Date.now();
        localStorage.setItem("codex-skins.since", String(since));
      }
    } catch {}
    return Math.max(1, Math.floor((Date.now() - (since || Date.now())) / 86400000) + 1);
  }
  // Codex 侧栏的 nav 里每种模式（ChatGPT / Codex）各有一组：标题行、快捷项列表（[data-appearance=plain]：新聊天…）、
  // 会话列表滚动区，不用的那组高度为 0。横幅插在当前可见那组的快捷项列表前面，也就是「新聊天」正上方；切模式后由定时补挂挪过去
  function bannerSpot() {
    for (const list of document.querySelectorAll("[data-sidebar-navigation-root] nav [data-appearance=plain]")) {
      if (list.parentElement && list.getBoundingClientRect().height > 0) return list;
    }
    return null;
  }
  function ensureBanner() {
    const spot = bannerSpot();
    if (!spot) return deco.banner?.isConnected ? deco.banner : null;
    if (deco.banner && deco.banner.isConnected && deco.banner.nextElementSibling === spot) return deco.banner;
    deco.banner?.remove();
    const host = document.createElement("div");
    host.setAttribute("data-cskin", "banner");
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; display: block; flex: 0 0 auto; margin: 2px 8px 6px; cursor: pointer; user-select: none; }
      .b { position: relative; height: 62px; border-radius: 12px; overflow: hidden; display: flex; align-items: center;
           background: linear-gradient(100deg, color-mix(in srgb, var(--cs-a) 22%, rgb(20 20 22 / .5)) 0%, rgb(20 20 22 / .35) 70%);
           box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cs-a) 30%, transparent);
           -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); transition: box-shadow .2s ease; }
      :host(:hover) .b { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cs-a) 65%, transparent), 0 6px 24px -10px var(--cs-a); }
      .t { position: relative; z-index: 1; padding-left: 14px; display: flex; flex-direction: column; gap: 3px; }
      .w { font: 800 19px/1.05 var(--cs-font); letter-spacing: .02em; color: #f4f1ea; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
           text-shadow: 0 2px 0 rgb(0 0 0 / .45), 0 0 18px color-mix(in srgb, var(--cs-a) 55%, transparent); }
      .n { font: 600 12px/1 var(--cs-font); color: var(--cs-a); letter-spacing: .06em; text-transform: lowercase; }
      .n span { color: rgb(244 241 234 / .55); margin-left: 8px; }
      canvas { position: absolute; right: 4px; bottom: -2px; transform: rotate(6deg); transform-origin: 50% 100%;
               filter: drop-shadow(0 3px 4px rgb(0 0 0 / .45)); transition: transform .3s cubic-bezier(.3,1.5,.5,1); }
      :host(:hover) canvas { transform: rotate(-3deg) translateY(-2px) scale(1.04); }
    `;
    const b = document.createElement("div");
    b.className = "b";
    const t = document.createElement("div");
    t.className = "t";
    const w = document.createElement("div");
    w.className = "w";
    const n = document.createElement("div");
    n.className = "n";
    const c = document.createElement("canvas");
    t.append(w, n);
    b.append(t, c);
    root.append(style, b);
    host.title = TEXT.cycle;
    host.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      api.cycle();
    });
    spot.parentElement.insertBefore(host, spot);
    deco.banner = host;
    deco.bannerName = n;
    deco.bannerTitle = w;
    deco.bannerCanvas = c;
    deco.bannerKey = "";
    return host;
  }
  async function fillBanner() {
    const host = ensureBanner();
    const skin = api.skin();
    if (!host) return;
    if (!skin) {
      host.style.setProperty("display", "none", "important");
      return;
    }
    host.style.setProperty("display", "block", "important");
    host.style.setProperty("--cs-a", skin.line);
    const key = skin.id;
    if (deco.bannerKey === key) return;
    deco.bannerKey = key;
    deco.bannerTitle.textContent = api.name(skin);
    deco.bannerName.textContent = typeof skin.tag === "string" ? skin.tag : "codex-skins";
    const span = document.createElement("span");
    span.textContent = TEXT.day(daysSince());
    deco.bannerName.append(span);
    paint(deco.bannerCanvas, await bitmap(skin.badge), 66, 66);
  }

  // ---------- 场景动效 ----------
  const FX = {
    spores: { n: 70, make: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, r: 1.2 + Math.random() * 2.6, v: 6 + Math.random() * 14, ph: Math.random() * 6.28, a: 0.25 + Math.random() * 0.5 }) },
    rain: { n: 150, make: (w, h) => ({ x: Math.random() * (w + 200) - 100, y: Math.random() * h, l: 14 + Math.random() * 22, v: 520 + Math.random() * 380, a: 0.08 + Math.random() * 0.16 }) },
    embers: { n: 46, make: (w, h) => ({ x: Math.random() * w * 0.55, y: h - Math.random() * h * 0.3, r: 0.8 + Math.random() * 1.8, v: 18 + Math.random() * 34, ph: Math.random() * 6.28, a: 0.4 + Math.random() * 0.5, life: Math.random() }) },
    snow: { n: 110, make: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 2.2, v: 14 + Math.random() * 26, ph: Math.random() * 6.28, a: 0.25 + Math.random() * 0.5 }) },
    petals: { n: 38, make: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, r: 3 + Math.random() * 4, v: 22 + Math.random() * 30, ph: Math.random() * 6.28, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 2.4, a: 0.35 + Math.random() * 0.45 }) },
  };
  function ensureFx() {
    if (deco.fxCanvas && deco.fxCanvas.isConnected) return deco.fxCanvas;
    const layer = document.querySelector("[data-cskin=layer]");
    if (!layer) return null;
    const c = document.createElement("canvas");
    imp(c, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", "pointer-events": "none" });
    layer.append(c);
    deco.fxCanvas = c;
    return c;
  }
  let fxRaf = 0, fxLast = 0, fxParts = [], fxKind = "", fxColor = "";
  function fxRunning() {
    return !document.hidden && document.hasFocus() && !reduceMotion.matches && fxKind;
  }
  function fxFrame(t) {
    fxRaf = 0;
    const c = deco.fxCanvas;
    if (!c || !fxRunning()) return;
    if (t - fxLast < 33) {
      fxRaf = requestAnimationFrame(fxFrame);
      return;
    }
    const dt = Math.min(0.1, (t - (fxLast || t)) / 1000);
    fxLast = t;
    const w = c.width, h = c.height, ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (fxKind === "rain") {
      ctx.strokeStyle = fxColor;
      ctx.lineCap = "round";
      for (const p of fxParts) {
        p.y += p.v * dt;
        p.x -= p.v * 0.18 * dt;
        if (p.y > h) Object.assign(p, FX.rain.make(w, h), { y: -30 });
        ctx.globalAlpha = p.a;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.l * 0.18, p.y - p.l);
        ctx.stroke();
      }
    } else if (fxKind === "snow" || fxKind === "petals") {
      ctx.fillStyle = fxColor;
      for (const p of fxParts) {
        p.ph += dt;
        p.y += p.v * dt;
        p.x += Math.sin(p.ph * (fxKind === "snow" ? 0.8 : 1.3)) * (fxKind === "snow" ? 0.4 : 0.9) - (fxKind === "petals" ? p.v * 0.25 * dt : 0);
        if (p.y > h + 10 || p.x < -20) Object.assign(p, FX[fxKind].make(w, h), { y: -10 });
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        if (fxKind === "snow") ctx.arc(p.x, p.y, p.r, 0, 6.283);
        else {
          // a petal: an ellipse that flips as it tumbles
          p.rot += p.spin * dt;
          ctx.ellipse(p.x, p.y, p.r, p.r * (0.35 + 0.3 * Math.abs(Math.sin(p.ph * 2))), p.rot, 0, 6.283);
        }
        ctx.fill();
      }
    } else {
      for (const p of fxParts) {
        p.ph += dt;
        p.y -= p.v * dt;
        p.x += Math.sin(p.ph * 0.9) * 0.35;
        let a = p.a;
        if (fxKind === "embers") {
          p.life += dt * 0.25;
          a *= Math.max(0, 1 - p.life) * (0.6 + 0.4 * Math.sin(p.ph * 9));
          if (p.life >= 1 || p.y < 0) Object.assign(p, FX.embers.make(w, h), { life: 0 });
        } else if (p.y < -10) Object.assign(p, FX.spores.make(w, h), { y: h + 10 });
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, fxColor);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    fxRaf = requestAnimationFrame(fxFrame);
  }
  function startFx() {
    const skin = api.skin();
    const c = ensureFx();
    fxKind = (skin && skin.fx) || "";
    fxColor = (skin && (skin.fxColor || skin.line)) || "#fff";
    if (!c) return;
    const scale = Math.min(window.devicePixelRatio || 1, 1.25);
    c.width = Math.round(innerWidth * scale);
    c.height = Math.round(innerHeight * scale);
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    const def = FX[fxKind];
    fxParts = def ? Array.from({ length: def.n }, () => def.make(c.width, c.height)) : [];
    if (!fxRaf && fxRunning()) fxRaf = requestAnimationFrame(fxFrame);
  }
  function resumeFx() {
    if (!fxRaf && fxRunning()) {
      fxLast = 0;
      fxRaf = requestAnimationFrame(fxFrame);
    }
  }

  // ---------- 总调度 ----------
  async function apply() {
    const skin = api.skin();
    const on = !!skin;
    const html = document.documentElement;
    if (on) {
      html.setAttribute("data-cskin-on", "");
      html.style.setProperty("--cs-a", skin.line);
      ensureSheet();
      const family = await themeFont(skin);
      if (family) html.style.setProperty("--cs-theme-font", `"${family}"`);
      else html.style.removeProperty("--cs-theme-font");
    } else {
      html.removeAttribute("data-cskin-on");
    }
    await fillBanner();
    ensurePeek();
    if (on && skin.peek && deco.peekKey !== skin.id + "/" + skin.peek) {
      deco.peekKey = skin.id + "/" + skin.peek;
      paintPeek(await bitmap(skin.peek));
    }
    placePeek();
    startFx();
  }

  const inComposer = (t) => t && t.closest && t.closest("[data-composer-body]");
  document.addEventListener("input", (e) => {
    if (api.skin() && inComposer(e.target)) onType();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && api.skin() && inComposer(e.target)) onSend();
  }, true);
  addEventListener("resize", () => {
    placePeek();
    startFx();
  });
  addEventListener("scroll", placePeek, true);
  addEventListener("focus", resumeFx);
  document.addEventListener("visibilitychange", resumeFx);
  reduceMotion.addEventListener?.("change", startFx);
  // SPA 换页会重建侧栏 / 输入框：定时补挂、重新定位
  setInterval(() => {
    if (api.skin()) {
      fillBanner();
      if (!deco.fxCanvas || !deco.fxCanvas.isConnected) startFx();
    }
    placePeek();
  }, 1000);

  return { apply };
}
