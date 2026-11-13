# `@code-lab/ui`

Layer 3 (`workbench`) UI controllers, theming, plugin contribution points, and developer observability for **CodeLab**:

- `ThemeService` — built-in `dark`, `light`, and `high-contrast` themes plus JSON custom theme loader (`parseCustomTheme`).
- `SettingsDialogController` — searchable modal `<dialog closedby="any">` Settings UI with category filters, Reset to Default, Export, and Open `.codelab/settings.json`.
- `PluginRegistry` — VS Code-inspired declarative contribution points (`commands`, `settings`, `keybindings`, `themes`, `panels`, `languages`) with lazy activation events and clean `IDisposable` deactivation.
- `renderObservabilityPanelHtml` & `WorkbenchErrorBoundary` — Dev Observability Inspector and user-visible error boundary.
