# Implementation Plans — Top 20 Features

Each plan is self-contained. The executor needs **only** this file and the numbered plan to work.

| # | Feature | Priority | Effort | Dependencies | Value |
|---|---------|----------|--------|--------------|-------|
| 001 | Plugin marketplace one-click install | P0 | M | — | End-to-end install UX, CLI progress |
| 002 | Goal Mode UI polish | P0 | S | — | Goal mode discoverability + state clarity |
| 003 | Call Logs in Account panel | P0 | S | — | Paying users need usage history |
| 004 | Message content search improvements | P0 | M | — | Functional search was just added; UX needed |
| 005 | Session presets (system prompt / config) | P1 | M | — | Power-user workflow templates |
| 006 | Embedded Browser upgrades | P1 | L | — | Auth flows, cookie persistence |
| 007 | Session export (Markdown + JSON) | P1 | S | — | Basic data portability |
| 008 | Workspace diff staging | P1 | L | 012 | Diff viewer then staging UI |
| 009 | Notification preferences | P1 | S | — | Do-not-disturb, per-channel |
| 010 | Plugin dependency graph | P2 | M | 001 | Only after one-click install works |
| 011 | Prompt library (curated + user) | P2 | M | 005 | Shared prompts on top of presets |
| 012 | Session diff / compare | P2 | L | — | Needs side-by-side or unified view |
| 013 | Agent memory viewer | P2 | S | — | Read-only memory inspection |
| 014 | Custom slash commands | P2 | L | — | User-defined `/command` → action |
| 015 | Multi-model answer comparison | P2 | M | — | Side-by-side model outputs |
| 016 | Per-project AGENTS.md editor | P2 | S | — | In-app editor for project config |
| 017 | Session analytics | P3 | M | — | Token usage, session stats |
| 018 | GitHub integration (issue → session) | P3 | L | 007 | Deep GitHub linking |
| 019 | Export conversation as image | P3 | S | — | Social-sharing output |
| 020 | Sync across machines | P3 | XL | — | Final-boss: needs daemon + CRDT |

**Priority**: P0 = quick-win for existing users, P1 = high value, P2 = nice-to-have, P3 = future
**Effort**: S < 1 day, M = 1–3 days, L = 3–5 days, XL = 1–2 weeks

---

# Template

Every plan follows this structure:

```md
## Summary
What this delivers and why.

## Current State
Relevant code excerpts with file paths and line numbers. The executor must not search.

## Steps
1. **File**: `path/to/file` — what to change and how.
2. **File**: `path/to/file` — what to change and how.
…

## Verification Gates
- [ ] Check 1 …
- [ ] Check 2 …

## Hard Boundaries / STOP Conditions
- Do not …
- If X happens, STOP and …
- If Y > 5 files, split into sub-plans.

## Dependencies
- List of plan numbers this depends on.
```
