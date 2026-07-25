## Summary
Upgrade the Embedded Browser for real auth flows: cookie persistence across app restarts, navigation controls (back/forward/reload), URL bar, load indicator, and a "Use this page's cookies in the Grok API client" feature for authenticated API access.

## Current State

**`src/components/EmbeddedBrowser.tsx`** — uses `<iframe>` approach (or `<webview>` depending on platform). Minimal: URL set via prop, no nav controls, no cookie persistence.

```tsx
// EmbeddedBrowser.tsx (simplified)
<iframe src={url} style={{ width: '100%', height: '100%' }} />
```

**`src-tauri/src/fs_browser.rs`** — no browser-related commands.

**`src-tauri/Cargo.toml`** — no cookie-related dependencies.

## Steps

1. **Backend — `src-tauri/Cargo.toml`**: Add `cookie` and `reqwest` (with `cookies` feature) or use `tauri-plugin-http` if available. If using Tauri v1/v2 WebView, use the Tauri shell/WebView API for navigation.

   Actually, for Tauri: use `<webview>` from `@tauri-apps/api/webview` for multi-window or `<iframe>` in current window. For cookie persistence, read cookies from the Tauri WebView's cookie store (Tauri v1: `tauri::api::http`; Tauri v2: `tauri-plugin-http`).

   **Alternative simpler approach**: Use `window.__TAURI__.http` (or Tauri's HTTP plugin) to proxy requests, and store cookies in `AppStore` as a `HashMap<String, String>`.

2. **`src-tauri/src/commands.rs`**: Add:
   - `set_browser_cookies(cookies: HashMap<String, String>)` — store cookies in settings.
   - `get_browser_cookies() -> HashMap<String, String>` — retrieve.
   - `clear_browser_cookies()`.
   - `inject_cookies_into_session()` — takes stored cookies and makes them available to the Grok API client (via new request header injection in `grokApi.ts`).

3. **`src-tauri/src/lib.rs`**: Register new commands.

4. **`src/components/EmbeddedBrowser.tsx`** (rewrite):
   - Add URL bar at top: `<input>` with current URL, Enter navigates.
   - Add nav buttons: ← Back, → Forward, ↻ Reload.
   - Add a loading indicator (thin progress bar at top of iframe).
   - Add "Extract Cookies" button → calls `set_browser_cookies` with current page cookies (read via `document.cookie` injected into iframe, or via Tauri WebViewAPI).
   - Use `allowNavigation` or iframe `sandbox` attributes as needed.
   - Add cookie status indicator: a small icon showing whether cookies are set for this domain.

5. **`src/lib/grokApi.ts`**: If cookies are present for the Grok API domain, inject them into all outgoing API requests as `Cookie` header. Add a check in `callGrok()`:
   ```tsx
   const cookies = await getBrowserCookies();
   if (cookies['x.com']) {
     headers['Cookie'] = Object.entries(cookies['x.com']).map(([k,v]) => `${k}=${v}`).join('; ');
   }
   ```

6. **`src/i18n/messages.ts`**: Add `EmbeddedBrowser` section with keys: `url_placeholder`, `back`, `forward`, `reload`, `extract_cookies`, `cookies_extracted`, `cookies_cleared`, `no_cookies`.

## Verification Gates

- [ ] Embedded Browser has working back/forward/reload buttons
- [ ] URL bar navigates on Enter
- [ ] Loading indicator shows during page load
- [ ] "Extract Cookies" reads cookies from current page domain
- [ ] Extracted cookies persist across app restart (check via `getBrowserCookies` after relaunch)
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** store raw cookies in the UI — always go through backend.
- Do **not** auto-inject cookies without user action (Extract Cookies button must be clicked).
- If using iframe, same-origin policies may prevent cookie reading — use Tauri's `WebviewWindow` API or a Tauri plugin to read cookies natively.
- If cookies cannot be read from iframe due to CORS, use a Tauri window with the `Webview` API instead.
- Do **not** store session tokens in plaintext — if storing `x.com` cookies, encrypt at rest.
- Keep browser feature parity: if cookies can't be injected into the Grok API (because the API expects a Bearer token, not cookies), fall back gracefully and show a message.

## Dependencies
- None
