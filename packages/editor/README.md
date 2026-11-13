# `@code-lab/editor`

Layer 2 (`services`) swappable editor abstraction (`IEditorAdapter` & `EditorService`).

## Included Adapters

- `MonacoEditorAdapter` — wraps a full Monaco `IStandaloneCodeEditor` instance.
- `SqlEditorAdapter` — wraps `@code-lab/sql`'s zero-WASM PostgreSQL 18 / SQLite 3 editor.
- `LightweightEditorAdapter` — minimal `<textarea>` fallback for headless tests and instant boot.
