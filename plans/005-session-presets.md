## Summary
Allow users to save and load session presets — reusable combinations of system prompt, model selection, effort, temperature, and YOLO mode. Presets appear in a dropdown above the composer. This is the foundation for the Prompt Library (plan 011).

## Current State

**`src/App.tsx`** — session initialization:
```tsx
// ~line 200: newSession() sets default model, systemPrompt, etc.
const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
const [model, setModel] = useState(getDefaultModel());
const [effort, setEffort] = useState<'low'|'medium'|'high'>('medium');
const [yolo, setYolo] = useState(false);
const [temperature, setTemperature] = useState(0.7);
```

**`src/components/SettingsPage.tsx`** — no preset UI.

**`src-tauri/src/store.rs`** — `Settings` struct has no `presets` field.

**`src/i18n/messages.ts`** — `Settings` section exists but no preset keys.

## Steps

1. **`src/lib/types.ts`**: Add `SessionPreset` interface:
   ```tsx
   export interface SessionPreset {
     id: string;
     name: string;
     description?: string;
     systemPrompt: string;
     model: string;
     effort: 'low' | 'medium' | 'high';
     yolo: boolean;
     temperature: number;
     createdAt: number;
   }
   ```

2. **`src-tauri/src/store.rs`**: Add `presets: Vec<SessionPreset>` to `Settings`. Add methods: `save_preset(preset: SessionPreset)`, `load_presets() -> Vec<SessionPreset>`, `delete_preset(id: String)`, `apply_preset(id: String) -> SessionPreset`. Persist in `settings.json` under a `presets` key.

3. **`src-tauri/src/commands.rs`**: Add commands: `save_session_preset`, `load_session_presets`, `delete_session_preset`, `apply_session_preset`. The latter returns the preset data and the frontend applies it to state.

4. **`src-tauri/src/lib.rs`**: Register new commands.

5. **`src/lib/api.ts`**: Add frontend API wrappers.

6. **`src/components/PresetSelector.tsx`** (new): A dropdown `<select>` (or custom dropdown) in the composer toolbar showing:
   - "Load Preset…" as placeholder
   - List of saved presets
   - "Save Current as Preset…" option
   - "Manage Presets…" option (opens modal with list, rename, delete)

   On select → call `apply_session_preset` → set all session state fields.

7. **`src/App.tsx`**: Import and render `<PresetSelector>` in the session toolbar area (near model selector). Wire `onApply` to update `systemPrompt`, `model`, `effort`, `yolo`, `temperature`.

8. **`src/components/GlassModal.tsx`** — reused for "Save Preset" and "Manage Presets" dialogs.

9. **`src/i18n/messages.ts`**: Add `Presets` section with keys: `save_preset`, `load_preset`, `manage_presets`, `preset_name`, `preset_description`, `delete_preset`, `delete_confirm`, `no_presets`.

## Verification Gates

- [ ] Save current session as preset → appears in dropdown
- [ ] Load preset → all session settings change (model, system prompt, effort, YOLO, temperature)
- [ ] Manage presets → rename/delete works
- [ ] Presets persist across app restarts
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** include message history in presets (only config).
- Do **not** add cloud sync of presets — local only.
- If preset count exceeds 50, show a warning before saving another.
- Do **not** autoload any preset — start with defaults every time.
- Presets must not affect session history — only future messages.

## Dependencies
- None
