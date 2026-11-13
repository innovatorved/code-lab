export {
  type FsEntryKind,
  type FsStat,
  type FsChangeEvent,
  type IFsBackend,
  type IFileSystemService,
  IFileSystemServiceId
} from './types';

export {
  MemoryBackend,
  IndexedDbBackend,
  OpfsBackend
} from './backends';

export {
  FileSystemService
} from './vfs-service';
