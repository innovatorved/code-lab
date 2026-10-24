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

/**
 * Decompresses a Base64url string into workspace snapshot payload.
 */
export async function decompressWorkspaceSnapshot(encoded: string): Promise<WorkspaceSharePayload | null> {
  if (!encoded || typeof encoded !== 'string') return null;
  try {
    const bytes = base64UrlToBuffer(encoded);

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(bytes as any);
        writer.close();

        const response = new Response(ds.readable);
        const decompressed = await response.arrayBuffer();
        const text = new TextDecoder().decode(decompressed);
        return JSON.parse(text);
      } catch (err) {
        // Fallback for uncompressed raw JSON payload
        void err;
        const rawText = new TextDecoder().decode(bytes);
        return JSON.parse(rawText);
      }
    }

    const rawText = new TextDecoder().decode(bytes);
    return JSON.parse(rawText);
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[CodeLab Share Snapshot Restore Error]:', err);
    }
    return null;
  }
}
