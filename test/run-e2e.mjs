// Runs the Electron end-to-end test (or records the demo with --record) against the files in src/ and skins/.
//   npm run e2e      → test/out/results.json + test/out/theme-*.png, exit code 0 when everything passes
//   npm run demo     → docs/demo.mp4 + docs/demo.gif (needs ffmpeg on PATH)
//   npm run e2e -- --skins <dir>   → also loads and tests the themes in <dir>
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { REPO } from "../lib/patch.mjs";

const record = process.argv.includes("--record");
// --skins <dir>: also load the themes in <dir> (e.g. your own private pack) and test every one of them
const extraAt = process.argv.indexOf("--skins");
const extra = extraAt > 0 ? path.resolve(process.argv[extraAt + 1]) : "";
const OUT = path.join(REPO, "test", "out");
fs.mkdirSync(OUT, { recursive: true });
const userData = path.join(OUT, "userdata");
fs.rmSync(userData, { recursive: true, force: true });
// the same two files the installer appends to the main window preload; the flag lets it run on a file:// page
const preload = path.join(OUT, "preload.test.js");
fs.writeFileSync(preload, ["globalThis.__CODEX_SKINS_TEST__ = true;", ...["deco.js", "preload.js"].map((f) => fs.readFileSync(path.join(REPO, "src", f), "utf8"))].join("\n"));

const electron = createRequire(import.meta.url)("electron");
const r = spawnSync(electron, [path.join(REPO, "test", "e2e", "app")], {
  stdio: "inherit",
  env: { ...process.env, CS_REPO: REPO, CS_OUT: OUT, CS_PRELOAD: preload, CS_USERDATA: userData, CS_RECORD: record ? "1" : "", CS_EXTRA_SKINS: extra },
});
if (r.status !== 0 || !record) process.exit(r.status ?? 1);

const frames = path.join(OUT, "frames");
const docs = path.join(REPO, "docs");
fs.mkdirSync(docs, { recursive: true });
const ff = (...a) => {
  const x = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a], { stdio: "inherit", cwd: frames });
  if (x.status !== 0) process.exit(x.status ?? 1);
};
ff("-f", "concat", "-i", "list.txt", "-vf", "fps=30,scale=1600:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", path.join(docs, "demo.mp4"));
ff("-i", path.join(docs, "demo.mp4"), "-vf", "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5", path.join(docs, "demo.gif"));
// README screenshots (clean screen) as compact JPEGs
for (const f of fs.readdirSync(OUT).filter((f) => /^readme-.+\.png$/.test(f))) {
  const id = f.slice(7, -4);
  const x = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(OUT, f), "-vf", "scale=1200:-2", "-q:v", "4", path.join(docs, `theme-${id}.jpg`)], { stdio: "inherit" });
  if (x.status !== 0) process.exit(x.status ?? 1);
}
console.log("wrote docs/demo.mp4, docs/demo.gif and docs/theme-*.jpg");
