/**
 * @innovatorved/code-lab — Zero-Backend URL Snapshot Compressor & Decompressor
 *
 * Serializes workspace state { lang, activeFile, files, stdin }, compresses it
 * with browser-native `CompressionStream('deflate-raw')`, and encodes as Base64url
 * in the URL hash `#codelab=<base64url>`.
 */

export interface WorkspaceSharePayload {
  lang?: string;
  activeFile?: string | null;
  files: Record<string, string>;
  stdin?: string;
}

function bufferToBase64Url(uint8: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(uint8).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Compresses workspace payload into a compact Base64url string.
 */
export async function compressWorkspaceSnapshot(payload: WorkspaceSharePayload): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(jsonStr);

  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();

    const response = new Response(cs.readable);
    const compressedBuffer = await response.arrayBuffer();
    return bufferToBase64Url(new Uint8Array(compressedBuffer));
  }

  // Fallback: uncompressed Base64url if CompressionStream unsupported
  return bufferToBase64Url(rawBytes);
}

const MAX_DECOMPRESSED_SNAPSHOT_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Decompresses a Base64url string into workspace snapshot payload.
 */
export async function decompressWorkspaceSnapshot(encoded: string): Promise<WorkspaceSharePayload | null> {
  if (!encoded || typeof encoded !== 'string') return null;
  try {
    const bytes = base64UrlToBuffer(encoded);
    if (bytes.byteLength > MAX_DECOMPRESSED_SNAPSHOT_BYTES) {
      throw new Error('Snapshot payload exceeds maximum allowed size');
    }

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const writeInput = new Uint8Array(bytes.byteLength);
        writeInput.set(bytes);
        writer.write(writeInput).catch(() => {});
        writer.close().catch(() => {});

        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        while (true) {
          const step = await reader.read();
          if (step.done) break;
          const chunk = step.value;
          if (chunk) {
            totalLength += chunk.byteLength;
            if (totalLength > MAX_DECOMPRESSED_SNAPSHOT_BYTES) {
              await reader.cancel().catch(() => {});
              throw new Error('Decompressed snapshot exceeds 5 MB safety limit');
            }
            chunks.push(chunk);
          }
        }
        const decompressed = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const text = new TextDecoder().decode(decompressed);
        return JSON.parse(text) as WorkspaceSharePayload;
      } catch (err) {
        if (err instanceof Error && err.message.includes('safety limit')) {
          throw err;
        }
        // Fallback for uncompressed raw JSON payload
        const rawText = new TextDecoder().decode(bytes);
        return JSON.parse(rawText) as WorkspaceSharePayload;
      }
    }

    const rawText = new TextDecoder().decode(bytes);
    return JSON.parse(rawText) as WorkspaceSharePayload;
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[CodeLab Share Snapshot Restore Error]:', err);
    }
    return null;
  }
}
