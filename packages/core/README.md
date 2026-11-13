# `@code-lab/core`

Layer 0 (`core`) foundational primitives for **CodeLab**. Contains **zero DOM or browser-storage dependencies** so it runs identically in Node, Bun, Web Workers, Service Workers, and browsers.

## Public API (`src/index.ts`)

- **Lifecycle**: `IDisposable`, `toDisposable`, `DisposableStore`, `MutableDisposable`
- **Events**: `Emitter<T>`, `Event<T>`, `EventUtils`, `setGlobalEventMonitor`
- **Dependency Injection**: `createServiceId<T>(id)`, `ServiceContainer`, `IServiceContainer`
- **Errors & Logging**: `CodeLabError`, `isCodeLabError`, `Logger`, `ILogger`
- **Paths & Globs**: `PosixPath`, `globToRegExp`, `matchesGlob`
- **Extensibility**: `ContributionRegistry<K, V>`
