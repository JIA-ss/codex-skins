// Injects codex-skins into an extracted app.asar tree of the Codex desktop app. Pure file operations; used by install.mjs
// and by anyone who keeps their own build pipeline (see README "Develop").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MAIN_NAME = "codex-skins-main.js";
export const MARK = "/* codex-skins */";

// tree: the extracted app.asar root. skinDirs: folders whose sub-folders are themes (later ones override earlier ones).
export function injectInto(tree, { skinDirs = [path.join(REPO, "skins")] } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(tree, "package.json"), "utf8"));
  const mainFile = path.join(tree, pkg.main);
  const buildDir = path.dirname(mainFile);
  // the main window's preload: the one that exposes electronBridge to Codex's UI
  const preloadFile = path.join(buildDir, "preload.js");
  if (!fs.existsSync(preloadFile) || !fs.readFileSync(preloadFile, "utf8").includes("electronBridge")) {
    throw new Error(`main window preload not found: ${preloadFile} (unsupported Codex version)`);
  }

  // main process: require our module first, before the app's own bootstrap
  let main = fs.readFileSync(mainFile, "utf8");
  if (main.includes(MAIN_NAME)) throw new Error(`${pkg.main} is already patched; start from the original app.asar`);
  main = main.replace(/^("use strict";)?/, (m) => `${m}try{require("./${MAIN_NAME}")}catch{}`);
  fs.writeFileSync(mainFile, main);
  fs.copyFileSync(path.join(REPO, "src", "main.js"), path.join(buildDir, MAIN_NAME));

  // main window preload: append deco + preload, each wrapped so a failure never touches the app
  const parts = ["deco.js", "preload.js"].map((f) => fs.readFileSync(path.join(REPO, "src", f), "utf8"));
  fs.appendFileSync(preloadFile, `\n${MARK}\n${parts.join("\n")}\n`);

  // themes
  const out = path.join(buildDir, "codex-skins", "skins");
  fs.rmSync(path.join(buildDir, "codex-skins"), { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const ids = [];
  for (const dir of skinDirs) {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory() || !fs.existsSync(path.join(dir, d.name, "skin.json"))) continue;
      fs.rmSync(path.join(out, d.name), { recursive: true, force: true });
      fs.cpSync(path.join(dir, d.name), path.join(out, d.name), { recursive: true });
      if (!ids.includes(d.name)) ids.push(d.name);
    }
  }
  return { main: pkg.main, preload: path.relative(tree, preloadFile), skins: ids };
}

export function isPatched(tree) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(tree, "package.json"), "utf8"));
    return fs.readFileSync(path.join(tree, pkg.main), "utf8").includes(MAIN_NAME);
  } catch {
    return false;
  }
}
