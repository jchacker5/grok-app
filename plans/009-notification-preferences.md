## Summary
Add a Notification Preferences panel in Settings: per-channel toggles (desktop notifications, sound, in-app badge), quiet hours mode (Do Not Disturb with start/end time), and a test notification button.

## Current State

**`src/lib/desktopNotify.ts`** — sends desktop notifications via `Notification` API and/or Tauri notification plugin. No toggle/no quiet hours.

```tsx
// desktopNotify.ts
export function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') new Notification(title, { body });
}
```

**`src-tauri/src/store.rs`** — `Settings` has no notification-related fields.

**`src/components/SettingsPage.tsx`** — has tabs: General, Appearance, Account, Advanced. No "Notifications" tab.

**`src/i18n/messages.ts`** — `Settings` section no notification keys.

## Steps

1. **`src-tauri/src/store.rs`**: Add `NotificationSettings` to `Settings`:
   ```rust
   pub struct NotificationSettings {
     pub desktop_enabled: bool,     // default: true
     pub sound_enabled: bool,       // default: true
     pub in_app_badge: bool,        // default: true
     pub quiet_hours_enabled: bool, // default: false
     pub quiet_hours_start: String, // "22:00"
     pub quiet_hours_end: String,   // "08:00"
     pub notify_on_completion: bool, // default: true
     pub notify_on_error: bool,     // default: true
   }
   ```
   Add default impl. Add `notification_settings: NotificationSettings` field. Add `update_notification_settings` method.

2. **`src-tauri/src/commands.rs`**: Add `get_notification_settings`, `update_notification_settings`, `test_notification` (sends a test desktop notification). Also add `is_quiet_hours() -> bool` command that checks current time against quiet hours.

3. **`src-tauri/src/lib.rs`**: Register commands.

4. **`src/lib/api.ts`**: Add wrappers.

5. **`src/components/NotificationSettings.tsx`** (new): Settings form with:
   - Enable desktop notifications (toggle)
   - Enable notification sound (toggle)
   - Show in-app badge (toggle)
   - Do Not Disturb section: Enable + time pickers (start, end)
   - Events section: Notify on completion, on error
   - "Send Test Notification" button

   Style matches settings page pattern (`.settings-section`, `.settings-row`).

6. **`src/components/SettingsPage.tsx`**: Add "Notifications" tab that renders `<NotificationSettings>`.

7. **`src/lib/desktopNotify.ts`**: Refactor to check settings before sending:
   ```tsx
   export async function notify(title: string, body: string, channel: 'completion' | 'error' | 'info') {
     const settings = await getNotificationSettings();
     if (await isQuietHours()) return;
     if (channel === 'completion' && !settings.notify_on_completion) return;
     if (channel === 'error' && !settings.notify_on_error) return;
     if (!settings.desktop_enabled) return;
     // … send notification
   }
   ```

8. **`src/i18n/messages.ts`**: Add `Settings.Notifications` section with keys: `tab_title`, `desktop`, `sound`, `badge`, `quiet_hours`, `quiet_start`, `quiet_end`, `notify_on_completion`, `notify_on_error`, `test_notification`, `test_sent`, `permission_denied`.

## Verification Gates

- [ ] Settings page has "Notifications" tab
- [ ] Toggle "desktop notifications" off → no notifications sent
- [ ] Set quiet hours 22:00–08:00, set system time to 23:00 → no notifications sent
- [ ] Click "Test Notification" → desktop notification appears (or permission prompt)
- [ ] Settings persist across restart
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** add push notifications (server-side) — local only.
- Do **not** add notification history/ log.
- If Notification permission is denied, show guidance in settings: "Enable notifications in your system settings."
- Quiet hours are evaluated client-side only; timezone uses the system timezone.
- Sound uses a simple beep (`AudioContext` oscillator or a small WAV asset) — not an MP3 file.

## Dependencies
- None
