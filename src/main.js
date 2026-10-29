"use strict";
// codex-skins — main-process side.
// Serves theme manifests and asset bytes to the page, and writes a probe file that helps when Codex changes its markup.
// Themes live in two places; a user theme with the same id wins over a bundled one:
//   bundled: <this file's dir>/codex-skins/skins/<id>/skin.json   (packed into app.asar by the installer)
//   user:    <userData>/codex-skins/skins/<id>/skin.json          (drop a folder here, no reinstall needed)
// Required at the very top of the app's main entry (early-bootstrap.js); every failure is swallowed so the app always starts.
function installCodexSkins(electron, options = {}) {
  const { app, ipcMain } = electron;
  const fs = require("fs");
  const path = require("path");

  const BUNDLED = options.bundledDir ?? path.join(__dirname, "codex-skins", "skins");
  const USER = options.userDir ?? path.join(app.getPath("userData"), "codex-skins", "skins");
  const ID_RE = /^[a-z0-9-]{1,32}$/;
  const FILE_RE = /^[\w.-]{1,64}\.(jpe?g|png|webp|woff2?|ttf|otf)$/i;

  // Only Codex's own UI (served from app://-/) may call in — not embedded web pages or sandboxed iframes.
  const isCodexSender = (event) => {
    try {
      const u = new URL(event.senderFrame.url);
      return u.protocol === "app:" && u.host === "-";
    } catch {
      return false;
    }
  };
  const isAllowedSender = options.isAllowedSender ?? isCodexSender;
  const guard = (event) => {
    if (!isAllowedSender(event)) throw new Error("codex-skins: sender not allowed");
  };

  function readManifest(dir, id) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, id, "skin.json"), "utf8"));
      return m && typeof m === "object" ? { ...m, id } : null;
    } catch {
      return null;
    }
  }
  function listDir(dir) {
    try {
      return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && ID_RE.test(d.name)).map((d) => d.name);
    } catch {
      return [];
    }
  }

  ipcMain.handle("codex-skins:list", (event) => {
    guard(event);
    const out = new Map();
    for (const [dir, source] of [[BUNDLED, "bundled"], [USER, "user"]]) {
      for (const id of listDir(dir)) {
        const m = readManifest(dir, id);
        if (m) out.set(id, { ...m, source });
      }
    }
    // bundled order first (by "order", then id), user-only themes after
    return [...out.values()].sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
  });

  ipcMain.handle("codex-skins:asset", (event, id, file) => {
    guard(event);
    if (!ID_RE.test(String(id)) || !FILE_RE.test(String(file))) throw new Error("codex-skins: bad asset name");
    for (const dir of [USER, BUNDLED]) {
      try {
        return fs.readFileSync(path.join(dir, id, file));
      } catch {}
    }
    return null;
  });

  // What the page actually found (accent variables, panels made see-through). Look here first after a Codex update.
  ipcMain.handle("codex-skins:probe", (event, data) => {
    guard(event);
    try {
      const text = JSON.stringify({ at: new Date().toISOString(), ...data }, null, 2);
      if (text.length < 512 * 1024) {
        fs.mkdirSync(path.join(app.getPath("userData"), "codex-skins"), { recursive: true });
        fs.writeFileSync(path.join(app.getPath("userData"), "codex-skins", "probe.json"), text);
      }
    } catch {}
    return true;
  });
}

module.exports = { installCodexSkins };

try {
  // Codex runs on OpenAI's own Electron-compatible runtime (owl); only skip the renderer, don't rely on process.type === "browser"
  if (process.type !== "renderer" && !process.env.CODEX_SKINS_NO_AUTOINSTALL) {
    const electron = require("electron");
    electron.app.whenReady().then(() => installCodexSkins(electron)).catch((e) => {
      try {
        process.stderr.write(`codex-skins: install failed: ${e?.message ?? e}\n`);
      } catch {}
    });
  }
} catch (e) {
  try {
    process.stderr.write(`codex-skins: install failed: ${e?.message ?? e}\n`);
  } catch {}
}
