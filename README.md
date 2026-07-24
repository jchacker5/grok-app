<p align="center">
  <img src="assets/logo.png" alt="Grok App" width="128" height="128" />
</p>

<h1 align="center">Grok App</h1>

<p align="center"><strong>Desktop workbench for local Grok Build</strong></p>
<p align="center"><em>Sessions, projects, media, voice, automations — for the real <code>grok</code> CLI</em></p>
<p align="center"><em>English-first open-source fork · upstream <a href="https://github.com/RongleCat/grok-app">RongleCat/grok-app</a></em></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README_ZH.md">中文</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/jchacker5/grok-app/stargazers"><img src="https://img.shields.io/github/stars/jchacker5/grok-app?style=social" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platforms" />
  <img src="https://img.shields.io/badge/Tauri-2-orange" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/note-unofficial-yellow" alt="Unofficial" />
</p>

<p align="center">
  <a href="https://x.com/joedefendre"><img src="https://img.shields.io/badge/X-%40joedefendre-black?logo=x&logoColor=white" alt="X @joedefendre" /></a>
</p>

<p align="center">
  <strong>Follow for more</strong><br/>
  <a href="https://x.com/joedefendre"><strong>X / Twitter → @joedefendre</strong></a>
</p>

<p align="center">
  Repo ·
  <a href="https://github.com/jchacker5/grok-app">jchacker5/grok-app</a>
</p>

---

> [!NOTE]
> ## Note
>
> **Grok App is not an official xAI product.** It wraps the local [Grok Build](https://x.ai) CLI (`grok agent stdio`) into a desktop workbench: sessions, projects, permissions, media previews, and scheduled tasks.
>
> Real agent power needs a working **Grok Build CLI** installed and signed in. Without CLI you can install from the first-run wizard, or use `GROK_APP_ACP=mock` for UI-only development.

---

## Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Screenshots](#screenshots)
4. [Install & first run](#install--first-run)
5. [macOS “damaged” / Gatekeeper](#macos-damaged--gatekeeper)
6. [Config paths](#config-paths)
7. [Develop & build](#develop--build)
8. [Docs & contributing](#docs--contributing)
9. [Contributors](#contributors)
10. [Follow the author](#follow-the-author)

---

## Overview

The `grok` CLI is powerful in a terminal. Day-to-day work still needs multi-project sessions, a permission bar, rich previews, voice, scheduled jobs, and a clear UI.

**Grok App** is that workbench (UI language defaults to **English**):

1. Install the app and prepare Grok Build CLI  
2. Add a project / new session  
3. Connect the agent; chat under Ask or YOLO  
4. Use **dictation** or **Live Voice** to talk and (optionally) delegate Build agent tasks  
5. Preview artifacts, schedule automations, manage account & relays in Settings  

**Stack:** Tauri 2 + Rust · React + TypeScript + Vite · Tailwind CSS

---

## Features

| Area | What you get |
|------|----------------|
| **Real Build sessions** | Default `grok agent stdio` (ACP); host-owned session FSM; optional remote ACP |
| **Projects & sessions** | Trusted dirs, virtualized sidebar, archive / orphan, fork & rewind; **import CLI sessions** in shared mode |
| **Multi-session stream** | Keep busy turns streaming after switching chats; process limits & idle recycle |
| **Git worktrees** | Project chip lists linked worktrees; switch cwd in one click (hidden for non-git) |
| **Permissions** | Default Ask; allow once / session / deny; YOLO; **per-project** permission tier |
| **Plan / Goal** | Sticky execution progress; resource-pane Markdown review + steps; Goal entry |
| **Slash · Extensions** | Slash palette, Skills; Settings → Extensions for MCP / Plugins |
| **Composer** | Follow-up send queue while busy; paste screenshots; context usage chip; **voice dictation** |
| **Live voice** | Full-duplex voice session (xAI realtime) with host tools to **delegate Grok Build agents** (mock mode: `GROK_APP_VOICE=mock`) |
| **Media & files** | Image / video / PDF / Office / code preview; **edit & save** text in Resources; Changes (session diffs + workspace git) |
| **Agent runtime** | Stall cancel; structured error deck; **diagnostic zip** export; no early “ready” while tools/permissions open |
| **Automations** | Scheduled list; natural-language create-from-chat (silent fence, no JSON in UI) |
| **Account & quota** | Multi-account switcher, official login, SuperGrok quota + heatmap, custom-provider local usage |
| **Custom relays** | Independent `GROK_HOME` agent profile (keeps `~/.grok` clean when desired) |
| **Security** | Optional OS keychain for API keys (default `secrets.json` 0600); store write locks; in-app confirms only |
| **i18n** | **English default**; optional Simplified Chinese / Traditional Chinese + tray |
| **Packaging** | macOS ARM / Intel · Windows x64 (setup + portable) · Linux x64 (AppImage / deb / rpm) |

---

## Screenshots

> From the current macOS development build.

| Workbench · SuperGrok | Account & quota |
|:---:|:---:|
| ![Workbench](assets/screenshots/workbench.png) | ![Account](assets/screenshots/account.png) |

| Light theme | Session & media |
|:---:|:---:|
| ![Light](assets/screenshots/light.png) | ![Chat](assets/screenshots/chat.png) |

---

## Install & first run

### 1. Download

Get installers from [Releases](https://github.com/jchacker5/grok-app/releases):

| Platform | Artifact |
|----------|----------|
| macOS Apple Silicon | `Grok_*_aarch64.dmg` |
| macOS Intel | `Grok_*_x64.dmg` |
| Windows x64 | `*-setup.exe` installer + `*-portable.zip` |
| Linux x64 | AppImage / `.deb` / `.rpm` |

The bundle product name is **Grok** (matches the window title).

**Arch / Manjaro / EndeavourOS:** prefer the **AppImage** (`chmod +x` then run). Official CI does not publish a separate AUR package; AppImage is distro-agnostic.

### 2. First run

1. Launch → **Setup wizard** ensures CLI is installed (multi-mirror install supported)  
2. (Optional) Official login / API key / custom relay — skippable  
3. **Add project** → trust a folder  
4. **Connect agent** → chat when Ready  
5. Permission bar defaults to **Ask**; use YOLO only when you want unattended runs  

### 3. Requirements

- Local **Grok Build CLI** (`grok`), often `~/.grok/bin/grok` or on `PATH`  
- Windows: `%USERPROFILE%\.grok\bin\grok.exe` or `PATH`  

---

## macOS “damaged” / Gatekeeper

Release builds are **not Apple-notarized** (paid Developer ID required). Gatekeeper may block downloads — that is expected.

**Recommended:**

```bash
xattr -cr /Applications/Grok.app
open /Applications/Grok.app
```

**Also works:**

- Finder: **right-click** → **Open** → confirm  
- **System Settings → Privacy & Security** → **Open Anyway**  

Only download from this repo’s official [Releases](https://github.com/jchacker5/grok-app/releases).

---

## Config paths

Default data root (override with **`GROK_APP_HOME`**):

| Platform | Typical path |
|----------|----------------|
| macOS | `~/Library/Application Support/com.grokapp.grok-app/` |
| Windows | `%APPDATA%\grokapp\grok-app\` |
| Fallback | `~/.grok-app/` |

```text
<app-data>/
  projects.json
  sessions_index.json
  settings.json
  secrets.json          # metadata (+ API-key fallback); keys prefer OS keychain
  automations.json
  projects/
  sessions/
  logs/
  agent-home/           # independent-mode GROK_HOME
```

API keys prefer the OS secret store (macOS Keychain / Windows Credential Manager /
Linux Secret Service) with a `secrets.json` (mode `0600`) fallback when the OS store
is unavailable. Do not commit secrets.

Grok Build’s own config remains under **`~/.grok`** (CLI login, `auth.json`, …).  
**shared** session mode can use `~/.grok`; **independent** mode uses `agent-home/`.

---

## Develop & build

```bash
# Needs: Node 22+, pnpm 9, Rust stable, Xcode CLT (macOS)
pnpm install

pnpm install --ignore-scripts   # if needed
pnpm dev                        # full app (real CLI by default)
pnpm dev:ui                     # frontend only
GROK_APP_ACP=mock pnpm dev      # UI without real agent
GROK_APP_VOICE=mock pnpm dev    # voice UI without xAI voice API

pnpm typecheck && pnpm test
cd src-tauri && cargo test

pnpm build
```

Cross-compile and release notes: [docs/BUILD.md](./docs/BUILD.md).

Release (write the matching `CHANGELOG.md` section first):

```bash
./scripts/release-tag.sh 0.1.1
./scripts/release-tag.sh 0.1.1 --push
```

---

## Docs & contributing

| Audience | Link |
|----------|------|
| AI agents / product rules | [`docs/llm-wiki/`](./docs/llm-wiki/) |
| Build & release | [docs/BUILD.md](./docs/BUILD.md) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) |
| Contributing | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Code of conduct | [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) |
| Security | [SECURITY.md](./SECURITY.md) |

Issues and PRs are welcome.

## Contributors

Thanks to everyone who has contributed to Grok App. Data from the GitHub Contributors API (fetched 2026-07-24).

<p align="center">
  <a href="https://github.com/RongleCat"><img src="https://github.com/RongleCat.png?size=80" width="80" height="80" alt="RongleCat" /></a>
  &nbsp;&nbsp;
  <a href="https://github.com/sonnemusk"><img src="https://github.com/sonnemusk.png?size=80" width="80" height="80" alt="sonnemusk" /></a>
  &nbsp;&nbsp;
  <a href="https://github.com/Sdefendre"><img src="https://github.com/Sdefendre.png?size=80" width="80" height="80" alt="Sdefendre" /></a>
  &nbsp;&nbsp;
  <a href="https://github.com/jason920612"><img src="https://github.com/jason920612.png?size=80" width="80" height="80" alt="jason920612" /></a>
  &nbsp;&nbsp;
  <a href="https://github.com/shiaho777"><img src="https://github.com/shiaho777.png?size=80" width="80" height="80" alt="shiaho777" /></a>
  &nbsp;&nbsp;
  <a href="https://github.com/2530185073"><img src="https://github.com/2530185073.png?size=80" width="80" height="80" alt="2530185073" /></a>
  &nbsp;&nbsp;
  <a href="https://github.com/tisrop"><img src="https://github.com/tisrop.png?size=80" width="80" height="80" alt="tisrop" /></a>
</p>

| | Contributor | Commits | Highlights (selected) |
|:---:|:---|:---:|:---|
| <img src="https://github.com/RongleCat.png?size=48" width="48" height="48" alt="RongleCat" /> | [**RongleCat**](https://github.com/RongleCat) · maintainer | 59 | Product architecture, releases, community integration |
| <img src="https://github.com/sonnemusk.png?size=48" width="48" height="48" alt="sonnemusk" /> | [**sonnemusk**](https://github.com/sonnemusk) | 21 | Changes / fork & rewind, MCP·Plugins, permission tiers, worktrees, resource edit, paste screenshots, error deck, multi-session stream, CLI session import, turn-complete, store locks, and more |
| <img src="https://github.com/Sdefendre.png?size=48" width="48" height="48" alt="Sdefendre" /> | [**Sdefendre**](https://github.com/Sdefendre)<br/>Steve Defendre | 2 | Session titles follow locale; Grok Build permission optionIds |
| <img src="https://github.com/jason920612.png?size=48" width="48" height="48" alt="jason920612" /> | [**jason920612**](https://github.com/jason920612) | 2 | Remote ACP (API mode); Traditional Chinese locale |
| <img src="https://github.com/shiaho777.png?size=48" width="48" height="48" alt="shiaho777" /> | [**shiaho777**](https://github.com/shiaho777)<br/>shiaho | 2 | Cancelable login; stop re-streaming history on session switch |
| <img src="https://github.com/2530185073.png?size=48" width="48" height="48" alt="2530185073" /> | [**2530185073**](https://github.com/2530185073)<br/>Yun | 1 | Custom provider account + local usage UI |
| <img src="https://github.com/tisrop.png?size=48" width="48" height="48" alt="tisrop" /> | [**tisrop**](https://github.com/tisrop)<br/>wanghang | — | Composer follow-up send queue while agent is busy |

[Full contributors graph →](https://github.com/jchacker5/grok-app/graphs/contributors)

[![Contributors](https://contrib.rocks/image?repo=RongleCat/grok-app)](https://github.com/jchacker5/grok-app/graphs/contributors)

## License

[MIT](./LICENSE) — upstream © RongleCat; this fork maintained by [jchacker5](https://github.com/jchacker5)

---

## Follow for more

| Channel | Link |
|---------|------|
| **X / Twitter** | [**@joedefendre**](https://x.com/joedefendre) |
| **GitHub** | [jchacker5/grok-app](https://github.com/jchacker5/grok-app) |

Upstream project and original Chinese community content: [RongleCat/grok-app](https://github.com/RongleCat/grok-app).

<p align="center">
  If Grok App helps you, please star the repo and follow
  <a href="https://x.com/joedefendre">@joedefendre</a> on X for more.
</p>
