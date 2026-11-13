# `@code-lab/settings`

Layer 1 (`platform`) VS Code-inspired configuration system for **CodeLab**:

- **Layered Precedence**: `default` (plugin/built-in schema defaults) → `user` → `workspace` (`.codelab/settings.json`) → `override` (URL query/embed config).
- **JSONC Parser**: Supports `//` line comments, `/* ... */` block comments, and trailing commas with exact 1-based line/column diagnostics.
- **CSP-Safe JSON Schema Validator**: Validates `.codelab/settings.json`, `.codelab/keybindings.json`, `.codelab/tasks.json`, and `.codelab/extensions.json` without `new Function`, automatically falling back invalid keys to safe defaults while reporting structured diagnostics.
