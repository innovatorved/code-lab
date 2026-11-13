# `@code-lab/fs`

Layer 1 (`platform`) virtual filesystem service (`IFileSystemService`) with hot-swappable storage backends:

- `MemoryBackend` — fast deterministic in-memory `Uint8Array` storage for tests and ephemeral sandboxes.
- `IndexedDbBackend` — persistent browser IndexedDB storage with automatic in-memory fallback.
- `OpfsBackend` — Origin Private File System (`navigator.storage.getDirectory()`) backend for large workspace trees.
