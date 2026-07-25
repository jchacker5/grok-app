## Summary
Allow users to define custom slash commands that trigger actions or insert text. For example, `/review` could insert a code review prompt, `/summarize` could run a summarization chain, or `/deploy` could run a shell command. Commands are defined in the CLI/agent config and exposed in the composer via autocomplete.

## Current State

**`src/components/Composer.tsx`** — `/` key triggers command autocomplete with built-in commands:
```tsx
// Composer.tsx ~line 150
const BUILT_IN_COMMANDS = ['think', 'goal', 'plan', 'search', 'browse'];
```

**`src/lib/grokPluginLoader.ts`** — plugins can define slash commands via `contributes.commands`. Loaded into the command list at startup.

**No custom (user-defined) commands.** The command list is static.

## Steps

1. **`src-tauri/src/store.rs`**: Add `custom_commands: Vec<CustomCommand>` to `Settings`:
   ```rust
   pub struct CustomCommand {
     pub id: String,
     pub name: String,         // e.g. "review"
     pub description: String,  // e.g. "Insert code review prompt"
     pub action: CommandAction,
     pub shortcut: Option<String>,
   }

   pub enum CommandAction {
     InsertText(String),       // Insert text into composer
     RunShell(String),         // Run a shell command (output appended)
     ToggleSetting(String),    // Toggle a setting
     OpenPanel(String),        // Open a specific panel
   }
   ```
   Methods: `save_custom_command`, `delete_custom_command`, `get_custom_commands`.

2. **`src-tauri/src/commands.rs`**: Add CRUD commands for custom commands. Also add `execute_custom_command(id: String) -> String` that runs the command action (shell execution, setting toggle, or returning text to insert).

3. **`src-tauri/src/lib.rs`**: Register commands.

4. **`src/lib/api.ts`**: Add wrappers.

5. **`src/components/Composer.tsx`**: Enhance `/` autocomplete:
   - Merge built-in + plugin + custom commands into a single list.
   - When selecting a custom command that inserts text, insert the text into the composer at cursor position.
   - When selecting one that runs a shell command, show the output as an assistant message.
   - Add a keyboard shortcut hint next to commands that have `shortcut`.

6. **`src/components/EditCommandsModal.tsx`** (new): A settings modal for managing custom commands:
   - List of commands with edit/delete.
   - "Add Command" form: name (slug), description, action type dropdown, action value (textarea for shell command or insert text).
   - "Test" button that runs the command immediately.
   - Validation: name must be alphanumeric + underscores only, no spaces.

7. **`src/App.tsx`**: Wire up the "Manage Commands" button (in settings or composer toolbar). Opens `<EditCommandsModal>`.

8. **`src/styles/components/EditCommandsModal.css`** (new): Style the command editor — code-like input for shell commands (`font-family: monospace;`).

9. **`src/i18n/messages.ts`**: Add `Commands` section with keys: `manage_commands`, `add_command`, `edit_command`, `delete_confirm`, `command_name`, `description`, `action_type`, `action_insert_text`, `action_run_shell`, `action_toggle_setting`, `action_open_panel`, `test_command`, `command_executed`, `no_commands`, `name_validation`.

## Verification Gates

- [ ] `/` in composer shows custom commands alongside built-in ones
- [ ] Custom "insert text" command inserts the configured text at cursor
- [ ] Custom "run shell" command runs and shows output
- [ ] Custom "toggle setting" toggles a boolean setting
- [ ] Manage Commands modal: add/edit/delete works
- [ ] Commands persist across restart
- [ ] i18n keys present

## Hard Boundaries / STOP Conditions

- **Shell commands run with user's permissions** — show a security warning when creating a shell command: "This runs arbitrary commands on your machine." Do not pre-approve; require explicit user confirmation on first run.
- Do **not** allow changing built-in commands — only custom.
- Command name must match `^[a-zA-Z0-9_]+$` (no spaces, no special chars).
- Shell command timeout: 30 seconds max. If it exceeds, kill the process and return "Command timed out."
- Do **not** persist shell output — it's ephemeral (stays only in the current message).

## Dependencies
- None
