# `@code-lab/commands`

Layer 1 (`platform`) command execution, `when`-clause context evaluation, and customizable keybinding dispatch:

- `ContextKeyService` — evaluates VS Code-style `when` expressions (`editorFocus && !editorReadonly && resourceLangId == 'sql'`).
- `CommandRegistry` — registers typed commands (`registerCommand` -> `IDisposable`) and dispatches `executeCommand`.
- `KeybindingService` — normalizes cross-platform `Mod`/`Cmd`/`Ctrl` chords, supports `.codelab/keybindings.json` overrides and `-command` unbinding rules.
