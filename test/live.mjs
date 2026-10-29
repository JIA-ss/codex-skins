// Live end-to-end check against a REAL, installed and running Codex (not the mock): connects to its DevTools port,
// cycles every installed theme with real key events, checks and screenshots each one, then returns to where it started.
//   1. start the skinned Codex with a debugging port, e.g.
//        "%LOCALAPPDATA%\codex-skins\Codex\ChatGPT.exe" --remote-debugging-port=9339
//   2. node test/live.mjs [--port 9339] [--out test/out/live]
//   3. quit Codex and start it normally again (an open debugging port lets any local process control the app)
// Read-only apart from key presses and typing 12 characters into the composer and deleting them: never sends a message.
import fs from "node:fs";
import path from "node:path";
import { REPO } from "../lib/patch.mjs";

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const PORT = arg("--port", "9339");
const OUT = path.resolve(arg("--out", path.join(REPO, "test", "out", "live")));
fs.mkdirSync(OUT, { recursive: true });

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === "page" && t.url === "app://-/index.html");
if (!target) throw new Error("Codex main window (app://-/index.html) not found on port " + PORT);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let n = 0;
const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => { const d = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (d.result?.exceptionDetails) throw new Error(JSON.stringify(d.result.exceptionDetails).slice(0, 500)); return d.result.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code, mods, text) => {
  const vk = code.startsWith("Key") ? code.charCodeAt(3) : code === "Backspace" ? 8 : 0;
  for (const type of ["rawKeyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, modifiers: mods, code, key: text ?? code.replace(/^Key/, "").toLowerCase(), windowsVirtualKeyCode: vk });
};
const CTRL_ALT = 2 | 1, SHIFT = 8;
const shot = async (name) => { const d = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(d.result.data, "base64")); };
const STATE = `(() => {
  const de = document.documentElement, v = (n) => getComputedStyle(de).getPropertyValue(n).trim();
  const layer = document.querySelector("[data-cskin=layer]"), banner = document.querySelector("[data-cskin=banner]"), peek = document.querySelector("[data-cskin=peek]");
  const card = [...document.querySelectorAll("[data-composer-body]")].find((e) => e.getBoundingClientRect().width > 120);
  const btn = card && [...card.querySelectorAll("button")].find((b) => getComputedStyle(b).backgroundColor !== "rgba(0, 0, 0, 0)");
  const mains = [...document.querySelectorAll("main[data-app-shell-main-surface]")].filter((m) => m.getBoundingClientRect().width > 100);
  const cr = card?.getBoundingClientRect(), pr = peek?.getBoundingClientRect();
  return {
    skin: localStorage.getItem("codex-skins.id"), on: de.hasAttribute("data-cskin-on"),
    layer: layer ? getComputedStyle(layer).opacity : null, accent: v("--codex-base-accent"), send: btn ? getComputedStyle(btn).backgroundColor : null,
    main: mains.map((m) => getComputedStyle(m).backgroundColor),
    bannerShown: !!banner && getComputedStyle(banner).display !== "none", bannerTitle: banner?.shadowRoot?.querySelector(".w")?.textContent ?? null,
    bannerAboveNewChat: !!banner && !!banner.nextElementSibling?.matches("[data-appearance=plain]") && banner.nextElementSibling.getBoundingClientRect().height > 0,
    peekShown: !!peek && getComputedStyle(peek).display !== "none", peekRightGap: cr && pr ? Math.round(cr.right - pr.right) : null,
    savedHome: localStorage.getItem("codex-skins.peekHomeX") ?? localStorage.getItem("codex-skins.peekPos"),
    toast: document.querySelector("[data-cskin=toast]")?.textContent ?? null,
  };
})()`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + JSON.stringify(detail)}`); };
const translucent = (cs) => cs.some((c) => /rgba\(.*, 0\.\d+\)/.test(c));

await send("Page.bringToFront");
const start = await js(STATE);
// go to "off" first to record the app's own colors
let s = start;
for (let i = 0; i < 20 && s.skin !== "off"; i++) { await key("KeyT", CTRL_ALT); await sleep(900); s = await js(STATE); }
const orig = s;
check("off: scene hidden, Codex's own accent, opaque main surface, banner and mascot gone", s.skin === "off" && s.layer === "0" && !s.accent.startsWith("hsl(") && !translucent(s.main) && !s.bannerShown && !s.peekShown, s);
await shot("live-off");
const seen = [];
for (let i = 0; i < 20; i++) {
  await key("KeyT", CTRL_ALT);
  await sleep(1800);
  s = await js(STATE);
  if (s.skin === "off") break;
  seen.push(s.skin);
  check(`${s.skin}: scene, accent, send button, see-through, banner above "new chat", mascot, toast`,
    s.on && s.layer === "1" && s.accent.startsWith("hsl(") && s.send && s.send !== orig.send && translucent(s.main) && s.bannerShown && !!s.bannerTitle && s.bannerAboveNewChat && s.peekShown && s.toast?.startsWith("codex-skins · "), s);
  if (!s.savedHome) check(`${s.skin}: mascot starts at the right end of the composer`, s.peekRightGap >= 16 && s.peekRightGap <= 32, s.peekRightGap);
  await shot(`live-${s.skin}`);
}
check("cycled through at least one theme and back to off", seen.length > 0 && s.skin === "off", seen);
// intensity
for (let i = 0; i < 20 && s.skin !== start.skin && s.skin !== seen[0]; i++) { await key("KeyT", CTRL_ALT); await sleep(900); s = await js(STATE); }
if (s.skin === "off") { await key("KeyT", CTRL_ALT); await sleep(1500); }
const a0 = (await js(STATE)).main.join();
await key("KeyT", CTRL_ALT | SHIFT, "T"); await sleep(700);
const a1 = (await js(STATE)).main.join();
check("Ctrl+Alt+Shift+T changes how much shows through", a0 !== a1, { a0, a1 });
for (let i = 0; i < 2; i++) { await key("KeyT", CTRL_ALT | SHIFT, "T"); await sleep(400); }
// typing: 12 characters, the mascot counts them, then delete them all
await js(`(() => { const ed = [...document.querySelectorAll("[data-composer-body] [contenteditable=true]")].find((e) => e.getBoundingClientRect().width > 50); ed.focus(); return !!ed; })()`);
for (const ch of "codexskins12") { await send("Input.insertText", { text: ch }); await sleep(70); }
await sleep(150);
const typed = await js(`({ text: document.activeElement?.textContent, combo: document.querySelector("[data-cskin=peek-combo]")?.textContent ?? null })`);
await shot("live-typing");
check("typing reaches the composer and the mascot counts the combo", typed.text === "codexskins12" && typed.combo === "×12", typed);
for (let i = 0; i < 14; i++) await key("Backspace", 0, "Backspace");
await sleep(300);
check("composer cleared again", (await js(`document.activeElement?.textContent ?? ""`)) === "");
// back to the starting theme
for (let i = 0; i < 20; i++) { s = await js(STATE); if (s.skin === start.skin) break; await key("KeyT", CTRL_ALT); await sleep(900); }
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 1));
console.log(`\n${results.length - failed.length}/${results.length} passed; screenshots in ${OUT}`);
ws.close();
process.exit(failed.length ? 1 : 0);
