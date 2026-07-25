## Summary
Add "Compare answers" mode: send the same message to multiple models simultaneously and show their responses side-by-side in the session. Each response is tagged with the model name and colored differently. Useful for comparing Grok vs Claude vs custom providers.

## Current State

**`src/lib/grokApi.ts`** — `callGrok(model, messages, config)` sends to a single model. The UI shows one assistant message per user message.

**`src/App.tsx`** — `handleSend` is the single-message flow: compose → call API → append response. No multi-model concept.

**`src-tauri/src/store.rs`** — sessions store messages with `model` field. Multiple messages can coexist.

**`src/i18n/messages.ts`** — no multi-model keys.

## Steps

1. **`src/lib/types.ts`**: Add `MultiModelConfig`:
   ```tsx
   export interface MultiModelConfig {
     enabled: boolean;
     models: string[]; // list of model IDs to query
   }
   ```

2. **`src/lib/grokApi.ts`**: Add `callMultipleModels(models: string[], messages, config) -> Promise<Map<string, StreamEvent>>`:
   - Fire parallel requests to each model using `callGrok` internally.
   - Handle partial failures: if model A fails, still show model B's response with error for A.
   - Return a map of model → response content + error (if any).

3. **`src/App.tsx`**: Add multi-model toggle to the composer toolbar:
   - A button "Compare Models" with a dropdown to select 2–4 models (default: current model + Grok 3).
   - When enabled, `handleSend` calls `callMultipleModels` instead of `callGrok`.
   - Each response stream is appended as separate assistant messages in the session, with model name as a label.

4. **`src/components/MessageList.tsx`** (or inline in App.tsx): When consecutive messages have the same parent user message but different models, render them in a side-by-side or tabbed container:
   ```tsx
   <div class="multi-model-answers">
     {answers.map(({ model, content, error }) => (
       <div class="multi-model-answer" data-model={model}>
         <div class="answer-header">{model}</div>
         <MarkdownBody content={content} />
         {error && <div class="answer-error">{error}</div>}
       </div>
     ))}
   </div>
   ```
   Or use tabs: tabs for each model name, click to switch.

5. **`src/styles/components/MultiModelAnswer.css`** (new): Style the comparison:
   ```css
   .multi-model-answers { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
   .multi-model-answer { border: 1px solid var(--c-border); border-radius: 8px; padding: 12px; }
   .multi-model-answer[data-model="grok-3"] { border-color: var(--c-accent); }
   .answer-header { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
   ```

6. **`src/i18n/messages.ts`**: Add `MultiModel` section with keys: `compare_models`, `select_models`, `model_label`, `response_from`, `error`, `no_models_selected`.

## Verification Gates

- [ ] "Compare Models" button visible in composer toolbar
- [ ] Select 2 models → send message → both responses appear in same message group
- [ ] Each response labeled with model name
- [ ] Side-by-side layout on wide screens, stacked on narrow
- [ ] If one model fails, its slot shows error message, other model's response unaffected
- [ ] Disable compare → normal single-model behavior
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- Maximum 4 models in comparison (to avoid rate limits and UI clutter).
- Do **not** auto-select models — user must explicitly choose at least 2.
- Handle non-streaming: if a model doesn't support streaming, collect full response and show it.
- Do **not** persist multi-model config per session — it's a transient toggle.
- Cost warning: if comparing with paid models, show an approximate cost before sending.
- If the same model is selected twice, deduplicate.

## Dependencies
- Plan 007 (Session export) — exported JSON should include multi-model responses. But not a hard dependency.
