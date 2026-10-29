#!/usr/bin/env node
// codex-skins installer: patches YOUR local Codex desktop app. Nothing from OpenAI is redistributed.
//   node install.mjs [install]   [--app <path>] [--skins <dir> ...] [--icons <dir>] [--profile <name>]
//   node install.mjs uninstall   [--app <path>]
//   node install.mjs status      [--app <path>]
// What install does (and uninstall undoes):
//   1. backs up resources/app.asar, the file holding the Electron fuses and resources/owl-app.ini next to themselves
//      (*.codex-skins-orig), once;
//   2. always rebuilds from that backup: extract → inject src/ + skins/ → repack (same set of unpacked native files);
//   3. turns off two Electron fuses (embedded asar integrity check, load-app-only-from-asar) so the patched asar loads.
//      Codex runs on OpenAI's own Electron-compatible runtime ("owl"); its fuses live in chrome.dll, not in the .exe.
// Windows Store / MSIX installs are read-only: the app is copied to %LOCALAPPDATA%\codex-skins\Codex and a Start menu
// shortcut "Codex (skins)" is created; uninstall deletes that copy and the shortcut. The copy gets its own UI profile
// name (owl-app.ini → UserDataDirectoryName), otherwise starting it would just bring up the Store app's window.
// Quit the skinned copy before running. The Store app itself is never modified and can keep running.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { injectInto, isPatched, MAIN_NAME, REPO } from "./lib/patch.mjs";

const require = createRequire(import.meta.url);
const BAK = ".codex-skins-orig";
const FUSE_SENTINEL = "dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX";
const ICONS = ["chatgpt-app-dark.ico", "chatgpt-app-light.ico"]; // window icons the app picks by taskbar theme
const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("-") ? args.shift() : "install";
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const skinDirs = [path.join(REPO, "skins")];
args.forEach((a, i) => a === "--skins" && args[i + 1] && skinDirs.push(path.resolve(args[i + 1])));
const iconDir = opt("--icons") ? path.resolve(opt("--icons")) : null;
const PROFILE = opt("--profile") ?? "CodexSkins";
const log = (...a) => console.log("codex-skins:", ...a);
const die = (m) => {
  console.error("codex-skins: " + m);
  process.exit(1);
};

// ---------- locate ----------
function ps(command) {
  return execFileSync("powershell", ["-NoProfile", "-Command", command], { encoding: "utf8" }).trim();
}
const fileHas = (file, text) => {
  try {
    return fs.readFileSync(file).includes(text);
  } catch {
    return false;
  }
};
// returns { root, resources, exe, fuses, ini }
function layoutFor(p) {
  const exe = ["ChatGPT.exe", "Codex.exe"].map((e) => path.join(p, e)).find((e) => fs.existsSync(e) && fs.statSync(e).size > 1e6);
  const resources = path.join(p, "resources");
  // the fuse wire sits in chrome.dll on owl builds; plain Electron keeps it in the executable
  const fuses = [path.join(p, "chrome.dll"), exe].find((f) => f && fileHas(f, FUSE_SENTINEL)) ?? exe;
  return { root: p, resources, exe, fuses, ini: path.join(resources, "owl-app.ini") };
}
function locate() {
  const given = opt("--app");
  if (given) return layoutFor(path.resolve(given.replace(/^~/, os.homedir())));
  if (process.platform !== "win32") die("only Windows is supported for now; pass --app <folder with resources/app.asar> to try anyway");
  const copy = path.join(process.env.LOCALAPPDATA, "codex-skins", "Codex");
  let store = "";
  try {
    store = ps("(Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1).InstallLocation");
  } catch {}
  if (store) return { ...layoutFor(copy), store: path.join(store, "app") };
  if (fs.existsSync(path.join(copy, "resources", "app.asar"))) return layoutFor(copy);
  die("Codex desktop not found; pass --app <folder that contains resources/app.asar>");
}

// ---------- helpers ----------
function running(l) {
  try {
    const n = ps(`@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('${l.root.replace(/'/g, "''")}\\', 'OrdinalIgnoreCase') }).Count`);
    return Number(n) > 0;
  } catch {
    return false;
  }
}
function hashTree(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).replace(/\\/g, "/") + " " + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort().join("\n");
}
async function setFuses(file, on) {
  const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
  await flipFuses(file, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: on,
    [FuseV1Options.OnlyLoadAppFromAsar]: on,
  });
}
const backup = (f) => f && fs.existsSync(f) && !fs.existsSync(f + BAK) && fs.copyFileSync(f, f + BAK);
const SHORTCUT = () => path.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Codex (skins).lnk");
function shortcut(l, icon) {
  const lnk = SHORTCUT();
  const q = (s) => s.replace(/'/g, "''");
  fs.rmSync(lnk, { force: true });
  ps(`$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${q(lnk)}');$s.TargetPath='${q(l.exe)}';$s.WorkingDirectory='${q(l.root)}';` +
    (icon ? `$s.IconLocation='${q(icon)},0';` : "") + `$s.Description='Codex with codex-skins';$s.Save()`);
  return lnk;
}

// ---------- commands ----------
async function install(l) {
  if (l.store) {
    // the copy does not update itself. The Store folder name carries the version (OpenAI.Codex_26.1023.…_x64__…),
    // so a different source path means Codex was updated: take a fresh copy.
    const marker = path.join(l.root, "codex-skins-source.txt");
    const copied = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "";
    if (copied !== l.store) {
      if (fs.existsSync(l.root) && running(l)) die("the skinned copy is running — quit it first");
      log(`Store (MSIX) install is read-only; copying ${l.store} -> ${l.root}`);
      fs.rmSync(l.root, { recursive: true, force: true });
      fs.cpSync(l.store, l.root, { recursive: true });
      fs.writeFileSync(marker, l.store + "\n");
      Object.assign(l, layoutFor(l.root), { store: l.store });
    }
  }
  if (!l.exe || !fs.existsSync(path.join(l.resources, "app.asar"))) die(`no app.asar under ${l.resources}`);
  if (running(l)) die("Codex is running from this folder — quit it (tray / menu → Quit) and run again");
  const asarPath = path.join(l.resources, "app.asar");
  const unpacked = asarPath + ".unpacked";
  backup(asarPath);
  backup(l.fuses);
  backup(l.ini);

  const asar = require("@electron/asar");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-skins-"));
  try {
    // extraction reads native files from <archive>.unpacked, so the backup gets its unpacked folder alongside
    fs.copyFileSync(asarPath + BAK, path.join(tmp, "app.asar"));
    if (fs.existsSync(unpacked)) fs.cpSync(unpacked, path.join(tmp, "app.asar.unpacked"), { recursive: true });
    const tree = path.join(tmp, "tree");
    asar.extractAll(path.join(tmp, "app.asar"), tree);
    if (isPatched(tree)) die("the backup is already patched — restore a clean app.asar first");
    const info = injectInto(tree, { skinDirs });
    log(`injected into ${info.main} + ${info.preload}; themes: ${info.skins.join(", ")}`);
    const out = path.join(tmp, "out", "app.asar");
    fs.mkdirSync(path.dirname(out));
    await asar.createPackageWithOptions(tree, out, { unpack: "{*.node,*.exe,*.dll,*.dylib,*.so}" });
    if (hashTree(out + ".unpacked") !== hashTree(unpacked)) die("repacked native files differ from the installed ones; aborting without changes");
    fs.copyFileSync(out, asarPath);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  fs.copyFileSync(l.fuses + BAK, l.fuses);
  await setFuses(l.fuses, false);
  log(`fuses off in ${path.basename(l.fuses)}`);

  // a separate UI profile for the Store copy (chats and login live in ~/.codex and stay shared)
  if (l.store && fs.existsSync(l.ini)) {
    const ini = fs.readFileSync(l.ini + BAK, "utf8");
    fs.writeFileSync(l.ini, /UserDataDirectoryName=/.test(ini) ? ini.replace(/UserDataDirectoryName=.*/, `UserDataDirectoryName=${PROFILE}`) : ini.replace(/\[Owl\]\r?\n/, `$&UserDataDirectoryName=${PROFILE}\n`));
    log(`profile: ${PROFILE}`);
  }

  // optional: your own window / shortcut icons (chatgpt-app-dark.ico, chatgpt-app-light.ico, shortcut.ico)
  let shortcutIcon = null;
  if (iconDir) {
    for (const name of ICONS) {
      const src = path.join(iconDir, name), dst = path.join(l.resources, name);
      if (!fs.existsSync(src) || !fs.existsSync(dst)) continue;
      backup(dst);
      fs.copyFileSync(src, dst);
      log(`icon: ${name}`);
    }
    if (fs.existsSync(path.join(iconDir, "shortcut.ico"))) {
      shortcutIcon = path.join(l.root, "codex-skins.ico");
      fs.copyFileSync(path.join(iconDir, "shortcut.ico"), shortcutIcon);
    }
  }
  if (l.store) log(`shortcut: ${shortcut(l, shortcutIcon)}`);
  log(`installed into ${l.root}. Start Codex${l.store ? " from the \"Codex (skins)\" shortcut" : ""}, then Ctrl+Alt+T to cycle themes.`);
}

async function uninstall(l) {
  if (l.store) {
    // Store install: the skinned copy is ours entirely — remove it and its shortcut
    if (!fs.existsSync(l.root)) return log("nothing to remove (no skinned copy)");
    if (running(l)) die("the skinned copy is running — quit it first");
    fs.rmSync(l.root, { recursive: true, force: true });
    fs.rmSync(SHORTCUT(), { force: true });
    try {
      fs.rmdirSync(path.dirname(l.root)); // %LOCALAPPDATA%\codex-skins, only if empty
    } catch {}
    return log(`removed ${l.root} and the "Codex (skins)" shortcut; the Store app was never modified`);
  }
  if (running(l)) die("Codex is running from this folder — quit it first");
  let done = false;
  for (const f of [path.join(l.resources, "app.asar"), l.fuses, l.ini, ...ICONS.map((n) => path.join(l.resources, n))]) {
    if (f && fs.existsSync(f + BAK)) {
      fs.copyFileSync(f + BAK, f);
      fs.rmSync(f + BAK);
      done = true;
    }
  }
  fs.rmSync(path.join(l.root, "codex-skins.ico"), { force: true });
  log(done ? `restored the original files in ${l.root}` : "nothing to restore (no backups found)");
}

function status(l) {
  const asarPath = path.join(l.resources, "app.asar");
  log(`app:      ${l.root}${l.store ? ` (Store install, copy target; source ${l.store})` : ""}`);
  log(`backup:   ${fs.existsSync(asarPath + BAK) ? "yes" : "no"}`);
  let patched = false;
  try {
    const asar = require("@electron/asar");
    patched = asar.listPackage(asarPath).some((f) => f.endsWith(MAIN_NAME));
  } catch {}
  log(`patched:  ${patched ? "yes" : "no"}`);
  log(`fuses in: ${l.fuses ? path.basename(l.fuses) : "?"}`);
  log(`running:  ${l.exe && fs.existsSync(l.exe) && running(l) ? "yes" : "no"}`);
}

const l = locate();
if (cmd === "install") await install(l);
else if (cmd === "uninstall") await uninstall(l);
else if (cmd === "status") status(l);
else die(`unknown command ${cmd}`);
