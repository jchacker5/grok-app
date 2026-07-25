## Summary
Integrate GitHub: link issues, PRs, and commits into sessions. Users can paste a GitHub URL (or use `/gh issue 42`) to fetch issue/PR details and discuss them in the session. Additionally, add "Create Issue from Session" to file a bug report or feature request with the session transcript attached.

## Current State

**`src/App.tsx`** — URL pasting is detected but not GitHub-specific. The `/` command list doesn't include GitHub commands.

**`src-tauri/src/commands.rs`** — no GitHub API commands.

**`src/lib/grokApi.ts`** — API calls use Grok's endpoint; no GitHub integration.

**`src-tauri/Cargo.toml`** — no GitHub/HTTP client beyond what Tauri provides.

## Steps

1. **Backend approach**: Use `reqwest` (already in dependencies or easy to add) to make GitHub API requests. No OAuth initially — use unauthenticated requests for public repos (rate limit: 60 req/hr). For private repos, add a GitHub token setting later.

2. **`src-tauri/Cargo.toml`**: If `reqwest` is not already present, add it with `json` feature.

3. **`src-tauri/src/github.rs`** (new): Implement GitHub API client:
   ```rust
   pub struct GitHubClient { token: Option<String> }

   impl GitHubClient {
     pub fn new(token: Option<String>) -> Self;
     pub async fn get_issue(owner: &str, repo: &str, issue: u32) -> Result<Issue>;
     pub async fn get_pr(owner: &str, repo: &str, pr: u32) -> Result<PullRequest>;
     pub async fn get_commit(owner: &str, repo: &str, sha: &str) -> Result<Commit>;
     pub async fn get_file_content(owner: &str, repo: &str, path: &str) -> Result<String>;
     pub fn parse_github_url(url: &str) -> Option<(String, String, String, String)>;
       // returns (owner, repo, type, id) where type is "issue"|"pull"|"commit"
   }

   pub struct Issue { pub number: u32, pub title: String, pub body: String, pub state: String,
                      pub labels: Vec<String>, pub created_at: String, pub author: String }
   ```

4. **`src-tauri/src/commands.rs`**: Add:
   - `github_fetch(url: String) -> String` — parse URL, fetch issue/PR/commit, return formatted markdown.
   - `github_set_token(token: String)` — save GitHub token in settings.
   - `github_get_token() -> Option<String>`.
   - `create_issue_from_session(owner: String, repo: String, title: String, session_id: String) -> Result<Issue>` — creates a GitHub issue with session transcript as body (using plan 007's export logic).

5. **`src-tauri/src/lib.rs`**: Register commands + mod `github`.

6. **`src/lib/api.ts`**: Add wrappers.

7. **`src/components/GitHubIntegration.tsx`** (new — or integrate into existing components):
   - **URL detection**: In the composer, when user pastes a GitHub URL (`github.com/owner/repo/issues/123`), auto-fetch the issue details and insert as context:
     ```tsx
     // In Composer onChange handler
     const match = text.match(/https?:\/\/github\.com\/([\w-]+)\/([\w-]+)\/(issues|pull|commit)\/(\d+|[a-f0-9]{40})/);
     if (match) {
       const details = await githubFetch(match[0]);
       // Insert as system context or show a preview
     }
     ```
   - **Slash command**: `/gh <owner/repo> <issue|pr> <number>`.
   - **Settings**: Settings page has "GitHub" section with token input (masked) and "Test Connection" button.
   - **Session context menu**: "Create GitHub Issue" → opens a dialog with repo/owner/title fields, auto-fills body with exported session.

8. **`src/i18n/messages.ts`**: Add `GitHub` section with keys: `settings_title`, `token_label`, `token_placeholder`, `test_connection`, `connection_ok`, `connection_failed`, `create_issue`, `issue_title`, `issue_created`, `issue_url`, `fetch_error`, `no_token`, `rate_limit_warning`.

## Verification Gates

- [ ] Paste `github.com/owner/repo/issues/123` → issue details fetched and shown as context
- [ ] `/gh user/repo issues 42` works
- [ ] PR and commit URLs also parse and fetch
- [ ] Settings: set token → "Test Connection" succeeds
- [ ] Without token: public repos work but show rate limit info
- [ ] "Create Issue from Session" creates a GitHub issue with session content
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** implement full GitHub OAuth flow — token-based auth only (user gets a personal access token from GitHub).
- Do **not** store token in plaintext — encrypt using Tauri's `tauri::api::store` or OS keychain.
- If rate limited, show a clear message with reset time.
- Do **not** auto-fetch on every keystroke — only when paste is detected or user presses enter after pasting.
- Private repo access requires a token; show "Token required" if the URL points to a private repo.

## Dependencies
- Plan 007 (Session export) — "Create Issue from Session" uses the export logic for the issue body.
