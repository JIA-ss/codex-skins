<h1 align="center">codex-skins</h1>

<p align="center"><b>给 Codex 桌面版换肤（Windows 和 macOS），再养一只跟着你打字的小家伙。</b><br>
<sub>聊天区后面铺一张场景画，强调色跟着换，面板变成毛玻璃，再加一点粒子；还有一只吉祥物趴在输入框上沿，你打字它就蹦着往前走，回车就起跳。</sub></p>

<p align="center">
  <a href="https://github.com/JIA-ss/codex-skins/actions/workflows/ci.yml"><img src="https://github.com/JIA-ss/codex-skins/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/JIA-ss/codex-skins/releases/latest"><img src="https://img.shields.io/github/v/release/JIA-ss/codex-skins?label=release&color=5fe3c4" alt="release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/JIA-ss/codex-skins?color=3d8bfd" alt="license"></a>
  <a href="skins/LICENSE.md"><img src="https://img.shields.io/badge/theme_art-CC0-8a8a8a" alt="theme art: CC0"></a>
  <a href="#安装"><img src="https://img.shields.io/badge/platform-Windows_%7C_macOS-0078D6?logo=windows&logoColor=white" alt="platform"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A5%2022-339933?logo=nodedotjs&logoColor=white" alt="node >= 22"></a>
  <a href="https://github.com/JIA-ss/codex-skins/stargazers"><img src="https://img.shields.io/github/stars/JIA-ss/codex-skins?color=f5c518&logo=github" alt="stars"></a>
  <a href="https://github.com/JIA-ss/claude-skins"><img src="https://img.shields.io/badge/%E5%A7%8A%E5%A6%B9%E9%A1%B9%E7%9B%AE-claude--skins-d97757" alt="claude-skins"></a>
</p>

<p align="center"><a href="README.md">English</a> · <a href="#安装">安装</a> · <a href="#怎么用">快捷键</a> · <a href="#自己做主题">做自己的主题</a> · <a href="https://github.com/JIA-ss/claude-skins">claude-skins（Claude 版）</a></p>

<p align="center"><img src="docs/demo.gif" alt="codex-skins 演示" width="860"></p>

> [!NOTE]
> **非官方项目。** codex-skins 是社区项目，不是 OpenAI 出品，也不受 OpenAI 支持。它修改的是<b>你自己电脑上装的那份</b> Codex，仓库里不包含任何 OpenAI 的文件。风险自担；Codex 更新后需要重新运行一次安装。

| 极光 | 夜樱 | 营火 | 霓虹雨夜 |
|---|---|---|---|
| ![](docs/theme-aurora.jpg) | ![](docs/theme-sakura.jpg) | ![](docs/theme-campfire.jpg) | ![](docs/theme-neon.jpg) |

## 安装

支持 Windows 和 macOS。需要 [Node.js](https://nodejs.org) 22 以上。

```bash
git clone https://github.com/JIA-ss/codex-skins.git
cd codex-skins
npm install --omit=dev   # 开发依赖（Electron）只有跑测试才需要
node install.mjs
```

然后启动 **Codex (skins)**：Windows 上从开始菜单里新出现的快捷方式启动，macOS 上从 `~/Applications` 或聚焦搜索启动。

安装器做了什么：Codex 是从微软商店（MSIX）装的，目录只读，所以安装器把应用复制到 `%LOCALAPPDATA%\codex-skins\Codex`，改这份副本，再加上那个快捷方式。原版 Codex 不会被改动，可以和副本同时开着。

- 登录、对话和项目都在 `~/.codex` 里，两边共用。
- 副本有自己独立的界面配置（窗口布局、本地设置）；不然一启动副本，打开的其实是原版的窗口。
- `codex://` 链接仍然会打开原版。

**macOS：** 官方签名的 `/Applications/ChatGPT.app`（bundle `com.openai.codex`）不会被改动——原地修改会破坏 OpenAI 的签名，它的自动更新也会跟着失效。安装器把它复制到 `~/Applications/Codex (skins).app`，给副本单独的界面配置（`~/Library/Application Support/CodexSkins`），在 `Frameworks/Codex Framework.framework` 里关掉 fuse，再做一次 ad hoc 重签名。macOS 可能会问一次是否允许副本控制其他应用（Codex 自带的操作电脑功能），按你自己的需要选。快捷键是 ⌃⌥T / ⌃⌥⇧T / ⌃⌥P。已在 macOS 26（Apple 芯片）+ Codex 26.1023 上测过。

其他命令：

```bash
node install.mjs status      # Codex 装在哪、副本改没改过
node install.mjs uninstall   # 删掉复制出来的副本和快捷方式（副本的界面配置 %APPDATA%\Codex\web\CodexSkins 会留下，不要可以手动删）
node install.mjs --app <目录> # 原地修改别的解包好的 Codex 目录（里面有 resources/app.asar）
```

**Codex 更新后**，先退出副本，再运行一次 `node install.mjs`，它会发现版本变了，重新复制一份。

## 怎么用

| | |
|---|---|
| `Ctrl+Alt+T` | 切到下一个主题（…→ 关闭 → 第一个主题） |
| `Ctrl+Alt+Shift+T` | 浓度：场景透出来多少（淡 / 中 / 浓） |
| `Ctrl+Alt+P` | **录屏模式**：隐藏侧栏内容（对话、项目、账号）和标签栏上的对话标题，并跳过标了 `"private": true` 的主题。再按一次关闭；重启后保持开启，直到你手动关掉。 |
| 点侧栏的横幅 | 切到下一个主题（横幅在「新聊天」正上方） |

吉祥物：

- **打字**：每敲一个键，它点一下头，沿着输入框上沿走一步。打得越快冲劲越足：步子更大、身体前倾、扬起小灰尘。连续打字有连击计数，会随机暴击，20 / 50 / 100 次时还会喊话；最高连击会被记住。
- **回车**：先蹲下再起跳；冲劲越大跳得越高，冲满时还会空翻。
- **点它**：弹一下 / 摇头 / 蹦一下，冒出台词气泡；快速点三下会晕。
- **拖它**：按住任意位置都能拖，它会跟着你的动作摆动，松手就留在原地。拖回输入框附近（或双击它）会爬回老位置：输入框右端。
- 点到它身上透明的地方，点击会直接落到页面上。

浅色主题下只换强调色（场景是按深色模式设计的）。系统开了「减少动态效果」时，动画和粒子都会关闭。

## 自己做主题

一个主题就是一个带 `skin.json` 的文件夹，格式和 [claude-skins](https://github.com/JIA-ss/claude-skins/blob/main/README.zh-CN.md) 一样：

```json
{
  "name": { "en": "Aurora", "zh": "极光" },
  "order": 1,
  "hue": 168, "sat": 62,
  "line": "#5fe3c4",
  "background": "background.jpg",
  "peek": "peek.png",
  "badge": "badge.png",
  "fx": "snow", "fxColor": "#e6f7ff"
}
```

| 字段 | 含义 |
|---|---|
| `name` | 字符串，或 `{ "en", "zh" }` |
| `hue`、`sat` | 强调色（HSL 的色相 / 饱和度；明度沿用你 Codex 里设置的强调色） |
| `line` | 描边、顶部细线、气泡用的高亮色 |
| `background` | 宽幅背景图（21:9 效果好，比如 3840×1632）。**画面中间要暗、要空**，文字在那里。不写就用自动生成的渐变。 |
| `peek` | 吉祥物从边上探出头的透明 PNG（底边要平）。不写就没有吉祥物。 |
| `badge` | 侧栏横幅上的透明 PNG |
| `fx` | 粒子：`snow`、`petals`、`embers`、`rain`、`spores`，或者不写 |
| `font` | 可选的 `.woff2` / `.ttf`，用在横幅标题、气泡和连击计数上 |
| `lines` | 可选的台词：`{ "click": [...], "drag": [...], "send": [...], "dizzy": [...], "home": [...], "crit": [...], "tiers": [20/50/100/200 连击时的 4 句喊话] }`，也可以按语言分 `{ "zh": {...}, "en": {...} }` |
| `tag` | 侧栏横幅里主题名下面的小字（默认 `codex-skins`） |
| `default` | `true` 表示第一次启动时用这个主题 |
| `private` | `true` 表示录屏模式下隐藏它（比如用了内部或有版权素材、不该出现在录屏里的主题） |

两种加法：

- **不用重装：** 把文件夹放到副本的用户数据目录下的 `codex-skins/skins/<id>/`，然后重启 Codex：
  Windows 是 `%APPDATA%\Codex\web\CodexSkins\codex-skins\skins\`，macOS 是 `~/Library/Application Support/CodexSkins/codex-skins/skins/`。和内置主题同 id 的文件夹会替换内置的那个。
- **打包进去：** `node install.mjs --skins <装着若干主题文件夹的目录>`（可以写多次）。

`<id>` 就是文件夹名：小写字母、数字和 `-`。

**自己的图标：** `node install.mjs --icons <目录>` 会用目录里的 `chatgpt-app-dark.ico` / `chatgpt-app-light.ico` 替换副本的窗口图标（Codex 会按任务栏的深浅模式挑一个），并用 `shortcut.ico` 做开始菜单快捷方式的图标，方便和原版区分。

## 原理

安装器把 Codex 的 `resources/app.asar` 解开，加两样东西再打包回去（放在包外的原生文件会逐个核对，必须和原来完全一致）：

- `src/main.js` 在应用主入口的最前面加载。它只响应三种 IPC 调用：列出主题、读主题文件、写诊断文件，而且只接受 Codex 自己的界面（`app://-/`）发来的调用，内嵌网页不行。
- `src/deco.js` + `src/preload.js` 追加到主窗口的 preload 末尾。它们在页面后面画一张场景 canvas，把盖住它的大块不透明主区改成半透明，让场景透出来（卡片、代码块和输入框保留原来的底色）；再换强调色，加上吉祥物、横幅、毛玻璃和粒子。图片是从字节解码的，所以不用改页面的内容安全策略（CSP）。

强调色：Codex 有自己的主题引擎，用四个输入（强调色、文字色、底色、对比度）派生出一整套 CSS 变量。codex-skins 读出强调色（`--codex-base-accent`）和它暗一档的颜色（`--color-background-accent-action`，发送按钮用的），把所有值里含这两个颜色的变量都换成主题的色相和饱和度（保留明度），再重新混合用强调色调出来的底色。危险色、普通的橙色色板和强调色上的文字色都不动。

Codex 跑在 OpenAI 自己的、兼容 Electron 的运行时（owl）上。它的 Electron fuse 在 `chrome.dll` 里，不在 exe 里；安装器在那里关掉 `EnableEmbeddedAsarIntegrityValidation` 和 `OnlyLoadAppFromAsar`，改过的包才能加载。改动过的每个文件，原件都备份在旁边，文件名是 `*.codex-skins-orig`。

所有代码出错时都不吭声：如果 Codex 改了页面结构，最坏的情况是吉祥物或强调色不出来了，应用本身照常能用。

## 排查

- **什么都没变**：确认你启动的是副本（**Codex (skins)** 快捷方式），并且安装时副本没在运行。`node install.mjs status` 应该显示 `patched: yes`。
- **场景出来了，但强调色没变，或者吉祥物 / 横幅没出来**：多半是 Codex 改版了。看一下 `%APPDATA%\Codex\web\CodexSkins\codex-skins\probe.json`（`accents`、`hooks`、`seeThrough`），带上它开 issue。
- **快捷方式打开的是原版 Codex 的窗口**：副本的界面配置名必须和原版不同，检查副本 `resources\owl-app.ini` 里的 `UserDataDirectoryName`（用 `--profile <名字>` 设置）。
- **改完 Codex 启动不了**：先 `node install.mjs uninstall`，再带上你的 Codex 版本开 issue。

## 开发

```bash
npm test        # 单元测试 + 在模拟 Codex 主窗口上跑的 Electron 端到端测试
npm run e2e     # 只跑端到端测试；截图在 test/out/
npm run demo    # 重新录 docs/demo.mp4 + docs/demo.gif + docs/theme-*.jpg（需要 ffmpeg）
npm run e2e -- --skins <目录>   # 同时加载并测试你自己的主题文件夹
```

端到端测试在 Electron 里用真的 preload 加载 `test/e2e/app/page.html`。这是一个模拟页面，只复刻 codex-skins 依赖的那些结构：主题引擎的变量、透明窗口上的不透明主区、侧栏里每种模式各一组的导航、`[data-composer-body]`、标签栏。测试会模拟键盘和鼠标，逐项检查：每个主题、透出效果、强调色替换（以及危险色 / 普通橙色 / 强调色上的文字色没被动）、横幅位置、打字时的走动速度、回车起跳、连击、点击穿透、拖动和吸回、浓度、录屏模式、诊断文件。

`test/live.mjs` 对**真正装好的**应用跑同类检查：用 `--remote-debugging-port=9339` 启动副本，运行 `node test/live.mjs`，跑完再正常重启 Codex。

想接进自己的构建流程，`lib/patch.mjs` 导出了 `injectInto(解包后的asar目录, { skinDirs })`。

## 另见

- [claude-skins](https://github.com/JIA-ss/claude-skins)：同一套主题和吉祥物，给 Claude 桌面版用。主题文件夹两边通用，拷过去就能用。

## 致谢

代码：MIT 协议，见 [LICENSE](LICENSE)。内置主题的美术（背景和吉祥物）来自 claude-skins：用图像模型只靠文字提示生成，没用任何参考图，以 [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (see [skins/LICENSE.md](skins/LICENSE.md)) 协议发布。提示词在 [tools/gen_art.py](tools/gen_art.py) 里。

## 法律声明

> 本项目是非官方的社区项目，与 OpenAI 没有任何关联，也未获得其认可或赞助。仓库里没有 OpenAI 的代码或素材：安装器修改的是已经装在你电脑上的那份 Codex。「OpenAI」「ChatGPT」「Codex」是 OpenAI 的商标。使用风险自担。

---

<p align="center"><sub>由 <a href="https://github.com/JIA-ss">JIA-ss</a> 制作 · 代码 MIT · 主题美术 CC0</sub></p>
