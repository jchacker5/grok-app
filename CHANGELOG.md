# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Maintainer rule (AI):** before every `vX.Y.Z` tag, complete `## [X.Y.Z]` below.  
CI Release body = this section only (via `scripts/changelog-for-release.py`; no repeated download/install boilerplate).  
See `docs/llm-wiki/release.md`.

## [Unreleased]

## [0.1.14] - 2026-07-26

### Added

- **Notification Preferences & Quiet Hours**: Per-channel desktop notification toggles, sound chimes, in-app badges, Do Not Disturb quiet hours scheduler, and event completion/error triggers.
- **Plugin Dependency Topology Graph**: Visual SVG node graph for installed plugin dependencies with relation arrows, status indicators, and topology view.
- **Agent Memory & State Inspector**: Read-only inspector panel for agent long-term memories (`memory.json`) with category filtering, search, confidence star ratings, and memory clearing.
- **GitHub Integration & Issue Creator**: Fetch GitHub issue, PR, and commit context via URL parser; create GitHub issues directly from session transcripts.
- **Multi-Machine Storage Sync**: Configurable shared storage directory manager for syncing sessions, settings, presets, prompts, and commands across devices (iCloud / Dropbox / OneDrive).
- **Goal Mode & Autonomous Plan Tracker**: Interactive goal indicator, subgoal step checklist, and Goal Panel.
- **Call Log History Panel**: Token usage, cost, and duration metrics history table in Account panel.
- **Enhanced Transcript Exporter**: Export chat sessions as clean Markdown (`.md`) or JSON (`.json`) files.
- **Streaming CLI Install Progress**: Real-time terminal log output modal during provider CLI installations.
- **Grouped Snippet Search**: Search code snippets across all chat sessions, grouped by project with term highlighting.
- **Session Presets Manager**: Save model, effort, yolo, and system prompt configurations with Quick Preset selector in composer toolbar and Settings.
- **Workspace Diff & Selective Staging Panel**: Visual Git diff viewer (unified & side-by-side) with file/hunk staging and commit panel.
- **Community & Custom Prompt Library**: Library of built-in system prompts (Code Review, Refactor, Unit Tests, Copywriting, Analysis) and custom prompt manager.
- **Custom Slash Commands Manager**: Define custom slash commands (`/name`) for text template insertion and shell script execution with test runner.
- **Embedded Browser Preview**: Embedded browser panel with navigation controls, reload, and domain cookie extractor.
- **Per-Project AGENTS.md Rules Editor**: In-app rules editor for `AGENTS.md`, `CLAUDE.md`, and `.grok/AGENTS.md` with starter templates and ⌘S save.
- **Export Chat as PNG Image**: Carbon-style styled PNG image generator with message selection, themes (Dark, Light, Sepia), and metadata toggle.
- **Session Diff & Branch Comparison**: Compare two chat sessions side-by-side or unified to view prompt and response diffs.
- **Session Analytics & Token Usage Dashboard**: Token usage dashboard with overview statistics, model distribution breakdown, and per-session analytics.
- **Multi-Model Parallel Comparison**: Side-by-side card grid for comparing responses from multiple AI models simultaneously.

## [0.1.13] - 2026-07-26

### Added

- **Embedded Terminal Panel (Phase 2)**: "Open Terminal Here" on a project's right-click menu (opens a terminal tab with that project's path as `cwd`); Settings → General gains a "Max concurrent terminals" field next to "Max concurrent agents".

### Fixed

- **Terminal concurrency limit not live**: `max_concurrent_terminals` was cached once at app startup, so changing it in Settings had no effect until restart. Now read fresh from settings on every terminal spawn, matching how agent-process concurrency already works.

## [0.1.12] - 2026-07-26

### Added

- **Embedded Terminal Panel** (Phase 1): Open a real PTY-backed shell in the resource pane ("New Terminal" toolbar button), keep it alive with bounded scrollback while switching tabs, resize it with the pane, and terminate it when its tab closes. Shell resolution: `$SHELL` (macOS/Linux, zsh/bash fallback) or PowerShell (Windows). Concurrency capped like agent processes (`max_concurrent_terminals`, default 4). Embedded terminals have full shell access with the same trust level as opening a system terminal — opt-in only, no ACP tool can trigger one.

## [0.1.11] - 2026-07-25

### Added

- **CLI-native slash commands in composer palette**: the app now fetches built-in slash commands bundled with the Grok Build CLI via `grok inspect --json` (future `commands` field) and `~/.grok/commands.json` manifest. CLI commands appear under a "CLI" section in the `/` palette, showing their `/name` and description; selecting one inserts the command text into the composer. Forward-compatible — empty list when no CLI commands are yet exposed. (`cli_builtin_commands` Rust command + `CommandsListResult` API + `cliCommandsToSlashItems` catalog)
- **Goal Mode & Autonomous Plan Tracker**: Interactive goal indicator, subgoal step checklist, and Goal Panel.
- **Call Log History Panel**: Token usage, cost, and duration metrics history table in Account panel.
- **Enhanced Transcript Exporter**: Export chat sessions as clean Markdown (`.md`) or JSON (`.json`) files.
- **Streaming CLI Install Progress**: Real-time terminal log output modal during provider CLI installations.
- **Grouped Snippet Search**: Search code snippets across all chat sessions, grouped by project with term highlighting.
- **Session Presets Manager**: Save model, effort, yolo, and system prompt configurations with Quick Preset selector in composer toolbar and Settings.
- **Workspace Diff & Selective Staging Panel**: Visual Git diff viewer (unified & side-by-side) with file/hunk staging and commit panel.
- **Community & Custom Prompt Library**: Library of built-in system prompts (Code Review, Refactor, Unit Tests, Copywriting, Analysis) and custom prompt manager.
- **Custom Slash Commands Manager**: Define custom slash commands (`/name`) for text template insertion and shell script execution with test runner.
- **Embedded Browser Preview**: native-webview browser panel (avoids the X-Frame-Options blank-page problem plain iframes hit on GitHub etc.) with an editable address bar, back/forward history, reload, zoom, devtools toggle, element picker (sends a selector + outerHTML snippet to the composer as an attachment), screenshot capture, and screen recording (start/stop/save).
- **Agent Memory Viewer**: browse and clear the agent's persisted memory entries (Settings panel).
- **GitHub integration section**: per-session GitHub status/actions surfaced in Settings.
- **Notification settings**: configure desktop notification behavior in Settings.
- **Plugin dependency graph**: visualize MCP/skill plugin dependencies in Settings → Extensions.
- **Sync settings section**: view sync method/path status in Settings.
- **Per-Project AGENTS.md Rules Editor**: In-app rules editor for `AGENTS.md`, `CLAUDE.md`, and `.grok/AGENTS.md` with starter templates and ⌘S save.
- **Export Chat as PNG Image**: Carbon-style styled PNG image generator with message selection, themes (Dark, Light, Sepia), and metadata toggle.
- **Session Diff & Branch Comparison**: Compare two chat sessions side-by-side or unified to view prompt and response diffs.
- **Session Analytics & Token Usage Dashboard**: Token usage dashboard with overview statistics, model distribution breakdown, and per-session analytics.
- **Multi-Model Parallel Comparison**: Side-by-side card grid for comparing responses from multiple AI models simultaneously.

### Fixed

- **Embedded Browser regression**: a prior commit replaced the native-webview browser panel with a plain sandboxed iframe (blank-pages on GitHub etc.) and a fake cookie-extractor button that wrote a placeholder string instead of a real cookie. Restored the native-webview version and dropped the non-functional cookie button.
- **Build break**: three call sites used `dirs::home_dir()` without `dirs` being a declared dependency; switched to the existing `process_util::user_home()` helper.

## [0.1.10] - 2026-07-25

### Added

- **Native OS push notifications** via `tauri-plugin-notification` (turn complete, permission requests, etc. now surface as real system notifications, not just in-app toasts).
- **Live Preview Panel v2**: zoom + devtools toggle, in-app element picker, screenshot capture, and screen recording (start/stop/save) for the embedded browser preview.
- **Plugin marketplace catalog browser** in Settings → Extensions (browse and install known MCP/skill plugins, not just manage already-installed ones).
- **Inline diff review comments**: leave comments directly on lines in the Changes panel's diff view.
- **SSH tunnel manager + WSL distro picker**: manage SSH port-forward tunnels and pick a WSL distro as the agent's working environment (Windows).
- **Git commit & PR workflow**: stage files, get an AI-drafted commit message, push, and open a PR — all from the app (`git_stage_paths` / `git_commit` / `git_push` commands + UI).
- **Fold large diffs & code blocks by default**: git diffs (>14 lines) and any code block (>40 lines) in chat now collapse to a summary row showing the language and `+adds −dels` (diffs) or line count; click to expand. Keeps big patches from blowing out the thread. (`CodeBlock.tsx`)
- **Copy branch name**: session right-click menu gains a "Copy branch name" item when the chat is on a git branch. (`App.tsx`)
- **Automatic PR status**: the active session's branch and pull-request state are now detected via `git` + the GitHub CLI (`gh`) and persisted, so the sidebar PR badge (open / merged / closed) populates on its own instead of requiring manual entry. Soft-fails silently when `git`/`gh` are unavailable. (`session_branch_pr` command)
- **Shared `grok.json` project config**: a checked-in `grok.json` (or `.grok/config.json`) at a project root can set `defaultModel`, `effort`, `permissionPolicy`, and `sandbox`. Values are validated against the live catalog and applied to the composer once when the project becomes active. (`project_config_read` command)
- **Windows update warning**: on Windows, the update banner now shows a SmartScreen heads-up and a "Proceed" confirm before downloading and running the update.

### Fixed

## [0.1.9] - 2026-07-25

### Added

- **Voice audio quality**: mic capture now prefers an `AudioWorklet` processor (falls back to `ScriptProcessor`), with noise-gate sensitivity, peak normalization, and playback rate control.
- **Voice settings expansion**: Settings → Voice gains mic device picker, noise suppression toggle, sensitivity slider, dictation language (auto or manual), and an end-of-turn feedback chime toggle.
- **Dictation keyboard shortcut**: `⌘⇧D` / `Ctrl+Shift+D` toggles dictation from the composer.
- **Live mic meter**: waveform bars animate with real-time RMS audio level during dictation.
- **Punctuation voice commands**: spoken "period", "comma", "new line", "question mark", etc. insert proper punctuation via transcript post-processing.
- **Playback rate control**: voice AI output speed slider (0.5x–2.0x) persists across sessions.

### Fixed

- **Sensitivity scale mismatch**: Settings → Voice sensitivity slider now correctly converts 0–100 UI to 0–1 internal range (the noise gate was always off after touching the slider).
- **Bulk delete N dialogs**: bulk delete now shows one confirm dialog for all selected sessions instead of one per session.
- **Bulk archive race**: bulk archive now batch-archives via `Promise.all` instead of per-session confirm/path logic.
- **AudioContext leak**: dictation PCM capture `AudioContext` is now properly closed when dictation ends.

## [0.1.8] - 2026-07-25

### Added

- **Settings expansion**: 16 new settings in Settings → General:
  - Timestamp format (system default / 12-hour / 24-hour)
  - Sidebar sort order (last updated / date created / manual drag)
  - Sidebar message preview line count (1–15 slider)
  - Word wrap for code blocks, diffs, and file previews
  - Diff whitespace toggle (ignore whitespace-only changes)
  - Confirm before delete / archive dialogs
  - Glass surface opacity slider (40–100%)
  - Auto-archive idle threads after N days (1–90)
  - Auto-open task panel when tool steps appear
  - Add project base directory picker
  - Provider update checks on startup
  - Per-provider binary path & config directory override
  - Per-provider custom model IDs
  - Restore all defaults button
  - Keyboard shortcuts viewer with user overrides
- **Keyboard shortcuts refactor**: `shortcuts.ts` → `keybindings.ts` with `getUserOverrides()` / `setUserOverrides()` stored in `localStorage`; backward-compatible re-exports.
- **Chat input morphing button**: trailing button transitions between mic (empty), send arrow (has text), and stop (generating / dictating) — matching Grok.com's pill-composer pattern.
- **Dictation waveform visualization**: 4 animated equalizer bars appear inline in the composer during dictation, placeholder text changes to "Listening…".
- **Pulse ring on dictation button**: animated blue ring radiates from the trailing button while recording.
- **Grok.com blue orb**: live voice orb updated from purple/teal to Grok's signature `#3794ff` blue palette.
- **Voice overlay refinement**: compact panel, centered orb, user/assistant line backgrounds, softer end button.

### Changed

- **Composer shape**: border-radius increased from 18px → **24px** (more pill-like); padding widened.
- **Providers panel**: model field changed from single-line input to textarea supporting multiple model IDs (comma-separated); field label updated to "Model IDs".
- **Voice orb colors**: `connecting` / `listening` / `speaking` states shifted to `#3794ff` blue tones.
- **Voice overlay**: redesigned panel (400px, rounded 20px, centered orb, transcript line backgrounds, subtler end button).

### Fixed

- **Build break**: new `SessionMeta` fields (`branch`/`prRef`/`prState`/`settledAt`/`snoozedUntil`) left the `store.rs` test fixture non-exhaustive; fixed.
- **Flaky test suite**: `store.rs` and `support_bundle.rs` tests each mutated the process-global `GROK_APP_HOME` env var behind their own private lock, so they raced each other under parallel `cargo test`. Consolidated into one shared lock.
- **i18n gap**: sidebar multi-select bulk-action bar ("selected" / Settle / Archive / Delete / Cancel) had hardcoded English strings bypassing the locale system.

## [0.1.7] - 2026-07-24

### Added

- **App update check** (#58): Settings → about / update checks GitHub Releases for newer installers.
- **Active agent tasks panel** (#59): right pane shows live tool tasks from the current stream.
- **Session content search** (#60): command palette / search matches journal message text, not only titles.
- **Plugin install & update** (#61): Settings → Extensions can install and update plugins (not only enable/disable).
- **Sandbox profile** (#66): Settings → Runtime sandbox (`off` / `workspace` / `read-only` / `strict` / `devbox`) at agent spawn.
- **Pin sessions** (#73): pin chats to the top of the sidebar (like projects).
- **Project inspect** (#75): Settings → Runtime summary from `grok inspect --json` (secret-safe).
- **CLI doctor in App Doctor** (#76): merge `grok doctor --json` findings into the Doctor modal.
- **Grok Spaces**: group projects into named workspaces (Work / Indie / Business / …). Switch instantly with `⌘⌥1`–`⌘⌥9` (while the app is focused), or right-click a project → "Add to space." Manage spaces from the new chip row above Projects.
- **Live voice orb**: the live-voice overlay now shows an animated, audio-reactive glowing orb (idle / listening / speaking states) instead of static waveform bars.
- **Voice settings**: Settings → Voice lets you pick the realtime voice (fetched live from the xAI voice catalog) and toggle auto-send-on-silence / keep-agents-running-after-voice-ends.

### Fixed

- **Session data mode switch** (#62): flipping independent↔shared recycles live/background/parked agents so none keep the old `GROK_HOME`.
- **Missing project folder** (#65): pathOk UX to relocate deleted/moved project directories.
- **Composer icon spacing**: the mic / live-voice / send button cluster at the end of the composer row was visually crowded; increased row gap so icon-only buttons read as distinct actions.
- **Duplicate mic icon**: the live-voice "Start voice" button used the same glyph as the dictation mic; now uses a distinct headset icon.
- **Settings deep link**: `#/settings/voice` (and any future new section) now actually opens that section instead of silently falling back to General.
- **Browser/dev-preview mode**: Spaces now loads via its localStorage fallback outside Tauri, and the live-voice overlay no longer throws when Tauri's event bridge isn't present (falls back to the mock voice session cleanly).

### Community

- Squash-merged **#58–#62**, **#65–#66**, **#73**, **#75–#76** (sonnemusk).  
- Remaining open PRs (**#63–#64**, **#67–#72**, **#74**, **#77–#89**) need conflict resolution against this batch (heavy overlap on `App.tsx` / `Settings` / `commands.rs` / spawn flags).

**中文**
- 新增：应用更新检查、活动任务面板、会话正文搜索、插件安装更新、沙箱配置、会话置顶、项目 inspect、CLI Doctor 合并、Grok 空间（项目分组 + ⌘⌥1-9 切换）、语音圆球动效、语音设置页。  
- 修复：会话模式切换回收 Agent；缺失项目目录可重定位；工具栏图标间距过窄；语音图标重复；设置深链接缺少 voice 分区；浏览器预览模式下的空间加载与语音浮层报错。

## [0.1.6] - 2026-07-24

> **Highlight:** early-turn fix (#52), multi-session stream, shared-mode CLI import, store write locks.

### Added

- **Import CLI sessions (shared mode)** (#57): Settings → General lists `~/.grok/sessions`; import one / all into App journals.
- **Session diagnostic export**: session menu → redacted zip (messages, runtime, CLI probe, logs, agent trail) for bug reports (#52).
- **Multi-session background stream** (#56): switching chats keeps busy turns streaming under the process cap.
- **A11y** (#53): conversation live region; permission / modal focus trap + Escape; ask_user `aria-pressed`.

### Fixed

- **Premature turn end** (#54 / #52): defer `prompt_complete` while tools, permission, plan, or ask_user are still open.
- **Orphan chat cwd**: no-project agents use `$HOME` instead of Dock `cwd=/` (#52).
- **Empty-run soft signal**: toast when a non-ask turn ends with zero tool calls (#52).
- **Store JSON write lock** (#55): exclusive lock + atomic rename; quarantine corrupt store files.
- **Git worktrees UI**: hide section for non-git folders; stop loading flicker; compact single-line rows.

### Community

- PRs **#53–#57** (sonnemusk). Closed #42 (worktrees), #52 (early end_turn).

**中文**
- 新增：CLI 会话导入（shared）、诊断包、后台多会话流式、无障碍。  
- 修复：工具/权限未完不提前就绪；无项目 cwd=`$HOME`；store 写锁；worktree 非 git 隐藏与紧凑行。

## [0.1.5] - 2026-07-24

> 中英文对照 / Bilingual notes.
>
> **Highlight:** Git worktree switch, per-project permission tiers, resource-pane text edit, clipboard image paste, structured error deck.

### Added

- **Git worktree switch** (#46): project chip lists `git worktree` siblings and rebinds session cwd (reuse / add project, trust inherited when possible).
- **Per-project permission default** (#47): trusted projects pin Ask / Accept edits / session / Deny / Full access; untrusted always forces Ask; cascade session → project → app.
- **Resource pane text edit** (#50): edit/save text·code·markdown with dirty state, ⌘/Ctrl+S, mtime conflict (reload vs overwrite), discard on close.
- **Structured error deck** (#51): CLI / auth / network / crash (+ quota, connect, process limit, timeout) cards with problem · cause · primary · secondary actions (Doctor / Account / Providers / Reconnect).

### Fixed

- **Composer image paste** (#48): WebView screenshot paste via event Files → Clipboard API → native OS clipboard (arboard → attachments/paste PNG); attach toast + clear errors.

### Community

- Integrated community PRs **#46–#48**, **#50–#51** (sonnemusk).
- README features + contributors list refreshed for shipped community work.

**中文 · 新增**
- Git worktree 从项目 chip 切换；可信项目默认权限阶梯；资源面板文本就地编辑保存；结构化错误卡（问题/原因/主次操作）。

**中文 · 修复**
- 粘贴截图/剪贴板图片可正确挂附件（含 macOS 系统剪贴板回退）。

**中文 · 文档**
- README 功能表与贡献者名单同步已合并社区能力。

## [0.1.4] - 2026-07-24

> 中英文对照 / Bilingual notes.
>
> **Highlight:** Plan review in the resource pane, top-only progress bar, opt-in keychain, custom-provider account usage.

### Security

- **Keychain opt-in on cold start** (#44): default keeps API keys in `secrets.json` (0600); OS keychain is Settings → General opt-in so app launch no longer prompts for Keychain unlock. Existing installs that already used keychain keep that mode.

### Added

- **Plan resource review** (#45): full plan Markdown + steps in the right **Resources → Plan** workbench; top sticky bar shows execution progress only (`n/m`, current step, meter); 「在资源中打开」/ review-gate auto-open; expand steps on demand; no plan card in the chat transcript.
- **Sticky Plan/Goal status bar** (L04, #41): progress + review actions above the chat stage.

### Fixed

- **macOS titlebar**: traffic-light safe inset so the sidebar panel toggle no longer underlaps red/yellow/green.
- **Composer placeholder**: hide overlay as soon as the DOM has typed/IME glyphs.
- **Chat scroll flicker**: ignore sub-4px content height noise while stick-to-bottom follows.
- **Custom provider account UI** (#43): sidebar shows active custom provider name/model and local usage instead of official OAuth identity when a custom route is active; hide official quota/login actions for that route.
- **Plan dismiss**: soft-hide top progress bar during execution without wiping plan state; review-gate dismiss still abandons the RPC.
- **Dead copy**: remove obsolete `composer.attachLater`.

### Community

- Integrated **#41**, **#43–#45** (plan UX, keychain startup, custom provider usage).

**中文 · 安全**
- 钥匙串改为设置里可选；默认仍用 `secrets.json`，避免冷启动弹系统密码框。

**中文 · 新增**
- 计划：顶部只显示执行进度；完整正文在资源面板 Markdown 审阅（批准/请求修改）；步骤按需展开。
- Plan/Goal 状态条（L04）。

**中文 · 修复**
- mac 交通灯与侧栏按钮重叠；输入框 placeholder 遮字；长对话滚动闪动；自定义中转时账户区与本地用量展示。

## [0.1.3] - 2026-07-24

> 中英文对照 / Bilingual notes.
>
> **Highlight:** OS keychain secrets, stream-stall cancel, MCP/Plugins enable, composer send queue, session switch fix.

### Security

- **API keys in OS keychain** (C07): `officialApiKey` / `relayApiKey` prefer macOS Keychain, Windows Credential Manager, or Linux Secret Service via `keyring`, with `secrets.json` (0600) fallback and one-time plaintext migration — community PR #34.

### Added

- **Composer follow-up send queue**: while the agent is busy, queue messages for the current session; auto-flush after the turn if you stay on that chat — community PR #40.
- **Stream stall cancel (I06)**: host watchdog emits `session://stream_stall` after pure silence (default 120s, Settings → Runtime); banner with Cancel turn / Keep waiting; tool events count as progress — community PR #37.
- **Journal write throttle (I04)**: mid-stream assistant journal flushes ≥500ms or on paragraph / turn end / stop / disconnect — community PR #37.
- **Changes panel — Workspace git status**: Session (agent tool edits) + Workspace (`git status`) sections; click for unified diff; refresh / open in editor / reveal / copy path — community PR #36.
- **Sidebar session list virtualization** (F07): windowed rendering for large project/orphan session groups (100+ rows); short lists unchanged — community PR #32.
- **Plugins manager** (L03): Settings → Extensions list / enable / disable / details / uninstall via `grok plugin` — community PR #39.
- **MCP enable + inject** (L03): Settings → Extensions toggles; enabled servers inject into ACP `session/new|load` and agent-home config — community PR #38.
- **ACP golden fixtures** (T06): offline protocol regression suite for wire shapes / mock stream / permissions — community PR #33.

### Fixed

- **Session switch re-stream**: switching historical sessions no longer re-types the whole assistant transcript as a live stream (Host FSM gate + frontend defense) — community PR #35.
- **Windows portable zip**: CI package finds product `Grok.exe` correctly.

### Community

- Integrated community PRs **#32–#40** (sonnemusk, shiaho777, tisrop).

**中文 · 安全**
- API 密钥优先写入系统钥匙串（Keychain / Credential Manager / Secret Service），失败时回退 `secrets.json`（0600），并支持一次性明文迁移。

**中文 · 新增**
- 忙时后续消息队列（当前会话自动发送）；流式卡顿取消提示 + 日志落盘节流；Changes 工作区 git 状态；侧栏会话虚拟列表；扩展页 Plugins 管理与 MCP 启用注入；ACP 协议 golden 回归。

**中文 · 修复**
- 切换历史会话不再整段重播流式回复；Windows 绿色版打包路径修正。

## [0.1.2] - 2026-07-24

> 中英文对照 / Bilingual notes.
>
> **Highlight:** session Changes/diff, fork & rewind, agent process limits, ask-user questionnaire.

### Added

- **Session Changes panel** (resource pane Files | Changes): track agent write/edit tools, unified diff from tool snippets or optional `git_file_diff` — community PR #28.
- **Session fork & rewind timeline**: fork full/partial history; rewind to a user prompt (local journal + best-effort agent) — community PR #29.
- **Agent process limits**: max concurrent warm agents (default 3) + idle recycle minutes (default 30); Settings → Runtime; `PROCESS_LIMIT` toast — community PR #30.
- **Ask user questionnaire**: in-app UI for `_x.ai/ask_user_question` (single/multi/free-text) instead of always cancelling — community PR #31.

### Community

- Integrated and closed community PRs **#28–#31**.

**中文 · 新增**
- 会话 Changes/diff 面板；会话分叉与回退时间线；并发 Agent 上限与闲置回收；Agent 问卷（ask_user）应用内作答。

## [0.1.1] - 2026-07-24

> 中英文对照 / Bilingual notes.
>
> **Highlight:** multi-account, Doctor support tools, context usage chip, Extensions (Skills/MCP), OAuth browser open, Windows 绿色版 + Linux deb/rpm.

### Added

- **Multi-account manager** (Settings → Account): compact hero, modal switcher, **Add account** = save current then OAuth; import/export account snapshots.
- **Doctor**: redacted support zip export; safe app-data reset (double in-app confirm; optional keep keys/accounts).
- **CLI install hardening**: HTTPS allowlist, streaming SHA-256, fail on published checksum mismatch.
- **Workbench UX**: session Markdown export; palette search by project path; connection status pill; keyboard shortcuts panel; optional desktop notifications for permission waits / finished turns.
- **Context usage chip** (composer): known tokens after compact, honest `~` estimate from visible chat, Compact… menu — community PR #25.
- **Settings → Extensions**: Skills + MCP inspect lists, project-scoped refresh, reveal paths, `/mcp` → Manage in Settings — community PR #27.
- **ACP connection test**: TCP + initialize probe and server setup one-liner in Runtime settings — community PR #23.
- Composer **file picker** (+ menu → Files / Folder) and **clipboard paste** for images/files.
- Open-source **maintenance playbook** (`docs/llm-wiki/maintain.md`).
- **Single-instance** plugin: second launch focuses the existing window.
- Thinking/reasoning **auto-collapse when done** (default); remembers expand/collapse choice.
- Error codes **QUOTA_EXCEEDED** / **CONNECT_FAILED** with clearer user-facing copy.
- **Import conversation** from markdown/JSON into a local session.
- **Linux x64** packages: AppImage + **.deb** + **.rpm** in release CI.
- **Windows x64 绿色版**: `Grok_*_x64-portable.zip` (unzip and run) alongside NSIS setup.
- **Traditional Chinese (zh-TW)** UI locale — community PR #18.
- **ACP API mode**: optional TCP remote ACP server (`host:port`) — community PR #20.

### Fixed

- **OAuth / device login**: open the authorize URL as soon as the CLI prints it (stream stdout); previously stuck on “Working…” with no browser — community PR #26.
- **Settings i18n**: Settings page uses full `createT` catalog (no raw keys / partial labels whitelist).
- **Settings → Session data mode** and **Add project trust**: replace `window.confirm` with in-app dialogs (Fixes #19).
- **Plan card**: keep `exit_plan_mode` `rpcId` so Approve / Request changes stay clickable (Fixes #17).
- **Plan mode**: handle `_x.ai/exit_plan_mode` + wire Plan card buttons.
- **Thinking UI**: multi-phase reasoning blocks; thought chunks bind to current assistant message.
- **Session ↔ project rebind** via composer project chip menu.
- Shell permission fallbacks use **underscore** optionIds — community PR #2.
- Session auto-title prompt follows **app locale** (incl. zh-TW) — community PR #1 / follow-ups.
- Composer stays **draftable while streaming**.
- macOS titlebar traffic-light inset / panel toggle drag.
- **Same-session history duplication** and stuck streaming flags.
- Login / connect error mapping (Access denied, quota, agent connect).

### Changed

- Release download table documents portable zip + Linux AppImage/deb/rpm.
- Bundle targets explicit: dmg / nsis / appimage / deb / rpm.

### Community

- Integrated and closed community PRs **#23–#27** (ACP probe, Doctor/workbench, context chip, OAuth browser, Extensions).
- Issues #3–#13 from launch-thread feedback; #17 / #19 fixed on main.
- PR #18 (zh-TW), PR #20 (ACP TCP) already on main.

**中文 · 新增**
- 多账号管理、Doctor 支持包/重置、CLI 安装校验、会话导出与连接状态、快捷键与桌面通知。
- 上下文用量芯片、设置 → 扩展（Skills/MCP）、ACP 连通测试。
- Windows **绿色版 zip**；Linux **AppImage / deb / rpm**。
- 多账号、导入对话、单实例、思考自动折叠、zh-TW、ACP API 模式等。

**中文 · 修复**
- 登录 OAuth/设备码时立即打开浏览器授权页（不再卡在 Working…）。
- 设置页 i18n 裸 key；`window.confirm` 替换；计划卡 RPC；历史重复与登录/连接错误提示等。

**中文 · 变更**
- 发布资源表与打包目标覆盖绿色版与 Linux 三件套。

## [0.1.0] - 2026-07-24

> 中英文对照 / Bilingual notes. English first (Keep a Changelog), then 中文摘要 under each section.
>
> **Highlight:** first public release — Grok Build desktop workbench, open-source packaging for macOS ARM / Intel + Windows.

### Added

- **Desktop workbench** for Grok Build (`grok agent stdio` ACP): projects, multi-session sidebar, streaming chat, live tool activity line, permission bar (Ask / allow once / session / YOLO).
- **First-run setup wizard**: multi-mirror CLI install, optional official account / API key / custom relay; CLI is a hard gate, account is skippable.
- **Account UI**: login surface, SuperGrok quota + usage heatmap, membership-oriented status.
- **Custom providers**: independent agent home (`GROK_HOME` / `agent-home`) so relays do not have to pollute `~/.grok`.
- **Rich media & files**: image / video / PDF / Office / code previews; path cards with smart open (ellipsis / sibling KB paths); resource pane + embedded multi-webview browser.
- **Automations (“已安排”)**: task list + silent create-from-chat (`grok-automation` fence stripped from bubbles); shell polling without blocking the main conversation.
- **i18n**: EN / 中文 UI via `src/i18n/`; tray menu follows locale.
- **In-app glass dialogs**: product UX never uses `window.confirm` / `prompt` / `alert`.
- **Packaging & open source**
  - GitHub Actions release matrix: macOS ARM64, macOS Intel, Windows x64.
  - Local cross-build: `cargo-xwin` + NSIS on macOS (`pnpm build:win`).
  - CHANGELOG-driven Release body (`scripts/changelog-for-release.py`) including macOS Gatekeeper / “damaged app” steps.
  - MIT license, bilingual README, CONTRIBUTING / SECURITY / CoC, issue & PR templates.

### Fixed

- Chat image cards: synchronous path resolve + cache to avoid zero-height flash / scroll jump while browsing history.
- Path open: strip agent `.../` ellipsis truncation; resolve files under project sibling folders (shared knowledge-base layout).
- Tauri feature allowlist: keep `macos-private-api` aligned for Windows cross-builds via cargo-xwin.
- Automation connect failures: do not leave empty “ghost” sessions in the sidebar.

### Changed

- Session continuity UX: single plain-text running tool line (not multi-row tool stack).
- Release process documented for AI maintainers: `docs/llm-wiki/release.md` + `docs/BUILD.md`.

### Notes

- **Not an official xAI product.** Real agents need a working [Grok Build](https://x.ai) CLI on the machine.
- macOS downloads are **unsigned / not notarized** — use `xattr -cr /Applications/Grok.app` if Gatekeeper blocks (see Release install notes).

**中文 · 新增**

- **Grok Build 桌面指挥台**：项目 / 多会话 / 流式对话 / 工具活动行 / 权限条（Ask · YOLO）。
- **首次向导**：CLI 多镜像安装（硬门禁）；账号 / Key / 中转可跳过。
- **账号与额度**、自定义中转（独立 `GROK_HOME`）、富媒体与资源预览、已安排自动化（对话静默创建，气泡不露 JSON）。
- **中英 UI + 托盘**、应用内毛玻璃弹窗（禁用系统 confirm/prompt/alert）。
- **开源与打包**：Actions 三端；本机 cargo-xwin 打 Windows；CHANGELOG 驱动 Release（含 macOS「已损坏」处理）；MIT 与双语 README。

**中文 · 修复**

- 聊天图片同步解析防滚动跳动；路径省略号 / 旁路知识库打开；Windows 交叉编译 private-api 白名单；自动化连接失败不留空壳会话。

**中文 · 变更**

- 工具活动改为单行纯文本；发版流程写入 `docs/llm-wiki/release.md` 供后续 AI 接手。

**中文 · 说明**

- **非 xAI 官方**；真 Agent 需本机 Grok Build CLI。macOS 未公证，遇 Gatekeeper 用 `xattr -cr`。
