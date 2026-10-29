// Injection on a minimal fake app.asar tree (no Electron needed).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { injectInto, isPatched, MAIN_NAME } from "../lib/patch.mjs";

// the shape of Codex's app.asar: package.json main → .vite/build/early-bootstrap.js, main window preload next to it
function fakeTree({ preload = "/* app preload */ contextBridge.exposeInMainWorld(`electronBridge`, V);" } = {}) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "cs-unit-"));
  fs.mkdirSync(path.join(t, ".vite", "build"), { recursive: true });
  fs.writeFileSync(path.join(t, "package.json"), JSON.stringify({ main: ".vite/build/early-bootstrap.js" }));
  fs.writeFileSync(path.join(t, ".vite/build/early-bootstrap.js"), 'require("./rolldown-runtime-x.js");boot();');
  fs.writeFileSync(path.join(t, ".vite/build/preload.js"), preload);
  return t;
}

test("injects main module, preload and bundled themes", () => {
  const t = fakeTree();
  const info = injectInto(t);
  const main = fs.readFileSync(path.join(t, ".vite/build/early-bootstrap.js"), "utf8");
  assert.equal(main, `try{require("./${MAIN_NAME}")}catch{}require("./rolldown-runtime-x.js");boot();`);
  const pre = fs.readFileSync(path.join(t, ".vite/build/preload.js"), "utf8");
  assert.ok(pre.startsWith("/* app preload */") && pre.includes("function codexSkinsDeco") && pre.includes("codex-skins:list"));
  assert.ok(fs.existsSync(path.join(t, ".vite/build", MAIN_NAME)));
  assert.deepEqual(info.skins.sort(), ["aurora", "campfire", "neon", "sakura"]);
  for (const id of info.skins) assert.ok(fs.existsSync(path.join(t, ".vite/build/codex-skins/skins", id, "skin.json")));
  assert.ok(isPatched(t));
});

test("refuses to patch twice", () => {
  const t = fakeTree();
  injectInto(t);
  assert.throws(() => injectInto(t), /already patched/);
});

test("refuses a tree whose preload is not the main window one", () => {
  assert.throws(() => injectInto(fakeTree({ preload: "/* some other preload */" })), /main window preload not found/);
});

test("extra skin folders are added and override bundled ids", () => {
  const t = fakeTree();
  const extra = fs.mkdtempSync(path.join(os.tmpdir(), "cs-skins-"));
  for (const id of ["aurora", "mine"]) {
    fs.mkdirSync(path.join(extra, id));
    fs.writeFileSync(path.join(extra, id, "skin.json"), JSON.stringify({ name: id, hue: 1, sat: 2 }));
  }
  const info = injectInto(t, { skinDirs: [path.resolve("skins"), extra] });
  assert.ok(info.skins.includes("mine"));
  const aurora = JSON.parse(fs.readFileSync(path.join(t, ".vite/build/codex-skins/skins/aurora/skin.json"), "utf8"));
  assert.equal(aurora.name, "aurora");
});
