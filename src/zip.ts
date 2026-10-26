/**
 * @innovatorved/code-lab — Zero-Dependency PKZip v2.0 Archive Engine
 * ============================================================================
 * Pure TypeScript implementation of PKZip 2.0 (Store method 0 + UTF-8 flag
 * bit 11 + IEEE 802.3 CRC32) for browser and Node/Bun project export & import.
 *
 * Includes built-in Zip-Slip path traversal sanitization and header integrity
 * verification.
 *
 * Strict leaf module: fully typed, zero explicit any, zero empty catches.
 */

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;
const UTF8_FLAG = 0x0800;

/** Precomputed IEEE 802.3 CRC32 lookup table. */
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

/**
 * Converts a string or byte buffer into a `Uint8Array`.
 */
export function toUint8Array(input: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof input === 'string') {
    return textEncoder.encode(input);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  return new Uint8Array(0);
}

/**
 * Computes the standard IEEE 802.3 CRC32 checksum of a string or byte array.
 */
export function computeCrc32(data: string | Uint8Array | ArrayBuffer): number {
  const bytes = toUint8Array(data);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const index = (crc ^ bytes[i]) & 0xff;
    crc = (crc >>> 8) ^ CRC32_TABLE[index];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const DANGEROUS_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype'
]);

const MAX_ZIP_ENTRIES = 10000;
const MAX_ZIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Sanitizes an archive entry path to prevent Zip-Slip directory traversal attacks
 * and prototype-pollution key injection.
 * Normalizes backslashes, strips drive prefixes and leading slashes, and collapses
 * or removes `..` and `.` segments so the resulting path is strictly relative.
 */
export function sanitizeZipPath(rawPath: string): string {
  const normalized = String(rawPath || '')
    .replace(/\\/g, '/')
    .replace(/^[A-Za-z]:/, '');
  const parts = normalized.split('/');
  const safeParts: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '.') continue;
    if (DANGEROUS_PATH_SEGMENTS.has(trimmed)) {
      return '';
    }
    if (trimmed === '..') {
      if (safeParts.length > 0) {
        safeParts.pop();
      }
      continue;
    }
    safeParts.push(trimmed);
  }
  return safeParts.join('/');
}

function writeUInt16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function readUInt16LE(buf: Uint8Array, offset: number): number {
  return (buf[offset] | (buf[offset + 1] << 8)) >>> 0;
}

function readUInt32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>> 0
  );
}

interface ZipEntryInternal {
  nameBytes: Uint8Array;
  dataBytes: Uint8Array;
  crc32: number;
  offset: number;
}

/**
 * Creates a standard PKZip v2.0 archive from a map of file paths to contents.
 */
export function createZip(
  files: Record<string, string | Uint8Array>
): Uint8Array {
  const entries: ZipEntryInternal[] = [];
  let localSectionSize = 0;
  let centralDirSize = 0;

  const rawKeys = Object.keys(files || {});
  for (const rawKey of rawKeys) {
    const safePath = sanitizeZipPath(rawKey);
    if (!safePath) continue;

    const rawContent = files[rawKey];
    const dataBytes = toUint8Array(rawContent);
    const nameBytes = textEncoder.encode(safePath);
    const crc = computeCrc32(dataBytes);

    entries.push({
      nameBytes,
      dataBytes,
      crc32: crc,
      offset: localSectionSize
    });

    localSectionSize += 30 + nameBytes.length + dataBytes.length;
    centralDirSize += 46 + nameBytes.length;
  }

  const totalSize = localSectionSize + centralDirSize + 22;
  const out = new Uint8Array(totalSize);
  let cursor = 0;

  // 1. Write Local File Headers + File Data
  for (const entry of entries) {
    writeUInt32LE(out, cursor, LOCAL_FILE_HEADER_SIG);
    writeUInt16LE(out, cursor + 4, 20); // Version needed to extract (2.0)
    writeUInt16LE(out, cursor + 6, UTF8_FLAG); // General purpose bit flag (UTF-8)
    writeUInt16LE(out, cursor + 8, 0); // Compression method: 0 (Store)
    writeUInt16LE(out, cursor + 10, 0); // Last mod file time
    writeUInt16LE(out, cursor + 12, 0x2100); // Last mod file date (1980-01-01)
    writeUInt32LE(out, cursor + 14, entry.crc32);
    writeUInt32LE(out, cursor + 18, entry.dataBytes.length); // Compressed size
    writeUInt32LE(out, cursor + 22, entry.dataBytes.length); // Uncompressed size
    writeUInt16LE(out, cursor + 26, entry.nameBytes.length); // File name length
    writeUInt16LE(out, cursor + 28, 0); // Extra field length
    cursor += 30;

    out.set(entry.nameBytes, cursor);
    cursor += entry.nameBytes.length;

    out.set(entry.dataBytes, cursor);
    cursor += entry.dataBytes.length;
  }

  const centralDirOffset = cursor;

  // 2. Write Central Directory File Headers
  for (const entry of entries) {
    writeUInt32LE(out, cursor, CENTRAL_DIR_HEADER_SIG);
    writeUInt16LE(out, cursor + 4, 20); // Version made by
    writeUInt16LE(out, cursor + 6, 20); // Version needed to extract
    writeUInt16LE(out, cursor + 8, UTF8_FLAG); // General purpose bit flag
    writeUInt16LE(out, cursor + 10, 0); // Compression method: Store
    writeUInt16LE(out, cursor + 12, 0); // Last mod file time
    writeUInt16LE(out, cursor + 14, 0x2100); // Last mod file date
    writeUInt32LE(out, cursor + 16, entry.crc32);
    writeUInt32LE(out, cursor + 20, entry.dataBytes.length); // Compressed size
    writeUInt32LE(out, cursor + 24, entry.dataBytes.length); // Uncompressed size
    writeUInt16LE(out, cursor + 28, entry.nameBytes.length); // File name length
    writeUInt16LE(out, cursor + 30, 0); // Extra field length
    writeUInt16LE(out, cursor + 32, 0); // File comment length
    writeUInt16LE(out, cursor + 34, 0); // Disk number start
    writeUInt16LE(out, cursor + 36, 0); // Internal file attributes
    writeUInt32LE(out, cursor + 38, 0); // External file attributes
    writeUInt32LE(out, cursor + 42, entry.offset); // Relative offset of local header
    cursor += 46;

    out.set(entry.nameBytes, cursor);
    cursor += entry.nameBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  writeUInt32LE(out, cursor, END_OF_CENTRAL_DIR_SIG);
  writeUInt16LE(out, cursor + 4, 0); // Number of this disk
  writeUInt16LE(out, cursor + 6, 0); // Disk where central directory starts
  writeUInt16LE(out, cursor + 8, entries.length); // Number of central dir records on this disk
  writeUInt16LE(out, cursor + 10, entries.length); // Total number of central dir records
  writeUInt32LE(out, cursor + 12, centralDirSize); // Size of central directory
  writeUInt32LE(out, cursor + 16, centralDirOffset); // Offset of start of central directory
  writeUInt16LE(out, cursor + 20, 0); // Comment length

  return out;
}

/**
 * Extracts a PKZip v2.0 archive into a UTF-8 file dictionary (`Record<string, string>`).
 * Validates magic headers, checks boundaries, and sanitizes paths against Zip-Slip.
 */
export function extractZip(
  data: Uint8Array | ArrayBuffer
): Record<string, string> {
  const bytes = toUint8Array(data);
  if (bytes.length < 22) {
    throw new Error('Invalid or truncated ZIP archive: buffer shorter than minimum 22-byte EOCD record');
  }

  // Locate End of Central Directory (EOCD) signature scanning backwards from end
  let eocdOffset = -1;
  const minSearchOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minSearchOffset; i--) {
    if (readUInt32LE(bytes, i) === END_OF_CENTRAL_DIR_SIG) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP archive: End of Central Directory (PK\\x05\\x06) signature not found');
  }

  const totalEntries = readUInt16LE(bytes, eocdOffset + 10);
  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP archive exceeds maximum allowed entry count (${MAX_ZIP_ENTRIES})`);
  }
  const centralDirSize = readUInt32LE(bytes, eocdOffset + 12);
  const centralDirOffset = readUInt32LE(bytes, eocdOffset + 16);

  if (centralDirOffset + centralDirSize > bytes.length) {
    throw new Error('Corrupted ZIP archive: Central Directory extends past end of buffer');
  }

  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  let cdCursor = centralDirOffset;
  let totalExtractedBytes = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (cdCursor + 46 > bytes.length) {
      throw new Error('Corrupted ZIP archive: truncated Central Directory header');
    }

    const sig = readUInt32LE(bytes, cdCursor);
    if (sig !== CENTRAL_DIR_HEADER_SIG) {
      throw new Error(`Corrupted ZIP archive: invalid Central Directory signature 0x${sig.toString(16)}`);
    }

    const compressionMethod = readUInt16LE(bytes, cdCursor + 10);
    const expectedCrc = readUInt32LE(bytes, cdCursor + 16);
    const compressedSize = readUInt32LE(bytes, cdCursor + 20);
    const fileNameLen = readUInt16LE(bytes, cdCursor + 28);
    const extraLen = readUInt16LE(bytes, cdCursor + 30);
    const commentLen = readUInt16LE(bytes, cdCursor + 32);
    const localHeaderOffset = readUInt32LE(bytes, cdCursor + 42);

    const nameStart = cdCursor + 46;
    const nameEnd = nameStart + fileNameLen;
    if (nameEnd > bytes.length) {
      throw new Error('Corrupted ZIP archive: file name exceeds buffer');
    }

    const rawName = textDecoder.decode(bytes.subarray(nameStart, nameEnd));
    cdCursor = nameEnd + extraLen + commentLen;

    // Skip explicit directory entries
    if (rawName.endsWith('/')) continue;

    const safeName = sanitizeZipPath(rawName);
    if (!safeName) continue;

    if (localHeaderOffset + 30 > bytes.length) {
      throw new Error(`Corrupted ZIP archive: local header offset out of bounds for ${safeName}`);
    }

    const localSig = readUInt32LE(bytes, localHeaderOffset);
    if (localSig !== LOCAL_FILE_HEADER_SIG) {
      throw new Error(`Corrupted ZIP archive: invalid Local File Header signature for ${safeName}`);
    }

    const localNameLen = readUInt16LE(bytes, localHeaderOffset + 26);
    const localExtraLen = readUInt16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > bytes.length) {
      throw new Error(`Corrupted ZIP archive: file data truncated for ${safeName}`);
    }

    totalExtractedBytes += compressedSize;
    if (totalExtractedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new Error(`ZIP archive exceeds maximum uncompressed size limit (${MAX_ZIP_UNCOMPRESSED_BYTES} bytes)`);
    }

    const rawFileBytes = bytes.subarray(dataStart, dataEnd);
    if (compressionMethod !== 0) {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${safeName} (only Store=0 is supported)`);
    }

    const actualCrc = computeCrc32(rawFileBytes);
    if (actualCrc !== expectedCrc) {
      throw new Error(
        `CRC32 integrity mismatch for ${safeName}: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`
      );
    }

    result[safeName] = textDecoder.decode(rawFileBytes);
  }

  return { ...result };
}

export default {
  createZip,
  extractZip,
  computeCrc32,
  sanitizeZipPath,
  toUint8Array
};
