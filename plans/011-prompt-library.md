## Summary
Add a Prompt Library — a curated collection of system prompts that users can browse, search, and apply. Includes built-in prompts (code review, creative writing, etc.) and user-created custom prompts. Built on top of session presets (plan 005).

## Current State

**`src/App.tsx`** — system prompt set via `DEFAULT_SYSTEM_PROMPT` constant:
```tsx
const DEFAULT_SYSTEM_PROMPT = 'You are Grok, a helpful AI assistant...';
```

**No prompt library exists.** The presets from plan 005 are the closest concept but they include model/config, not just prompts.

**`src/i18n/messages.ts`** — no prompt library keys.

## Steps

1. **`src/lib/promptLibrary.ts`** (new): Define built-in prompts:
   ```tsx
   export interface LibraryPrompt {
     id: string;
     name: string;
     description: string;
     content: string;
     category: 'general' | 'coding' | 'writing' | 'analysis' | 'custom';
     isBuiltIn: boolean;
   }

   export const BUILT_IN_PROMPTS: LibraryPrompt[] = [
     { id: 'code-review', name: 'Code Review', description: 'Review code for bugs, style, and security',
       content: 'You are an expert code reviewer. Analyze the following code for…', category: 'coding', isBuiltIn: true },
     { id: 'creative-writer', name: 'Creative Writer', description: 'Creative writing assistant',
       content: 'You are a creative writing partner. Help me develop…', category: 'writing', isBuiltIn: true },
     { id: 'data-analysis', name: 'Data Analyst', description: 'Analyze data and generate insights',
       content: 'You are a data analyst. Help me understand the following data…', category: 'analysis', isBuiltIn: true },
     // … 8-12 prompts
   ];
   ```

2. **`src-tauri/src/store.rs`**: Add `custom_prompts: Vec<CustomPrompt>` to `Settings`. Methods: `save_custom_prompt`, `delete_custom_prompt`, `get_custom_prompts`.

3. **`src-tauri/src/commands.rs`**: Add commands for CRUD on custom prompts.

4. **`src-tauri/src/lib.rs`**: Register commands.

5. **`src/lib/api.ts`**: Add wrappers.

6. **`src/components/PromptLibrary.tsx`** (new): A panel with:
   - Search bar (filters by name, description).
   - Category tabs: All, General, Coding, Writing, Analysis, Custom.
   - Grid of prompt cards: name, description, category badge, "Apply" button.
   - Click "Apply" → set system prompt to the prompt content and show a toast.
   - "Save Current as Custom" button (saves current system prompt as custom prompt with name/description/category form).
   - Custom prompts have Edit/Delete buttons.
   - Show category icons (code icon for coding, pen for writing, etc.).

7. **`src/App.tsx`**: Add "Prompt Library" button in the composer toolbar (near preset selector). Opens `<PromptLibrary>` in a `GlassModal` or slide-over panel. On apply:
   ```tsx
   setSystemPrompt(prompt.content);
   showToast(t('prompt_applied', { name: prompt.name }));
   ```

8. **`src/i18n/messages.ts`**: Add `PromptLibrary` section with keys: `title`, `search_placeholder`, `prompt_applied`, `save_custom`, `edit`, `delete`, `delete_confirm`, `category_all`, `category_coding`, `category_writing`, `category_analysis`, `category_custom`, `no_results`, `no_custom`.

## Verification Gates

- [ ] "Prompt Library" button visible in composer toolbar
- [ ] Opens panel with 8-12 built-in prompts + any custom prompts
- [ ] Search filters prompts by name/description in real time
- [ ] Category tabs filter correctly
- [ ] Click "Apply" → system prompt set, toast shown
- [ ] "Save Current as Custom" works, persists across restart
- [ ] Edit/Delete custom prompts works
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Do **not** sync prompts to cloud — local only.
- Built-in prompts are hardcoded in TypeScript (not backend); custom prompts stored via backend.
- Do **not** allow deleting built-in prompts.
- If custom prompts exceed 100, show a warning.
- Applying a prompt does NOT change model/config — only the system prompt text (that's the difference from Presets in plan 005).

## Dependencies
- Plan 005 (Session Presets) — the prompt library UI and the presets UI should look consistent (same style). But no hard dependency.
