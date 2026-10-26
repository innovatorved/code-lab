// @ts-nocheck
'use strict';
if (typeof globalThis !== 'undefined' && typeof globalThis.Bun === 'undefined') {
  globalThis.Bun = { version: '1.1.20' };
}
/**
 * Virtual Node.js Web Worker Runtime & Multi-File JS/TS Execution Engine
 * Zero external dependencies. Runs identically in Browser Web Workers, Browser Main Thread, and Node.js.
 *
 * Provides complete in-memory shims for:
 *   - Buffer (Uint8Array subclass with full Node.js Buffer read/write/encoding/slice/copy API)
 *   - node:crypto / crypto (pure JS synchronous MD5, SHA-256, HMAC, timingSafeEqual, randomUUID, randomBytes)
 *   - node:zlib / zlib (pure JS IEEE 802.3 CRC-32)
 *   - node:path / path & node:os / os
 *   - node:fs / fs (in-memory POSIX filesystem with inode table, file descriptors, stats, and UI inspector snapshot)
 *   - node:http / http (in-memory loopback HTTP server & client with ephemeral ports, streaming bodies, timeouts, ECONNREFUSED/ETIMEDOUT, and network trace inspector)
 *   - node:assert & node:assert/strict (complete assertion library including throws/rejects/deepStrictEqual)
 *   - Fast TypeScript & ESM-to-CommonJS transpiler
 *   - Structured Test Harness & Console/Process interceptor
 */

function __initVirtualRuntime(rootScope) {
  const _runtimeLogger = (rootScope && rootScope.CodeLabLogger && typeof rootScope.CodeLabLogger.createLogger === 'function')
    ? rootScope.CodeLabLogger.createLogger()
    : {
        debug() {},
        info() {},
        warn(msg, meta) { if (typeof console !== 'undefined' && console.warn) console.warn('[CodeLab]', msg, meta || ''); },
        error(msg, meta) { if (typeof console !== 'undefined' && console.error) console.error('[CodeLab]', msg, meta || ''); }
      };
  // =========================================================================
  // 1. UTF-8 / HEX / BASE64 / BASE64URL CODECS & VIRTUAL BUFFER
  // =========================================================================
  const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;

  function utf8Encode(str) {
    str = String(str);
    if (textEncoder) return textEncoder.encode(str);
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          c = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
          out.push(
            0xf0 | (c >> 18),
            0x80 | ((c >> 12) & 0x3f),
            0x80 | ((c >> 6) & 0x3f),
            0x80 | (c & 0x3f)
          );
          i++;
        } else {
          out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function utf8Decode(bytes) {
    if (textDecoder) return textDecoder.decode(bytes);
    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b0 = bytes[i++];
      if (b0 < 0x80) {
        out += String.fromCharCode(b0);
      } else if ((b0 & 0xe0) === 0xc0) {
        const b1 = bytes[i++] & 0x3f;
        out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
      } else if ((b0 & 0xf0) === 0xe0) {
        const b1 = bytes[i++] & 0x3f;
        const b2 = bytes[i++] & 0x3f;
        out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
      } else {
        const b1 = bytes[i++] & 0x3f;
        const b2 = bytes[i++] & 0x3f;
        const b3 = bytes[i++] & 0x3f;
        const cp = (((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3) - 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      }
    }
    return out;
  }

  const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const B64_LOOKUP = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64_CHARS.length; i++) B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
  B64_LOOKUP['-'.charCodeAt(0)] = 62;
  B64_LOOKUP['_'.charCodeAt(0)] = 63;

  function base64Encode(bytes, urlSafe = false) {
    let out = '';
    const len = bytes.length;
    for (let i = 0; i < len; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < len ? bytes[i + 1] : 0;
      const b2 = i + 2 < len ? bytes[i + 2] : 0;
      const trip = (b0 << 16) | (b1 << 8) | b2;
      out += B64_CHARS[(trip >> 18) & 0x3f];
      out += B64_CHARS[(trip >> 12) & 0x3f];
      out += i + 1 < len ? B64_CHARS[(trip >> 6) & 0x3f] : (urlSafe ? '' : '=');
      out += i + 2 < len ? B64_CHARS[trip & 0x3f] : (urlSafe ? '' : '=');
    }
    if (urlSafe) {
      out = out.replace(/\+/g, '-').replace(/\//g, '_');
    }
    return out;
  }

  function base64Decode(str) {
    const clean = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code === 61 /* '=' */) break;
      const val = code < 256 ? B64_LOOKUP[code] : -1;
      if (val >= 0) clean.push(val);
    }
    const outLen = Math.floor((clean.length * 3) / 4);
    const out = new Uint8Array(outLen);
    let outIdx = 0;
    for (let i = 0; i < clean.length; i += 4) {
      const c0 = clean[i];
      const c1 = i + 1 < clean.length ? clean[i + 1] : 0;
      const c2 = i + 2 < clean.length ? clean[i + 2] : 0;
      const c3 = i + 3 < clean.length ? clean[i + 3] : 0;
      const trip = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
      if (outIdx < outLen) out[outIdx++] = (trip >> 16) & 0xff;
      if (outIdx < outLen) out[outIdx++] = (trip >> 8) & 0xff;
      if (outIdx < outLen) out[outIdx++] = trip & 0xff;
    }
    return out;
  }

  function hexEncode(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      out += (b < 16 ? '0' : '') + b.toString(16);
    }
    return out;
  }

  function hexDecode(str) {
    str = String(str);
    const out = [];
    for (let i = 0; i + 1 < str.length; i += 2) {
      const byte = parseInt(str.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) break;
      out.push(byte);
    }
    return new Uint8Array(out);
  }

  class VirtualBuffer extends Uint8Array {
    constructor(arg, byteOffset, length) {
      if (typeof arg === 'number') {
        super(arg);
      } else if (arg instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && arg instanceof SharedArrayBuffer)) {
        super(arg, byteOffset, length);
      } else if (arg !== undefined) {
        super(arg);
      } else {
        super(0);
      }
      this._isVirtualBuffer = true;
    }

    static get [Symbol.species]() {
      return VirtualBuffer;
    }

    static isBuffer(obj) {
      return Boolean(obj && (obj instanceof VirtualBuffer || obj._isVirtualBuffer === true));
    }

    static isEncoding(encoding) {
      if (typeof encoding !== 'string') return false;
      return ['utf8', 'utf-8', 'hex', 'base64', 'base64url', 'ascii', 'latin1', 'binary', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le'].includes(encoding.toLowerCase());
    }

    static from(value, encodingOrOffset, length) {
      if (typeof value === 'string') {
        const enc = (typeof encodingOrOffset === 'string' ? encodingOrOffset : 'utf8').toLowerCase();
        let bytes;
        if (enc === 'utf8' || enc === 'utf-8') {
          bytes = utf8Encode(value);
        } else if (enc === 'hex') {
          bytes = hexDecode(value);
        } else if (enc === 'base64' || enc === 'base64url') {
          bytes = base64Decode(value);
        } else if (enc === 'ascii' || enc === 'latin1' || enc === 'binary') {
          bytes = new Uint8Array(value.length);
          for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff;
        } else if (enc === 'utf16le' || enc === 'utf-16le' || enc === 'ucs2' || enc === 'ucs-2') {
          bytes = new Uint8Array(value.length * 2);
          for (let i = 0; i < value.length; i++) {
            const c = value.charCodeAt(i);
            bytes[i * 2] = c & 0xff;
            bytes[i * 2 + 1] = (c >>> 8) & 0xff;
          }
        } else {
          bytes = utf8Encode(value);
        }
        const buf = new VirtualBuffer(bytes.length);
        buf.set(bytes);
        return buf;
      }
      if (value instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)) {
        const view = new Uint8Array(value, encodingOrOffset || 0, length !== undefined ? length : value.byteLength - (encodingOrOffset || 0));
        Object.setPrototypeOf(view, VirtualBuffer.prototype);
        view._isVirtualBuffer = true;
        return view;
      }
      if (ArrayBuffer.isView(value)) {
        const src = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        const buf = new VirtualBuffer(src.length);
        buf.set(src);
        return buf;
      }
      if (Array.isArray(value) || (value && typeof value.length === 'number')) {
        const buf = new VirtualBuffer(value.length);
        for (let i = 0; i < value.length; i++) buf[i] = value[i] & 0xff;
        return buf;
      }
      if (value && typeof value.valueOf === 'function' && value.valueOf() !== value) {
        return VirtualBuffer.from(value.valueOf(), encodingOrOffset, length);
      }
      throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object');
    }

    static alloc(size, fill, encoding) {
      if (typeof size !== 'number' || size < 0 || !Number.isFinite(size)) {
        throw new RangeError('Invalid buffer size');
      }
      const buf = new VirtualBuffer(size);
      if (fill !== undefined && size > 0) {
        buf.fill(fill, 0, size, encoding);
      }
      return buf;
    }

    static allocUnsafe(size) {
      return VirtualBuffer.alloc(size);
    }

    static allocUnsafeSlow(size) {
      return VirtualBuffer.alloc(size);
    }

    static concat(list, totalLength) {
      if (!Array.isArray(list)) throw new TypeError('list argument must be an Array');
      if (list.length === 0) return VirtualBuffer.alloc(0);
      let len = totalLength;
      if (len === undefined) {
        len = 0;
        for (let i = 0; i < list.length; i++) len += list[i].length;
      }
      const out = VirtualBuffer.alloc(len);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const chunk = list[i];
        if (offset + chunk.length > len) {
          out.set(chunk.subarray(0, len - offset), offset);
          break;
        }
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out;
    }

    static byteLength(stringOrBuf, encoding = 'utf8') {
      if (typeof stringOrBuf !== 'string') {
        if (stringOrBuf && typeof stringOrBuf.byteLength === 'number') return stringOrBuf.byteLength;
        if (stringOrBuf && typeof stringOrBuf.length === 'number') return stringOrBuf.length;
        throw new TypeError('The "string" argument must be of type string or an instance of Buffer or ArrayBuffer');
      }
      const enc = (encoding || 'utf8').toLowerCase();
      if (enc === 'utf8' || enc === 'utf-8') return utf8Encode(stringOrBuf).length;
      if (enc === 'ascii' || enc === 'latin1' || enc === 'binary') return stringOrBuf.length;
      if (enc === 'utf16le' || enc === 'utf-16le' || enc === 'ucs2' || enc === 'ucs-2') return stringOrBuf.length * 2;
      if (enc === 'hex') return stringOrBuf.length >>> 1;
      if (enc === 'base64' || enc === 'base64url') return base64Decode(stringOrBuf).length;
      return utf8Encode(stringOrBuf).length;
    }

    static compare(a, b) {
      if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
        throw new TypeError('Arguments must be Buffers or Uint8Arrays');
      }
      const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
      }
      if (a.length === b.length) return 0;
      return a.length < b.length ? -1 : 1;
    }

    fill(value, offset = 0, end = this.length, encoding = 'utf8') {
      if (typeof offset === 'string') {
        encoding = offset;
        offset = 0;
        end = this.length;
      } else if (typeof end === 'string') {
        encoding = end;
        end = this.length;
      }
      if (typeof value === 'number') {
        super.fill(value & 0xff, offset, end);
        return this;
      }
      const bytes = typeof value === 'string' ? VirtualBuffer.from(value, encoding) : value;
      if (!bytes || bytes.length === 0) {
        super.fill(0, offset, end);
        return this;
      }
      for (let i = offset; i < end; i++) {
        this[i] = bytes[(i - offset) % bytes.length];
      }
      return this;
    }

    subarray(start = 0, end = this.length) {
      const view = Uint8Array.prototype.subarray.call(this, start, end);
      Object.setPrototypeOf(view, VirtualBuffer.prototype);
      view._isVirtualBuffer = true;
      return view;
    }

    slice(start = 0, end = this.length) {
      // In Node.js Buffer.prototype.slice returns a mutable view sharing memory, identical to subarray
      return this.subarray(start, end);
    }

    compare(target, targetStart = 0, targetEnd = target.length, sourceStart = 0, sourceEnd = this.length) {
      const a = this.subarray(sourceStart, sourceEnd);
      const b = target.subarray(targetStart, targetEnd);
      return VirtualBuffer.compare(a, b);
    }

    equals(other) {
      if (!(other instanceof Uint8Array)) return false;
      if (this.length !== other.length) return false;
      return VirtualBuffer.compare(this, other) === 0;
    }

    copy(target, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
      if (sourceStart >= sourceEnd || targetStart >= target.length) return 0;
      const src = this.subarray(sourceStart, sourceEnd);
      const maxLen = Math.min(src.length, target.length - targetStart);
      target.set(src.subarray(0, maxLen), targetStart);
      return maxLen;
    }

    write(string, offset = 0, length = this.length - offset, encoding = 'utf8') {
      if (typeof offset === 'string') {
        encoding = offset;
        offset = 0;
        length = this.length;
      } else if (typeof length === 'string') {
        encoding = length;
        length = this.length - offset;
      }
      const bytes = VirtualBuffer.from(String(string), encoding);
      const n = Math.min(bytes.length, length, this.length - offset);
      if (n <= 0) return 0;
      this.set(bytes.subarray(0, n), offset);
      return n;
    }

    toString(encoding = 'utf8', start = 0, end = this.length) {
      if (start < 0) start = 0;
      if (end > this.length) end = this.length;
      if (start >= end) return '';
      const sub = Uint8Array.prototype.subarray.call(this, start, end);
      const enc = String(encoding || 'utf8').toLowerCase();
      if (enc === 'utf8' || enc === 'utf-8') return utf8Decode(sub);
      if (enc === 'hex') return hexEncode(sub);
      if (enc === 'base64') return base64Encode(sub, false);
      if (enc === 'base64url') return base64Encode(sub, true);
      if (enc === 'ascii' || enc === 'latin1' || enc === 'binary') {
        let s = '';
        for (let i = 0; i < sub.length; i++) s += String.fromCharCode(sub[i]);
        return s;
      }
      if (enc === 'utf16le' || enc === 'utf-16le' || enc === 'ucs2' || enc === 'ucs-2') {
        let s = '';
        for (let i = 0; i + 1 < sub.length; i += 2) {
          s += String.fromCharCode(sub[i] | (sub[i + 1] << 8));
        }
        return s;
      }
      return utf8Decode(sub);
    }

    toJSON() {
      return { type: 'Buffer', data: Array.from(this) };
    }

    _dv() {
      return new DataView(this.buffer, this.byteOffset, this.byteLength);
    }

    readUInt8(offset = 0) { return this._dv().getUint8(offset); }
    readUint8(offset = 0) { return this._dv().getUint8(offset); }
    readInt8(offset = 0) { return this._dv().getInt8(offset); }

    readUInt16BE(offset = 0) { return this._dv().getUint16(offset, false); }
    readUint16BE(offset = 0) { return this._dv().getUint16(offset, false); }
    readUInt16LE(offset = 0) { return this._dv().getUint16(offset, true); }
    readUint16LE(offset = 0) { return this._dv().getUint16(offset, true); }
    readInt16BE(offset = 0) { return this._dv().getInt16(offset, false); }
    readInt16LE(offset = 0) { return this._dv().getInt16(offset, true); }

    readUInt32BE(offset = 0) { return this._dv().getUint32(offset, false); }
    readUint32BE(offset = 0) { return this._dv().getUint32(offset, false); }
    readUInt32LE(offset = 0) { return this._dv().getUint32(offset, true); }
    readUint32LE(offset = 0) { return this._dv().getUint32(offset, true); }
    readInt32BE(offset = 0) { return this._dv().getInt32(offset, false); }
    readInt32LE(offset = 0) { return this._dv().getInt32(offset, true); }

    readBigUInt64BE(offset = 0) { return this._dv().getBigUint64(offset, false); }
    readBigUint64BE(offset = 0) { return this._dv().getBigUint64(offset, false); }
    readBigUInt64LE(offset = 0) { return this._dv().getBigUint64(offset, true); }
    readBigUint64LE(offset = 0) { return this._dv().getBigUint64(offset, true); }
    readBigInt64BE(offset = 0) { return this._dv().getBigInt64(offset, false); }
    readBigInt64LE(offset = 0) { return this._dv().getBigInt64(offset, true); }

    readFloatBE(offset = 0) { return this._dv().getFloat32(offset, false); }
    readFloatLE(offset = 0) { return this._dv().getFloat32(offset, true); }
    readDoubleBE(offset = 0) { return this._dv().getFloat64(offset, false); }
    readDoubleLE(offset = 0) { return this._dv().getFloat64(offset, true); }

    writeUInt8(value, offset = 0) { this._dv().setUint8(offset, Number(value)); return offset + 1; }
    writeUint8(value, offset = 0) { return this.writeUInt8(value, offset); }
    writeInt8(value, offset = 0) { this._dv().setInt8(offset, Number(value)); return offset + 1; }

    writeUInt16BE(value, offset = 0) { this._dv().setUint16(offset, Number(value), false); return offset + 2; }
    writeUint16BE(value, offset = 0) { return this.writeUInt16BE(value, offset); }
    writeUInt16LE(value, offset = 0) { this._dv().setUint16(offset, Number(value), true); return offset + 2; }
    writeUint16LE(value, offset = 0) { return this.writeUInt16LE(value, offset); }
    writeInt16BE(value, offset = 0) { this._dv().setInt16(offset, Number(value), false); return offset + 2; }
    writeInt16LE(value, offset = 0) { this._dv().setInt16(offset, Number(value), true); return offset + 2; }

    writeUInt32BE(value, offset = 0) { this._dv().setUint32(offset, Number(value) >>> 0, false); return offset + 4; }
    writeUint32BE(value, offset = 0) { return this.writeUInt32BE(value, offset); }
    writeUInt32LE(value, offset = 0) { this._dv().setUint32(offset, Number(value) >>> 0, true); return offset + 4; }
    writeUint32LE(value, offset = 0) { return this.writeUInt32LE(value, offset); }
    writeInt32BE(value, offset = 0) { this._dv().setInt32(offset, Number(value) | 0, false); return offset + 4; }
    writeInt32LE(value, offset = 0) { this._dv().setInt32(offset, Number(value) | 0, true); return offset + 4; }

    writeBigUInt64BE(value, offset = 0) { this._dv().setBigUint64(offset, BigInt(value), false); return offset + 8; }
    writeBigUint64BE(value, offset = 0) { return this.writeBigUInt64BE(value, offset); }
    writeBigUInt64LE(value, offset = 0) { this._dv().setBigUint64(offset, BigInt(value), true); return offset + 8; }
    writeBigUint64LE(value, offset = 0) { return this.writeBigUInt64LE(value, offset); }
    writeBigInt64BE(value, offset = 0) { this._dv().setBigInt64(offset, BigInt(value), false); return offset + 8; }
    writeBigInt64LE(value, offset = 0) { this._dv().setBigInt64(offset, BigInt(value), true); return offset + 8; }

    writeFloatBE(value, offset = 0) { this._dv().setFloat32(offset, Number(value), false); return offset + 4; }
    writeFloatLE(value, offset = 0) { this._dv().setFloat32(offset, Number(value), true); return offset + 4; }
    writeDoubleBE(value, offset = 0) { this._dv().setFloat64(offset, Number(value), false); return offset + 8; }
    writeDoubleLE(value, offset = 0) { this._dv().setFloat64(offset, Number(value), true); return offset + 8; }
  }

  // =========================================================================
  // 2. PURE JS CRYPTO (RFC 1321 MD5, FIPS 180-4 SHA-256, HMAC, UUID)
  // =========================================================================
  const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  const MD5_K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  function md5Raw(inputBytes) {
    const len = inputBytes.length;
    const bitLenLo = (len << 3) >>> 0;
    const bitLenHi = (len >>> 29) >>> 0;
    const padLen = ((len + 8) & ~63) + 64;
    const msg = new Uint8Array(padLen);
    msg.set(inputBytes);
    msg[len] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(padLen - 8, bitLenLo, true);
    dv.setUint32(padLen - 4, bitLenHi, true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    const M = new Uint32Array(16);
    for (let off = 0; off < padLen; off += 64) {
      for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) {
          F = (B & C) | (~B & D);
          g = i;
        } else if (i < 32) {
          F = (D & B) | (~D & C);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          F = B ^ C ^ D;
          g = (3 * i + 5) % 16;
        } else {
          F = C ^ (B | ~D);
          g = (7 * i) % 16;
        }
        F = (F + A + MD5_K[i] + M[g]) | 0;
        A = D;
        D = C;
        C = B;
        const s = MD5_S[i];
        B = (B + ((F << s) | (F >>> (32 - s)))) | 0;
      }
      a0 = (a0 + A) | 0;
      b0 = (b0 + B) | 0;
      c0 = (c0 + C) | 0;
      d0 = (d0 + D) | 0;
    }

    const out = VirtualBuffer.alloc(16);
    out.writeInt32LE(a0, 0);
    out.writeInt32LE(b0, 4);
    out.writeInt32LE(c0, 8);
    out.writeInt32LE(d0, 12);
    return out;
  }

  const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256Raw(inputBytes) {
    const len = inputBytes.length;
    const bitLenHi = Math.floor(len / 0x20000000);
    const bitLenLo = (len << 3) >>> 0;
    const padLen = ((len + 8) & ~63) + 64;
    const msg = new Uint8Array(padLen);
    msg.set(inputBytes);
    msg[len] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(padLen - 8, bitLenHi, false);
    dv.setUint32(padLen - 4, bitLenLo, false);

    let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

    const W = new Uint32Array(64);
    for (let off = 0; off < padLen; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4, false);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }

      let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H0 = (H0 + a) >>> 0;
      H1 = (H1 + b) >>> 0;
      H2 = (H2 + c) >>> 0;
      H3 = (H3 + d) >>> 0;
      H4 = (H4 + e) >>> 0;
      H5 = (H5 + f) >>> 0;
      H6 = (H6 + g) >>> 0;
      H7 = (H7 + h) >>> 0;
    }

    const out = VirtualBuffer.alloc(32);
    out.writeUInt32BE(H0, 0);
    out.writeUInt32BE(H1, 4);
    out.writeUInt32BE(H2, 8);
    out.writeUInt32BE(H3, 12);
    out.writeUInt32BE(H4, 16);
    out.writeUInt32BE(H5, 20);
    out.writeUInt32BE(H6, 24);
    out.writeUInt32BE(H7, 28);
    return out;
  }

  function sha1Raw(inputBytes) {
    const len = inputBytes.length;
    const bitLenHi = Math.floor(len / 0x20000000);
    const bitLenLo = (len << 3) >>> 0;
    const padLen = ((len + 8) & ~63) + 64;
    const msg = new Uint8Array(padLen);
    msg.set(inputBytes);
    msg[len] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(padLen - 8, bitLenHi, false);
    dv.setUint32(padLen - 4, bitLenLo, false);

    let H0 = 0x67452301, H1 = 0xefcdab89, H2 = 0x98badcfe, H3 = 0x10325476, H4 = 0xc3d2e1f0;
    const W = new Uint32Array(80);

    for (let off = 0; off < padLen; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4, false);
      for (let t = 16; t < 80; t++) {
        const x = W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16];
        W[t] = ((x << 1) | (x >>> 31)) >>> 0;
      }
      let a = H0, b = H1, c = H2, d = H3, e = H4;
      for (let t = 0; t < 80; t++) {
        let f, k;
        if (t < 20) {
          f = (b & c) | (~b & d);
          k = 0x5a827999;
        } else if (t < 40) {
          f = b ^ c ^ d;
          k = 0x6ed9eba1;
        } else if (t < 60) {
          f = (b & c) | (b & d) | (c & d);
          k = 0x8f1bbcdc;
        } else {
          f = b ^ c ^ d;
          k = 0xca62c1d6;
        }
        const temp = ((((a << 5) | (a >>> 27)) >>> 0) + (f >>> 0) + e + k + W[t]) >>> 0;
        e = d;
        d = c;
        c = ((b << 30) | (b >>> 2)) >>> 0;
        b = a;
        a = temp;
      }
      H0 = (H0 + a) >>> 0;
      H1 = (H1 + b) >>> 0;
      H2 = (H2 + c) >>> 0;
      H3 = (H3 + d) >>> 0;
      H4 = (H4 + e) >>> 0;
    }

    const out = VirtualBuffer.alloc(20);
    out.writeUInt32BE(H0, 0);
    out.writeUInt32BE(H1, 4);
    out.writeUInt32BE(H2, 8);
    out.writeUInt32BE(H3, 12);
    out.writeUInt32BE(H4, 16);
    return out;
  }

  function hashBytes(alg, bytes) {
    const a = String(alg).toLowerCase().replace('-', '');
    if (a === 'md5') return md5Raw(bytes);
    if (a === 'sha1') return sha1Raw(bytes);
    if (a === 'sha256') return sha256Raw(bytes);
    throw new Error(`Unsupported hash algorithm: ${alg}`);
  }

  class Hash {
    constructor(algorithm) {
      this.algorithm = algorithm;
      this.chunks = [];
      this.digested = false;
    }
    update(data, inputEncoding) {
      if (this.digested) throw new Error('Digest already called');
      const buf = typeof data === 'string'
        ? VirtualBuffer.from(data, inputEncoding || 'utf8')
        : VirtualBuffer.from(data);
      this.chunks.push(buf);
      return this;
    }
    digest(encoding) {
      if (this.digested) throw new Error('Digest already called');
      this.digested = true;
      const total = VirtualBuffer.concat(this.chunks);
      const res = hashBytes(this.algorithm, total);
      if (!encoding || encoding === 'buffer') return res;
      return res.toString(encoding);
    }
  }

  class Hmac {
    constructor(algorithm, key) {
      this.algorithm = algorithm;
      let keyBuf = typeof key === 'string' ? VirtualBuffer.from(key, 'utf8') : VirtualBuffer.from(key);
      const blockSize = 64;
      if (keyBuf.length > blockSize) {
        keyBuf = hashBytes(algorithm, keyBuf);
      }
      this.ipad = VirtualBuffer.alloc(blockSize, 0x36);
      this.opad = VirtualBuffer.alloc(blockSize, 0x5c);
      for (let i = 0; i < keyBuf.length; i++) {
        this.ipad[i] ^= keyBuf[i];
        this.opad[i] ^= keyBuf[i];
      }
      this.inner = new Hash(algorithm);
      this.inner.update(this.ipad);
      this.digested = false;
    }
    update(data, inputEncoding) {
      this.inner.update(data, inputEncoding);
      return this;
    }
    digest(encoding) {
      if (this.digested) throw new Error('Digest already called');
      this.digested = true;
      const innerDigest = this.inner.digest();
      const outer = new Hash(this.algorithm);
      outer.update(this.opad);
      outer.update(innerDigest);
      return outer.digest(encoding);
    }
  }

  const VirtualCrypto = {
    createHash(algorithm) {
      return new Hash(algorithm);
    },
    createHmac(algorithm, key) {
      return new Hmac(algorithm, key);
    },
    timingSafeEqual(a, b) {
      if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b)) {
        throw new TypeError('Input must be Buffer or TypedArray');
      }
      if (a.byteLength !== b.byteLength) {
        throw new RangeError('Input buffers must have the same byte length');
      }
      const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      const ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      let diff = 0;
      for (let i = 0; i < ua.length; i++) {
        diff |= ua[i] ^ ub[i];
      }
      return diff === 0;
    },
    randomBytes(size, cb) {
      const buf = VirtualBuffer.alloc(size);
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(buf);
      } else {
        for (let i = 0; i < size; i++) buf[i] = Math.floor(Math.random() * 256);
      }
      if (typeof cb === 'function') {
        queueMicrotask(() => cb(null, buf));
      }
      return buf;
    },
    randomUUID() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      const b = VirtualCrypto.randomBytes(16);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const hex = b.toString('hex');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
  };

  // =========================================================================
  // 3. PURE JS ZLIB (IEEE 802.3 CRC-32)
  // =========================================================================
  const CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      t[n] = c >>> 0;
    }
    return t;
  })();

  const VirtualZlib = {
    crc32(data, value = 0) {
      const bytes = typeof data === 'string'
        ? utf8Encode(data)
        : (data instanceof Uint8Array ? data : VirtualBuffer.from(data));
      let crc = (value >>> 0) ^ 0xffffffff;
      for (let i = 0; i < bytes.length; i++) {
        crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    },
    // The full Node zlib constant surface. Packages such as axios read these at
    // module-load time (e.g. `zlib.constants.Z_SYNC_FLUSH`) even when they never
    // actually compress, so a missing table breaks the whole module graph.
    constants: {
      Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4,
      Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1,
      Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_MEM_ERROR: -4, Z_BUF_ERROR: -5,
      Z_VERSION_ERROR: -6, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9,
      Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4,
      Z_DEFAULT_STRATEGY: 0, ZLIB_VERNUM: 0x1310, DEFLATE: 1, INFLATE: 2, GZIP: 3,
      GUNZIP: 4, DEFLATERAW: 5, INFLATERAW: 6, UNZIP: 7, BROTLI_DECODE: 8,
      BROTLI_ENCODE: 9, Z_MIN_WINDOWBITS: 8, Z_MAX_WINDOWBITS: 15,
      Z_DEFAULT_WINDOWBITS: 15, Z_MIN_CHUNK: 64, Z_MAX_CHUNK: Infinity,
      Z_DEFAULT_CHUNK: 16384, Z_MIN_MEMLEVEL: 1, Z_MAX_MEMLEVEL: 9,
      Z_DEFAULT_MEMLEVEL: 8, Z_MIN_LEVEL: -1, Z_MAX_LEVEL: 9, Z_DEFAULT_LEVEL: -1
    }
  };

  // Compression: delegate to the host's real zlib when the runtime is embedded in
  // Node (same process). In a pure browser worker there is no synchronous zlib, so
  // the async APIs use CompressionStream/DecompressionStream and the *Sync variants
  // throw a descriptive error instead of silently corrupting data.
  (() => {
    let hostZlib = null;
    try { hostZlib = (typeof require === 'function') ? require('zlib') : null; } catch (_) { hostZlib = null; }
    const names = [
      'gzip', 'gunzip', 'deflate', 'inflate', 'deflateRaw', 'inflateRaw', 'unzip',
      'gzipSync', 'gunzipSync', 'deflateSync', 'inflateSync', 'deflateRawSync', 'inflateRawSync', 'unzipSync',
      'createGzip', 'createGunzip', 'createDeflate', 'createInflate', 'createDeflateRaw', 'createInflateRaw'
    ];
    if (hostZlib) {
      for (const n of names) {
        if (typeof hostZlib[n] === 'function') VirtualZlib[n] = hostZlib[n].bind(hostZlib);
      }
      return;
    }
    const asyncVariant = (format, kind) => (data, optsOrCb, maybeCb) => {
      const cb = typeof optsOrCb === 'function' ? optsOrCb : (typeof maybeCb === 'function' ? maybeCb : null);
      const p = (async () => {
        if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') {
          throw new Error('zlib.' + kind + ' is not supported in this environment');
        }
        const decompress = /^(gunzip|unzip|inflate)/.test(kind);
        const stream = decompress ? new DecompressionStream(format) : new CompressionStream(format);
        const writer = stream.writable.getWriter();
        const input = data instanceof Uint8Array ? data : VirtualBuffer.from(data);
        writer.write(input);
        writer.close();
        const ab = await new Response(stream.readable).arrayBuffer();
        return VirtualBuffer.from(ab);
      })();
      if (cb) { p.then((out) => cb(null, out), (err) => cb(err)); return undefined; }
      return p;
    };
    VirtualZlib.gzip = asyncVariant('gzip', 'gzip');
    VirtualZlib.gunzip = asyncVariant('gzip', 'gunzip');
    VirtualZlib.unzip = asyncVariant('gzip', 'unzip');
    VirtualZlib.deflate = asyncVariant('deflate', 'deflate');
    VirtualZlib.inflate = asyncVariant('deflate', 'inflate');
    VirtualZlib.deflateRaw = asyncVariant('deflate-raw', 'deflateRaw');
    VirtualZlib.inflateRaw = asyncVariant('deflate-raw', 'inflateRaw');
    const unsupported = (kind) => () => { throw new Error('zlib.' + kind + ' is not supported in a browser worker (use the async API)'); };
    VirtualZlib.gzipSync = unsupported('gzipSync');
    VirtualZlib.gunzipSync = unsupported('gunzipSync');
    VirtualZlib.deflateSync = unsupported('deflateSync');
    VirtualZlib.inflateSync = unsupported('inflateSync');
    VirtualZlib.deflateRawSync = unsupported('deflateRawSync');
    VirtualZlib.inflateRawSync = unsupported('inflateRawSync');
    VirtualZlib.unzipSync = unsupported('unzipSync');
  })();

  // =========================================================================
  // 4. PATH & OS SHIMS
  // =========================================================================
  let _activeCwdGetter = () => '/workspace';

  const VirtualPath = {
    sep: '/',
    delimiter: ':',
    normalize(p) {
      if (typeof p !== 'string') throw new TypeError('Path must be a string');
      if (p.length === 0) return '.';
      const isAbs = p.startsWith('/');
      const trailingSlash = p.endsWith('/') && p.length > 1;
      const parts = p.split('/');
      const res = [];
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        if (!seg || seg === '.') continue;
        if (seg === '..') {
          if (res.length > 0 && res[res.length - 1] !== '..') {
            res.pop();
          } else if (!isAbs) {
            res.push('..');
          }
        } else {
          res.push(seg);
        }
      }
      let out = (isAbs ? '/' : '') + res.join('/');
      if (!out) out = isAbs ? '/' : '.';
      if (trailingSlash && out !== '/') out += '/';
      return out;
    },
    join(...segments) {
      if (segments.length === 0) return '.';
      const joined = segments.filter((s) => s !== '').join('/');
      return joined ? VirtualPath.normalize(joined) : '.';
    },
    resolve(...segments) {
      let resolved = '';
      for (let i = segments.length - 1; i >= 0 && !resolved.startsWith('/'); i--) {
        const seg = segments[i];
        if (!seg) continue;
        resolved = resolved ? `${seg}/${resolved}` : seg;
      }
      if (!resolved.startsWith('/')) {
        const baseCwd = typeof _activeCwdGetter === 'function' ? _activeCwdGetter() : '/workspace';
        resolved = `${baseCwd}/${resolved}`;
      }
      const norm = VirtualPath.normalize(resolved);
      return norm.length > 1 && norm.endsWith('/') ? norm.slice(0, -1) : norm;
    },
    relative(from, to) {
      const f = VirtualPath.resolve(from);
      const t = VirtualPath.resolve(to);
      if (f === t) return '';
      const fParts = f.split('/').filter(Boolean);
      const tParts = t.split('/').filter(Boolean);
      let common = 0;
      while (common < fParts.length && common < tParts.length && fParts[common] === tParts[common]) {
        common++;
      }
      const up = new Array(fParts.length - common).fill('..');
      return [...up, ...tParts.slice(common)].join('/');
    },
    dirname(p) {
      if (typeof p !== 'string') throw new TypeError('Path must be a string');
      if (p.length === 0) return '.';
      const clean = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
      const idx = clean.lastIndexOf('/');
      if (idx === -1) return '.';
      if (idx === 0) return '/';
      return clean.slice(0, idx);
    },
    basename(p, ext) {
      if (typeof p !== 'string') throw new TypeError('Path must be a string');
      const clean = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
      const idx = clean.lastIndexOf('/');
      let base = idx === -1 ? clean : clean.slice(idx + 1);
      if (ext && base.endsWith(ext)) {
        base = base.slice(0, base.length - ext.length);
      }
      return base;
    },
    extname(p) {
      const base = VirtualPath.basename(p);
      const idx = base.lastIndexOf('.');
      if (idx <= 0) return '';
      return base.slice(idx);
    },
    parse(p) {
      if (typeof p !== 'string') throw new TypeError('Path must be a string');
      const root = p.startsWith('/') ? '/' : '';
      const dir = p ? VirtualPath.dirname(p) : '';
      const base = p ? VirtualPath.basename(p) : '';
      const ext = p ? VirtualPath.extname(p) : '';
      const name = ext ? base.slice(0, base.length - ext.length) : base;
      return { root, dir: dir === '.' && !p.startsWith('./') ? '' : dir, base, ext, name };
    },
    format(pathObject) {
      if (!pathObject || typeof pathObject !== 'object') throw new TypeError('pathObject must be an object');
      const dir = pathObject.dir || pathObject.root || '';
      const base = pathObject.base || `${pathObject.name || ''}${pathObject.ext || ''}`;
      if (!dir) return base;
      return dir === pathObject.root ? `${dir}${base}` : `${dir}/${base}`;
    },
    isAbsolute(p) {
      return typeof p === 'string' && p.startsWith('/');
    }
  };
  VirtualPath.posix = VirtualPath;

  const VirtualOs = {
    tmpdir: () => '/tmp',
    EOL: '\n',
    platform: () => 'linux',
    arch: () => 'x64',
    homedir: () => '/home/user',
    hostname: () => 'code-lab-vm',
    cpus: () => [{ model: 'Virtual Code-Lab CPU', speed: 3200 }]
  };

  // =========================================================================
  // 5. VIRTUAL IN-MEMORY POSIX FILESYSTEM (node:fs)
  // =========================================================================
  function createVirtualFs(initialFiles = {}, vfsOptions = {}) {
    const dirs = new Set(['/', '/tmp', '/workspace', '/home', '/home/user']);
    const files = new Map();       // normalizedPath -> { data: Uint8Array, mtimeMs, ctimeMs, ino }
    const deletedInspectorCache = new Map(); // normalizedPath -> { data: Uint8Array, mtimeMs, deletedAtMs }
    const MAX_DELETED_CACHE_ENTRIES = 50;
    const MAX_DELETED_CACHE_FILE_BYTES = 65536;
    const customCwdGetter = typeof vfsOptions === 'function'
      ? vfsOptions
      : (vfsOptions && typeof vfsOptions.cwdGetter === 'function' ? vfsOptions.cwdGetter : null);
    const fdTable = new Map();     // fd -> { inode, path, flags, pos, isDirectory }
    let nextFd = 10;
    let nextIno = 100;
    let mkdtempCounter = 1;

    function recordDeletedForInspector(p, data, mtimeMs) {
      if (!data || data.byteLength <= 0 || data.byteLength > MAX_DELETED_CACHE_FILE_BYTES) return;
      if (deletedInspectorCache.has(p)) {
        deletedInspectorCache.delete(p);
      } else if (deletedInspectorCache.size >= MAX_DELETED_CACHE_ENTRIES) {
        const oldestKey = deletedInspectorCache.keys().next().value;
        if (oldestKey !== undefined) deletedInspectorCache.delete(oldestKey);
      }
      deletedInspectorCache.set(p, { data: data.slice(), mtimeMs, deletedAtMs: Date.now() });
    }

    function normPath(p) {
      if (typeof p !== 'string' || !p) {
        const err = new TypeError('path must be a non-empty string');
        err.code = 'ERR_INVALID_ARG_TYPE';
        throw err;
      }
      const baseCwd = typeof customCwdGetter === 'function'
        ? customCwdGetter()
        : (typeof _activeCwdGetter === 'function' ? _activeCwdGetter() : '/workspace');
      const abs = p.startsWith('/') ? VirtualPath.normalize(p) : VirtualPath.resolve(baseCwd, p);
      return abs.length > 1 && abs.endsWith('/') ? abs.slice(0, -1) : abs;
    }

    function fsError(code, syscall, p, msg) {
      const err = new Error(`${code}: ${msg || code}, ${syscall} '${p}'`);
      err.code = code;
      err.syscall = syscall;
      err.path = p;
      return err;
    }

    function ensureParentDirs(absPath) {
      const parts = absPath.split('/').filter(Boolean);
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur += '/' + parts[i];
        dirs.add(cur);
      }
    }

    function makeStats(size, mtimeMs, isDir, ino = 1, mode = null) {
      const d = new Date(mtimeMs);
      const defaultMode = isDir ? 0o40755 : 0o100644;
      return {
        size,
        ino,
        mode: mode !== null && mode !== undefined ? mode : defaultMode,
        mtimeMs,
        ctimeMs: mtimeMs,
        atimeMs: mtimeMs,
        birthtimeMs: mtimeMs,
        mtime: d,
        ctime: d,
        atime: d,
        birthtime: d,
        isFile: () => !isDir,
        isDirectory: () => isDir,
        isSymbolicLink: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false
      };
    }

    // Seed initial project files into /workspace (preserving system paths like /usr, /tmp, /lib, /include)
    for (const [relPath, content] of Object.entries(initialFiles)) {
      const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
      const isSystemPath = /^\/(workspace|usr|tmp|lib|include|etc|bin|dev)(\/|$)/.test(relPath);
      let fullPath = isSystemPath
        ? normPath(relPath)
        : normPath(`/workspace/${cleanRel}`);
      if (!isSystemPath && fullPath !== '/workspace' && !fullPath.startsWith('/workspace/')) {
        const safeSub = cleanRel.split('/').filter((seg) => seg && seg !== '.' && seg !== '..').join('/');
        fullPath = normPath(`/workspace/${safeSub || 'file'}`);
      }
      ensureParentDirs(fullPath);
      const bytes = typeof content === 'string' ? utf8Encode(content) : new Uint8Array(content);
      files.set(fullPath, {
        data: bytes,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
        ino: nextIno++,
        mode: 0o100644,
        isInitialProjectFile: !/^\/(usr|tmp|lib|include|etc|bin|dev)(\/|$)/.test(fullPath)
      });
    }

    const fsShim = {
      existsSync(p) {
        try {
          const np = normPath(p);
          return dirs.has(np) || files.has(np);
        } catch (_) {
          return false;
        }
      },

      mkdirSync(p, opts) {
        const np = normPath(p);
        const recursive = typeof opts === 'object' && opts !== null ? Boolean(opts.recursive) : Boolean(opts);
        if (files.has(np)) throw fsError('EEXIST', 'mkdir', p, 'file already exists');
        if (dirs.has(np)) {
          if (recursive) return undefined;
          throw fsError('EEXIST', 'mkdir', p, 'directory already exists');
        }
        const parent = VirtualPath.dirname(np);
        if (!dirs.has(parent)) {
          if (!recursive) throw fsError('ENOENT', 'mkdir', p, 'no such file or directory');
          ensureParentDirs(np + '/placeholder');
        }
        dirs.add(np);
        return np;
      },

      mkdtempSync(prefix) {
        if (typeof prefix !== 'string') throw new TypeError('filename prefix is required');
        const id = String(mkdtempCounter++).padStart(4, '0') + Math.random().toString(36).slice(2, 4);
        const dirPath = normPath(`${prefix}${id}`);
        ensureParentDirs(dirPath + '/placeholder');
        dirs.add(dirPath);
        return dirPath;
      },

      readdirSync(p, opts) {
        const np = normPath(p);
        if (!dirs.has(np)) {
          if (files.has(np)) throw fsError('ENOTDIR', 'scandir', p, 'not a directory');
          throw fsError('ENOENT', 'scandir', p, 'no such file or directory');
        }
        const prefix = np === '/' ? '/' : np + '/';
        const children = new Map(); // name -> isDir
        for (const d of dirs) {
          if (d !== np && d.startsWith(prefix)) {
            const rest = d.slice(prefix.length);
            const first = rest.split('/')[0];
            if (first) children.set(first, true);
          }
        }
        for (const f of files.keys()) {
          if (f.startsWith(prefix)) {
            const rest = f.slice(prefix.length);
            if (!rest.includes('/')) children.set(rest, false);
          }
        }
        const names = Array.from(children.keys()).sort();
        if (opts && typeof opts === 'object' && opts.withFileTypes) {
          return names.map((name) => {
            const isDir = children.get(name);
            return {
              name,
              isFile: () => !isDir,
              isDirectory: () => isDir,
              isSymbolicLink: () => false
            };
          });
        }
        return names;
      },

      statSync(p) {
        const np = normPath(p);
        if (dirs.has(np)) return makeStats(0, Date.now(), true, 1, 0o40755);
        const f = files.get(np);
        if (f) return makeStats(f.data.byteLength, f.mtimeMs, false, f.ino, f.mode !== undefined ? f.mode : 0o100644);
        throw fsError('ENOENT', 'stat', p, 'no such file or directory');
      },

      lstatSync(p) {
        return fsShim.statSync(p);
      },

      fstatSync(fd) {
        const entry = fdTable.get(fd);
        if (!entry) throw fsError('EBADF', 'fstat', String(fd), 'bad file descriptor');
        if (entry.isDirectory) return makeStats(0, Date.now(), true, 1, 0o40755);
        return makeStats(entry.inode.data.byteLength, entry.inode.mtimeMs, false, entry.inode.ino, entry.inode.mode !== undefined ? entry.inode.mode : 0o100644);
      },

      openSync(p, flags = 'r', mode = 0o666) {
        const np = normPath(p);
        const flagStr = String(flags || 'r');
        if (dirs.has(np)) {
          if (flagStr === 'r') {
            const fd = nextFd++;
            fdTable.set(fd, { inode: null, path: np, flags: flagStr, pos: 0, isDirectory: true });
            return fd;
          }
          throw fsError('EISDIR', 'open', p, 'illegal operation on a directory');
        }

        let inode = files.get(np);
        if (flagStr.includes('x') && inode) {
          throw fsError('EEXIST', 'open', p, 'file already exists');
        }
        if (flagStr.startsWith('r') && !flagStr.includes('c')) {
          if (!inode) throw fsError('ENOENT', 'open', p, 'no such file or directory');
        } else if (flagStr.startsWith('w')) {
          const parent = VirtualPath.dirname(np);
          if (!dirs.has(parent)) throw fsError('ENOENT', 'open', p, 'no such file or directory');
          if (!inode) {
            inode = { data: new Uint8Array(0), mtimeMs: Date.now(), ctimeMs: Date.now(), ino: nextIno++, mode: 0o100000 | (Number(mode) & 0o777) };
            files.set(np, inode);
          } else {
            inode.data = new Uint8Array(0);
            inode.mtimeMs = Date.now();
          }
        } else if (flagStr.startsWith('a') || flagStr.includes('c')) {
          const parent = VirtualPath.dirname(np);
          if (!dirs.has(parent)) throw fsError('ENOENT', 'open', p, 'no such file or directory');
          if (!inode) {
            inode = { data: new Uint8Array(0), mtimeMs: Date.now(), ctimeMs: Date.now(), ino: nextIno++, mode: 0o100000 | (Number(mode) & 0o777) };
            files.set(np, inode);
          }
        }

        const fd = nextFd++;
        fdTable.set(fd, {
          inode,
          path: np,
          flags: flagStr,
          pos: flagStr.startsWith('a') ? inode.data.byteLength : 0,
          isDirectory: false
        });
        return fd;
      },

      lseekSync(fd, offset, whence = 0) {
        const entry = fdTable.get(fd);
        if (!entry || entry.isDirectory) throw fsError('EBADF', 'lseek', String(fd), 'bad file descriptor');
        const off = Number(offset) || 0;
        let nextPos = entry.pos;
        if (whence === 0) nextPos = off; // SEEK_SET
        else if (whence === 1) nextPos = entry.pos + off; // SEEK_CUR
        else if (whence === 2) nextPos = (entry.inode ? entry.inode.data.byteLength : 0) + off; // SEEK_END
        else throw fsError('EINVAL', 'lseek', String(fd), 'invalid whence');
        if (nextPos < 0) throw fsError('EINVAL', 'lseek', String(fd), 'negative seek offset');
        entry.pos = nextPos;
        return entry.pos;
      },

      tellSync(fd) {
        const entry = fdTable.get(fd);
        if (!entry || entry.isDirectory) throw fsError('EBADF', 'tell', String(fd), 'bad file descriptor');
        return entry.pos;
      },

      closeSync(fd) {
        if (!fdTable.has(fd)) throw fsError('EBADF', 'close', String(fd), 'bad file descriptor');
        fdTable.delete(fd);
      },

      fsyncSync(fd) {
        const entry = fdTable.get(fd);
        if (!entry) throw fsError('EBADF', 'fsync', String(fd), 'bad file descriptor');
      },

      fdatasyncSync(fd) {
        return fsShim.fsyncSync(fd);
      },

      writeSync(fd, bufOrStr, offsetOrPosition, length, position) {
        const entry = fdTable.get(fd);
        if (!entry || entry.isDirectory) throw fsError('EBADF', 'write', String(fd), 'bad file descriptor');
        let chunk;
        let explicitPos = null;
        if (typeof bufOrStr === 'string') {
          const enc = typeof length === 'string' ? length : 'utf8';
          chunk = VirtualBuffer.from(bufOrStr, enc);
          if (typeof offsetOrPosition === 'number') explicitPos = offsetOrPosition;
        } else {
          const src = bufOrStr instanceof Uint8Array
            ? bufOrStr
            : VirtualBuffer.from(bufOrStr);
          const off = typeof offsetOrPosition === 'number' ? offsetOrPosition : 0;
          const len = typeof length === 'number' ? length : src.byteLength - off;
          if (typeof position === 'number') explicitPos = position;
          chunk = src.subarray(off, off + len);
        }

        const inode = entry.inode;
        const writePos = entry.flags.startsWith('a')
          ? inode.data.byteLength
          : (explicitPos !== null ? explicitPos : entry.pos);

        const needed = writePos + chunk.byteLength;
        if (needed > inode.data.byteLength) {
          const grown = new Uint8Array(needed);
          grown.set(inode.data, 0);
          inode.data = grown;
        }
        inode.data.set(chunk, writePos);
        inode.mtimeMs = Date.now();
        entry.pos = writePos + chunk.byteLength;

        return chunk.byteLength;
      },

      readSync(fd, buffer, offset = 0, length = buffer.byteLength - offset, position = null) {
        const entry = fdTable.get(fd);
        if (!entry || entry.isDirectory) throw fsError('EBADF', 'read', String(fd), 'bad file descriptor');
        const inode = entry.inode;
        const readPos = (position !== null && position !== undefined) ? position : entry.pos;
        if (readPos >= inode.data.byteLength || length <= 0) return 0;
        const avail = Math.min(length, inode.data.byteLength - readPos);
        buffer.set(inode.data.subarray(readPos, readPos + avail), offset);
        if (position === null || position === undefined) {
          entry.pos = readPos + avail;
        }
        return avail;
      },

      readFileSync(p, opts) {
        const np = normPath(p);
        if (dirs.has(np)) throw fsError('EISDIR', 'read', p, 'illegal operation on a directory');
        const inode = files.get(np);
        if (!inode) throw fsError('ENOENT', 'open', p, 'no such file or directory');
        const buf = VirtualBuffer.alloc(inode.data.byteLength);
        buf.set(inode.data);
        const encoding = typeof opts === 'string' ? opts : (opts && opts.encoding);
        return encoding ? buf.toString(encoding) : buf;
      },

      writeFileSync(p, data, opts) {
        const np = normPath(p);
        if (dirs.has(np)) throw fsError('EISDIR', 'open', p, 'illegal operation on a directory');
        const parent = VirtualPath.dirname(np);
        if (!dirs.has(parent)) throw fsError('ENOENT', 'open', p, 'no such file or directory');
        const encoding = typeof opts === 'string' ? opts : (opts && opts.encoding) || 'utf8';
        const bytes = typeof data === 'string'
          ? utf8Encode(data)
          : (data instanceof Uint8Array ? data.slice() : new Uint8Array( VirtualBuffer.from(String(data), encoding) ));
        let inode = files.get(np);
        if (!inode) {
          const modeVal = (opts && typeof opts === 'object' && opts.mode !== undefined)
            ? (0o100000 | (Number(opts.mode) & 0o777))
            : 0o100644;
          inode = { data: bytes, mtimeMs: Date.now(), ctimeMs: Date.now(), ino: nextIno++, mode: modeVal };
          files.set(np, inode);
        } else {
          inode.data = bytes;
          inode.mtimeMs = Date.now();
          if (opts && typeof opts === 'object' && opts.mode !== undefined) {
            inode.mode = 0o100000 | (Number(opts.mode) & 0o777);
          }
        }
        deletedInspectorCache.delete(np);
      },

      chmodSync(p, mode) {
        const np = normPath(p);
        const parsedMode = typeof mode === 'string' ? parseInt(mode, 8) : Number(mode);
        if (dirs.has(np)) return;
        const f = files.get(np);
        if (!f) throw fsError('ENOENT', 'chmod', p, 'no such file or directory');
        const currentType = (f.mode !== undefined ? f.mode : 0o100644) & ~0o777;
        f.mode = currentType | (parsedMode & 0o777);
      },

      appendFileSync(p, data, opts) {
        const np = normPath(p);
        const encoding = typeof opts === 'string' ? opts : (opts && opts.encoding) || 'utf8';
        const chunk = typeof data === 'string'
          ? utf8Encode(data)
          : (data instanceof Uint8Array ? data : new Uint8Array(VirtualBuffer.from(String(data), encoding)));
        let inode = files.get(np);
        if (!inode) {
          fsShim.writeFileSync(np, chunk, opts);
          return;
        }
        const combined = new Uint8Array(inode.data.byteLength + chunk.byteLength);
        combined.set(inode.data, 0);
        combined.set(chunk, inode.data.byteLength);
        inode.data = combined;
        inode.mtimeMs = Date.now();
        deletedInspectorCache.delete(np);
      },

      truncateSync(p, len = 0) {
        const np = normPath(p);
        const inode = files.get(np);
        if (!inode) throw fsError('ENOENT', 'truncate', p, 'no such file or directory');
        const nextLen = Math.max(0, Number(len) || 0);
        if (nextLen <= inode.data.byteLength) {
          inode.data = inode.data.slice(0, nextLen);
        } else {
          const grown = new Uint8Array(nextLen);
          grown.set(inode.data, 0);
          inode.data = grown;
        }
        inode.mtimeMs = Date.now();
      },

      renameSync(oldP, newP) {
        const src = normPath(oldP);
        const dst = normPath(newP);
        if (dirs.has(src)) {
          if (src === dst) return;
          if (dst.startsWith(src + '/')) {
            throw fsError('EINVAL', 'rename', oldP, 'cannot move an ancestor to child');
          }
          if (files.has(dst)) {
            throw fsError('ENOTDIR', 'rename', newP, 'not a directory');
          }
          if (dirs.has(dst)) {
            const hasChildren = Array.from(dirs).some(d => d !== dst && d.startsWith(dst + '/')) ||
              Array.from(files.keys()).some(f => f.startsWith(dst + '/'));
            if (hasChildren) {
              throw fsError('ENOTEMPTY', 'rename', newP, 'directory not empty');
            }
            dirs.delete(dst);
          }
          ensureParentDirs(dst);
          dirs.delete(src);
          dirs.add(dst);

          const srcPrefix = src + '/';
          const dstPrefix = dst + '/';
          const dirsToRename = [];
          for (const d of dirs) {
            if (d.startsWith(srcPrefix)) dirsToRename.push(d);
          }
          for (const d of dirsToRename) {
            dirs.delete(d);
            dirs.add(dstPrefix + d.slice(srcPrefix.length));
          }

          const filesToRename = [];
          for (const [p, fileNode] of files.entries()) {
            if (p.startsWith(srcPrefix)) filesToRename.push([p, fileNode]);
          }
          for (const [p, fileNode] of filesToRename) {
            files.delete(p);
            const newPath = dstPrefix + p.slice(srcPrefix.length);
            files.set(newPath, fileNode);
            for (const fdEntry of fdTable.values()) {
              if (fdEntry.path === p) fdEntry.path = newPath;
            }
          }
          return;
        }

        const inode = files.get(src);
        if (!inode) throw fsError('ENOENT', 'rename', oldP, 'no such file or directory');
        ensureParentDirs(dst);
        files.set(dst, inode);
        files.delete(src);
        for (const fdEntry of fdTable.values()) {
          if (fdEntry.path === src) fdEntry.path = dst;
        }
        deletedInspectorCache.delete(src);
        deletedInspectorCache.delete(dst);
      },

      unlinkSync(p) {
        const np = normPath(p);
        const inode = files.get(np);
        if (!inode) throw fsError('ENOENT', 'unlink', p, 'no such file or directory');
        recordDeletedForInspector(np, inode.data, inode.mtimeMs);
        files.delete(np);
      },

      rmSync(p, opts = {}) {
        const np = normPath(p);
        const recursive = Boolean(opts && opts.recursive);
        const force = Boolean(opts && opts.force);
        if (files.has(np)) {
          fsShim.unlinkSync(np);
          return;
        }
        if (dirs.has(np)) {
          const prefix = np === '/' ? '/' : np + '/';
          for (const [fPath, inode] of Array.from(files.entries())) {
            if (fPath.startsWith(prefix)) {
              if (!recursive) throw fsError('ENOTEMPTY', 'rm', p, 'directory not empty');
              recordDeletedForInspector(fPath, inode.data, inode.mtimeMs);
              files.delete(fPath);
            }
          }
          for (const dPath of Array.from(dirs)) {
            if (dPath === np || dPath.startsWith(prefix)) {
              if (dPath !== '/' && dPath !== '/tmp' && dPath !== '/workspace') {
                dirs.delete(dPath);
              }
            }
          }
          return;
        }
        if (!force) throw fsError('ENOENT', 'rm', p, 'no such file or directory');
      },

      rmdirSync(p, opts = {}) {
        return fsShim.rmSync(p, { ...opts, recursive: Boolean(opts && opts.recursive) });
      },

      accessSync(p) {
        const np = normPath(p);
        if (!dirs.has(np) && !files.has(np)) {
          throw fsError('ENOENT', 'access', p, 'no such file or directory');
        }
      },

      realpathSync(p) {
        const np = normPath(p);
        if (!dirs.has(np) && !files.has(np)) {
          throw fsError('ENOENT', 'realpath', p, 'no such file or directory');
        }
        return np;
      },

      copyFileSync(src, dest, mode = 0) {
        const srcNorm = normPath(src);
        const destNorm = normPath(dest);
        if (dirs.has(srcNorm)) throw fsError('EISDIR', 'copyfile', src, 'illegal operation on a directory');
        const srcInode = files.get(srcNorm);
        if (!srcInode) throw fsError('ENOENT', 'copyfile', src, 'no such file or directory');
        if (dirs.has(destNorm)) throw fsError('EISDIR', 'copyfile', dest, 'illegal operation on a directory');
        if ((mode & 1) && files.has(destNorm)) {
          throw fsError('EEXIST', 'copyfile', dest, 'file already exists');
        }
        fsShim.writeFileSync(destNorm, srcInode.data.slice());
      },

      createReadStream(p, opts = {}) {
        if (typeof opts === 'string') opts = { encoding: opts };
        const np = normPath(p);
        const start = typeof opts.start === 'number' ? opts.start : 0;
        const end = typeof opts.end === 'number' ? opts.end : Infinity;
        const highWaterMark = opts.highWaterMark || 16384;
        const stream = new Readable({ encoding: opts.encoding || null });
        stream.path = np;
        stream.bytesRead = 0;
        queueMicrotask(() => {
          if (stream.destroyed) return;
          if (dirs.has(np)) {
            stream.destroy(fsError('EISDIR', 'read', p, 'illegal operation on a directory'));
            return;
          }
          const inode = files.get(np);
          if (!inode) {
            stream.destroy(fsError('ENOENT', 'open', p, 'no such file or directory'));
            return;
          }
          stream.emit('open', 100);
          stream.emit('ready');
          const upper = Math.min(inode.data.byteLength, Number.isFinite(end) ? end + 1 : inode.data.byteLength);
          const slice = inode.data.subarray(Math.max(0, start), Math.max(0, upper));
          for (let off = 0; off < slice.byteLength; off += highWaterMark) {
            if (stream.destroyed) return;
            const chunk = VirtualBuffer.from(slice.subarray(off, Math.min(slice.byteLength, off + highWaterMark)));
            stream.bytesRead += chunk.byteLength;
            stream.push(chunk);
          }
          if (!stream.destroyed) stream.push(null);
        });
        return stream;
      },

      createWriteStream(p, opts = {}) {
        if (typeof opts === 'string') opts = { encoding: opts };
        const np = normPath(p);
        const flags = (opts && opts.flags) || 'w';
        let fd = null;
        let openErr = null;
        try {
          fd = fsShim.openSync(np, flags);
        } catch (err) {
          openErr = err;
        }
        const stream = new Writable({
          write(chunk, encoding, cb) {
            if (openErr) return cb(openErr);
            try {
              const buf = typeof chunk === 'string'
                ? VirtualBuffer.from(chunk, encoding || (opts && opts.encoding) || 'utf8')
                : VirtualBuffer.from(chunk);
              const written = fsShim.writeSync(fd, buf, 0, buf.byteLength);
              stream.bytesWritten += written;
              cb(null);
            } catch (err) {
              cb(err);
            }
          },
          final(cb) {
            if (fd !== null) {
              try { fsShim.closeSync(fd); } catch (err) { _runtimeLogger.debug('vfs writeStream closeSync failed', err); }
              fd = null;
            }
            cb(null);
          }
        });
        stream.path = np;
        stream.bytesWritten = 0;
        queueMicrotask(() => {
          if (openErr) {
            stream.destroy(openErr);
          } else {
            stream.emit('open', fd);
            stream.emit('ready');
          }
        });
        return stream;
      },

      constants: {
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1,
        COPYFILE_EXCL: 1,
        COPYFILE_FICLONE: 2,
        COPYFILE_FICLONE_FORCE: 4
      },

      getSnapshot() {
        const items = [];
        const formatPreview = (bytes) => {
          const slice = bytes.subarray(0, 256);
          let printable = 0;
          for (let i = 0; i < slice.length; i++) {
            const b = slice[i];
            if ((b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13) printable++;
          }
          const isMostlyText = slice.length === 0 || (printable / slice.length) >= 0.75;
          const textPreview = isMostlyText ? utf8Decode(bytes.subarray(0, 512)) : null;
          const hexParts = [];
          const hexLen = Math.min(bytes.length, 64);
          for (let i = 0; i < hexLen; i++) {
            hexParts.push(bytes[i].toString(16).padStart(2, '0'));
          }
          return {
            isBinary: !isMostlyText,
            preview: textPreview,
            hexPreview: hexParts.join(' ') + (bytes.length > 64 ? ' …' : '')
          };
        };

        for (const [fPath, inode] of files.entries()) {
          const { isBinary, preview, hexPreview } = formatPreview(inode.data);
          items.push({
            path: fPath,
            size: inode.data.byteLength,
            mtimeMs: inode.mtimeMs,
            isDirectory: false,
            deleted: false,
            isInitialProjectFile: Boolean(inode.isInitialProjectFile),
            isBinary,
            preview,
            hexPreview
          });
        }

        // Include non-empty runtime artifacts in /tmp that were created during execution and cleaned up on exit
        for (const [fPath, cached] of deletedInspectorCache.entries()) {
          if (!files.has(fPath) && !fPath.endsWith('.tmp') && cached.data.byteLength > 0) {
            const { isBinary, preview, hexPreview } = formatPreview(cached.data);
            items.push({
              path: fPath,
              size: cached.data.byteLength,
              mtimeMs: cached.mtimeMs,
              isDirectory: false,
              deleted: true,
              isInitialProjectFile: false,
              isBinary,
              preview,
              hexPreview
            });
          }
        }

        items.sort((a, b) => a.path.localeCompare(b.path));
        return items;
      }
    };

    fsShim.realpathSync.native = fsShim.realpathSync;

    // Callback-based async wrappers
    const wrapAsyncCb = (syncFn) => (...args) => {
      const cb = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
      queueMicrotask(() => {
        try {
          const res = syncFn(...args);
          cb(null, res);
        } catch (err) {
          cb(err);
        }
      });
    };

    fsShim.exists = (p, cb) => queueMicrotask(() => (typeof cb === 'function' ? cb(fsShim.existsSync(p)) : undefined));
    fsShim.readFile = wrapAsyncCb(fsShim.readFileSync);
    fsShim.writeFile = wrapAsyncCb(fsShim.writeFileSync);
    fsShim.appendFile = wrapAsyncCb(fsShim.appendFileSync);
    fsShim.mkdir = wrapAsyncCb(fsShim.mkdirSync);
    fsShim.mkdtemp = wrapAsyncCb(fsShim.mkdtempSync);
    fsShim.readdir = wrapAsyncCb(fsShim.readdirSync);
    fsShim.stat = wrapAsyncCb(fsShim.statSync);
    fsShim.lstat = wrapAsyncCb(fsShim.lstatSync);
    fsShim.fstat = wrapAsyncCb(fsShim.fstatSync);
    fsShim.unlink = wrapAsyncCb(fsShim.unlinkSync);
    fsShim.rm = wrapAsyncCb(fsShim.rmSync);
    fsShim.rmdir = wrapAsyncCb(fsShim.rmdirSync);
    fsShim.rename = wrapAsyncCb(fsShim.renameSync);
    fsShim.truncate = wrapAsyncCb(fsShim.truncateSync);
    fsShim.access = wrapAsyncCb(fsShim.accessSync);
    fsShim.copyFile = wrapAsyncCb(fsShim.copyFileSync);
    fsShim.realpath = wrapAsyncCb(fsShim.realpathSync);
    fsShim.chmod = wrapAsyncCb(fsShim.chmodSync);
    fsShim.open = wrapAsyncCb(fsShim.openSync);
    fsShim.close = wrapAsyncCb(fsShim.closeSync);
    fsShim.fsync = wrapAsyncCb(fsShim.fsyncSync);
    fsShim.fdatasync = wrapAsyncCb(fsShim.fdatasyncSync);
    fsShim.read = (fd, buffer, offset, length, position, cb) => {
      if (typeof position === 'function') { cb = position; position = null; }
      queueMicrotask(() => {
        try {
          const bytesRead = fsShim.readSync(fd, buffer, offset, length, position);
          if (typeof cb === 'function') cb(null, bytesRead, buffer);
        } catch (err) {
          if (typeof cb === 'function') cb(err);
        }
      });
    };
    fsShim.write = (fd, buffer, offset, length, position, cb) => {
      if (typeof offset === 'function') { cb = offset; offset = undefined; }
      else if (typeof length === 'function') { cb = length; length = undefined; }
      else if (typeof position === 'function') { cb = position; position = undefined; }
      queueMicrotask(() => {
        try {
          const bytesWritten = fsShim.writeSync(fd, buffer, offset, length, position);
          if (typeof cb === 'function') cb(null, bytesWritten, buffer);
        } catch (err) {
          if (typeof cb === 'function') cb(err);
        }
      });
    };

    class VirtualFileHandle {
      constructor(fd, path) {
        this.fd = fd;
        this.path = path;
        this._closed = false;
      }
      async read(bufferOrOpts, offset, length, position) {
        let buffer = bufferOrOpts;
        if (bufferOrOpts && typeof bufferOrOpts === 'object' && !ArrayBuffer.isView(bufferOrOpts)) {
          buffer = bufferOrOpts.buffer || VirtualBuffer.alloc(bufferOrOpts.length || 16384);
          offset = bufferOrOpts.offset ?? 0;
          length = bufferOrOpts.length ?? (buffer.byteLength - offset);
          position = bufferOrOpts.position ?? null;
        } else if (!buffer) {
          buffer = VirtualBuffer.alloc(16384);
          offset = 0;
          length = buffer.byteLength;
          position = null;
        }
        if (offset === undefined) offset = 0;
        if (length === undefined) length = buffer.byteLength - offset;
        const bytesRead = fsShim.readSync(this.fd, buffer, offset, length, position);
        return { bytesRead, buffer };
      }
      async write(bufOrStr, offsetOrPos, lengthOrEnc, position) {
        const bytesWritten = fsShim.writeSync(this.fd, bufOrStr, offsetOrPos, lengthOrEnc, position);
        return { bytesWritten, buffer: bufOrStr };
      }
      async readFile(opts) {
        return fsShim.readFileSync(this.path, opts);
      }
      async writeFile(data, opts) {
        return fsShim.writeFileSync(this.path, data, opts);
      }
      async stat() {
        return fsShim.fstatSync(this.fd);
      }
      async truncate(len = 0) {
        return fsShim.truncateSync(this.path, len);
      }
      async sync() {
        return fsShim.fsyncSync(this.fd);
      }
      async datasync() {
        return fsShim.fdatasyncSync(this.fd);
      }
      async close() {
        if (!this._closed) {
          this._closed = true;
          fsShim.closeSync(this.fd);
        }
      }
    }

    const fsPromises = {
      constants: fsShim.constants,
      FileHandle: VirtualFileHandle,
      access: async (p, mode) => fsShim.accessSync(p, mode),
      chmod: async (p, mode) => fsShim.chmodSync(p, mode),
      copyFile: async (src, dest, mode) => fsShim.copyFileSync(src, dest, mode),
      open: async (p, flags = 'r') => {
        const np = normPath(p);
        const fd = fsShim.openSync(np, flags);
        return new VirtualFileHandle(fd, np);
      },
      readFile: async (p, opts) => {
        if (p instanceof VirtualFileHandle) return p.readFile(opts);
        return fsShim.readFileSync(p, opts);
      },
      writeFile: async (p, data, opts) => {
        if (p instanceof VirtualFileHandle) return p.writeFile(data, opts);
        return fsShim.writeFileSync(p, data, opts);
      },
      appendFile: async (p, data, opts) => fsShim.appendFileSync(p, data, opts),
      mkdir: async (p, opts) => fsShim.mkdirSync(p, opts),
      mkdtemp: async (prefix) => fsShim.mkdtempSync(prefix),
      readdir: async (p, opts) => fsShim.readdirSync(p, opts),
      stat: async (p) => fsShim.statSync(p),
      lstat: async (p) => fsShim.lstatSync(p),
      unlink: async (p) => fsShim.unlinkSync(p),
      rm: async (p, opts) => fsShim.rmSync(p, opts),
      rmdir: async (p, opts) => fsShim.rmdirSync(p, opts),
      rename: async (oldP, newP) => fsShim.renameSync(oldP, newP),
      truncate: async (p, len) => fsShim.truncateSync(p, len),
      realpath: async (p) => fsShim.realpathSync(p)
    };

    fsShim.promises = fsPromises;

    return fsShim;
  }

  // =========================================================================
  // 5B. EVENT EMITTER (node:events), UTIL (node:util), URL, QUERYSTRING, STREAM
  // =========================================================================
  class EventEmitter {
    constructor() {
      this._events = new Map();
      this._maxListeners = EventEmitter.defaultMaxListeners;
    }
    _ensureMap() {
      if (!this._events) this._events = new Map();
      return this._events;
    }
    setMaxListeners(n) {
      this._maxListeners = Number(n);
      return this;
    }
    getMaxListeners() {
      return this._maxListeners !== undefined ? this._maxListeners : EventEmitter.defaultMaxListeners;
    }
    on(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('The "listener" argument must be of type Function');
      const map = this._ensureMap();
      if (!map.has(event)) map.set(event, []);
      map.get(event).push({ fn, once: false });
      if (event !== 'newListener' && map.has('newListener')) {
        this.emit('newListener', event, fn);
      }
      return this;
    }
    addListener(event, fn) {
      return this.on(event, fn);
    }
    prependListener(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('The "listener" argument must be of type Function');
      const map = this._ensureMap();
      if (!map.has(event)) map.set(event, []);
      map.get(event).unshift({ fn, once: false });
      return this;
    }
    once(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('The "listener" argument must be of type Function');
      const map = this._ensureMap();
      if (!map.has(event)) map.set(event, []);
      map.get(event).push({ fn, once: true });
      return this;
    }
    prependOnceListener(event, fn) {
      if (typeof fn !== 'function') throw new TypeError('The "listener" argument must be of type Function');
      const map = this._ensureMap();
      if (!map.has(event)) map.set(event, []);
      map.get(event).unshift({ fn, once: true });
      return this;
    }
    off(event, fn) {
      const map = this._ensureMap();
      const list = map.get(event);
      if (!list) return this;
      const idx = list.findIndex((x) => x.fn === fn || x.fn.listener === fn);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) map.delete(event);
        if (event !== 'removeListener' && map.has('removeListener')) {
          this.emit('removeListener', event, fn);
        }
      }
      return this;
    }
    removeListener(event, fn) {
      return this.off(event, fn);
    }
    removeAllListeners(event) {
      const map = this._ensureMap();
      if (event !== undefined) map.delete(event);
      else map.clear();
      return this;
    }
    listeners(event) {
      const list = this._ensureMap().get(event);
      return list ? list.map((x) => x.fn) : [];
    }
    rawListeners(event) {
      return this.listeners(event);
    }
    listenerCount(event) {
      const list = this._ensureMap().get(event);
      return list ? list.length : 0;
    }
    eventNames() {
      return Array.from(this._ensureMap().keys());
    }
    emit(event, ...args) {
      const map = this._ensureMap();
      const list = map.get(event);
      if (!list || list.length === 0) {
        if (event === 'error') {
          const err = args[0] instanceof Error ? args[0] : new Error(String(args[0] || 'Unhandled error event'));
          throw err;
        }
        return false;
      }
      const copy = list.slice();
      const remaining = list.filter((x) => !x.once);
      if (remaining.length > 0) map.set(event, remaining);
      else map.delete(event);
      for (let i = 0; i < copy.length; i++) {
        copy[i].fn.apply(this, args);
      }
      return true;
    }
  }
  EventEmitter.defaultMaxListeners = 10;
  EventEmitter.EventEmitter = EventEmitter;
  EventEmitter.listenerCount = (emitter, event) => emitter.listenerCount(event);
  EventEmitter.once = (emitter, event) =>
    new Promise((resolve, reject) => {
      const onEvent = (...args) => {
        emitter.off('error', onError);
        resolve(args);
      };
      const onError = (err) => {
        emitter.off(event, onEvent);
        reject(err);
      };
      emitter.once(event, onEvent);
      if (event !== 'error') emitter.once('error', onError);
    });

  const MiniEventEmitter = EventEmitter;

  // --- node:querystring ---
  const VirtualQuerystring = {
    escape(str) {
      return encodeURIComponent(String(str));
    },
    unescape(str) {
      try {
        return decodeURIComponent(String(str).replace(/\+/g, ' '));
      } catch (_) {
        return String(str);
      }
    },
    parse(str, sep = '&', eq = '=') {
      const out = Object.create(null);
      if (typeof str !== 'string' || str.length === 0) return out;
      const clean = str.startsWith('?') ? str.slice(1) : str;
      const parts = clean.split(sep || '&');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const idx = part.indexOf(eq || '=');
        const rawK = idx === -1 ? part : part.slice(0, idx);
        const rawV = idx === -1 ? '' : part.slice(idx + (eq || '=').length);
        const k = VirtualQuerystring.unescape(rawK);
        const v = VirtualQuerystring.unescape(rawV);
        if (Object.prototype.hasOwnProperty.call(out, k)) {
          if (Array.isArray(out[k])) out[k].push(v);
          else out[k] = [out[k], v];
        } else {
          out[k] = v;
        }
      }
      return out;
    },
    stringify(obj, sep = '&', eq = '=') {
      if (!obj || typeof obj !== 'object') return '';
      const pairs = [];
      for (const [k, v] of Object.entries(obj)) {
        const ek = VirtualQuerystring.escape(k);
        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) {
            pairs.push(`${ek}${eq}${VirtualQuerystring.escape(v[i] ?? '')}`);
          }
        } else if (v !== undefined) {
          pairs.push(`${ek}${eq}${VirtualQuerystring.escape(v ?? '')}`);
        }
      }
      return pairs.join(sep);
    }
  };
  VirtualQuerystring.decode = VirtualQuerystring.parse;
  VirtualQuerystring.encode = VirtualQuerystring.stringify;

  // --- node:url ---
  const VirtualUrl = {
    URL: typeof URL !== 'undefined' ? URL : null,
    URLSearchParams: typeof URLSearchParams !== 'undefined' ? URLSearchParams : null,
    parse(urlStr, parseQueryString = false) {
      urlStr = String(urlStr || '');
      let hash = null;
      const hashIdx = urlStr.indexOf('#');
      if (hashIdx !== -1) {
        hash = urlStr.slice(hashIdx);
        urlStr = urlStr.slice(0, hashIdx);
      }
      let search = null;
      let query = parseQueryString ? Object.create(null) : null;
      const qIdx = urlStr.indexOf('?');
      if (qIdx !== -1) {
        search = urlStr.slice(qIdx);
        const qRaw = search.slice(1);
        query = parseQueryString ? VirtualQuerystring.parse(qRaw) : qRaw;
        urlStr = urlStr.slice(0, qIdx);
      }
      const fullMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*:)?(\/\/)?([^/?#]*)?(\/.*)?$/.exec(urlStr);
      const protocol = fullMatch && fullMatch[1] ? fullMatch[1].toLowerCase() : null;
      const slashes = Boolean(fullMatch && fullMatch[2]);
      let hostPart = fullMatch && fullMatch[2] ? (fullMatch[3] || '') : null;
      let pathname = fullMatch && fullMatch[2] ? (fullMatch[4] || '/') : urlStr || '/';
      let auth = null;
      let host = null;
      let hostname = null;
      let port = null;
      if (hostPart !== null) {
        const atIdx = hostPart.indexOf('@');
        if (atIdx !== -1) {
          auth = hostPart.slice(0, atIdx);
          hostPart = hostPart.slice(atIdx + 1);
        }
        host = hostPart;
        const colonIdx = hostPart.lastIndexOf(':');
        if (colonIdx !== -1 && !hostPart.endsWith(']')) {
          hostname = hostPart.slice(0, colonIdx);
          port = hostPart.slice(colonIdx + 1);
        } else {
          hostname = hostPart;
        }
      }
      const path = pathname + (search || '');
      const href = (protocol || '') + (slashes ? '//' : '') + (auth ? auth + '@' : '') + (host || '') + path + (hash || '');
      return {
        protocol,
        slashes,
        auth,
        host,
        port,
        hostname,
        hash,
        search,
        query,
        pathname,
        path,
        href
      };
    },
    format(urlObj) {
      if (typeof urlObj === 'string') return urlObj;
      if (typeof URL !== 'undefined' && urlObj instanceof URL) return urlObj.toString();
      if (!urlObj || typeof urlObj !== 'object') return '';
      if (urlObj.href) return urlObj.href;
      const protocol = urlObj.protocol ? (urlObj.protocol.endsWith(':') ? urlObj.protocol : urlObj.protocol + ':') : '';
      const slashes = urlObj.slashes || protocol === 'http:' || protocol === 'https:' || protocol === 'file:' ? '//' : '';
      const auth = urlObj.auth ? urlObj.auth + '@' : '';
      const host = urlObj.host || (urlObj.hostname ? urlObj.hostname + (urlObj.port ? ':' + urlObj.port : '') : '');
      const pathname = urlObj.pathname || '/';
      let search = urlObj.search || '';
      if (!search && urlObj.query) {
        const qs = typeof urlObj.query === 'object' ? VirtualQuerystring.stringify(urlObj.query) : String(urlObj.query);
        if (qs) search = '?' + qs;
      }
      const hash = urlObj.hash ? (urlObj.hash.startsWith('#') ? urlObj.hash : '#' + urlObj.hash) : '';
      return `${protocol}${slashes}${auth}${host}${pathname}${search}${hash}`;
    },
    resolve(from, to) {
      const fromStr = String(from || '');
      const toStr = String(to || '');
      if (!toStr) return fromStr;
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(toStr)) return toStr;
      if (typeof URL !== 'undefined') {
        try {
          const resolvedUrl = new URL(toStr, new URL(fromStr, 'resolve://'));
          if (resolvedUrl.protocol === 'resolve:') {
            const { pathname, search, hash } = resolvedUrl;
            return pathname + search + hash;
          }
          return resolvedUrl.href;
        } catch (err) {
          _runtimeLogger.debug('url.resolve fallback used', err);
        }
      }
      if (toStr.startsWith('/')) {
        const m = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+)/.exec(fromStr);
        return m ? m[1] + toStr : toStr;
      }
      const baseDir = fromStr.endsWith('/') ? fromStr : fromStr.replace(/[^/]*$/, '');
      return baseDir + toStr;
    },
    fileURLToPath(u) {
      const str = typeof u === 'string' ? u : u.href || String(u);
      return str.replace(/^file:\/\//i, '') || '/';
    },
    pathToFileURL(p) {
      const clean = VirtualPath.resolve(String(p));
      return typeof URL !== 'undefined' ? new URL(`file://${clean}`) : { href: `file://${clean}`, pathname: clean };
    }
  };

  // --- node:stream ---
  class Stream extends EventEmitter {
    pipe(dest, options = {}) {
      const onData = (chunk) => {
        if (!dest.destroyed && !dest.writableFinished) dest.write(chunk);
      };
      this.on('data', onData);
      if (options.end !== false) {
        this.once('end', () => {
          if (!dest.destroyed && !dest.writableFinished) dest.end();
        });
      }
      this.once('error', (err) => {
        dest.emit('error', err);
      });
      dest.emit('pipe', this);
      return dest;
    }
  }

  class Readable extends Stream {
    constructor(opts = {}) {
      super();
      this.readable = true;
      this.readableEnded = false;
      this.destroyed = false;
      this._objectMode = Boolean(opts.objectMode);
      this._encoding = opts.encoding || null;
      this._readableBuffer = [];
      this._flowing = false;
      this._reading = false;
      if (typeof opts.read === 'function') this._read = opts.read;
      if (typeof opts.destroy === 'function') this._destroy = opts.destroy;
    }
    _read() {}
    setEncoding(enc) {
      this._encoding = enc;
      return this;
    }
    push(chunk, encoding) {
      if (this.destroyed || this.readableEnded) return false;
      if (chunk === null) {
        this.readableEnded = true;
        this._flushReadable();
        return false;
      }
      let item = chunk;
      if (!this._objectMode) {
        const buf = typeof chunk === 'string'
          ? VirtualBuffer.from(chunk, encoding || this._encoding || 'utf8')
          : (VirtualBuffer.isBuffer(chunk) ? chunk : VirtualBuffer.from(chunk));
        item = this._encoding ? buf.toString(this._encoding) : buf;
      }
      this._readableBuffer.push(item);
      this._flushReadable();
      return true;
    }
    read() {
      if (this._readableBuffer.length === 0 && !this.readableEnded && !this._reading) {
        this._reading = true;
        try { this._read(16384); } finally { this._reading = false; }
      }
      if (this._readableBuffer.length === 0) return null;
      return this._readableBuffer.shift();
    }
    on(event, fn) {
      super.on(event, fn);
      if (event === 'data') {
        this._flowing = true;
        queueMicrotask(() => this._drainReadable());
      } else if (event === 'end' && this.readableEnded && this._readableBuffer.length === 0) {
        queueMicrotask(() => this.emit('end'));
      }
      return this;
    }
    resume() {
      this._flowing = true;
      queueMicrotask(() => this._drainReadable());
      return this;
    }
    pause() {
      this._flowing = false;
      return this;
    }
    unpipe() {
      this.removeAllListeners('data');
      return this;
    }
    _drainReadable() {
      if (this.destroyed) return;
      if (!this.readableEnded && this._readableBuffer.length === 0 && !this._reading) {
        this._reading = true;
        try { this._read(16384); } finally { this._reading = false; }
      }
      this._flushReadable();
    }
    _flushReadable() {
      if (this.destroyed) return;
      if (this._flowing && this.listenerCount('data') > 0) {
        while (this._readableBuffer.length > 0 && this._flowing) {
          const item = this._readableBuffer.shift();
          this.emit('data', item);
        }
      }
      if (this.readableEnded && this._readableBuffer.length === 0 && !this._endEmitted) {
        this._endEmitted = true;
        queueMicrotask(() => {
          if (!this.destroyed) {
            this.emit('end');
            this.emit('close');
          }
        });
      }
    }
    destroy(err) {
      if (this.destroyed) return this;
      this.destroyed = true;
      if (err) queueMicrotask(() => this.emit('error', err));
      queueMicrotask(() => this.emit('close'));
      return this;
    }
    async *[Symbol.asyncIterator]() {
      const queue = [];
      let done = false;
      let error = null;
      let notify = null;
      this.on('data', (chunk) => {
        queue.push(chunk);
        if (notify) { const r = notify; notify = null; r(); }
      });
      this.once('end', () => {
        done = true;
        if (notify) { const r = notify; notify = null; r(); }
      });
      this.once('error', (err) => {
        error = err;
        done = true;
        if (notify) { const r = notify; notify = null; r(); }
      });
      while (!done || queue.length > 0) {
        if (error) throw error;
        if (queue.length > 0) {
          yield queue.shift();
        } else if (!done) {
          await new Promise((r) => { notify = r; });
        }
      }
      if (error) throw error;
    }
    static from(iterable, opts = {}) {
      const r = new Readable({ objectMode: true, ...opts });
      queueMicrotask(async () => {
        try {
          for await (const item of iterable) {
            r.push(item);
          }
          r.push(null);
        } catch (err) {
          r.destroy(err);
        }
      });
      return r;
    }
  }

  class Writable extends Stream {
    constructor(opts = {}) {
      super();
      this.writable = true;
      this.writableFinished = false;
      this.destroyed = false;
      this._objectMode = Boolean(opts.objectMode);
      if (typeof opts.write === 'function') this._write = opts.write;
      if (typeof opts.final === 'function') this._final = opts.final;
    }
    _write(chunk, encoding, cb) {
      if (typeof cb === 'function') cb();
    }
    write(chunk, encoding, cb) {
      if (typeof encoding === 'function') { cb = encoding; encoding = 'utf8'; }
      if (this.destroyed || this.writableFinished) return false;
      const item = (!this._objectMode && typeof chunk === 'string')
        ? VirtualBuffer.from(chunk, encoding || 'utf8')
        : chunk;
      this._write(item, encoding || 'utf8', (err) => {
        if (err) this.emit('error', err);
        if (typeof cb === 'function') cb(err);
      });
      return true;
    }
    cork() {}
    uncork() {}
    end(chunk, encoding, cb) {
      if (typeof chunk === 'function') { cb = chunk; chunk = undefined; encoding = undefined; }
      else if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
      if (this.destroyed || this.writableFinished) return this;
      if (chunk !== undefined && chunk !== null) {
        this.write(chunk, encoding);
      }
      const finish = () => {
        this.writableFinished = true;
        queueMicrotask(() => {
          this.emit('finish');
          this.emit('close');
          if (typeof cb === 'function') cb();
        });
      };
      if (typeof this._final === 'function') {
        this._final((err) => {
          if (err) this.emit('error', err);
          finish();
        });
      } else {
        finish();
      }
      return this;
    }
    destroy(err) {
      if (this.destroyed) return this;
      this.destroyed = true;
      if (err) queueMicrotask(() => this.emit('error', err));
      queueMicrotask(() => this.emit('close'));
      return this;
    }
  }

  class Duplex extends Readable {
    constructor(opts = {}) {
      super(opts);
      this.writable = true;
      this.writableFinished = false;
      if (typeof opts.write === 'function') this._write = opts.write;
      if (typeof opts.final === 'function') this._final = opts.final;
    }
    _write(chunk, encoding, cb) {
      if (typeof cb === 'function') cb();
    }
    write(chunk, encoding, cb) {
      return Writable.prototype.write.call(this, chunk, encoding, cb);
    }
    end(chunk, encoding, cb) {
      return Writable.prototype.end.call(this, chunk, encoding, cb);
    }
  }

  class Transform extends Duplex {
    constructor(opts = {}) {
      super(opts);
      if (typeof opts.transform === 'function') this._transform = opts.transform;
      if (typeof opts.flush === 'function') this._flush = opts.flush;
    }
    _transform(chunk, encoding, cb) {
      cb(null, chunk);
    }
    _write(chunk, encoding, cb) {
      this._transform(chunk, encoding, (err, out) => {
        if (err) {
          if (typeof cb === 'function') cb(err);
          else this.emit('error', err);
          return;
        }
        if (out !== undefined && out !== null) this.push(out);
        if (typeof cb === 'function') cb();
      });
    }
    end(chunk, encoding, cb) {
      if (typeof chunk === 'function') { cb = chunk; chunk = undefined; encoding = undefined; }
      else if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
      if (chunk !== undefined && chunk !== null) {
        this.write(chunk, encoding);
      }
      const done = (err, out) => {
        if (err) this.emit('error', err);
        if (out !== undefined && out !== null) this.push(out);
        this.push(null);
        this.writableFinished = true;
        queueMicrotask(() => {
          this.emit('finish');
          if (typeof cb === 'function') cb(err);
        });
      };
      if (typeof this._flush === 'function') {
        this._flush(done);
      } else {
        done();
      }
      return this;
    }
  }

  class PassThrough extends Transform {}

  function finished(stream, optsOrCb, maybeCb) {
    const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
    let called = false;
    const done = (err) => {
      if (called) return;
      called = true;
      if (typeof cb === 'function') cb(err || null);
    };
    stream.once('end', () => done(null));
    stream.once('finish', () => done(null));
    stream.once('error', (err) => done(err));
    stream.once('close', () => done(null));
    return () => { called = true; };
  }

  function pipeline(...args) {
    const hasCb = typeof args[args.length - 1] === 'function';
    const cb = hasCb ? args.pop() : null;
    const streams = args.flat();
    const run = new Promise((resolve, reject) => {
      if (streams.length < 2) {
        resolve();
        return;
      }
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        for (const s of streams) {
          if (typeof s.destroy === 'function') s.destroy();
        }
        reject(err);
      };
      for (let i = 0; i < streams.length - 1; i++) {
        streams[i].on('error', fail);
        streams[i].pipe(streams[i + 1]);
      }
      const last = streams[streams.length - 1];
      last.on('error', fail);
      finished(last, (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      });
    });
    if (cb) {
      run.then(() => cb(null), (err) => cb(err));
      return streams[streams.length - 1];
    }
    return run;
  }

  const VirtualStreamPromises = {
    pipeline: (...streams) => new Promise((res, rej) => pipeline(...streams, (err) => (err ? rej(err) : res()))),
    finished: (stream, opts) => new Promise((res, rej) => finished(stream, opts, (err) => (err ? rej(err) : res())))
  };

  Stream.Stream = Stream;
  Stream.Readable = Readable;
  Stream.Writable = Writable;
  Stream.Duplex = Duplex;
  Stream.Transform = Transform;
  Stream.PassThrough = PassThrough;
  Stream.pipeline = pipeline;
  Stream.finished = finished;
  Stream.promises = VirtualStreamPromises;
  const VirtualStream = Stream;

  function createVirtualPortTable() {
    const table = new Map();
    const listeners = new Map(); // event name -> Set<Function>
    const chaosRules = new Map(); // port -> ChaosRule

    function emit(event, ...args) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try {
          fn(...args);
        } catch (err) {
          if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(`[portTable] listener for "${event}" threw:`, err);
          }
        }
      }
    }

    function normalizeChaosRule(port, partial = {}, existing = null) {
      const p = Number(port);
      const base = existing || {
        port: p,
        latencyMs: 0,
        jitterMs: 0,
        dropRate: 0,
        errorRate: 0,
        statusCode: 503,
        partitionFromPorts: [],
        crashed: false
      };
      const merged = Object.assign({}, base, partial, { port: p });
      merged.latencyMs = Math.max(0, Number(merged.latencyMs) || 0);
      merged.jitterMs = Math.max(0, Number(merged.jitterMs) || 0);
      merged.dropRate = Math.max(0, Math.min(1, Number(merged.dropRate) || 0));
      merged.errorRate = Math.max(0, Math.min(1, Number(merged.errorRate) || 0));
      merged.statusCode = Number(merged.statusCode) || 503;
      merged.partitionFromPorts = Array.isArray(merged.partitionFromPorts)
        ? Array.from(new Set(merged.partitionFromPorts.map(Number).filter((n) => Number.isFinite(n) && n > 0)))
        : [];
      merged.crashed = Boolean(merged.crashed);
      return merged;
    }

    function isRuleActive(rule) {
      if (!rule) return false;
      return Boolean(
        rule.crashed ||
        rule.latencyMs > 0 ||
        rule.jitterMs > 0 ||
        rule.dropRate > 0 ||
        rule.errorRate > 0 ||
        (Array.isArray(rule.partitionFromPorts) && rule.partitionFromPorts.length > 0)
      );
    }

    return {
      on(event, fn) {
        if (typeof fn !== 'function') return () => {};
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
        return () => {
          const set = listeners.get(event);
          if (set) set.delete(fn);
        };
      },
      off(event, fn) {
        const set = listeners.get(event);
        if (set) set.delete(fn);
      },
      emit,
      registerServer(port, info = {}) {
        const p = Number(port);
        if (table.has(p)) {
          throw new Error(`Port ${p} is already in use`);
        }
        const entry = Object.assign({ port: p, registeredAt: Date.now() }, info);
        table.set(p, entry);
        emit('listen', entry);
        return entry;
      },
      unregisterServer(port) {
        const p = Number(port);
        const entry = table.get(p);
        const deleted = table.delete(p);
        if (deleted) emit('close', p, entry);
        return deleted;
      },
      unregister(port) {
        return this.unregisterServer(port);
      },
      killProcess(pid) {
        const pStr = String(pid);
        let found = false;
        for (const [port, entry] of Array.from(table.entries())) {
          if (entry.pid !== undefined && String(entry.pid) === pStr) {
            if (entry.server && typeof entry.server.close === 'function') {
              try { entry.server.close(); } catch (err) { _runtimeLogger.debug('portTable server.close failed', err); }
            }
            if (typeof entry.stop === 'function') {
              try { entry.stop(); } catch (err) { _runtimeLogger.debug('portTable entry.stop failed', err); }
            }
            // Avoid a double 'close' emission when entry.server.close() already
            // unregistered the port through unregisterServer().
            if (table.delete(port)) {
              emit('close', port, entry);
            }
            found = true;
          }
        }
        return found;
      },
      unregisterByPid(pid) {
        return this.killProcess(pid);
      },
      getServer(port) {
        return table.get(Number(port)) || null;
      },
      listServers() {
        return Array.from(table.values());
      },
      setChaosRule(port, partial = {}) {
        const p = Number(port);
        const updated = normalizeChaosRule(p, partial, chaosRules.get(p) || null);
        if (isRuleActive(updated)) {
          chaosRules.set(p, updated);
        } else {
          chaosRules.delete(p);
        }
        emit('chaos', p, updated);
        return updated;
      },
      getChaosRule(port) {
        return chaosRules.get(Number(port)) || null;
      },
      listChaosRules() {
        return Array.from(chaosRules.values());
      },
      clearChaosRules(port) {
        if (port !== undefined && port !== null && port !== '') {
          const p = Number(port);
          const deleted = chaosRules.delete(p);
          emit('chaos', p, null);
          return deleted;
        }
        chaosRules.clear();
        emit('chaos', null, null);
        return true;
      },
      async dispatchRequest(url, init = {}) {
        const parsed = new URL(url);
        const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
        const rawHdrs = (init && init.headers) || {};
        const hdrFromPort = typeof rawHdrs.get === 'function'
          ? rawHdrs.get('x-codelab-from-port')
          : (rawHdrs['x-codelab-from-port'] || rawHdrs['X-CodeLab-From-Port']);
        const fromPort = Number((init && init._fromPort) || hdrFromPort || 0) || null;
        const rule = chaosRules.get(port);
        let appliedDelayMs = 0;

        if (rule) {
          let delay = Number(rule.latencyMs) || 0;
          if (rule.jitterMs > 0) {
            delay += Math.round((Math.random() * 2 - 1) * Number(rule.jitterMs));
          }
          delay = Math.max(0, delay);
          if (delay > 0) {
            appliedDelayMs = delay;
            await new Promise((r) => setTimeout(r, delay));
          }

          if (rule.crashed) {
            const err = new Error(`connect ECONNREFUSED 127.0.0.1:${port} (chaos: node crashed)`);
            err.code = 'ECONNREFUSED';
            err.chaosEffect = 'CRASHED';
            err.fromPort = fromPort;
            throw err;
          }

          if (fromPort && Array.isArray(rule.partitionFromPorts) && rule.partitionFromPorts.includes(fromPort)) {
            const err = new Error(`connect EHOSTUNREACH 127.0.0.1:${port} (chaos: network partition from :${fromPort})`);
            err.code = 'EHOSTUNREACH';
            err.chaosEffect = `PARTITION(:${fromPort}-x->:${port})`;
            err.fromPort = fromPort;
            throw err;
          }

          if (rule.dropRate > 0 && Math.random() < rule.dropRate) {
            const err = new Error(`socket hang up 127.0.0.1:${port} (chaos: packet dropped)`);
            err.code = 'ETIMEDOUT';
            err.chaosEffect = 'DROPPED';
            err.fromPort = fromPort;
            throw err;
          }

          if (rule.errorRate > 0 && Math.random() < rule.errorRate) {
            const status = Number(rule.statusCode) || 503;
            const statusText = status === 429
              ? 'Too Many Requests'
              : (status === 504 ? 'Gateway Timeout' : 'Service Unavailable');
            const chaosTag = appliedDelayMs > 0 ? `ERROR_${status}+${appliedDelayMs}ms` : `ERROR_${status}`;
            const res = new Response(
              JSON.stringify({ error: `${statusText} (Chaos Injected)`, chaos: true, port, status }),
              {
                status,
                statusText,
                headers: {
                  'content-type': 'application/json',
                  'x-codelab-chaos': chaosTag
                }
              }
            );
            res._chaosEffect = chaosTag;
            res._fromPort = fromPort;
            return res;
          }
        }

        const entry = table.get(port);
        if (!entry) {
          const err = new Error(`connect ECONNREFUSED 127.0.0.1:${port}`);
          err.code = 'ECONNREFUSED';
          err.fromPort = fromPort;
          throw err;
        }
        let res;
        if (entry.fetch) {
          res = await entry.fetch(new Request(url, init));
        } else if (entry.server && typeof entry.server.dispatchRequest === 'function') {
          res = await entry.server.dispatchRequest(url, init);
        } else {
          res = new Response('OK', { status: 200 });
        }
        if (res && typeof res === 'object') {
          res._fromPort = fromPort;
          if (appliedDelayMs > 0 && !res._chaosEffect) {
            res._chaosEffect = `DELAY_+${appliedDelayMs}ms`;
          }
        }
        return res;
      }
    };
  }

  const _defaultPortTable = createVirtualPortTable();

  function createVirtualHttp(resourceTracker, activePortTable = null) {
    const activeServers = new Map(); // port -> VirtualServer
    const httpTrace = [];
    let nextEphemeralPort = 31000;

    function lowercaseHeaders(hdrs = {}) {
      const out = {};
      for (const [k, v] of Object.entries(hdrs)) {
        if (v !== undefined) out[k.toLowerCase()] = String(v);
      }
      return out;
    }

    class IncomingMessage extends MiniEventEmitter {
      constructor({ method = 'GET', url = '/', statusCode = 200, headers = {}, socket = null } = {}) {
        super();
        this.method = method;
        this.url = url;
        this.statusCode = statusCode;
        this.headers = lowercaseHeaders(headers);
        this.socket = socket || { remoteAddress: '127.0.0.1', encrypted: false };
        this.destroyed = false;
        this.complete = false;
        this._BufferedChunks = [];
        this._flowing = false;
        this._ended = false;
      }

      on(event, fn) {
        super.on(event, fn);
        if (event === 'data') {
          this._flowing = true;
          this._flushBuffered();
        } else if (event === 'end' && this._ended && this._BufferedChunks.length === 0) {
          queueMicrotask(() => {
            if (!this.complete) {
              this.complete = true;
              this.emit('end');
            }
          });
        }
        return this;
      }

      resume() {
        this._flowing = true;
        this._flushBuffered();
        return this;
      }

      pause() {
        this._flowing = false;
        return this;
      }

      pipe(dest) {
        this.on('data', (chunk) => {
          if (!dest.destroyed && !dest.writableFinished) dest.write(chunk);
        });
        this.on('end', () => {
          if (!dest.destroyed && !dest.writableFinished) dest.end();
        });
        return dest;
      }

      _pushData(chunk) {
        if (this.destroyed) return;
        const buf = VirtualBuffer.isBuffer(chunk) ? chunk : VirtualBuffer.from(chunk);
        if (this._flowing && this.listenerCount('data') > 0) {
          this.emit('data', buf);
        } else {
          this._BufferedChunks.push(buf);
        }
      }

      _pushEnd() {
        if (this.destroyed || this._ended) return;
        this._ended = true;
        this._flushBuffered();
      }

      _flushBuffered() {
        if (this.destroyed) return;
        if (this._flowing && this.listenerCount('data') > 0) {
          while (this._BufferedChunks.length > 0) {
            const c = this._BufferedChunks.shift();
            this.emit('data', c);
          }
        }
        if (this._ended && (this._flowing || this._BufferedChunks.length === 0)) {
          this._BufferedChunks.length = 0;
          if (!this.complete) {
            this.complete = true;
            this.emit('end');
          }
        }
      }

      destroy(err) {
        if (this.destroyed) return this;
        this.destroyed = true;
        if (err) this.emit('error', err);
        this.emit('close');
        return this;
      }
    }

    class ServerResponse extends MiniEventEmitter {
      constructor(clientReq, traceEntry) {
        super();
        this._clientReq = clientReq;
        this._traceEntry = traceEntry;
        this.statusCode = 200;
        this.statusMessage = 'OK';
        this.headersSent = false;
        this.writableFinished = false;
        this.destroyed = false;
        this._headers = {};
        this._clientRes = null;
      }

      setHeader(name, value) {
        if (this.headersSent) throw new Error('Cannot set headers after they are sent to the client');
        this._headers[String(name).toLowerCase()] = String(value);
        return this;
      }

      getHeader(name) {
        return this._headers[String(name).toLowerCase()];
      }

      removeHeader(name) {
        delete this._headers[String(name).toLowerCase()];
      }

      writeHead(statusCode, statusMessage, headers) {
        if (this.headersSent) return this;
        this.statusCode = Number(statusCode) || 200;
        let hdrs = headers;
        if (typeof statusMessage === 'object' && statusMessage !== null) {
          hdrs = statusMessage;
        } else if (typeof statusMessage === 'string') {
          this.statusMessage = statusMessage;
        }
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            if (v !== undefined) this._headers[k.toLowerCase()] = String(v);
          }
        }
        this.headersSent = true;
        this._clientRes = new IncomingMessage({
          statusCode: this.statusCode,
          headers: { ...this._headers }
        });
        if (!this._clientReq.destroyed) {
          this._clientReq._onResponseHeaders(this._clientRes);
        }
        return this;
      }

      write(chunk, encoding) {
        if (this.destroyed || this.writableFinished) return false;
        if (!this.headersSent) this.writeHead(this.statusCode, this._headers);
        if (chunk !== undefined && chunk !== null && chunk !== '') {
          const buf = typeof chunk === 'string'
            ? VirtualBuffer.from(chunk, encoding || 'utf8')
            : VirtualBuffer.from(chunk);
          if (this._traceEntry) this._traceEntry.responseBytes += buf.length;
          const res = this._clientRes;
          const req = this._clientReq;
          queueMicrotask(() => {
            if (!req.destroyed && res) res._pushData(buf);
          });
        }
        return true;
      }

      end(chunk, encoding, cb) {
        if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
        else if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
        if (this.destroyed || this.writableFinished) return this;
        if (!this.headersSent) this.writeHead(this.statusCode, this._headers);
        if (chunk !== undefined && chunk !== null && chunk !== '') {
          this.write(chunk, encoding);
        }
        this.writableFinished = true;
        if (this._traceEntry) {
          this._traceEntry.status = this.statusCode;
          this._traceEntry.durationMs = Math.max(0, performance.now() - this._traceEntry._t0);
          this._traceEntry.responseHeaders = { ...this._headers };
        }
        const res = this._clientRes;
        const req = this._clientReq;
        queueMicrotask(() => {
          req._clearTimeout();
          if (!req.destroyed && res) res._pushEnd();
          req._finishInFlight();
          this.emit('finish');
          this.emit('close');
          if (typeof cb === 'function') cb();
        });
        return this;
      }

      destroy(err) {
        if (this.destroyed) return this;
        this.destroyed = true;
        this._clientReq._finishInFlight();
        if (err) this.emit('error', err);
        this.emit('close');
        return this;
      }
    }

    class ClientRequest extends MiniEventEmitter {
      constructor(options, resCallback) {
        super();
        if (typeof options === 'string' || (typeof URL !== 'undefined' && options instanceof URL)) {
          const u = new URL(String(options));
          options = {
            host: u.hostname,
            port: Number(u.port) || 80,
            path: u.pathname + u.search,
            method: 'GET'
          };
        }
        this.host = options.host || options.hostname || '127.0.0.1';
        this.port = Number(options.port) || 80;
        this.method = String(options.method || 'GET').toUpperCase();
        this.path = options.path || '/';
        this.headers = lowercaseHeaders(options.headers || {});
        if (!this.headers.host) {
          this.headers.host = `${this.host}:${this.port}`;
        }
        this.destroyed = false;
        this._bodyChunks = [];
        this._ended = false;
        this._timeoutTimer = null;
        this._serverRes = null;
        this._inFlightDone = false;

        if (typeof resCallback === 'function') {
          this.once('response', resCallback);
        }

        if (resourceTracker) resourceTracker.inFlightHttp.add(this);
      }

      _finishInFlight() {
        if (!this._inFlightDone) {
          this._inFlightDone = true;
          this._clearTimeout();
          if (resourceTracker) resourceTracker.inFlightHttp.delete(this);
        }
      }

      _clearTimeout() {
        if (this._timeoutTimer !== null) {
          clearTimeout(this._timeoutTimer);
          if (resourceTracker) resourceTracker.activeTimers.delete(this._timeoutTimer);
          this._timeoutTimer = null;
        }
      }

      setTimeout(ms, callback) {
        this._clearTimeout();
        if (typeof callback === 'function') this.once('timeout', callback);
        if (ms > 0 && Number.isFinite(ms)) {
          const timerId = setTimeout(() => {
            if (resourceTracker) resourceTracker.activeTimers.delete(timerId);
            this._timeoutTimer = null;
            if (!this.destroyed && !this._inFlightDone) {
              this.emit('timeout');
            }
          }, ms);
          this._timeoutTimer = timerId;
          if (resourceTracker) resourceTracker.activeTimers.add(timerId);
        }
        return this;
      }

      write(chunk, encoding) {
        if (this.destroyed || this._ended) return false;
        if (chunk !== undefined && chunk !== null && chunk !== '') {
          const buf = typeof chunk === 'string'
            ? VirtualBuffer.from(chunk, encoding || 'utf8')
            : VirtualBuffer.from(chunk);
          this._bodyChunks.push(buf);
        }
        return true;
      }

      end(chunk, encoding, cb) {
        if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
        else if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
        if (this._ended || this.destroyed) return this;
        if (chunk !== undefined && chunk !== null && chunk !== '') {
          this.write(chunk, encoding);
        }
        this._ended = true;
        if (typeof cb === 'function') queueMicrotask(cb);

        const traceEntry = {
          id: httpTrace.length + 1,
          method: this.method,
          host: this.host,
          port: this.port,
          url: this.path,
          status: 'PENDING',
          durationMs: 0,
          requestBytes: this._bodyChunks.reduce((s, b) => s + b.length, 0),
          responseBytes: 0,
          requestHeaders: { ...this.headers },
          responseHeaders: {},
          _t0: performance.now()
        };
        if (httpTrace.length >= 500) httpTrace.shift();
        httpTrace.push(traceEntry);
        this._traceEntry = traceEntry;

        queueMicrotask(() => {
          if (this.destroyed) {
            this._finishInFlight();
            return;
          }
          const server = activeServers.get(this.port);
          const hasChaosRule = Boolean(
            activePortTable &&
            typeof activePortTable.getChaosRule === 'function' &&
            activePortTable.getChaosRule(this.port)
          );
          const hasPortTableServer = Boolean(
            activePortTable &&
            typeof activePortTable.getServer === 'function' &&
            activePortTable.getServer(this.port)
          );
          if ((!server || !server._listening || hasChaosRule) && activePortTable && (hasPortTableServer || hasChaosRule) && typeof activePortTable.dispatchRequest === 'function') {
            let inferredFromPort = null;
            if (activeServers.size > 0) {
              const firstLocalPort = Array.from(activeServers.keys()).find((p) => Number(p) !== Number(this.port));
              if (firstLocalPort) inferredFromPort = firstLocalPort;
            } else if (resourceTracker && resourceTracker.pid && typeof activePortTable.listServers === 'function') {
              const owned = activePortTable.listServers().find((s) => s && s.pid === resourceTracker.pid && Number(s.port) !== Number(this.port));
              if (owned) inferredFromPort = owned.port;
            }
            const reqBody = this._bodyChunks.length > 0 ? VirtualBuffer.concat(this._bodyChunks) : undefined;
            const fullUrl = `http://${this.host}:${this.port}${this.path.startsWith('/') ? '' : '/'}${this.path}`;
            activePortTable.dispatchRequest(fullUrl, {
              method: this.method,
              headers: { ...this.headers },
              body: reqBody,
              _fromPort: inferredFromPort
            }).then(async (res) => {
              if (this.destroyed) {
                this._finishInFlight();
                return;
              }
              const resHeaders = {};
              if (res && res.headers && typeof res.headers.forEach === 'function') {
                res.headers.forEach((v, k) => { resHeaders[String(k).toLowerCase()] = String(v); });
              }
              let buf = VirtualBuffer.alloc(0);
              if (res && typeof res.arrayBuffer === 'function') {
                const ab = await res.arrayBuffer();
                buf = VirtualBuffer.from(ab);
              }
              traceEntry.status = (res && res.status) || 200;
              traceEntry.durationMs = Math.max(0, performance.now() - traceEntry._t0);
              traceEntry.responseBytes = buf.length;
              traceEntry.responseHeaders = resHeaders;
              if (inferredFromPort) traceEntry.fromPort = inferredFromPort;
              if (res && res._chaosEffect) traceEntry.chaosEffect = res._chaosEffect;
              const clientRes = new IncomingMessage({
                statusCode: (res && res.status) || 200,
                headers: resHeaders
              });
              this._onResponseHeaders(clientRes);
              if (buf.length > 0) clientRes._pushData(buf);
              clientRes._pushEnd();
              this._finishInFlight();
            }).catch((err) => {
              if (this.destroyed) {
                this._finishInFlight();
                return;
              }
              err.errno = err.errno || -61;
              err.syscall = err.syscall || 'connect';
              err.address = this.host;
              err.port = this.port;
              traceEntry.status = err.code || 'ECONNREFUSED';
              traceEntry.durationMs = Math.max(0, performance.now() - traceEntry._t0);
              if (inferredFromPort) traceEntry.fromPort = inferredFromPort;
              if (err && err.chaosEffect) traceEntry.chaosEffect = err.chaosEffect;
              this._finishInFlight();
              this.emit('error', err);
            });
            return;
          }
          if (!server || !server._listening) {
            const err = new Error(`connect ECONNREFUSED ${this.host}:${this.port}`);
            err.code = 'ECONNREFUSED';
            err.errno = -61;
            err.syscall = 'connect';
            err.address = this.host;
            err.port = this.port;
            traceEntry.status = 'ECONNREFUSED';
            traceEntry.durationMs = Math.max(0, performance.now() - traceEntry._t0);
            this._finishInFlight();
            this.emit('error', err);
            return;
          }

          const serverReq = new IncomingMessage({
            method: this.method,
            url: this.path,
            headers: { ...this.headers },
            socket: { remoteAddress: '127.0.0.1', encrypted: false }
          });
          const serverRes = new ServerResponse(this, traceEntry);
          this._serverRes = serverRes;

          try {
            server.emit('request', serverReq, serverRes);
          } catch (err) {
            this._finishInFlight();
            this.emit('error', err);
            return;
          }

          queueMicrotask(() => {
            if (this.destroyed) return;
            try {
              for (let i = 0; i < this._bodyChunks.length; i++) {
                serverReq._pushData(this._bodyChunks[i]);
              }
              serverReq._pushEnd();
            } catch (err) {
              this._finishInFlight();
              this.emit('error', err);
            }
          });
        });

        return this;
      }

      _onResponseHeaders(clientRes) {
        if (this.destroyed) return;
        this.emit('response', clientRes);
      }

      destroy(err) {
        if (this.destroyed) return this;
        this.destroyed = true;
        if (this._traceEntry && this._traceEntry.status === 'PENDING') {
          this._traceEntry.status = (err && err.code) ? err.code : 'ABORTED';
          this._traceEntry.durationMs = Math.max(0, performance.now() - this._traceEntry._t0);
        }
        this._finishInFlight();
        if (this._serverRes && !this._serverRes.writableFinished) {
          this._serverRes.destroyed = true;
          this._serverRes.emit('close');
        }
        if (err) {
          queueMicrotask(() => this.emit('error', err));
        }
        queueMicrotask(() => this.emit('close'));
        return this;
      }
    }

    class VirtualServer extends MiniEventEmitter {
      constructor(requestListener) {
        super();
        if (typeof requestListener === 'function') {
          this.on('request', requestListener);
        }
        this._port = null;
        this._host = '127.0.0.1';
        this._listening = false;
      }

      listen(port = 0, host = '127.0.0.1', callback) {
        if (typeof port === 'function') {
          callback = port;
          port = 0;
          host = '127.0.0.1';
        } else if (typeof host === 'function') {
          callback = host;
          host = '127.0.0.1';
        }
        this._port = port === 0 ? nextEphemeralPort++ : Number(port);
        this._host = host || '127.0.0.1';
        this._listening = true;
        activeServers.set(this._port, this);
        if (activePortTable) {
          activePortTable.registerServer(this._port, {
            server: this,
            name: 'http-server',
            port: this._port,
            pid: (resourceTracker && resourceTracker.pid) || 1
          });
        }
        if (typeof callback === 'function') {
          this.once('listening', callback);
        }
        queueMicrotask(() => {
          this.emit('listening');
        });
        return this;
      }

      address() {
        if (!this._listening) return null;
        return { port: this._port, family: 'IPv4', address: this._host };
      }

      closeAllConnections() {
        // Virtual loopback connections are cleaned up automatically
      }

      close(callback) {
        if (this._port !== null) {
          activeServers.delete(this._port);
          if (activePortTable) {
            activePortTable.unregisterServer(this._port);
          }
        }
        this._listening = false;
        if (typeof callback === 'function') {
          queueMicrotask(() => callback());
        }
        queueMicrotask(() => this.emit('close'));
        return this;
      }

      async dispatchRequest(url, init = {}) {
        return new Promise((resolve, reject) => {
          try {
            const parsed = new URL(url);
            let rawHeaders = init.headers || {};
            let hdrs = {};
            if (rawHeaders instanceof Headers || (rawHeaders && typeof rawHeaders.entries === 'function')) {
              for (const [k, v] of rawHeaders.entries()) {
                hdrs[k.toLowerCase()] = String(v);
              }
            } else if (typeof rawHeaders === 'object' && rawHeaders !== null) {
              for (const [k, v] of Object.entries(rawHeaders)) {
                if (v !== undefined) hdrs[k.toLowerCase()] = String(v);
              }
            }
            if (!hdrs.host) {
              hdrs.host = `${parsed.hostname || '127.0.0.1'}:${parsed.port || this._port}`;
            }

            const serverReq = new IncomingMessage({
              method: (init.method || 'GET').toUpperCase(),
              url: parsed.pathname + parsed.search,
              headers: hdrs,
              socket: { remoteAddress: '127.0.0.1', encrypted: false }
            });

            const mockClientReq = new MiniEventEmitter();
            mockClientReq.destroyed = false;
            mockClientReq._clearTimeout = () => {};
            mockClientReq._finishInFlight = () => {};
            mockClientReq._onResponseHeaders = () => {};

            const serverRes = new ServerResponse(mockClientReq, null);
            const chunks = [];

            const origWrite = serverRes.write.bind(serverRes);
            const origEnd = serverRes.end.bind(serverRes);

            serverRes.write = function(chunk, encoding) {
              if (chunk !== undefined && chunk !== null && chunk !== '') {
                const buf = typeof chunk === 'string'
                  ? VirtualBuffer.from(chunk, encoding || 'utf8')
                  : VirtualBuffer.from(chunk);
                chunks.push(buf);
              }
              return origWrite(chunk, encoding);
            };

            serverRes.end = function(chunk, encoding, cb) {
              if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
              else if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
              if (chunk !== undefined && chunk !== null && chunk !== '') {
                const buf = typeof chunk === 'string'
                  ? VirtualBuffer.from(chunk, encoding || 'utf8')
                  : VirtualBuffer.from(chunk);
                chunks.push(buf);
              }
              const resObj = origEnd(chunk, encoding, cb);
              queueMicrotask(() => {
                const totalBuf = VirtualBuffer.concat(chunks);
                const outHeaders = new Headers();
                for (const [k, v] of Object.entries(serverRes._headers)) {
                  outHeaders.set(k, v);
                }
                const response = new Response(totalBuf, {
                  status: serverRes.statusCode || 200,
                  statusText: serverRes.statusMessage || 'OK',
                  headers: outHeaders
                });
                resolve(response);
              });
              return resObj;
            };

            this.emit('request', serverReq, serverRes);

            queueMicrotask(async () => {
              try {
                if (init.body) {
                  let b = init.body;
                  if (typeof b.text === 'function') b = await b.text();
                  const buf = typeof b === 'string' ? VirtualBuffer.from(b, 'utf8') : VirtualBuffer.from(b);
                  serverReq._pushData(buf);
                }
                serverReq._pushEnd();
              } catch (err) {
                reject(err);
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      }
    }

    class Agent {
      constructor(opts = {}) {
        this.options = opts;
        this.keepAlive = Boolean(opts.keepAlive);
        this.maxSockets = opts.maxSockets || Infinity;
      }
      destroy() {}
    }

    return {
      Agent,
      Server: VirtualServer,
      IncomingMessage,
      ServerResponse,
      ClientRequest,
      createServer(requestListener) {
        return new VirtualServer(requestListener);
      },
      request(options, callback) {
        return new ClientRequest(options, callback);
      },
      get(options, callback) {
        const req = new ClientRequest(options, callback);
        req.end();
        return req;
      },
      getTrace() {
        return httpTrace.map(({ _t0, ...rest }) => rest);
      },
      activeServers,
      hasActiveServers() {
        return activeServers.size > 0;
      },
      closeAllServers() {
        for (const s of Array.from(activeServers.values())) {
          try { s.close(); } catch (err) { _runtimeLogger.debug('vhttp closeAllServers close failed', err); }
        }
        activeServers.clear();
      }
    };
  }

  // =========================================================================
  // 7. COMPLETE ASSERTION LIBRARY (node:assert & node:assert/strict)
  // =========================================================================
  class AssertionError extends Error {
    constructor({ message, actual, expected, operator }) {
      const msg = message || `Assertion failed: ${formatValue(actual)} ${operator || '!='} ${formatValue(expected)}`;
      super(msg);
      this.name = 'AssertionError';
      this.code = 'ERR_ASSERTION';
      this.actual = actual;
      this.expected = expected;
      this.operator = operator;
    }
  }

  function formatValue(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'bigint') return `${v}n`;
    if (v instanceof RegExp || v instanceof Error) return String(v);
    if (VirtualBuffer.isBuffer(v)) return `<Buffer ${v.toString('hex').slice(0, 32)}>`;
    try {
      return JSON.stringify(v);
    } catch (_) {
      return String(v);
    }
  }

  function isDeepEqual(a, b, strict = true, seen = new Map()) {
    if (strict ? Object.is(a, b) : a == b) return true;
    if (strict && typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      return strict ? Object.is(a, b) : a == b;
    }
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;
    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
      if (a.byteLength !== b.byteLength) return false;
      const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      const ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
      return true;
    }
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    }
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, v] of a.entries()) {
        if (!b.has(k) || !isDeepEqual(v, b.get(k), strict, seen)) return false;
      }
      return true;
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (seen.get(a) === b) return true;
    seen.set(a, b);
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      const k = keysA[i];
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!isDeepEqual(a[k], b[k], strict, seen)) return false;
    }
    return true;
  }

  function matchesError(err, matcher) {
    if (!matcher) return true;
    if (matcher instanceof RegExp) {
      return matcher.test(err && err.message ? err.message : String(err)) || matcher.test(String(err));
    }
    if (typeof matcher === 'function') {
      if (matcher.prototype && err instanceof matcher) return true;
      if (matcher === Error || (matcher.prototype && matcher.prototype instanceof Error)) {
        return Boolean(err && (err instanceof matcher || err.name === matcher.name));
      }
      try {
        return Boolean(matcher(err));
      } catch (_) {
        return false;
      }
    }
    if (typeof matcher === 'object') {
      for (const [k, v] of Object.entries(matcher)) {
        if (v instanceof RegExp) {
          if (!v.test(String(err[k]))) return false;
        } else if (err[k] !== v) {
          return false;
        }
      }
      return true;
    }
    return true;
  }

  function assert(value, message) {
    if (!value) {
      throw new AssertionError({ message, actual: value, expected: true, operator: '==' });
    }
  }

  assert.AssertionError = AssertionError;
  assert.ok = assert;
  assert.fail = function fail(message) {
    throw new AssertionError({ message: message || 'Failed', actual: false, expected: true, operator: 'fail' });
  };
  assert.equal = function equal(actual, expected, message) {
    if (actual != expected && !(Number.isNaN(actual) && Number.isNaN(expected))) {
      throw new AssertionError({ message, actual, expected, operator: '==' });
    }
  };
  assert.notEqual = function notEqual(actual, expected, message) {
    if (actual == expected) {
      throw new AssertionError({ message, actual, expected, operator: '!=' });
    }
  };
  assert.strictEqual = function strictEqual(actual, expected, message) {
    if (!Object.is(actual, expected)) {
      throw new AssertionError({ message, actual, expected, operator: '===' });
    }
  };
  assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
    if (Object.is(actual, expected)) {
      throw new AssertionError({ message, actual, expected, operator: '!==' });
    }
  };
  assert.deepEqual = function deepEqual(actual, expected, message) {
    if (!isDeepEqual(actual, expected, false)) {
      throw new AssertionError({ message, actual, expected, operator: 'deepEqual' });
    }
  };
  assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
    if (isDeepEqual(actual, expected, false)) {
      throw new AssertionError({ message, actual, expected, operator: 'notDeepEqual' });
    }
  };
  assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
    if (!isDeepEqual(actual, expected, true)) {
      throw new AssertionError({ message, actual, expected, operator: 'deepStrictEqual' });
    }
  };
  assert.notDeepStrictEqual = function notDeepStrictEqual(actual, expected, message) {
    if (isDeepEqual(actual, expected, true)) {
      throw new AssertionError({ message, actual, expected, operator: 'notDeepStrictEqual' });
    }
  };
  assert.match = function match(string, regexp, message) {
    if (!(regexp instanceof RegExp) || !regexp.test(String(string))) {
      throw new AssertionError({ message, actual: string, expected: regexp, operator: 'match' });
    }
  };
  assert.doesNotMatch = function doesNotMatch(string, regexp, message) {
    if (regexp instanceof RegExp && regexp.test(String(string))) {
      throw new AssertionError({ message, actual: string, expected: regexp, operator: 'doesNotMatch' });
    }
  };
  assert.throws = function throws(block, errorOrMessage, maybeMessage) {
    let matcher = errorOrMessage;
    let msg = maybeMessage;
    if (typeof errorOrMessage === 'string' && maybeMessage === undefined) {
      matcher = null;
      msg = errorOrMessage;
    }
    let threw = false;
    let thrownErr = null;
    try {
      block();
    } catch (e) {
      threw = true;
      thrownErr = e;
    }
    if (!threw) {
      throw new AssertionError({ message: msg || 'Missing expected exception', actual: undefined, expected: matcher, operator: 'throws' });
    }
    if (matcher && !matchesError(thrownErr, matcher)) {
      throw new AssertionError({
        message: msg || `Unexpected exception: ${thrownErr && thrownErr.message ? thrownErr.message : thrownErr}`,
        actual: thrownErr,
        expected: matcher,
        operator: 'throws'
      });
    }
  };
  assert.doesNotThrow = function doesNotThrow(block, message) {
    try {
      block();
    } catch (e) {
      throw new AssertionError({ message: message || `Got unwanted exception: ${e.message}`, actual: e, expected: undefined, operator: 'doesNotThrow' });
    }
  };
  assert.rejects = async function rejects(asyncFnOrPromise, errorOrMessage, maybeMessage) {
    let matcher = errorOrMessage;
    let msg = maybeMessage;
    if (typeof errorOrMessage === 'string' && maybeMessage === undefined) {
      matcher = null;
      msg = errorOrMessage;
    }
    let threw = false;
    let thrownErr = null;
    try {
      const p = typeof asyncFnOrPromise === 'function' ? asyncFnOrPromise() : asyncFnOrPromise;
      await p;
    } catch (e) {
      threw = true;
      thrownErr = e;
    }
    if (!threw) {
      throw new AssertionError({ message: msg || 'Missing expected rejection', actual: undefined, expected: matcher, operator: 'rejects' });
    }
    if (matcher && !matchesError(thrownErr, matcher)) {
      throw new AssertionError({
        message: msg || `Unexpected rejection: ${thrownErr && thrownErr.message ? thrownErr.message : thrownErr}`,
        actual: thrownErr,
        expected: matcher,
        operator: 'rejects'
      });
    }
  };
  assert.strict = assert;

  // =========================================================================
  // 7b. VIRTUAL `node:util` (`format`, `inspect`, `promisify`, `callbackify`, `inherits`, `types`)
  // =========================================================================
  const kCustomPromisifiedSymbol = Symbol.for('nodejs.util.promisify.custom');

  function utilInspect(val, opts = {}) {
    const maxDepth = opts && typeof opts.depth === 'number' ? opts.depth : 4;
    const seen = new WeakSet();
    function fmt(v, depth) {
      if (v === null) return 'null';
      if (v === undefined) return 'undefined';
      if (typeof v === 'string') return JSON.stringify(v);
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (typeof v === 'bigint') return `${v}n`;
      if (typeof v === 'symbol') return v.toString();
      if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`;
      if (v instanceof RegExp) return v.toString();
      if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString();
      if (v instanceof Error) return v.stack || `${v.name}: ${v.message}`;
      if (VirtualBuffer.isBuffer(v)) {
        const hex = v.toString('hex');
        const pairs = hex.match(/.{1,2}/g) || [];
        return `<Buffer ${pairs.slice(0, 32).join(' ')}${pairs.length > 32 ? ' ... ' : ''}>`;
      }
      if (v instanceof Uint8Array) {
        return `Uint8Array(${v.byteLength}) [ ${Array.from(v.slice(0, 16)).join(', ')}${v.byteLength > 16 ? ', ...' : ''} ]`;
      }
      if (typeof v === 'object') {
        if (seen.has(v)) return '[Circular]';
        if (depth > maxDepth) return Array.isArray(v) ? '[Array]' : '[Object]';
        seen.add(v);
        try {
          if (v instanceof Map) {
            const entries = [];
            for (const [mk, mv] of v.entries()) {
              entries.push(`${fmt(mk, depth + 1)} => ${fmt(mv, depth + 1)}`);
            }
            return `Map(${v.size}) { ${entries.join(', ')} }`;
          }
          if (v instanceof Set) {
            const items = [];
            for (const sv of v.values()) items.push(fmt(sv, depth + 1));
            return `Set(${v.size}) { ${items.join(', ')} }`;
          }
          if (Array.isArray(v)) {
            if (v.length === 0) return '[]';
            return `[ ${v.map((item) => fmt(item, depth + 1)).join(', ')} ]`;
          }
          const keys = Object.keys(v);
          if (keys.length === 0) return '{}';
          const pairs = keys.map((k) => {
            const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
            return `${safeKey}: ${fmt(v[k], depth + 1)}`;
          });
          const ctor = v.constructor && v.constructor !== Object ? `${v.constructor.name} ` : '';
          return `${ctor}{ ${pairs.join(', ')} }`;
        } finally {
          seen.delete(v);
        }
      }
      return String(v);
    }
    return fmt(val, 0);
  }

  function utilFormat(...args) {
    if (args.length === 0) return '';
    const first = args[0];
    if (typeof first !== 'string') {
      return args.map((a) => (typeof a === 'object' && a !== null ? utilInspect(a) : String(a))).join(' ');
    }
    let idx = 1;
    let out = '';
    for (let i = 0; i < first.length; i++) {
      if (first[i] === '%' && i + 1 < first.length) {
        const next = first[i + 1];
        if (next === '%') {
          out += '%';
          i++;
          continue;
        }
        if (idx < args.length) {
          const arg = args[idx];
          if (next === 's') { out += String(arg); idx++; i++; continue; }
          if (next === 'd') { out += Number(arg); idx++; i++; continue; }
          if (next === 'i') { out += parseInt(arg, 10); idx++; i++; continue; }
          if (next === 'f') { out += parseFloat(arg); idx++; i++; continue; }
          if (next === 'j') {
            try { out += JSON.stringify(arg); } catch (_) { out += '[Circular]'; }
            idx++; i++; continue;
          }
          if (next === 'o' || next === 'O') {
            out += utilInspect(arg);
            idx++; i++; continue;
          }
        }
      }
      out += first[i];
    }
    while (idx < args.length) {
      const a = args[idx++];
      out += ' ' + (typeof a === 'object' && a !== null ? utilInspect(a) : String(a));
    }
    return out;
  }

  function utilPromisify(original) {
    if (typeof original !== 'function') {
      throw new TypeError('The "original" argument must be of type Function');
    }
    if (original[kCustomPromisifiedSymbol]) {
      const fn = original[kCustomPromisifiedSymbol];
      if (typeof fn !== 'function') {
        throw new TypeError('The "util.promisify.custom" property must be of type Function');
      }
      return Object.defineProperty(fn, kCustomPromisifiedSymbol, {
        value: fn, enumerable: false, writable: false, configurable: true
      });
    }
    function fn(...args) {
      return new Promise((resolve, reject) => {
        try {
          original.call(this, ...args, (err, ...values) => {
            if (err) return reject(err);
            resolve(values.length <= 1 ? values[0] : values);
          });
        } catch (err) {
          reject(err);
        }
      });
    }
    Object.setPrototypeOf(fn, Object.getPrototypeOf(original));
    Object.defineProperty(fn, kCustomPromisifiedSymbol, {
      value: fn, enumerable: false, writable: false, configurable: true
    });
    return fn;
  }
  utilPromisify.custom = kCustomPromisifiedSymbol;

  function utilCallbackify(original) {
    if (typeof original !== 'function') {
      throw new TypeError('The "original" argument must be of type Function');
    }
    return function callbackified(...args) {
      const maybeCb = args.pop();
      if (typeof maybeCb !== 'function') {
        throw new TypeError('The last argument must be of type Function');
      }
      Promise.resolve()
        .then(() => original.apply(this, args))
        .then(
          (ret) => queueMicrotask(() => maybeCb(null, ret)),
          (err) => queueMicrotask(() => {
            const e = err || new Error('Promise was rejected with a falsy value');
            maybeCb(e);
          })
        );
    };
  }

  function utilInherits(ctor, superCtor) {
    if (ctor === undefined || ctor === null) throw new TypeError('The constructor to "inherits" must not be null or undefined');
    if (superCtor === undefined || superCtor === null) throw new TypeError('The super constructor to "inherits" must not be null or undefined');
    ctor.super_ = superCtor;
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  }

  const VirtualUtil = {
    format: utilFormat,
    inspect: utilInspect,
    promisify: utilPromisify,
    callbackify: utilCallbackify,
    inherits: utilInherits,
    isDeepStrictEqual: (a, b) => isDeepEqual(a, b, true),
    deprecate: (fn) => fn,
    TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : undefined,
    TextDecoder: typeof TextDecoder !== 'undefined' ? TextDecoder : undefined,
    types: {
      isPromise: (v) => Boolean(v && typeof v === 'object' && typeof v.then === 'function'),
      isRegExp: (v) => v instanceof RegExp,
      isDate: (v) => v instanceof Date,
      isUint8Array: (v) => v instanceof Uint8Array,
      isArrayBuffer: (v) => v instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && v instanceof SharedArrayBuffer),
      isMap: (v) => v instanceof Map,
      isSet: (v) => v instanceof Set,
      isNativeError: (v) => v instanceof Error,
      isBoxedPrimitive: (v) => v instanceof Number || v instanceof String || v instanceof Boolean
    }
  };

  // --- node:string_decoder ---
  class StringDecoder {
    constructor(encoding = 'utf8') {
      const enc = String(encoding || 'utf8').toLowerCase().replace(/[-_]/g, '');
      this.encoding = enc === 'utf8' || enc === 'utf' ? 'utf8' : (enc === 'ucs2' || enc === 'utf16le' ? 'utf16le' : (enc === 'latin1' || enc === 'binary' ? 'latin1' : enc));
      this._pending = VirtualBuffer.alloc(0);
    }

    write(buf) {
      const chunk = VirtualBuffer.isBuffer(buf) ? buf : VirtualBuffer.from(buf);
      if (chunk.length === 0) return '';
      if (this.encoding !== 'utf8' && this.encoding !== 'utf16le' && this.encoding !== 'base64') {
        return chunk.toString(this.encoding);
      }
      const combined = this._pending.length > 0 ? VirtualBuffer.concat([this._pending, chunk]) : chunk;
      if (this.encoding === 'utf16le') {
        const rem = combined.length % 2;
        const completeLen = combined.length - rem;
        this._pending = rem > 0 ? VirtualBuffer.from(combined.subarray(completeLen)) : VirtualBuffer.alloc(0);
        return completeLen > 0 ? combined.subarray(0, completeLen).toString('utf16le') : '';
      }
      if (this.encoding === 'base64') {
        const rem = combined.length % 3;
        const completeLen = combined.length - rem;
        this._pending = rem > 0 ? VirtualBuffer.from(combined.subarray(completeLen)) : VirtualBuffer.alloc(0);
        return completeLen > 0 ? combined.subarray(0, completeLen).toString('base64') : '';
      }
      // UTF-8 multi-byte boundary detection
      let incomplete = 0;
      const len = combined.length;
      for (let i = 1; i <= 3 && i <= len; i++) {
        const byte = combined[len - i];
        if ((byte & 0xc0) === 0x80) {
          continue; // continuation byte 10xxxxxx
        }
        let expectedLen = 1;
        if ((byte & 0xe0) === 0xc0) expectedLen = 2;
        else if ((byte & 0xf0) === 0xe0) expectedLen = 3;
        else if ((byte & 0xf8) === 0xf0) expectedLen = 4;
        if (i < expectedLen) {
          incomplete = i;
        }
        break;
      }
      const completeLen = len - incomplete;
      this._pending = incomplete > 0 ? VirtualBuffer.from(combined.subarray(completeLen)) : VirtualBuffer.alloc(0);
      return completeLen > 0 ? combined.subarray(0, completeLen).toString('utf8') : '';
    }

    end(buf) {
      let res = '';
      if (buf !== undefined) {
        res += this.write(buf);
      }
      if (this._pending.length > 0) {
        res += this._pending.toString(this.encoding);
        this._pending = VirtualBuffer.alloc(0);
      }
      return res;
    }
  }

  const VirtualStringDecoder = { StringDecoder };

  // --- node:dns ---
  const VirtualDnsPromises = {
    async lookup(hostname, options) {
      const all = options && typeof options === 'object' && options.all;
      const family = (typeof options === 'number' ? options : options?.family) || 4;
      const address = family === 6 ? '::1' : '127.0.0.1';
      if (all) return [{ address, family }];
      return { address, family };
    },
    async resolve(hostname, rrtype = 'A') {
      if (rrtype === 'AAAA') return ['::1'];
      if (rrtype === 'TXT') return [['v=spf1 loopback']];
      if (rrtype === 'MX') return [{ exchange: `mail.${hostname}`, priority: 10 }];
      if (rrtype === 'CNAME') return [`${hostname}.local`];
      if (hostname === 'example.com') return ['93.184.216.34'];
      return ['127.0.0.1'];
    },
    async resolve4(hostname) {
      if (hostname === 'example.com') return ['93.184.216.34'];
      return ['127.0.0.1'];
    },
    async resolve6() { return ['::1']; },
    async reverse() { return ['localhost']; }
  };

  function dnsLookup(hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? {} : options;
    VirtualDnsPromises.lookup(hostname, opts).then((res) => {
      if (typeof cb !== 'function') return;
      if (Array.isArray(res)) cb(null, res);
      else cb(null, res.address, res.family);
    }, (err) => { if (typeof cb === 'function') cb(err); });
  }
  dnsLookup[utilPromisify.custom] = VirtualDnsPromises.lookup;

  const VirtualDns = {
    ADDRCONFIG: 1024,
    V4MAPPED: 2048,
    lookup: dnsLookup,
    resolve(hostname, rrtype, callback) {
      const cb = typeof rrtype === 'function' ? rrtype : callback;
      const type = typeof rrtype === 'string' ? rrtype : 'A';
      VirtualDnsPromises.resolve(hostname, type).then((r) => cb && cb(null, r), (e) => cb && cb(e));
    },
    resolve4(hostname, options, callback) {
      const cb = typeof options === 'function' ? options : callback;
      VirtualDnsPromises.resolve4(hostname).then((r) => cb && cb(null, r), (e) => cb && cb(e));
    },
    resolve6(hostname, options, callback) {
      const cb = typeof options === 'function' ? options : callback;
      VirtualDnsPromises.resolve6(hostname).then((r) => cb && cb(null, r), (e) => cb && cb(e));
    },
    reverse(ip, callback) {
      VirtualDnsPromises.reverse(ip).then((r) => callback && callback(null, r), (e) => callback && callback(e));
    },
    promises: VirtualDnsPromises
  };

  // --- node:net (In-Memory Loopback TCP Server & Socket) ---
  function createVirtualNet(resourceTracker, sharedTrace = []) {
    const servers = new Map();
    let nextPort = 40000;

    class Socket extends Duplex {
      constructor(options = {}) {
        super(options);
        this.connecting = false;
        this.destroyed = false;
        this.remoteAddress = '127.0.0.1';
        this.remoteFamily = 'IPv4';
        this.remotePort = null;
        this.localAddress = '127.0.0.1';
        this.localPort = null;
        this.bytesRead = 0;
        this.bytesWritten = 0;
        this._peer = null;
        this._encoding = null;
        this._timeoutMs = 0;
        this._timeoutId = null;
        this._endEmitted = false;
      }

      setEncoding(enc) {
        this._encoding = enc;
        return this;
      }

      setNoDelay() { return this; }
      setKeepAlive() { return this; }
      ref() { return this; }
      unref() { return this; }

      setTimeout(ms, cb) {
        if (this._timeoutId) {
          clearTimeout(this._timeoutId);
          this._timeoutId = null;
        }
        this._timeoutMs = ms;
        if (typeof cb === 'function') this.once('timeout', cb);
        if (ms > 0 && !this.destroyed) {
          this._timeoutId = setTimeout(() => {
            this.emit('timeout');
          }, ms);
        }
        return this;
      }

      address() {
        return { port: this.localPort || 0, family: 'IPv4', address: this.localAddress };
      }

      connect(...args) {
        let port;
        let host = '127.0.0.1';
        let connectListener = null;
        if (typeof args[0] === 'object' && args[0] !== null) {
          port = Number(args[0].port);
          if (args[0].host) host = args[0].host;
          if (typeof args[1] === 'function') connectListener = args[1];
        } else {
          port = Number(args[0]);
          if (typeof args[1] === 'string') {
            host = args[1];
            if (typeof args[2] === 'function') connectListener = args[2];
          } else if (typeof args[1] === 'function') {
            connectListener = args[1];
          }
        }
        if (connectListener) this.once('connect', connectListener);

        this.connecting = true;
        this.remotePort = port;
        this.remoteAddress = host;
        this.localPort = nextPort++;

        queueMicrotask(() => {
          if (this.destroyed) return;
          const srv = servers.get(port);
          if (!srv || !srv.listening) {
            this.connecting = false;
            const err = new Error(`connect ECONNREFUSED ${host}:${port}`);
            err.code = 'ECONNREFUSED';
            err.errno = -111;
            err.syscall = 'connect';
            err.address = host;
            err.port = port;
            this.emit('error', err);
            return;
          }

          const serverSocket = new Socket();
          serverSocket.localPort = port;
          serverSocket.remotePort = this.localPort;
          serverSocket._peer = this;
          this._peer = serverSocket;
          this.connecting = false;

          if (sharedTrace.length >= 500) sharedTrace.shift();
          sharedTrace.push({
            protocol: 'TCP',
            event: 'connect',
            localPort: this.localPort,
            remotePort: port,
            host,
            timestamp: Date.now()
          });

          srv._connections.add(serverSocket);
          serverSocket.once('close', () => srv._connections.delete(serverSocket));

          srv.emit('connection', serverSocket);
          this.emit('connect');
          this.emit('ready');
        });
        return this;
      }

      write(chunk, encoding, cb) {
        const callback = typeof encoding === 'function' ? encoding : cb;
        const enc = typeof encoding === 'string' ? encoding : 'utf8';
        if (this.destroyed) {
          const err = new Error('This socket has been ended by the other party');
          err.code = 'EPIPE';
          if (typeof callback === 'function') queueMicrotask(() => callback(err));
          return false;
        }
        const buf = VirtualBuffer.isBuffer(chunk) ? chunk : VirtualBuffer.from(String(chunk ?? ''), enc);
        this.bytesWritten += buf.length;

        const peer = this._peer;
        if (peer && !peer.destroyed) {
          queueMicrotask(() => {
            if (peer.destroyed) return;
            peer.bytesRead += buf.length;
            const out = peer._encoding ? buf.toString(peer._encoding) : buf;
            peer.emit('data', out);
            if (typeof callback === 'function') callback(null);
          });
        } else if (typeof callback === 'function') {
          queueMicrotask(() => callback(null));
        }
        return true;
      }

      end(chunk, encoding, cb) {
        const callback = typeof chunk === 'function' ? chunk : (typeof encoding === 'function' ? encoding : cb);
        const enc = typeof encoding === 'string' ? encoding : 'utf8';
        if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
          this.write(chunk, enc);
        }
        queueMicrotask(() => {
          if (this.destroyed) return;
          const peer = this._peer;
          if (peer && !peer.destroyed && !peer._endEmitted) {
            peer._endEmitted = true;
            peer.emit('end');
          }
          this.emit('finish');
          if (typeof callback === 'function') callback();
          this.destroy();
        });
        return this;
      }

      destroy(err) {
        if (this.destroyed) return this;
        this.destroyed = true;
        if (this._timeoutId) {
          clearTimeout(this._timeoutId);
          this._timeoutId = null;
        }
        const peer = this._peer;
        this._peer = null;
        queueMicrotask(() => {
          if (err) this.emit('error', err);
          this.emit('close', Boolean(err));
          if (peer && !peer.destroyed) {
            if (!peer._endEmitted) {
              peer._endEmitted = true;
              peer.emit('end');
            }
            peer.destroy();
          }
        });
        return this;
      }
    }

    class Server extends EventEmitter {
      constructor(options, connectionListener) {
        super();
        const cb = typeof options === 'function' ? options : connectionListener;
        if (typeof cb === 'function') this.on('connection', cb);
        this.listening = false;
        this._port = null;
        this._host = '127.0.0.1';
        this._connections = new Set();
      }

      listen(...args) {
        let port = 0;
        let host = '127.0.0.1';
        let cb = null;
        for (const arg of args) {
          if (typeof arg === 'number') port = arg;
          else if (typeof arg === 'string') host = arg;
          else if (typeof arg === 'function') cb = arg;
          else if (typeof arg === 'object' && arg !== null) {
            if (typeof arg.port === 'number') port = arg.port;
            if (typeof arg.host === 'string') host = arg.host;
          }
        }
        if (cb) this.once('listening', cb);
        if (!port || port === 0) {
          port = nextPort++;
          while (servers.has(port)) port = nextPort++;
        }
        this._port = port;
        this._host = host;
        this.listening = true;
        servers.set(port, this);
        queueMicrotask(() => {
          if (this.listening) this.emit('listening');
        });
        return this;
      }

      address() {
        if (!this.listening) return null;
        return { port: this._port, family: 'IPv4', address: this._host };
      }

      getConnections(cb) {
        if (typeof cb === 'function') queueMicrotask(() => cb(null, this._connections.size));
        return this;
      }

      close(cb) {
        if (typeof cb === 'function') this.once('close', cb);
        if (this._port !== null) servers.delete(this._port);
        this.listening = false;
        for (const sock of this._connections) {
          sock.destroy();
        }
        this._connections.clear();
        queueMicrotask(() => this.emit('close'));
        return this;
      }

      ref() { return this; }
      unref() { return this; }
    }

    function isIPv4(input) {
      const s = String(input || '');
      const parts = s.split('.');
      if (parts.length !== 4) return false;
      return parts.every((p) => /^(?:0|[1-9]\d*)$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
    }

    function isIPv6(input) {
      const s = String(input || '');
      if (!s.includes(':')) return false;
      return /^[0-9a-fA-F:]+$/.test(s);
    }

    function isIP(input) {
      if (isIPv4(input)) return 4;
      if (isIPv6(input)) return 6;
      return 0;
    }

    function createServer(options, connectionListener) {
      return new Server(options, connectionListener);
    }

    function createConnection(...args) {
      const sock = new Socket();
      return sock.connect(...args);
    }

    function closeAllServers() {
      for (const srv of servers.values()) {
        try { srv.close(); } catch (err) { _runtimeLogger.debug('vnet closeAllServers close failed', err); }
      }
      servers.clear();
    }

    return {
      Socket,
      Server,
      Stream: Socket,
      createServer,
      connect: createConnection,
      createConnection,
      isIP,
      isIPv4,
      isIPv6,
      closeAllServers,
      getTrace: () => [...sharedTrace]
    };
  }

  // =========================================================================
  // 7b. JSX / TSX SUPPORT
  // -------------------------------------------------------------------------
  // Rewrites JSX syntax into classic `createElement(...)` calls. This runs
  // BEFORE the string-masking pass so that JSX text (which routinely contains
  // quotes/apostrophes, e.g. <p>Don't</p>) is captured verbatim, while genuine
  // JS strings, comments and template literals are skipped untouched.
  // =========================================================================
  function detectJsxSyntax(source, filename) {
    if (/\.(jsx|tsx)$/i.test(filename || '')) return true;
    if (!source || source.indexOf('<') === -1) return false;
    if (/@jsx\b/.test(source)) return true;
    if (source.indexOf('<>') !== -1) return true;
    if (/<\/[A-Za-z]/.test(source)) return true;
    if (/<[A-Za-z_$][A-Za-z0-9_$:.\-]*\b[^>\n]*\/>/.test(source)) return true;
    return false;
  }

  function readJsxPragma(source) {
    let pragma = 'React.createElement';
    let frag = null;
    const m = /@jsx\s+([A-Za-z_$][\w$.]*)/.exec(source);
    if (m) pragma = m[1];
    const fm = /@jsxFrag\s+([A-Za-z_$][\w$.]*)/.exec(source);
    if (fm) frag = fm[1];
    if (!frag) frag = pragma === 'React.createElement' ? 'React.Fragment' : 'Fragment';
    return { pragma, frag };
  }

  const JSX_WS_RE = /\s/;
  const JSX_NAME_START_RE = /[A-Za-z_$]/;
  const JSX_NAME_CHAR_RE = /[A-Za-z0-9_$:.\-]/;

  function jsxThrow(message) {
    const err = new Error(message);
    err.jsxParse = true;
    throw err;
  }

  // Returns the exclusive end index if a JS string / template / comment starts
  // at `i`, otherwise -1. Regexes are deliberately ignored.
  function jsxSkipJsLiteral(source, i) {
    const ch = source[i];
    const next = source[i + 1];
    const len = source.length;
    if (ch === '/' && next === '/') {
      const e = source.indexOf('\n', i);
      return e === -1 ? len : e;
    }
    if (ch === '/' && next === '*') {
      const e = source.indexOf('*/', i + 2);
      return e === -1 ? len : e + 2;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < len) {
        const c = source[j];
        if (c === '\\') { j += 2; continue; }
        if (c === ch) { j++; break; }
        if (c === '\n') break;
        j++;
      }
      return j;
    }
    if (ch === '`') {
      let j = i + 1;
      let depth = 0;
      while (j < len) {
        const c = source[j];
        if (c === '\\') { j += 2; continue; }
        if (c === '$' && source[j + 1] === '{') { depth++; j += 2; continue; }
        if (c === '}' && depth > 0) { depth--; j++; continue; }
        if (c === '`' && depth === 0) { j++; break; }
        j++;
      }
      return j;
    }
    return -1;
  }

  function jsxReadName(source, i) {
    if (!JSX_NAME_START_RE.test(source[i] || '')) jsxThrow('jsx: expected a tag name');
    let j = i;
    while (j < source.length && JSX_NAME_CHAR_RE.test(source[j])) j++;
    return { name: source.slice(i, j), next: j };
  }

  function jsxSkipWs(source, i) {
    while (i < source.length && JSX_WS_RE.test(source[i])) i++;
    return i;
  }

  function isJsxCommentOnly(str) {
    if (!str) return true;
    let k = 0;
    while (k < str.length) {
      k = jsxSkipWs(str, k);
      if (k >= str.length) break;
      if (str[k] === '/' && (str[k + 1] === '/' || str[k + 1] === '*')) {
        const next = jsxSkipJsLiteral(str, k);
        if (next === -1) return false;
        k = next;
      } else {
        return false;
      }
    }
    return true;
  }

  function normalizeJsxText(raw) {
    if (!raw) return '';
    let t = raw.replace(/\r/g, '');
    if (t.indexOf('\n') !== -1) {
      t = t.split('\n').map((s) => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join(' ');
    } else if (!/\S/.test(t)) {
      return '';
    } else {
      t = t.replace(/[ \t]+/g, ' ');
    }
    return t ? JSON.stringify(t) : '';
  }

  // Reads a balanced `{ ... }` expression container, skipping nested JSX and
  // JS literals. Returns the raw inner source (later re-transformed) plus the
  // index just past the closing brace.
  function jsxReadBraced(source, i, opts) {
    let depth = 0;
    let j = i;
    while (j < source.length) {
      const lit = jsxSkipJsLiteral(source, j);
      if (lit !== -1) { j = lit; continue; }
      const c = source[j];
      if (c === '{') { depth++; j++; continue; }
      if (c === '}') {
        depth--;
        j++;
        if (depth === 0) return { inner: source.slice(i + 1, j - 1), next: j };
        continue;
      }
      if (c === '<' && (JSX_NAME_START_RE.test(source[j + 1] || '') || source[j + 1] === '>')) {
        try {
          const el = jsxParseElement(source, j, opts);
          j = el.next;
          continue;
        } catch (e) {
          if (!e || !e.jsxParse) throw e;
        }
      }
      j++;
    }
    jsxThrow('jsx: unterminated expression container');
  }

  function jsxParseElement(source, i, opts) {
    const o = opts || readJsxPragma(source);
    let j = i + 1;
    let isFragment = false;
    let typeExpr;
    if (source[j] === '>') {
      isFragment = true;
      typeExpr = o.frag;
      j++;
    } else {
      const nm = jsxReadName(source, j);
      j = nm.next;
      const raw = nm.name;
      const isReference = raw.indexOf('.') !== -1 || raw.indexOf(':') !== -1 || /^[A-Z_$]/.test(raw);
      if (isReference) {
        typeExpr = raw.replace(/:/g, '.');
      } else {
        typeExpr = JSON.stringify(raw);
      }
    }

    const props = [];
    let selfClosing = false;
    if (!isFragment) {
      for (;;) {
        j = jsxSkipWs(source, j);
        if (j >= source.length) jsxThrow('jsx: unexpected end of input inside a tag');
        const c = source[j];
        if (c === '/') {
          if (source[j + 1] !== '>') jsxThrow('jsx: malformed self-closing tag');
          j += 2;
          selfClosing = true;
          break;
        }
        if (c === '>') { j++; break; }
        if (c === '{') {
          const br = jsxReadBraced(source, j, o);
          const inner = br.inner.trim();
          if (inner.slice(0, 3) !== '...') jsxThrow('jsx: only a spread {...} may appear where an attribute is expected');
          props.push({ spread: jsxTransform(inner.slice(3), o) });
          j = br.next;
          continue;
        }
        if (!JSX_NAME_START_RE.test(c)) jsxThrow('jsx: malformed attribute');
        const am = jsxReadName(source, j);
        const attrName = am.name;
        j = jsxSkipWs(source, am.next);
        let valueExpr = 'true';
        if (source[j] === '=') {
          j = jsxSkipWs(source, j + 1);
          const vc = source[j];
          if (vc === '"' || vc === "'") {
            let k = j + 1;
            while (k < source.length && source[k] !== vc) {
              if (source[k] === '\\') k++;
              k++;
            }
            if (k >= source.length) jsxThrow('jsx: unterminated attribute string');
            valueExpr = JSON.stringify(source.slice(j + 1, k));
            j = k + 1;
          } else if (vc === '{') {
            const br = jsxReadBraced(source, j, o);
            valueExpr = jsxTransform(br.inner, o) || 'undefined';
            j = br.next;
          } else if (vc === '<') {
            const el = jsxParseElement(source, j, o);
            valueExpr = el.code;
            j = el.next;
          } else {
            jsxThrow('jsx: unsupported attribute value');
          }
        }
        const propKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(attrName) ? attrName : JSON.stringify(attrName);
        props.push({ key: propKey, value: valueExpr });
      }
    }

    const children = [];
    if (!selfClosing) {
      for (;;) {
        if (j >= source.length) jsxThrow('jsx: missing closing tag');
        const c = source[j];
        if (c === '<' && source[j + 1] === '/') {
          j = jsxSkipWs(source, j + 2);
          if (source[j] === '>') { j++; break; }
          const cm = jsxReadName(source, j);
          j = jsxSkipWs(source, cm.next);
          if (source[j] !== '>') jsxThrow('jsx: malformed closing tag');
          j++;
          break;
        }
        if (c === '<') {
          const el = jsxParseElement(source, j, o);
          children.push(el.code);
          j = el.next;
          continue;
        }
        if (c === '{') {
          const br = jsxReadBraced(source, j, o);
          if (!isJsxCommentOnly(br.inner)) {
            const inner = jsxTransform(br.inner, o);
            if (inner && inner.trim()) {
              children.push(inner.indexOf('//') !== -1 && !inner.endsWith('\n') ? inner + '\n' : inner);
            }
          }
          j = br.next;
          continue;
        }
        let k = j;
        while (k < source.length && source[k] !== '<' && source[k] !== '{') k++;
        const text = normalizeJsxText(source.slice(j, k));
        if (text) children.push(text);
        j = k;
      }
    }

    let propsCode = 'null';
    if (props.length) {
      const parts = props.map((p) => (p.spread !== undefined ? '...(' + p.spread + ')' : p.key + ': ' + p.value));
      propsCode = '{ ' + parts.join(', ') + ' }';
    }

    const args = [typeExpr, propsCode].concat(children);
    return { code: o.pragma + '(' + args.join(', ') + ')', next: j };
  }

  function jsxTransform(source, opts) {
    const o = opts || readJsxPragma(source);
    let i = 0;
    let out = '';
    while (i < source.length) {
      const lit = jsxSkipJsLiteral(source, i);
      if (lit !== -1) { out += source.slice(i, lit); i = lit; continue; }
      const ch = source[i];
      if (ch === '<' && (JSX_NAME_START_RE.test(source[i + 1] || '') || source[i + 1] === '>')) {
        try {
          const el = jsxParseElement(source, i, o);
          out += el.code;
          i = el.next;
          continue;
        } catch (e) {
          if (!e || !e.jsxParse) throw e;
        }
      }
      out += ch;
      i++;
    }
    return out;
  }

  // =========================================================================
  // 8. FAST TYPESCRIPT & ESM-TO-CJS TRANSPILER
  // =========================================================================
  function transpileTS(source, filename = 'module.ts', opts = {}) {
    // `keepEsm` leaves `import`/`export` statements intact so the output can run
    // natively in a browser as an ES module (used by the built-in preview server).
    const keepEsm = Boolean(opts && opts.keepEsm);
    const isTS = /\.(ts|tsx|mts|cts)$/i.test(filename)
      || /^[ \t]*(?:export\s+)?(?:abstract\s+class\s+[A-Za-z_$]|declare\s+(?:const|let|var|function|class|namespace|module|global)\b|interface\s+[A-Za-z_$][A-Za-z0-9_$]*|type\s+[A-Za-z_$][A-Za-z0-9_$]*\s*(?:<[^>]*>)?\s*=|enum\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\{|namespace\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\{)/m.test(source);
    const hasESM = /^\s*(?:import|export)\b/m.test(source)
      || /\bexport\s*\{/.test(source)
      || /\bimport\s*\{/.test(source)
      || /\bexport\s+default\b/.test(source);
    const hasJsx = detectJsxSyntax(source, filename);
    if (!isTS && !hasESM && !hasJsx) return source;

    // JSX/TSX must be rewritten before masking so JSX text is kept verbatim.
    if (hasJsx) {
      const { pragma, frag } = readJsxPragma(source);
      const hasReactBinding = /\bimport\s+(?!type\b)(?:\*\s+as\s+React\b|React\b)|(?:\bconst|\blet|\bvar|\bfunction|\bclass)\s+React\b|\bReact\s*=/.test(source);
      const needsReact = pragma === 'React.createElement' && (keepEsm ? !hasReactBinding : !/\bReact\b/.test(source));
      const transformed = jsxTransform(source, { pragma, frag });
      if (transformed !== source) {
        source = transformed;
        // The classic runtime needs a React binding available to the JSX output.
        if (needsReact) {
          source = (keepEsm ? 'import React from "react";\n' : 'const React = require("react");\n') + source;
        }
      } else if (!isTS && !hasESM) {
        return source;
      }
    }

    // Step 1: Mask strings, template literals, regex literals, and comments so transforms never corrupt literals
    const placeholders = [];
    const mask = (str) => {
      const id = `\x00__LIT_${placeholders.length}__\x00`;
      placeholders.push(str);
      return id;
    };

    const canPrecedeRegex = (prefix) => {
      const trimmed = prefix.trimEnd();
      if (!trimmed) return true;
      const lastChar = trimmed[trimmed.length - 1];
      if ('(,=:[!&|?{};+-*/%~^<>'.includes(lastChar)) return true;
      return /\b(?:return|throw|case|in|of|typeof|instanceof|void|delete|await|yield)$/.test(trimmed);
    };

    let code = '';
    let i = 0;
    const len = source.length;
    while (i < len) {
      const ch = source[i];
      const next = source[i + 1];
      // Single-line comment
      if (ch === '/' && next === '/') {
        let end = source.indexOf('\n', i + 2);
        if (end === -1) end = len;
        code += mask(source.slice(i, end));
        i = end;
        continue;
      }
      // Multi-line comment
      if (ch === '/' && next === '*') {
        let end = source.indexOf('*/', i + 2);
        if (end === -1) end = len; else end += 2;
        code += mask(source.slice(i, end));
        i = end;
        continue;
      }
      // Regex literal `/.../flags`
      if (ch === '/' && next !== '/' && next !== '*' && next !== '=' && canPrecedeRegex(code)) {
        let j = i + 1;
        let inCharClass = false;
        let validRegex = false;
        while (j < len) {
          const rc = source[j];
          if (rc === '\n' || rc === '\r') break;
          if (rc === '\\') { j += 2; continue; }
          if (rc === '[') { inCharClass = true; j++; continue; }
          if (rc === ']' && inCharClass) { inCharClass = false; j++; continue; }
          if (rc === '/' && !inCharClass) {
            validRegex = true;
            j++;
            while (j < len && /[dgimsuvy]/.test(source[j])) j++;
            break;
          }
          j++;
        }
        if (validRegex) {
          code += mask(source.slice(i, j));
          i = j;
          continue;
        }
      }
      // Single or double quoted string
      if (ch === "'" || ch === '"') {
        let j = i + 1;
        while (j < len) {
          if (source[j] === '\\') { j += 2; continue; }
          if (source[j] === ch || source[j] === '\n') { j++; break; }
          j++;
        }
        code += mask(source.slice(i, j));
        i = j;
        continue;
      }
      // Template literal
      if (ch === '`') {
        let j = i + 1;
        let depth = 0;
        while (j < len) {
          if (source[j] === '\\') { j += 2; continue; }
          if (source[j] === '$' && source[j + 1] === '{') { depth++; j += 2; continue; }
          if (source[j] === '}' && depth > 0) { depth--; j++; continue; }
          if (source[j] === '`' && depth === 0) { j++; break; }
          j++;
        }
        code += mask(source.slice(i, j));
        i = j;
        continue;
      }
      code += ch;
      i++;
    }

    // Helper: split string on top-level delimiter (ignoring nested <>, (), {}, [])
    const splitTopLevel = (str, sep = ',') => {
      const parts = [];
      let cur = '';
      let angle = 0, paren = 0, brace = 0, bracket = 0;
      for (let idx = 0; idx < str.length; idx++) {
        const c = str[idx];
        if (c === '<') angle++;
        else if (c === '>' && angle > 0) angle--;
        else if (c === '(') paren++;
        else if (c === ')' && paren > 0) paren--;
        else if (c === '{') brace++;
        else if (c === '}' && brace > 0) brace--;
        else if (c === '[') bracket++;
        else if (c === ']' && bracket > 0) bracket--;
        if (c === sep && angle === 0 && paren === 0 && brace === 0 && bracket === 0) {
          parts.push(cur);
          cur = '';
        } else {
          cur += c;
        }
      }
      parts.push(cur);
      return parts;
    };

    // Helper: strip `: Type` from a single parameter declaration (keeping default `= ...`)
    const cleanSingleParam = (rawParam) => {
      const leadWS = (rawParam.match(/^\s*/) || [''])[0];
      let trimmed = rawParam.trim();
      if (!trimmed) return rawParam;
      let colonIdx = -1;
      let eqIdx = -1;
      let angle = 0, paren = 0, brace = 0, bracket = 0;
      for (let idx = 0; idx < trimmed.length; idx++) {
        const c = trimmed[idx];
        if (c === '=' && trimmed[idx + 1] === '>') { idx++; continue; }
        if (c === '<') angle++;
        else if (c === '>' && angle > 0) angle--;
        else if (c === '(') paren++;
        else if (c === ')' && paren > 0) paren--;
        else if (c === '{') brace++;
        else if (c === '}' && brace > 0) brace--;
        else if (c === '[') bracket++;
        else if (c === ']' && bracket > 0) bracket--;
        else if (c === ':' && angle === 0 && paren === 0 && brace === 0 && bracket === 0 && colonIdx === -1 && eqIdx === -1) {
          colonIdx = idx;
        } else if (c === '=' && angle === 0 && paren === 0 && brace === 0 && bracket === 0 && eqIdx === -1) {
          eqIdx = idx;
          break;
        }
      }
      if (colonIdx === -1) return rawParam;
      let lhs = trimmed.slice(0, colonIdx).trimEnd();
      if (lhs.endsWith('?')) lhs = lhs.slice(0, -1).trimEnd();
      const defPart = eqIdx !== -1 ? ' = ' + trimmed.slice(eqIdx + 1).trim() : '';
      return leadWS + lhs + defPart;
    };

    if (isTS) {
      // Remove `declare ...` statements
      code = code.replace(/^\s*(?:export\s+)?declare\s+(?:const|let|var|function|class|type|interface)\s+[^;{}\n]+(?:;|\{[^}]*\})?/gm, '');

      // Remove `export interface ... { ... }` and `interface ... { ... }` with balanced braces
      const stripBracedBlock = (input, headerRe) => {
        let result = input;
        let match;
        headerRe.lastIndex = 0;
        while ((match = headerRe.exec(result)) !== null) {
          const start = match.index;
          const braceIdx = start + match[0].length - 1;
          let depth = 1;
          let k = braceIdx + 1;
          while (k < result.length && depth > 0) {
            if (result[k] === '{') depth++;
            else if (result[k] === '}') depth--;
            k++;
          }
          result = result.slice(0, start) + result.slice(k);
          headerRe.lastIndex = start;
        }
        return result;
      };

      code = stripBracedBlock(code, /\b(?:export\s+)?interface\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^{]*>)?(?:\s+extends\s+[^{]+)?\s*\{/g);

      // Transform `enum Name { A, B = 1, C = 'c' }` into runtime IIFE (stripping any masked comments inside enum body)
      code = code.replace(/\b(export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{([^}]*)\}/g, (_, isExp, name, body) => {
        const cleanBody = body.replace(/\x00__LIT_(\d+)__\x00/g, (m, id) => {
          const lit = placeholders[Number(id)] || '';
          return (lit.startsWith('//') || lit.startsWith('/*')) ? '' : m;
        });
        const items = splitTopLevel(cleanBody, ',').map((s) => s.trim()).filter(Boolean);
        let autoVal = 0;
        const assigns = [];
        for (const item of items) {
          const eqIdx = item.indexOf('=');
          if (eqIdx !== -1) {
            const k = item.slice(0, eqIdx).trim();
            const v = item.slice(eqIdx + 1).trim();
            const num = Number(v);
            if (!Number.isNaN(num) && v !== '') {
              assigns.push(`${name}[${name}[${JSON.stringify(k)}] = ${num}] = ${JSON.stringify(k)};`);
              autoVal = num + 1;
            } else {
              assigns.push(`${name}[${JSON.stringify(k)}] = ${v};`);
            }
          } else {
            assigns.push(`${name}[${name}[${JSON.stringify(item)}] = ${autoVal++}] = ${JSON.stringify(item)};`);
          }
        }
        return `${isExp ? 'export ' : ''}const ${name} = {}; (function(${name}){ ${assigns.join(' ')} })(${name});`;
      });

      // Remove `export type { ... } from ...` or `export type { ... }` (single or multi-line)
      code = code.replace(/^\s*export\s+type\s*\{[\s\S]*?\}(?:\s*from\s*[^\n;]+)?;?/gm, '');

      // Remove `type Foo<...> = ...;` (including multi-line object type aliases)
      code = stripBracedBlock(code, /^\s*(?:export\s+)?type\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^>]*>)?\s*=\s*\{/gm);
      code = code.replace(/^\s*(?:export\s+)?type\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^>]*>)?\s*=\s*[^;]+;?/gm, '');

      // Remove `import type ...` (including multi-line `import type { ... } from ...`)
      code = code.replace(/^\s*import\s+type\s*\{[\s\S]*?\}\s*from\s*[^\n;]+;?/gm, '');
      code = code.replace(/^\s*import\s+type\s+[^;\n]+;?/gm, '');

      // Convert `abstract class` -> `class`
      code = code.replace(/\b(export\s+(?:default\s+)?)?abstract\s+class\b/g, '$1class');

      // Remove abstract methods: `abstract foo(...): ...;`
      code = code.replace(/^[ \t]*(?:(?:public|private|protected)\s+)?abstract\s+[A-Za-z_$][A-Za-z0-9_$]*\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^;\n]+)?;/gm, '');

      // Remove generic type parameters on classes & functions (supporting nested `<T extends Record<string, any>>`)
      const stripGenericDeclParams = (input) => {
        let out = input;
        const re = /(\b(?:class|function)\s+[A-Za-z_$][A-Za-z0-9_$]*)\s*</g;
        let m;
        while ((m = re.exec(out)) !== null) {
          const angleStart = m.index + m[0].length - 1;
          let depth = 1;
          let k = angleStart + 1;
          while (k < out.length && depth > 0) {
            if (out[k] === '<') depth++;
            else if (out[k] === '>') depth--;
            k++;
          }
          if (depth === 0) {
            out = out.slice(0, angleStart) + out.slice(k);
            re.lastIndex = m.index + m[1].length;
          }
        }
        return out;
      };
      code = stripGenericDeclParams(code);

      // Strip generic type parameters on arrow functions: `= <T extends ...>(...)` or `= async <T>(...)`
      const stripArrowGenerics = (input) => {
        let out = input;
        const re = /(=\s*(?:async\s+)?|[\s(,]async\s+|\(\s*)</g;
        let m;
        while ((m = re.exec(out)) !== null) {
          const angleStart = m.index + m[0].length - 1;
          let depth = 1;
          let k = angleStart + 1;
          while (k < out.length && depth > 0) {
            if (out[k] === '<') depth++;
            else if (out[k] === '>') depth--;
            k++;
          }
          if (depth === 0) {
            const after = out.slice(k).trimStart();
            if (after.startsWith('(')) {
              out = out.slice(0, angleStart) + out.slice(k);
              re.lastIndex = m.index + m[1].length;
            }
          }
        }
        return out;
      };
      code = stripArrowGenerics(code);

      // Remove `implements ...` on classes and generic type args on `extends Foo<T>`
      code = code.replace(/(\bclass\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s+extends\s+[A-Za-z0-9_$.<>]+)?)\s+implements\s+[^{]+(\{)/g, '$1 $2');
      let prevExt;
      do {
        prevExt = code;
        code = code.replace(/(\bextends\s+[A-Za-z_$][A-Za-z0-9_$.]*)\s*<[^<>]*>/g, '$1');
      } while (code !== prevExt);

      // Handle constructor parameter properties (supporting derived classes with `super(...)` and `override` modifier)
      const transformConstructors = (input) => {
        let result = input;
        const ctorRe = /\bconstructor\s*\(([\s\S]*?)\)\s*\{/g;
        let match;
        while ((match = ctorRe.exec(result)) !== null) {
          const fullMatch = match[0];
          const params = match[1];
          const startIdx = match.index;
          const openBraceIdx = startIdx + fullMatch.length - 1;

          const propInits = [];
          const parts = splitTopLevel(params, ',');
          const cleanParams = parts.map((p) => {
            let trimmed = p.trim();
            if (!trimmed) return '';
            const modMatch = /^(?:(public|private|protected|readonly|override)\s+)+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(trimmed);
            if (modMatch) {
              const propName = modMatch[2];
              propInits.push(`this.${propName} = ${propName};`);
              trimmed = trimmed.replace(/^(?:(?:public|private|protected|readonly|override)\s+)+/, '');
            }
            return cleanSingleParam(trimmed).trim();
          }).filter(Boolean).join(', ');

          // Find end of constructor body to see if `super(...)` is called
          let depth = 1;
          let k = openBraceIdx + 1;
          while (k < result.length && depth > 0) {
            if (result[k] === '{') depth++;
            else if (result[k] === '}') depth--;
            k++;
          }
          const bodySlice = result.slice(openBraceIdx + 1, k - 1);
          const initCode = propInits.join(' ');
          let newBodySlice = bodySlice;

          if (propInits.length > 0) {
            const superMatch = /\bsuper\s*\(/.exec(bodySlice);
            if (superMatch) {
              let pDepth = 1;
              let sIdx = superMatch.index + superMatch[0].length;
              while (sIdx < bodySlice.length && pDepth > 0) {
                if (bodySlice[sIdx] === '(') pDepth++;
                else if (bodySlice[sIdx] === ')') pDepth--;
                sIdx++;
              }
              if (bodySlice[sIdx] === ';') sIdx++;
              newBodySlice = bodySlice.slice(0, sIdx) + '; ' + initCode + bodySlice.slice(sIdx);
            } else {
              newBodySlice = ' ' + initCode + bodySlice;
            }
          }

          const replacement = `constructor(${cleanParams}) {${newBodySlice}}`;
          result = result.slice(0, startIdx) + replacement + result.slice(k);
          ctorRe.lastIndex = startIdx + replacement.length;
        }
        return result;
      };
      code = transformConstructors(code);

      // Remove uninitialized class field declarations like `  private count: number;`
      code = code.replace(/^[ \t]*(?:(?:public|private|protected|readonly|override|abstract)\s+)*[A-Za-z_$][A-Za-z0-9_$]*[?!]?\s*:\s*[^=;\n{}]+;[ \t]*$/gm, '');

      // Strip access modifiers on initialized class fields or methods (including `get`/`set`/`async`/`static`)
      code = code.replace(/^[ \t]*(?:(?:public|private|protected|readonly|override|abstract)\s+)+(?=(?:static\s+|async\s+|get\s+|set\s+)?[A-Za-z_$])/gm, '  ');
      code = code.replace(/^[ \t]*static\s+(?:(?:public|private|protected|readonly|override)\s+)+(?=[A-Za-z_$])/gm, '  static ');

      // Strip type annotations on initialized class fields (including nested `{ a: string; b: number }` inside generics)
      code = code.replace(/^([ \t]*(?:static\s+)?[A-Za-z_$][A-Za-z0-9_$]*)[?!]?\s*:\s*(?:[^=\n<>()!]|<[^=\n]*>)+(?<![=!<>])=(?![=>])\s*/gm, '$1 = ');

      // Strip non-null assertions `expr!` BEFORE generic call stripping so `fn!<T>()` works cleanly
      let prevCode;
      do {
        prevCode = code;
        code = code.replace(/([A-Za-z0-9_$)\]\x00])!(?!=)/g, '$1');
      } while (code !== prevCode);

      // Strip generic type arguments on `new Foo<Bar<Baz>>(...)` or `fn<Bar>(...)` or `method<{ a: number }>(...)`
      do {
        prevCode = code;
        code = code.replace(/(\b[A-Za-z_$][A-Za-z0-9_$.]*)\s*<[^<>()\n]+>\s*\(/g, (full, ident) => {
          if (['if', 'for', 'while', 'switch', 'return', 'typeof', 'instanceof'].includes(ident)) return full;
          return `${ident}(`;
        });
      } while (code !== prevCode);

      // Strip generic type parameters on class methods: `  async find<T extends U>(...)` -> `  async find(...)`
      do {
        prevCode = code;
        code = code.replace(/^([ \t]*(?:static\s+)?(?:async\s+)?[A-Za-z_$][A-Za-z0-9_$]*)\s*<[^<>()\n]+>\s*\(/gm, '$1(');
      } while (code !== prevCode);

      // Strip return type annotations on functions/methods/arrow functions: `): ReturnType {` or `): ReturnType =>`
      const stripReturnTypes = (input) => {
        let out = '';
        let idx = 0;
        while (idx < input.length) {
          const closeParen = input.indexOf(')', idx);
          if (closeParen === -1) {
            out += input.slice(idx);
            break;
          }
          out += input.slice(idx, closeParen + 1);
          let k = closeParen + 1;
          while (k < input.length && (input[k] === ' ' || input[k] === '\t' || input[k] === '\n' || input[k] === '\r')) k++;
          if (input[k] !== ':') {
            idx = closeParen + 1;
            continue;
          }
          let t = k + 1;
          let angle = 0, paren = 0, brace = 0, bracket = 0;
          let foundBodyStart = -1;
          while (t < input.length) {
            const c = input[t];
            const nxt = input[t + 1];
            if (angle === 0 && paren === 0 && brace === 0 && bracket === 0) {
              if (c === '=' && nxt === '>') {
                foundBodyStart = t;
                break;
              }
              if (c === '{') {
                let bDepth = 1;
                let u = t + 1;
                while (u < input.length && bDepth > 0) {
                  if (input[u] === '{') bDepth++;
                  else if (input[u] === '}') bDepth--;
                  u++;
                }
                const afterBrace = input.slice(u).trimStart();
                if (afterBrace.startsWith('{') || afterBrace.startsWith('=>') || afterBrace.startsWith('|') || afterBrace.startsWith('&') || afterBrace.startsWith('[')) {
                  t = u;
                  continue;
                }
                foundBodyStart = t;
                break;
              }
              if (c === ';' || c === ',') break;
            }
            if (c === '=' && nxt === '>') { t += 2; continue; }
            if (c === '<') angle++;
            else if (c === '>' && angle > 0) angle--;
            else if (c === '(') paren++;
            else if (c === ')' && paren > 0) {
              paren--;
              if (paren === 0 && angle === 0 && brace === 0 && bracket === 0) {
                let pNext = t + 1;
                while (pNext < input.length && (input[pNext] === ' ' || input[pNext] === '\t')) pNext++;
                if (input[pNext] === '=' && input[pNext + 1] === '>') {
                  t = pNext + 2;
                  continue;
                }
              }
            }
            else if (c === '[') bracket++;
            else if (c === ']' && bracket > 0) bracket--;
            else if (c === '{') brace++;
            else if (c === '}') {
              if (brace > 0) brace--;
              else break;
            }
            t++;
          }
          if (foundBodyStart !== -1) {
            const typeSegment = input.slice(k + 1, foundBodyStart).trim();
            if (typeSegment.length > 0 && !/^[0-9]/.test(typeSegment)) {
              out += ' ';
              idx = foundBodyStart;
              continue;
            }
          }
          idx = closeParen + 1;
        }
        return out;
      };
      code = stripReturnTypes(code);

      // Strip parameter type annotations inside `(...)` (supports multi-line parameter lists and default value `()` calls)
      code = code.replace(/\(((?:[^()]|\([^()]*\))*)\)/g, (full, inner) => {
        if (!inner.includes(':')) return full;
        if (inner.includes('?') && !/[A-Za-z0-9_$}\]]\s*\?\s*:/.test(inner)) return full;
        if (/[{}]/.test(inner) && !/\}\s*\??\s*:/.test(inner) && !/:\s*[A-Za-z_$][A-Za-z0-9_$.<>[\]|&\s]*\{/.test(inner)) {
          const partsCheck = splitTopLevel(inner, ',');
          const looksLikeTypedParams = partsCheck.every((p) => {
            const s = p.trim();
            return !s || /^(?:\.\.\.)?[A-Za-z_$][A-Za-z0-9_$]*\s*\??\s*:/.test(s) || /^\{[\s\S]*\}\s*\??\s*:/.test(s);
          });
          if (!looksLikeTypedParams) return full;
        }
        const parts = splitTopLevel(inner, ',');
        const cleaned = parts.map((part) => cleanSingleParam(part));
        return `(${cleaned.join(',')})`;
      });

      // Strip variable type annotations: `const x: Type =`, `let y: Type =`
      code = code.replace(/\b(const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*[^=;\n]+(?<![=!<>])=(?![=>])/g, '$1 $2 =');

      // Strip `as Type` and `satisfies Type` assertions (supporting object types `{ a: number }`, tuples `[number, string]`, generics, unions)
      const stripAsAndSatisfies = (input) => {
        let result = input;
        const kwRe = /(\S)[ \t]+(?:as|satisfies)[ \t]+/g;
        let match;
        while ((match = kwRe.exec(result)) !== null) {
          const prevChar = match[1];
          // Avoid matching `import * as foo` or `export { a as b }`
          const beforeSlice = result.slice(Math.max(0, match.index - 30), match.index + 1);
          if (/\b(?:import|export)\b[^;\n]*$/.test(beforeSlice)) continue;
          if (!/[A-Za-z0-9_$)\]}`"'\x00]/.test(prevChar)) continue;

          const typeStart = match.index + match[0].length;
          let k = typeStart;
          let angle = 0, brace = 0, bracket = 0, paren = 0;
          let consumedAny = false;

          while (k < result.length) {
            const ch = result[k];
            if (ch === '<') { angle++; consumedAny = true; k++; continue; }
            if (ch === '>' && angle > 0) { angle--; k++; continue; }
            if (ch === '{') { brace++; consumedAny = true; k++; continue; }
            if (ch === '}' && brace > 0) { brace--; k++; continue; }
            if (ch === '[') { bracket++; consumedAny = true; k++; continue; }
            if (ch === ']' && bracket > 0) { bracket--; k++; continue; }
            if (ch === '(') {
              if (!consumedAny) { paren++; consumedAny = true; k++; continue; }
              if (angle > 0 || brace > 0 || bracket > 0 || paren > 0) { paren++; k++; continue; }
              break;
            }
            if (ch === ')' && paren > 0) { paren--; k++; continue; }

            if (angle === 0 && brace === 0 && bracket === 0 && paren === 0) {
              if (ch === ';' || ch === ',' || ch === ')' || ch === ']' || ch === '}' || ch === '?' || ch === ':' || ch === '=') {
                break;
              }
              if (ch === '\n' || ch === '\r') {
                const restTrim = result.slice(k).trimStart();
                if (restTrim.startsWith('|') || restTrim.startsWith('&')) {
                  k++;
                  continue;
                }
                break;
              }
              if (ch === ' ' || ch === '\t') {
                const afterWS = result.slice(k).trimStart();
                if (/^(?:as|satisfies)\b/.test(afterWS) || /^[|&]/.test(afterWS) || /^readonly\b/.test(sequenceAt(result, typeStart, k))) {
                  k++;
                  continue;
                }
                if (consumedAny) break;
              }
              if (/[A-Za-z0-9_$.|&\x00]/.test(ch)) {
                consumedAny = true;
                k++;
                continue;
              }
              break;
            }
            k++;
          }

          if (consumedAny && k > typeStart) {
            result = result.slice(0, match.index + 1) + result.slice(k);
            kwRe.lastIndex = match.index;
          }
        }
        return result;
      };
      function sequenceAt(str, start, end) {
        return str.slice(start, end).trim();
      }
      code = stripAsAndSatisfies(code);

      // Second pass for non-null assertions `expr!` after generic call stripping (`fn<T>()!.prop`)
      do {
        prevCode = code;
        code = code.replace(/([A-Za-z0-9_$)\]\x00])!(?!=)/g, '$1');
      } while (code !== prevCode);
    }

    if ((hasESM || isTS) && !keepEsm) {
      // Convert ES module imports (including multi-line `{ ... }`)
      code = code.replace(/\bimport\s*\*\s*as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*from\s*([^\n;]+);?/gm, 'const $1 = require($2);');
      code = code.replace(/\bimport\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*,\s*\{([\s\S]*?)\}\s*from\s*([^\n;]+);?/gm, (_, defId, specifiers, mod) => {
        const cleaned = specifiers
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && !/^type\s+/.test(s))
          .map((s) => s.replace(/\s+as\s+/g, ': '))
          .join(', ');
        const mTrim = mod.trim();
        return `const ${defId} = (function(m){ return m && m.__esModule ? m.default : m; })(require(${mTrim}));` +
          (cleaned ? ` const { ${cleaned} } = require(${mTrim});` : '');
      });
      code = code.replace(/\bimport\s*\{([\s\S]*?)\}\s*from\s*([^\n;]+);?/gm, (_, specifiers, mod) => {
        const cleaned = specifiers
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && !/^type\s+/.test(s))
          .map((s) => s.replace(/\s+as\s+/g, ': '))
          .join(', ');
        return cleaned ? `const { ${cleaned} } = require(${mod.trim()});` : '';
      });
      code = code.replace(/\bimport\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+([^\n;]+);?/gm, 'const $1 = (function(m){ return m && m.__esModule ? m.default : m; })(require($2));');
      // Dynamic `import("pkg")` — resolve through the CJS loader instead of the
      // host's dynamic import, which cannot see the virtual filesystem.
      code = code.replace(/\bimport\s*\(\s*(\x00__LIT_\d+__\x00)\s*\)/g, 'Promise.resolve().then(() => require($1))');
      // Side-effect import `import"pkg"` / `import "pkg"`. By this point the
      // specifier is literal-masked, and minified modules emit no whitespace
      // between `import` and the string, so `\s*` (not `\s+`) is required.
      code = code.replace(/\bimport\s*(\x00__LIT_\d+__\x00)\s*;?/gm, 'require($1);');

      // Convert ES module exports
      const exportedNames = [];
      let defaultExportName = null;
      let hasEsmExport = false;

      code = code.replace(/\bexport\s*\*\s*as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*from\s*([^\n;]+);?/gm, (_, ns, mod) => {
        hasEsmExport = true;
        return `exports.${ns} = require(${mod.trim()});`;
      });
      code = code.replace(/\bexport\s*\*\s*from\s*([^\n;]+);?/gm, (_, mod) => {
        hasEsmExport = true;
        return `Object.assign(exports, require(${mod.trim()}));`;
      });
      code = code.replace(/\bexport\s+default\s+(async\s+function|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm, (_, kw, name) => {
        hasEsmExport = true;
        defaultExportName = name;
        return `${kw} ${name}`;
      });
      code = code.replace(/\bexport\s+default\s+/gm, () => {
        hasEsmExport = true;
        return 'exports.default = ';
      });
      code = code.replace(/\bexport\s+(async\s+function|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm, (_, kw, name) => {
        hasEsmExport = true;
        exportedNames.push(name);
        return `${kw} ${name}`;
      });
      code = code.replace(/\bexport\s+(const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm, (_, kw, name) => {
        hasEsmExport = true;
        exportedNames.push(name);
        return `${kw} ${name}`;
      });
      code = code.replace(/\bexport\s*\{([^}]+)\}\s*from\s*([^\n;]+);?/gm, (_, list, mod) => {
        hasEsmExport = true;
        const mTrim = mod.trim();
        return list.split(',').map((item) => {
          const cleanItem = item.trim().replace(/^type\s+/, '');
          if (!cleanItem) return '';
          const parts = cleanItem.split(/\s+as\s+/);
          const local = parts[0].trim();
          const exported = (parts[1] || parts[0]).trim();
          return `exports.${exported} = require(${mTrim}).${local};`;
        }).join(' ');
      });
      code = code.replace(/\bexport\s*\{([^}]+)\}\s*;?/gm, (_, list) => {
        hasEsmExport = true;
        return list.split(',').map((item) => {
          const trimmed = item.trim();
          if (!trimmed || /^type\s+/.test(trimmed)) return '';
          const parts = trimmed.split(/\s+as\s+/);
          if (!parts[0]) return '';
          const local = parts[0].trim();
          const exported = (parts[1] || parts[0]).trim();
          return `exports.${exported} = ${local};`;
        }).join(' ');
      });
      if (defaultExportName) {
        code += `\nexports.default = ${defaultExportName};`;
      }
      if (exportedNames.length > 0) {
        code += '\n' + exportedNames.map((n) => `exports.${n} = ${n};`).join('\n');
      }
      if (hasEsmExport) {
        code += '\nObject.defineProperty(exports, "__esModule", { value: true, enumerable: false, configurable: true });\n' +
          'if (Object.prototype.hasOwnProperty.call(exports, "default") && module.exports === exports) {\n' +
          '  if ((typeof exports.default === "object" && exports.default !== null) || typeof exports.default === "function") {\n' +
          '    module.exports = Object.assign(exports.default, exports);\n' +
          '    Object.defineProperty(module.exports, "__esModule", { value: true, enumerable: false, configurable: true });\n' +
          '  } else if (Object.keys(exports).every((k) => k === "default")) {\n' +
          '    module.exports = exports.default;\n' +
          '  }\n' +
          '}';
      }
    }

    // Restore masked literals
    code = code.replace(/\x00__LIT_(\d+)__\x00/g, (_, idx) => placeholders[Number(idx)]);
    return code;
  }

  // =========================================================================
  // 9. TEST HARNESS INSTRUMENTATION
  // =========================================================================
  function instrumentTestCode(code) {
    let out = code;
    // Pattern 1: `const test = (name, fn) => tests.push({ name, fn });`
    out = out.replace(
      /const\s+test\s*=\s*\(\s*name\s*,\s*fn\s*\)\s*=>\s*tests\.push\(\s*\{\s*name\s*,\s*fn\s*\}\s*\)\s*;/g,
      'const test = (name, fn) => { if (typeof __shouldSkipTest === "function" && __shouldSkipTest(name)) return; fn = typeof __wrapTestFn === "function" ? __wrapTestFn(name, fn) : fn; return tests.push({ name, fn }); };'
    );
    // Pattern 2: `function test(name, fn) {`
    out = out.replace(
      /function\s+test\s*\(\s*name\s*,\s*fn\s*\)\s*\{/g,
      'function test(name, fn) { if (typeof __shouldSkipTest === "function" && __shouldSkipTest(name)) return; fn = typeof __wrapTestFn === "function" ? __wrapTestFn(name, fn) : fn;'
    );
    return out;
  }

  // =========================================================================
  // 10. VIRTUAL RUNTIME EXECUTION ENGINE (`executeInVirtualRuntime`)
  // =========================================================================
  class ProcessExitSignal extends Error {
    constructor(code) {
      super(`process.exit(${code})`);
      this.name = 'ProcessExitSignal';
      this.exitCode = code;
      this._isProcessExit = true;
    }
  }

  const _npmPackageCache = new Map();
  const _npmMetadataCache = new Map();

  async function preloadNpmPackages(files = {}, secondArg = null, thirdArg = null) {
    // The 2nd/3rd arguments are overloaded for backwards compatibility:
    //   preloadNpmPackages(files)
    //   preloadNpmPackages(files, onProgress)                // progress callback (used by the Workbench)
    //   preloadNpmPackages(files, existingCache)             // package-text cache (Map)
    //   preloadNpmPackages(files, existingCache, onProgress)
    const isCacheLike = (v) => !!v && typeof v !== 'function' && typeof v.has === 'function' && typeof v.get === 'function';
    let onProgress = null;
    let existingCache = _npmPackageCache;
    if (typeof secondArg === 'function') onProgress = secondArg;
    else if (isCacheLike(secondArg)) existingCache = secondArg;
    if (typeof thirdArg === 'function') onProgress = onProgress || thirdArg;
    else if (isCacheLike(thirdArg)) existingCache = thirdArg;

    const specs = new Set();
    const builtinSet = new Set([
      'fs', 'fs/promises', 'path', 'os', 'crypto', 'zlib', 'http', 'https', 'net',
      'dns', 'dns/promises', 'string_decoder', 'child_process', 'process',
      'assert', 'assert/strict', 'events', 'util', 'util/types', 'url', 'querystring',
      'stream', 'stream/promises', 'stream/web', 'stream/consumers', 'test', 'perf_hooks',
      'timers', 'timers/promises', 'buffer', 'tty', 'tls', 'dgram', 'readline', 'readline/promises',
      'async_hooks', 'worker_threads', 'v8', 'vm', 'module', 'constants', 'domain',
      'diagnostics_channel', 'http2', 'cluster', 'repl', 'inspector', 'trace_events',
      'wasi', 'console',
      'bun', 'bun:test', 'bun:sqlite'
    ]);

    function addSpec(raw) {
      if (!raw || typeof raw !== 'string') return;
      const s = raw.trim();
      if (!s || s.startsWith('.') || s.startsWith('/') || s.startsWith('node:') || s.startsWith('bun:')) return;
      const parts = s.split('/');
      const pkgName = s.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
      if (builtinSet.has(pkgName) || builtinSet.has(s)) return;
      specs.add(pkgName);
    }

    for (const [filePath, content] of Object.entries(files || {})) {
      if (typeof content !== 'string') continue;
      if (filePath.endsWith('package.json')) {
        try {
          const pkgJson = JSON.parse(content);
          for (const dep of Object.keys(pkgJson.dependencies || {})) addSpec(dep);
        } catch (err) {
          _runtimeLogger.debug('preloadNpmPackages invalid package.json', err);
        }
        continue;
      }
      const reqRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      const impRe = /\bfrom\s+['"]([^'"]+)['"]/g;
      let m;
      while ((m = reqRe.exec(content)) !== null) addSpec(m[1]);
      while ((m = impRe.exec(content)) !== null) addSpec(m[1]);
    }

    // Follow declared dependencies transitively (best effort, bounded). Metadata
    // is memoised across calls so repeated preloads stay cheap.
    if (typeof fetch === 'function') {
      let pass = 0;
      while (pass < 6) {
        const pending = [];
        for (const pkg of specs) {
          if (!_npmMetadataCache.has(pkg)) pending.push(pkg);
        }
        if (pending.length === 0) break;
        pass++;
        await Promise.all(pending.map(async (pkg) => {
          let deps = [];
          try {
            const res = await fetch(`https://cdn.jsdelivr.net/npm/${pkg}/package.json`);
            if (res && res.ok) {
              const meta = await res.json();
              deps = Object.keys((meta && meta.dependencies) || {});
            }
          } catch (err) {
            _runtimeLogger.debug('preloadNpmPackages metadata fetch failed', { pkg, err });
          }
          _npmMetadataCache.set(pkg, deps);
        }));
        for (const pkg of pending) {
          for (const dep of (_npmMetadataCache.get(pkg) || [])) addSpec(dep);
        }
      }
    }

    const loaded = {};
    for (const pkg of specs) {
      const nmKey = `node_modules/${pkg}/index.js`;
      if (files[nmKey] || files[`/workspace/${nmKey}`]) continue;
      if (existingCache.has(pkg)) {
        loaded[pkg] = existingCache.get(pkg);
        continue;
      }
      if (typeof onProgress === 'function') {
        try { onProgress(pkg); } catch (err) { _runtimeLogger.debug('preloadNpmPackages onProgress callback failed', err); }
      }
      if (typeof fetch === 'function') {
        try {
          const res = await fetch(`https://cdn.jsdelivr.net/npm/${pkg}`);
          if (res && res.ok) {
            const text = await res.text();
            if (typeof existingCache.set === 'function') existingCache.set(pkg, text);
            loaded[pkg] = text;
          }
        } catch (err) {
          _runtimeLogger.debug('preloadNpmPackages package fetch failed', { pkg, err });
        }
      }
    }
    return loaded;
  }

  class WasiExitSignal extends Error {
    constructor(code) {
      super(`WASI proc_exit(${code})`);
      this.name = 'WasiExitSignal';
      this.code = Number(code) || 0;
      this._isWasiExit = true;
    }
  }

  function createVirtualWasi(defaults = {}) {
    class WASI {
      constructor(options = {}) {
        const merged = Object.assign({}, defaults, options);
        this.args = Array.isArray(merged.args) ? merged.args.map(String) : ['wasm'];
        this.env = merged.env && typeof merged.env === 'object' ? Object.assign({}, merged.env) : {};
        this.preopens = merged.preopens && typeof merged.preopens === 'object'
          ? Object.assign({}, merged.preopens)
          : { '.': '/workspace', '/workspace': '/workspace', '/usr': '/usr', '/tmp': '/tmp', '/': '/' };
        this.returnOnExit = merged.returnOnExit !== false;
        this.vfs = merged.vfs || createVirtualFs();
        this.onStdout = typeof merged.onStdout === 'function' ? merged.onStdout : null;
        this.onStderr = typeof merged.onStderr === 'function' ? merged.onStderr : null;
        const rawStdin = merged.stdin !== undefined ? merged.stdin : '';
        this._stdinBytes = typeof rawStdin === 'string'
          ? utf8Encode(rawStdin)
          : (rawStdin instanceof Uint8Array ? rawStdin : new Uint8Array(0));
        this._stdinPos = 0;
        this.memory = merged.memory || null;
        this._fds = new Map();
        this._nextFd = 3;

        this._fds.set(0, { type: 'stdio', path: '/dev/stdin', isDir: false, preopen: null, vfsFd: null });
        this._fds.set(1, { type: 'stdio', path: '/dev/stdout', isDir: false, preopen: null, vfsFd: null });
        this._fds.set(2, { type: 'stdio', path: '/dev/stderr', isDir: false, preopen: null, vfsFd: null });

        for (const [guestPath, hostPath] of Object.entries(this.preopens)) {
          const cleanHost = String(hostPath || '/');
          try {
            if (!this.vfs.existsSync(cleanHost)) {
              this.vfs.mkdirSync(cleanHost, { recursive: true });
            }
          } catch (err) {
            _runtimeLogger.debug('WASI preopen mkdir skipped', err);
          }
          const fd = this._nextFd++;
          this._fds.set(fd, {
            type: 'preopen',
            path: cleanHost,
            isDir: true,
            preopen: String(guestPath),
            vfsFd: null
          });
        }

        this.wasiImport = this._createImports();
      }

      _getMem(instance) {
        const mem = (instance && instance.exports && instance.exports.memory) || this.memory;
        if (!mem) throw new Error('WASI instance does not export WebAssembly.Memory');
        return {
          bytes: new Uint8Array(mem.buffer),
          view: new DataView(mem.buffer)
        };
      }

      _mapFsError(err) {
        const code = err && err.code;
        if (code === 'ENOENT') return 44;
        if (code === 'EBADF') return 8;
        if (code === 'EEXIST') return 20;
        if (code === 'EINVAL') return 28;
        if (code === 'EISDIR') return 31;
        if (code === 'ENOTDIR') return 54;
        if (code === 'ENOTEMPTY') return 55;
        if (code === 'EPERM' || code === 'EACCES') return 63;
        return 29; // EIO
      }

      _resolveAt(dirfd, relPath) {
        const dirEntry = this._fds.get(dirfd);
        if (!dirEntry || !dirEntry.isDir) return { err: 8, path: null };
        const cleanRel = String(relPath || '').replace(/\0+$/, '');
        if (!cleanRel || cleanRel === '.') return { err: 0, path: dirEntry.path };
        if (cleanRel.startsWith('/')) return { err: 0, path: VirtualPath.resolve('/', cleanRel) };
        return { err: 0, path: VirtualPath.resolve(dirEntry.path, cleanRel) };
      }

      _writeFilestat(view, bufPtr, stat, isDir) {
        view.setBigUint64(bufPtr + 0, 1n, true);
        view.setBigUint64(bufPtr + 8, BigInt(stat && stat.ino ? stat.ino : 1), true);
        view.setUint8(bufPtr + 16, isDir ? 3 : 4);
        for (let i = 17; i < 24; i++) view.setUint8(bufPtr + i, 0);
        view.setBigUint64(bufPtr + 24, 1n, true);
        view.setBigUint64(bufPtr + 32, BigInt(stat && stat.size ? stat.size : 0), true);
        const mtimeNs = BigInt(Math.floor((stat && stat.mtimeMs) || Date.now())) * 1000000n;
        view.setBigUint64(bufPtr + 40, mtimeNs, true);
        view.setBigUint64(bufPtr + 48, mtimeNs, true);
        view.setBigUint64(bufPtr + 56, mtimeNs, true);
      }

      _createImports() {
        const self = this;
        return {
          args_sizes_get(argcPtr, argvBufSizePtr) {
            const { view } = self._getMem();
            let total = 0;
            for (const arg of self.args) total += utf8Encode(arg).byteLength + 1;
            view.setUint32(argcPtr, self.args.length, true);
            view.setUint32(argvBufSizePtr, total, true);
            return 0;
          },
          args_get(argvPtr, argvBufPtr) {
            const { bytes, view } = self._getMem();
            let bufOffset = argvBufPtr;
            for (let i = 0; i < self.args.length; i++) {
              view.setUint32(argvPtr + i * 4, bufOffset, true);
              const enc = utf8Encode(self.args[i]);
              bytes.set(enc, bufOffset);
              bytes[bufOffset + enc.byteLength] = 0;
              bufOffset += enc.byteLength + 1;
            }
            return 0;
          },
          environ_sizes_get(countPtr, bufSizePtr) {
            const { view } = self._getMem();
            const entries = Object.entries(self.env);
            let total = 0;
            for (const [k, v] of entries) total += utf8Encode(`${k}=${v}`).byteLength + 1;
            view.setUint32(countPtr, entries.length, true);
            view.setUint32(bufSizePtr, total, true);
            return 0;
          },
          environ_get(environPtr, environBufPtr) {
            const { bytes, view } = self._getMem();
            const entries = Object.entries(self.env);
            let bufOffset = environBufPtr;
            for (let i = 0; i < entries.length; i++) {
              view.setUint32(environPtr + i * 4, bufOffset, true);
              const enc = utf8Encode(`${entries[i][0]}=${entries[i][1]}`);
              bytes.set(enc, bufOffset);
              bytes[bufOffset + enc.byteLength] = 0;
              bufOffset += enc.byteLength + 1;
            }
            return 0;
          },
          clock_res_get(_clockId, resPtr) {
            const { view } = self._getMem();
            view.setBigUint64(resPtr, 1000n, true);
            return 0;
          },
          clock_time_get(clockId, _precision, timePtr) {
            const { view } = self._getMem();
            const nowMs = clockId === 0 ? Date.now() : performance.now();
            view.setBigUint64(timePtr, BigInt(Math.round(nowMs * 1e6)), true);
            return 0;
          },
          fd_advise() { return 0; },
          fd_allocate(fd, offsetBig, lenBig) {
            const entry = self._fds.get(fd);
            if (!entry || entry.isDir || entry.vfsFd === null) return 8;
            try {
              const st = self.vfs.fstatSync(entry.vfsFd);
              const needed = Number(offsetBig) + Number(lenBig);
              if (needed > st.size) self.vfs.truncateSync(entry.path, needed);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_close(fd) {
            const entry = self._fds.get(fd);
            if (!entry) return 8;
            if (entry.type === 'stdio') return 0;
            if (entry.vfsFd !== null) {
              try { self.vfs.closeSync(entry.vfsFd); } catch (err) { _runtimeLogger.debug('WASI fd_close vfs error', err); }
            }
            self._fds.delete(fd);
            return 0;
          },
          fd_datasync() { return 0; },
          fd_sync() { return 0; },
          fd_fdstat_get(fd, statPtr) {
            const entry = self._fds.get(fd);
            if (!entry) return 8;
            const { view } = self._getMem();
            const filetype = entry.type === 'stdio' ? 2 : (entry.isDir ? 3 : 4);
            view.setUint8(statPtr + 0, filetype);
            view.setUint8(statPtr + 1, 0);
            view.setUint16(statPtr + 2, entry.fdflags || 0, true);
            view.setUint32(statPtr + 4, 0, true);
            view.setBigUint64(statPtr + 8, 0xffffffffffffffffn, true);
            view.setBigUint64(statPtr + 16, 0xffffffffffffffffn, true);
            return 0;
          },
          fd_fdstat_set_flags(fd, flags) {
            const entry = self._fds.get(fd);
            if (!entry) return 8;
            entry.fdflags = flags;
            return 0;
          },
          fd_fdstat_set_rights() { return 0; },
          fd_filestat_get(fd, bufPtr) {
            const entry = self._fds.get(fd);
            if (!entry) return 8;
            const { view } = self._getMem();
            if (entry.type === 'stdio') {
              self._writeFilestat(view, bufPtr, { ino: fd + 1, size: 0, mtimeMs: Date.now() }, false);
              view.setUint8(bufPtr + 16, 2);
              return 0;
            }
            try {
              const st = self.vfs.statSync(entry.path);
              self._writeFilestat(view, bufPtr, st, st.isDirectory());
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_filestat_set_size(fd, sizeBig) {
            const entry = self._fds.get(fd);
            if (!entry || entry.isDir) return 8;
            try {
              self.vfs.truncateSync(entry.path, Number(sizeBig));
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_filestat_set_times() { return 0; },
          fd_prestat_get(fd, bufPtr) {
            const entry = self._fds.get(fd);
            if (!entry || entry.type !== 'preopen') return 8;
            const { view } = self._getMem();
            const nameBytes = utf8Encode(entry.preopen);
            view.setUint8(bufPtr + 0, 0);
            view.setUint32(bufPtr + 4, nameBytes.byteLength, true);
            return 0;
          },
          fd_prestat_dir_name(fd, pathPtr, pathLen) {
            const entry = self._fds.get(fd);
            if (!entry || entry.type !== 'preopen') return 8;
            const { bytes } = self._getMem();
            const nameBytes = utf8Encode(entry.preopen);
            bytes.set(nameBytes.subarray(0, pathLen), pathPtr);
            return 0;
          },
          fd_read(fd, iovsPtr, iovsLen, nreadPtr) {
            const entry = self._fds.get(fd);
            if (!entry) return 8;
            const { bytes, view } = self._getMem();
            let totalRead = 0;
            if (fd === 0) {
              for (let i = 0; i < iovsLen; i++) {
                const ptr = view.getUint32(iovsPtr + i * 8, true);
                const len = view.getUint32(iovsPtr + i * 8 + 4, true);
                if (len <= 0) continue;
                const avail = Math.min(len, self._stdinBytes.byteLength - self._stdinPos);
                if (avail > 0) {
                  bytes.set(self._stdinBytes.subarray(self._stdinPos, self._stdinPos + avail), ptr);
                  self._stdinPos += avail;
                  totalRead += avail;
                }
                if (avail < len) break;
              }
              view.setUint32(nreadPtr, totalRead, true);
              return 0;
            }
            if (entry.isDir || entry.vfsFd === null) return 8;
            try {
              for (let i = 0; i < iovsLen; i++) {
                const ptr = view.getUint32(iovsPtr + i * 8, true);
                const len = view.getUint32(iovsPtr + i * 8 + 4, true);
                if (len <= 0) continue;
                const n = self.vfs.readSync(entry.vfsFd, bytes, ptr, len, null);
                totalRead += n;
                if (n < len) break;
              }
              view.setUint32(nreadPtr, totalRead, true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_pread(fd, iovsPtr, iovsLen, offsetBig, nreadPtr) {
            const entry = self._fds.get(fd);
            if (!entry || entry.isDir || entry.vfsFd === null) return 8;
            const { bytes, view } = self._getMem();
            let pos = Number(offsetBig);
            let totalRead = 0;
            try {
              for (let i = 0; i < iovsLen; i++) {
                const ptr = view.getUint32(iovsPtr + i * 8, true);
                const len = view.getUint32(iovsPtr + i * 8 + 4, true);
                if (len <= 0) continue;
                const n = self.vfs.readSync(entry.vfsFd, bytes, ptr, len, pos);
                pos += n;
                totalRead += n;
                if (n < len) break;
              }
              view.setUint32(nreadPtr, totalRead, true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_write(fd, iovsPtr, iovsLen, nwrittenPtr) {
            const entry = self._fds.get(fd);
            if (!entry) return 8;
            const { bytes, view } = self._getMem();
            let totalWritten = 0;
            if (fd === 1 || fd === 2) {
              const chunks = [];
              for (let i = 0; i < iovsLen; i++) {
                const ptr = view.getUint32(iovsPtr + i * 8, true);
                const len = view.getUint32(iovsPtr + i * 8 + 4, true);
                if (len > 0) {
                  chunks.push(bytes.subarray(ptr, ptr + len));
                  totalWritten += len;
                }
              }
              if (totalWritten > 0) {
                const merged = new Uint8Array(totalWritten);
                let off = 0;
                for (const c of chunks) {
                  merged.set(c, off);
                  off += c.byteLength;
                }
                const text = utf8Decode(merged);
                if (fd === 1 && self.onStdout) self.onStdout(text);
                else if (fd === 2 && self.onStderr) self.onStderr(text);
              }
              view.setUint32(nwrittenPtr, totalWritten, true);
              return 0;
            }
            if (entry.isDir || entry.vfsFd === null) return 8;
            try {
              for (let i = 0; i < iovsLen; i++) {
                const ptr = view.getUint32(iovsPtr + i * 8, true);
                const len = view.getUint32(iovsPtr + i * 8 + 4, true);
                if (len <= 0) continue;
                const n = self.vfs.writeSync(entry.vfsFd, bytes, ptr, len);
                totalWritten += n;
              }
              view.setUint32(nwrittenPtr, totalWritten, true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_pwrite(fd, iovsPtr, iovsLen, offsetBig, nwrittenPtr) {
            const entry = self._fds.get(fd);
            if (!entry || entry.isDir || entry.vfsFd === null) return 8;
            const { bytes, view } = self._getMem();
            let pos = Number(offsetBig);
            let totalWritten = 0;
            try {
              for (let i = 0; i < iovsLen; i++) {
                const ptr = view.getUint32(iovsPtr + i * 8, true);
                const len = view.getUint32(iovsPtr + i * 8 + 4, true);
                if (len <= 0) continue;
                const n = self.vfs.writeSync(entry.vfsFd, bytes, ptr, len, pos);
                pos += n;
                totalWritten += n;
              }
              view.setUint32(nwrittenPtr, totalWritten, true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_seek(fd, offsetBig, whence, newOffsetPtr) {
            const entry = self._fds.get(fd);
            if (!entry || entry.isDir || entry.vfsFd === null) return 8;
            const { view } = self._getMem();
            try {
              const nextPos = self.vfs.lseekSync(entry.vfsFd, Number(offsetBig), Number(whence));
              view.setBigUint64(newOffsetPtr, BigInt(nextPos), true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_tell(fd, offsetPtr) {
            const entry = self._fds.get(fd);
            if (!entry || entry.isDir || entry.vfsFd === null) return 8;
            const { view } = self._getMem();
            try {
              const pos = self.vfs.tellSync(entry.vfsFd);
              view.setBigUint64(offsetPtr, BigInt(pos), true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          fd_renumber(fromFd, toFd) {
            const entry = self._fds.get(fromFd);
            if (!entry) return 8;
            const existing = self._fds.get(toFd);
            if (existing && existing.vfsFd !== null) {
              try { self.vfs.closeSync(existing.vfsFd); } catch (err) { _runtimeLogger.debug('WASI fd_renumber close error', err); }
            }
            self._fds.set(toFd, entry);
            self._fds.delete(fromFd);
            return 0;
          },
          fd_readdir(fd, bufPtr, bufLen, cookieBig, bufusedPtr) {
            const entry = self._fds.get(fd);
            if (!entry || !entry.isDir) return 8;
            const { bytes, view } = self._getMem();
            try {
              const names = ['.', '..', ...self.vfs.readdirSync(entry.path)];
              let offset = 0;
              const startIdx = Number(cookieBig);
              for (let i = startIdx; i < names.length; i++) {
                const name = names[i];
                const nameBytes = utf8Encode(name);
                const fullPath = name === '.' || name === '..' ? entry.path : VirtualPath.resolve(entry.path, name);
                let isDir = true;
                let ino = 1;
                try {
                  const st = self.vfs.statSync(fullPath);
                  isDir = st.isDirectory();
                  ino = st.ino || 1;
                } catch (err) {
                  _runtimeLogger.debug('WASI fd_readdir stat skipped', err);
                }
                const headerSize = 24;
                const totalEntrySize = headerSize + nameBytes.byteLength;
                if (offset + headerSize > bufLen) break;
                view.setBigUint64(bufPtr + offset + 0, BigInt(i + 1), true);
                view.setBigUint64(bufPtr + offset + 8, BigInt(ino), true);
                view.setUint32(bufPtr + offset + 16, nameBytes.byteLength, true);
                view.setUint8(bufPtr + offset + 20, isDir ? 3 : 4);
                const copyNameLen = Math.min(nameBytes.byteLength, bufLen - (offset + headerSize));
                bytes.set(nameBytes.subarray(0, copyNameLen), bufPtr + offset + headerSize);
                offset += headerSize + copyNameLen;
                if (copyNameLen < nameBytes.byteLength) break;
              }
              view.setUint32(bufusedPtr, offset, true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          path_create_directory(dirfd, pathPtr, pathLen) {
            const { bytes } = self._getMem();
            const rel = utf8Decode(bytes.subarray(pathPtr, pathPtr + pathLen));
            const resolved = self._resolveAt(dirfd, rel);
            if (resolved.err) return resolved.err;
            try {
              self.vfs.mkdirSync(resolved.path, { recursive: true });
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          path_filestat_get(dirfd, _flags, pathPtr, pathLen, bufPtr) {
            const { bytes, view } = self._getMem();
            const rel = utf8Decode(bytes.subarray(pathPtr, pathPtr + pathLen));
            const resolved = self._resolveAt(dirfd, rel);
            if (resolved.err) return resolved.err;
            try {
              const st = self.vfs.statSync(resolved.path);
              self._writeFilestat(view, bufPtr, st, st.isDirectory());
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          path_filestat_set_times() { return 0; },
          path_link() { return 52; },
          path_open(dirfd, _dirflags, pathPtr, pathLen, oflags, _rightsBase, _rightsInheriting, fdflags, openedFdPtr) {
            const { bytes, view } = self._getMem();
            const rel = utf8Decode(bytes.subarray(pathPtr, pathPtr + pathLen));
            const resolved = self._resolveAt(dirfd, rel);
            if (resolved.err) return resolved.err;
            const targetPath = resolved.path;
            const isCreat = (oflags & 1) !== 0;
            const isDirFlag = (oflags & 2) !== 0;
            const isExcl = (oflags & 4) !== 0;
            const isTrunc = (oflags & 8) !== 0;
            const isAppend = (fdflags & 1) !== 0;

            try {
              if (self.vfs.existsSync(targetPath) && self.vfs.statSync(targetPath).isDirectory()) {
                const newFd = self._nextFd++;
                self._fds.set(newFd, {
                  type: 'dir',
                  path: targetPath,
                  isDir: true,
                  preopen: null,
                  vfsFd: null,
                  fdflags
                });
                view.setUint32(openedFdPtr, newFd, true);
                return 0;
              }
              if (isDirFlag) return 54; // ENOTDIR

              let modeStr = 'r+';
              if (isAppend) modeStr = 'a+';
              else if (isTrunc) modeStr = 'w+';
              else if (isCreat) modeStr = 'r+c';
              if (isExcl) modeStr += 'x';

              const parentDir = VirtualPath.dirname(targetPath);
              if (isCreat && !self.vfs.existsSync(parentDir)) {
                self.vfs.mkdirSync(parentDir, { recursive: true });
              }

              const vfsFd = self.vfs.openSync(targetPath, modeStr);
              const newFd = self._nextFd++;
              self._fds.set(newFd, {
                type: 'file',
                path: targetPath,
                isDir: false,
                preopen: null,
                vfsFd,
                fdflags
              });
              view.setUint32(openedFdPtr, newFd, true);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          path_readlink() { return 52; },
          path_remove_directory(dirfd, pathPtr, pathLen) {
            const { bytes } = self._getMem();
            const rel = utf8Decode(bytes.subarray(pathPtr, pathPtr + pathLen));
            const resolved = self._resolveAt(dirfd, rel);
            if (resolved.err) return resolved.err;
            try {
              self.vfs.rmdirSync(resolved.path);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          path_rename(oldFd, oldPathPtr, oldPathLen, newFd, newPathPtr, newPathLen) {
            const { bytes } = self._getMem();
            const oldRel = utf8Decode(bytes.subarray(oldPathPtr, oldPathPtr + oldPathLen));
            const newRel = utf8Decode(bytes.subarray(newPathPtr, newPathPtr + newPathLen));
            const oldRes = self._resolveAt(oldFd, oldRel);
            if (oldRes.err) return oldRes.err;
            const newRes = self._resolveAt(newFd, newRel);
            if (newRes.err) return newRes.err;
            try {
              self.vfs.renameSync(oldRes.path, newRes.path);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          path_symlink() { return 52; },
          path_unlink_file(dirfd, pathPtr, pathLen) {
            const { bytes } = self._getMem();
            const rel = utf8Decode(bytes.subarray(pathPtr, pathPtr + pathLen));
            const resolved = self._resolveAt(dirfd, rel);
            if (resolved.err) return resolved.err;
            try {
              self.vfs.unlinkSync(resolved.path);
              return 0;
            } catch (err) {
              return self._mapFsError(err);
            }
          },
          poll_oneoff(_inPtr, _outPtr, _nsubscriptions, neventsPtr) {
            const { view } = self._getMem();
            view.setUint32(neventsPtr, 0, true);
            return 0;
          },
          proc_exit(rval) {
            throw new WasiExitSignal(rval);
          },
          proc_raise() { return 0; },
          random_get(bufPtr, bufLen) {
            const { bytes } = self._getMem();
            const rand = VirtualCrypto.randomBytes(bufLen);
            bytes.set(rand, bufPtr);
            return 0;
          },
          sched_yield() { return 0; },
          sock_accept() { return 52; },
          sock_recv() { return 52; },
          sock_send() { return 52; },
          sock_shutdown() { return 52; }
        };
      }

      getImportObject() {
        return {
          wasi_snapshot_preview1: this.wasiImport,
          wasi_unstable: this.wasiImport
        };
      }

      bindMemory(memory) {
        this.memory = memory;
        return this;
      }

      setMemory(memory) {
        this.memory = memory;
        return this;
      }

      start(instance) {
        if (!instance || !instance.exports) {
          throw new Error('WASI.start requires a WebAssembly.Instance with exports');
        }
        if (instance.exports.memory) {
          this.memory = instance.exports.memory;
        }
        try {
          if (typeof instance.exports._start === 'function') {
            instance.exports._start();
          } else if (typeof instance.exports.main === 'function') {
            const ret = instance.exports.main(0, 0);
            if (typeof ret === 'number') return ret;
          }
          return 0;
        } catch (err) {
          if (err && err._isWasiExit) {
            if (this.returnOnExit) return err.code;
            throw err;
          }
          throw err;
        }
      }

      initialize(instance) {
        if (!instance || !instance.exports) {
          throw new Error('WASI.initialize requires a WebAssembly.Instance with exports');
        }
        if (instance.exports.memory) {
          this.memory = instance.exports.memory;
        }
        if (typeof instance.exports._initialize === 'function') {
          instance.exports._initialize();
        }
      }
    }

    const defaultWasi = new WASI(defaults);
    defaultWasi.WASI = WASI;
    return defaultWasi;
  }

  async function executeWasiModule(wasmBytesOrModule, options = {}) {
    const startTime = performance.now();
    const stdoutChunks = [];
    const stderrChunks = [];
    const onStdout = (text) => {
      stdoutChunks.push(text);
      if (typeof options.onStdout === 'function') options.onStdout(text);
    };
    const onStderr = (text) => {
      stderrChunks.push(text);
      if (typeof options.onStderr === 'function') options.onStderr(text);
    };

    const vfs = options.vfs || createVirtualFs(options.files || {});
    const { WASI } = createVirtualWasi();
    const wasi = new WASI({
      args: options.args || options.argv || ['wasm'],
      env: options.env || {},
      preopens: options.preopens || { '.': '/workspace', '/workspace': '/workspace', '/usr': '/usr', '/tmp': '/tmp', '/': '/' },
      vfs,
      stdin: options.stdin || '',
      onStdout,
      onStderr,
      returnOnExit: true
    });

    let exitCode = 0;
    try {
      const importObject = Object.assign({}, wasi.getImportObject(), options.imports || {});
      let instance;
      if (typeof WebAssembly !== 'undefined' && wasmBytesOrModule instanceof WebAssembly.Module) {
        instance = await WebAssembly.instantiate(wasmBytesOrModule, importObject);
      } else {
        const bytes = wasmBytesOrModule instanceof Uint8Array
          ? wasmBytesOrModule
          : new Uint8Array(wasmBytesOrModule);
        const instantiated = await WebAssembly.instantiate(bytes, importObject);
        instance = instantiated.instance || instantiated;
      }
      exitCode = wasi.start(instance);
    } catch (err) {
      if (err && err._isWasiExit) {
        exitCode = err.code;
      } else {
        exitCode = 1;
        onStderr((err && err.stack ? err.stack : String(err)) + '\n');
      }
    }

    return {
      ok: exitCode === 0,
      exitCode,
      durationMs: Math.max(0, performance.now() - startTime),
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      vfs
    };
  }

  async function executeInVirtualRuntime(options = {}) {
    const {
      files = {},
      packages = {},
      npmModules = {},
      entry = 'demo.js',
      mode = 'run', // 'run' | 'test' | 'repl'
      replCode = '',
      testFilter = null,
      timeoutMs = 30000,
      maxOutputBytes = 262144, // 256 KB default output cap
      maxConsoleCalls = 5000,
      onStdout = null,
      onStderr = null,
      onTestResult = null,
      vfs: optVfs = null,
      activePortTable: optPortTable = null,
      portTable = null,
      pid = 1000,
      argv = null,
      isBackground = false,
      signal = null
    } = options;

    const startTime = performance.now();
    const stdoutChunks = [];
    const stderrChunks = [];
    const testResults = [];
    let totalOutputBytes = 0;
    let consoleCallsCount = 0;
    let outputTruncated = false;
    let testIndex = 0;
    let exitCode = 0;
    let hasExited = false;

    const resourceTracker = {
      activeTimers: new Set(),
      allTimers: new Set(),
      activeImmediates: new Set(),
      inFlightHttp: new Set(),
      pendingTests: new Set(),
      pid
    };

    function formatConsoleArg(arg) {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
      if (VirtualBuffer.isBuffer(arg)) return `<Buffer ${arg.toString('hex').slice(0, 64)}>`;
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (_) {
          return utilInspect(arg);
        }
      }
      return String(arg);
    }

    const TRUNCATION_NOTICE = '\n[Output truncated: exceeded 256 KB limit]\n';

    function triggerTruncation(targetChunks, cb) {
      if (outputTruncated) return;
      outputTruncated = true;
      targetChunks.push(TRUNCATION_NOTICE);
      if (typeof cb === 'function') cb(TRUNCATION_NOTICE);
    }

    let _stdoutLineBuf = '';
    function _processStdoutText(rawText) {
      let s = String(rawText);
      if (s.includes('__CODELAB_TEST__:') || _stdoutLineBuf.length > 0) {
        const combined = _stdoutLineBuf + s;
        const lines = combined.split('\n');
        _stdoutLineBuf = lines.pop() || '';
        const visibleLines = [];
        for (const line of lines) {
          const cleanLine = line.replace(/\r$/, '');
          const markerIdx = cleanLine.indexOf('__CODELAB_TEST__:');
          if (markerIdx !== -1) {
            const prefix = cleanLine.slice(0, markerIdx);
            if (prefix) visibleLines.push(prefix);
            const jsonPart = cleanLine.slice(markerIdx + '__CODELAB_TEST__:'.length).trim();
            try {
              const parsed = JSON.parse(jsonPart);
              if (parsed && parsed.name && !shouldSkipTest(parsed.name)) {
                const idx = ++testIndex;
                const isPass = parsed.passed !== undefined
                  ? Boolean(parsed.passed)
                  : (parsed.status === 'pass' || parsed.status === 'passed');
                const item = {
                  index: idx,
                  name: String(parsed.name),
                  status: isPass ? 'pass' : 'fail',
                  passed: isPass,
                  durationMs: Number(parsed.durationMs) || 0,
                  error: parsed.error || null
                };
                testResults.push(item);
                if (typeof onTestResult === 'function') onTestResult(item);
              }
            } catch (err) {
              _runtimeLogger.debug('Failed to parse __CODELAB_TEST__ payload', err);
            }
          } else {
            visibleLines.push(line);
          }
        }
        s = visibleLines.length > 0 ? visibleLines.join('\n') + '\n' : '';
      }
      return s;
    }

    function emitStdout(text) {
      if (outputTruncated) return;
      const s = _processStdoutText(text);
      if (!s) return;
      if (totalOutputBytes + s.length > maxOutputBytes) {
        const remaining = Math.max(0, maxOutputBytes - totalOutputBytes);
        if (remaining > 0) {
          const slice = s.slice(0, remaining);
          stdoutChunks.push(slice);
          totalOutputBytes += slice.length;
          if (typeof onStdout === 'function') onStdout(slice);
        }
        triggerTruncation(stdoutChunks, onStdout);
        return;
      }
      totalOutputBytes += s.length;
      stdoutChunks.push(s);
      if (typeof onStdout === 'function') onStdout(s);
    }

    function emitStderr(text) {
      if (outputTruncated) return;
      const s = String(text);
      if (totalOutputBytes + s.length > maxOutputBytes) {
        const remaining = Math.max(0, maxOutputBytes - totalOutputBytes);
        if (remaining > 0) {
          const slice = s.slice(0, remaining);
          stderrChunks.push(slice);
          totalOutputBytes += slice.length;
          if (typeof onStderr === 'function') onStderr(slice);
        }
        triggerTruncation(stderrChunks, onStderr);
        return;
      }
      totalOutputBytes += s.length;
      stderrChunks.push(s);
      if (typeof onStderr === 'function') onStderr(s);
    }

    function serializeError(err) {
      if (!err) return null;
      return {
        name: err.name || 'Error',
        message: err.message || String(err),
        stack: err.stack || String(err),
        actual: err.actual !== undefined ? formatValue(err.actual) : undefined,
        expected: err.expected !== undefined ? formatValue(err.expected) : undefined,
        operator: err.operator
      };
    }

    function shouldSkipTest(name) {
      if (!testFilter) return false;
      if (typeof testFilter === 'string') {
        return !name.toLowerCase().includes(testFilter.toLowerCase());
      }
      if (Array.isArray(testFilter) && testFilter.length > 0) {
        return !testFilter.includes(name);
      }
      return false;
    }

    function wrapTestFn(name, origFn) {
      return function wrappedTestFn(...args) {
        const idx = ++testIndex;
        const t0 = performance.now();
        let res;
        try {
          res = origFn.apply(this, args);
        } catch (err) {
          if (err && err._isProcessExit) throw err;
          const durationMs = Math.max(0, performance.now() - t0);
          const item = { index: idx, name, status: 'fail', passed: false, durationMs, error: serializeError(err) };
          testResults.push(item);
          if (typeof onTestResult === 'function') onTestResult(item);
          throw err;
        }
        if (res && typeof res.then === 'function') {
          const tracked = res.then(
            (val) => {
              resourceTracker.pendingTests.delete(tracked);
              const durationMs = Math.max(0, performance.now() - t0);
              const item = { index: idx, name, status: 'pass', passed: true, durationMs, error: null };
              testResults.push(item);
              if (typeof onTestResult === 'function') onTestResult(item);
              return val;
            },
            (err) => {
              resourceTracker.pendingTests.delete(tracked);
              if (err && err._isProcessExit) throw err;
              const durationMs = Math.max(0, performance.now() - t0);
              const item = { index: idx, name, status: 'fail', passed: false, durationMs, error: serializeError(err) };
              testResults.push(item);
              if (typeof onTestResult === 'function') onTestResult(item);
              throw err;
            }
          );
          tracked.catch(() => {});
          resourceTracker.pendingTests.add(tracked);
          return tracked;
        }
        const durationMs = Math.max(0, performance.now() - t0);
        const item = { index: idx, name, status: 'pass', passed: true, durationMs, error: null };
        testResults.push(item);
        if (typeof onTestResult === 'function') onTestResult(item);
        return res;
      };
    }

    const activePortTable = optPortTable || portTable || _defaultPortTable;
    resourceTracker.pid = pid;

    let currentCwd = '/workspace';
    _activeCwdGetter = () => currentCwd;

    const vfs = optVfs || createVirtualFs(files, { cwdGetter: () => currentCwd });
    if (optVfs && files && typeof files === 'object') {
      for (const [fPath, content] of Object.entries(files)) {
        const abs = fPath.startsWith('/') ? fPath : '/workspace/' + fPath;
        try {
          const dir = VirtualPath.dirname(abs);
          if (!vfs.existsSync(dir)) vfs.mkdirSync(dir, { recursive: true });
          vfs.writeFileSync(abs, content);
        } catch (err) {
          _runtimeLogger.warn('vfs initial file seed failed', { abs, err });
        }
      }
    }
    const vhttp = createVirtualHttp(resourceTracker, activePortTable);
    const vnet = createVirtualNet(resourceTracker, vhttp.getTrace());

    const injectedPackages = new Map();
    const combinedPackages = Object.assign(
      {},
      Object.fromEntries(_npmPackageCache.entries()),
      npmModules || {},
      packages || {}
    );
    for (const [pkgName, pkgVal] of Object.entries(combinedPackages)) {
      if (typeof pkgVal === 'string') {
        const targetPath = `/workspace/node_modules/${pkgName}/index.js`;
        if (!vfs.existsSync(targetPath)) {
          vfs.mkdirSync(VirtualPath.dirname(targetPath), { recursive: true });
          vfs.writeFileSync(targetPath, pkgVal);
        }
      } else if (pkgVal !== undefined && pkgVal !== null) {
        injectedPackages.set(pkgName, pkgVal);
      }
    }

    // Custom timer wrappers supporting .unref() / .ref() and active handle tracking
    function makeTimerHandle(rawId, isInterval) {
      const handle = {
        _id: rawId,
        _isInterval: isInterval,
        _ref: true,
        unref() {
          this._ref = false;
          resourceTracker.activeTimers.delete(rawId);
          return this;
        },
        ref() {
          this._ref = true;
          resourceTracker.activeTimers.add(rawId);
          return this;
        },
        hasRef() {
          return this._ref;
        },
        [Symbol.toPrimitive]() {
          return rawId;
        }
      };
      return handle;
    }

    function sandboxSetTimeout(fn, delay = 0, ...args) {
      const rawId = setTimeout(() => {
        resourceTracker.activeTimers.delete(rawId);
        resourceTracker.allTimers.delete(rawId);
        if (hasExited) return;
        try {
          fn(...args);
        } catch (err) {
          if (err && err._isProcessExit) {
            exitCode = err.exitCode;
            hasExited = true;
          } else {
            emitStderr((err && err.stack ? err.stack : String(err)) + '\n');
            exitCode = 1;
          }
        }
      }, delay);
      resourceTracker.activeTimers.add(rawId);
      resourceTracker.allTimers.add(rawId);
      return makeTimerHandle(rawId, false);
    }

    function sandboxClearTimeout(handleOrId) {
      if (handleOrId === null || handleOrId === undefined) return;
      const rawId = typeof handleOrId === 'object' && '_id' in handleOrId ? handleOrId._id : handleOrId;
      clearTimeout(rawId);
      resourceTracker.activeTimers.delete(rawId);
      resourceTracker.allTimers.delete(rawId);
    }

    function sandboxSetInterval(fn, delay = 0, ...args) {
      const rawId = setInterval(() => {
        if (hasExited) {
          clearInterval(rawId);
          return;
        }
        try {
          fn(...args);
        } catch (err) {
          if (err && err._isProcessExit) {
            exitCode = err.exitCode;
            hasExited = true;
            clearInterval(rawId);
          } else {
            emitStderr((err && err.stack ? err.stack : String(err)) + '\n');
            exitCode = 1;
          }
        }
      }, delay);
      resourceTracker.activeTimers.add(rawId);
      resourceTracker.allTimers.add(rawId);
      return makeTimerHandle(rawId, true);
    }

    function sandboxClearInterval(handleOrId) {
      if (handleOrId === null || handleOrId === undefined) return;
      const rawId = typeof handleOrId === 'object' && '_id' in handleOrId ? handleOrId._id : handleOrId;
      clearInterval(rawId);
      resourceTracker.activeTimers.delete(rawId);
      resourceTracker.allTimers.delete(rawId);
    }

    function sandboxSetImmediate(fn, ...args) {
      const id = {};
      resourceTracker.activeImmediates.add(id);
      queueMicrotask(() => {
        if (!resourceTracker.activeImmediates.has(id)) return;
        resourceTracker.activeImmediates.delete(id);
        if (hasExited) return;
        try {
          fn(...args);
        } catch (err) {
          if (err && err._isProcessExit) {
            exitCode = err.exitCode;
            hasExited = true;
          } else {
            emitStderr((err && err.stack ? err.stack : String(err)) + '\n');
            exitCode = 1;
          }
        }
      });
      return id;
    }

    function sandboxClearImmediate(id) {
      resourceTracker.activeImmediates.delete(id);
    }

    const consoleTimers = new Map();
    const consoleCounts = new Map();
    let groupDepth = 0;

    function formatConsoleArgs(args) {
      if (args.length === 0) return '';
      if (args.length > 1 && typeof args[0] === 'string' && /%[sdifjoO%]/.test(args[0])) {
        const first = args[0];
        let idx = 1;
        let out = '';
        for (let i = 0; i < first.length; i++) {
          if (first[i] === '%' && i + 1 < first.length) {
            const next = first[i + 1];
            if (next === '%') {
              out += '%';
              i++;
              continue;
            }
            if (idx < args.length) {
              const arg = args[idx];
              if (next === 's') { out += String(arg); idx++; i++; continue; }
              if (next === 'd') { out += Number(arg); idx++; i++; continue; }
              if (next === 'i') { out += parseInt(arg, 10); idx++; i++; continue; }
              if (next === 'f') { out += parseFloat(arg); idx++; i++; continue; }
              if (next === 'j') {
                try { out += JSON.stringify(arg); } catch (_) { out += '[Circular]'; }
                idx++; i++; continue;
              }
              if (next === 'o' || next === 'O') {
                out += utilInspect(arg);
                idx++; i++; continue;
              }
            }
          }
          out += first[i];
        }
        while (idx < args.length) {
          out += ' ' + formatConsoleArg(args[idx++]);
        }
        return out;
      }
      return args.map(formatConsoleArg).join(' ');
    }

    function formatTableCell(val) {
      if (val === undefined) return '';
      if (val === null) return 'null';
      if (typeof val === 'string') return `'${val}'`;
      if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') return String(val);
      return utilInspect(val, { depth: 0 });
    }

    function formatConsoleTable(tabularData, properties) {
      if (tabularData === null || typeof tabularData !== 'object') {
        return null;
      }
      const entries = Array.isArray(tabularData)
        ? tabularData.map((v, i) => [String(i), v])
        : Object.entries(tabularData);
      if (entries.length === 0) {
        return '(empty table)';
      }
      const propFilter = Array.isArray(properties) ? new Set(properties.map(String)) : null;
      const cols = [];
      const colSet = new Set();
      let hasPrimitiveRow = false;

      for (const [, row] of entries) {
        if (row !== null && typeof row === 'object' && !VirtualBuffer.isBuffer(row) && !(row instanceof Date) && !(row instanceof RegExp)) {
          for (const k of Object.keys(row)) {
            if (!propFilter || propFilter.has(k)) {
              if (!colSet.has(k)) {
                colSet.add(k);
                cols.push(k);
              }
            }
          }
        } else {
          hasPrimitiveRow = true;
        }
      }

      const headers = ['(index)', ...cols, ...(hasPrimitiveRow ? ['Values'] : [])];
      const matrix = entries.map(([idxKey, row]) => {
        const isRowObj = row !== null && typeof row === 'object' && !VirtualBuffer.isBuffer(row) && !(row instanceof Date) && !(row instanceof RegExp);
        const cells = [String(idxKey)];
        for (const col of cols) {
          cells.push(isRowObj && Object.prototype.hasOwnProperty.call(row, col) ? formatTableCell(row[col]) : '');
        }
        if (hasPrimitiveRow) {
          cells.push(isRowObj ? '' : formatTableCell(row));
        }
        return cells;
      });

      const widths = headers.map((h, colIdx) => {
        let maxW = h.length;
        for (const r of matrix) {
          if (r[colIdx].length > maxW) maxW = r[colIdx].length;
        }
        return maxW;
      });

      const borderTop = '┌─' + widths.map((w) => '─'.repeat(w)).join('─┬─') + '─┐';
      const borderMid = '├─' + widths.map((w) => '─'.repeat(w)).join('─┼─') + '─┤';
      const borderBot = '└─' + widths.map((w) => '─'.repeat(w)).join('─┴─') + '─┘';
      const formatRow = (cells) => '│ ' + cells.map((c, i) => c.padEnd(widths[i], ' ')).join(' │ ') + ' │';

      return [
        borderTop,
        formatRow(headers),
        borderMid,
        ...matrix.map(formatRow),
        borderBot
      ].join('\n');
    }

    function applyGroupIndent(text) {
      if (groupDepth <= 0) return text;
      const pad = '  '.repeat(groupDepth);
      return String(text).split('\n').map((line) => pad + line).join('\n');
    }

    function checkConsoleFlood(isErr = false, targetChunks = null, targetCb = null) {
      if (outputTruncated) return false;
      consoleCallsCount++;
      if (consoleCallsCount > maxConsoleCalls) {
        triggerTruncation(
          targetChunks || (isErr ? stderrChunks : stdoutChunks),
          targetCb !== null ? targetCb : (isErr ? onStderr : onStdout)
        );
        return false;
      }
      return true;
    }

    function createConsole(writeOut, writeErr) {
      const c = {
        log: (...args) => {
          if (checkConsoleFlood(false)) writeOut(applyGroupIndent(formatConsoleArgs(args)) + '\n');
        },
        info: (...args) => {
          if (checkConsoleFlood(false)) writeOut(applyGroupIndent(formatConsoleArgs(args)) + '\n');
        },
        debug: (...args) => {
          if (checkConsoleFlood(false)) writeOut(applyGroupIndent(formatConsoleArgs(args)) + '\n');
        },
        warn: (...args) => {
          if (checkConsoleFlood(true)) writeErr(applyGroupIndent(formatConsoleArgs(args)) + '\n');
        },
        error: (...args) => {
          if (checkConsoleFlood(true)) writeErr(applyGroupIndent(formatConsoleArgs(args)) + '\n');
        },
        dir: (obj, opts) => {
          if (checkConsoleFlood(false)) writeOut(applyGroupIndent(utilInspect(obj, opts)) + '\n');
        },
        table: (tabularData, properties) => {
          const tableStr = formatConsoleTable(tabularData, properties);
          if (tableStr === null) {
            c.log(tabularData);
          } else if (checkConsoleFlood(false)) {
            writeOut(applyGroupIndent(tableStr) + '\n');
          }
        },
        time: (label = 'default') => {
          consoleTimers.set(String(label), performance.now());
        },
        timeLog: (label = 'default', ...data) => {
          const key = String(label);
          if (!consoleTimers.has(key)) {
            if (checkConsoleFlood(true)) writeErr(applyGroupIndent(`Warning: No such label '${key}' for console.timeLog()`) + '\n');
            return;
          }
          const elapsed = (performance.now() - consoleTimers.get(key)).toFixed(2);
          const extra = data.length > 0 ? ' ' + formatConsoleArgs(data) : '';
          if (checkConsoleFlood(false)) writeOut(applyGroupIndent(`${key}: ${elapsed}ms${extra}`) + '\n');
        },
        timeEnd: (label = 'default') => {
          const key = String(label);
          if (!consoleTimers.has(key)) {
            if (checkConsoleFlood(true)) writeErr(applyGroupIndent(`Warning: No such label '${key}' for console.timeEnd()`) + '\n');
            return;
          }
          const elapsed = (performance.now() - consoleTimers.get(key)).toFixed(2);
          consoleTimers.delete(key);
          if (checkConsoleFlood(false)) writeOut(applyGroupIndent(`${key}: ${elapsed}ms`) + '\n');
        },
        count: (label = 'default') => {
          const key = String(label);
          const next = (consoleCounts.get(key) || 0) + 1;
          consoleCounts.set(key, next);
          if (checkConsoleFlood(false)) writeOut(applyGroupIndent(`${key}: ${next}`) + '\n');
        },
        countReset: (label = 'default') => {
          consoleCounts.delete(String(label));
        },
        assert: (condition, ...data) => {
          if (!condition) {
            const msg = data.length > 0 ? 'Assertion failed: ' + formatConsoleArgs(data) : 'Assertion failed';
            if (checkConsoleFlood(true)) writeErr(applyGroupIndent(msg) + '\n');
          }
        },
        group: (...label) => {
          if (label.length > 0) c.log(...label);
          groupDepth = Math.min(groupDepth + 1, 20);
        },
        groupCollapsed: (...label) => {
          if (label.length > 0) c.log(...label);
          groupDepth = Math.min(groupDepth + 1, 20);
        },
        groupEnd: () => {
          groupDepth = Math.max(0, groupDepth - 1);
        },
        trace: (...data) => {
          if (!checkConsoleFlood(true)) return;
          const header = data.length > 0 ? 'Trace: ' + formatConsoleArgs(data) : 'Trace';
          const err = new Error();
          const rawLines = String(err.stack || '').split('\n').slice(2);
          const stackPart = rawLines.length > 0 ? '\n' + rawLines.join('\n') : '';
          writeErr(applyGroupIndent(header + stackPart) + '\n');
        },
        clear: () => {
          if (typeof options.onConsoleClear === 'function') options.onConsoleClear();
        }
      };
      return c;
    }

    const sandboxConsole = createConsole(emitStdout, emitStderr);

    const hrtimeFn = function hrtime(prev) {
      const ns = BigInt(Math.round(performance.now() * 1e6));
      const sec = Number(ns / 1000000000n);
      const nano = Number(ns % 1000000000n);
      if (Array.isArray(prev) && prev.length === 2) {
        let ds = sec - prev[0];
        let dn = nano - prev[1];
        if (dn < 0) { ds -= 1; dn += 1e9; }
        return [ds, dn];
      }
      return [sec, nano];
    };
    hrtimeFn.bigint = () => BigInt(Math.round(performance.now() * 1e6));

    let syncExecDepth = 0;

    const sandboxProcess = Object.assign(new EventEmitter(), {
      env: { NODE_ENV: 'development', PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/home/user' },
      argv: argv || ['node', entry.startsWith('/') ? entry : `/workspace/${entry}`],
      argv0: 'node',
      execArgv: [],
      execPath: '/usr/local/bin/node',
      pid: pid,
      ppid: 1,
      title: 'node',
      version: 'v22.0.0',
      versions: { node: '22.0.0', v8: '12.4', uv: '1.48.0', modules: '127' },
      platform: 'linux',
      arch: 'x64',
      cwd: () => currentCwd,
      chdir: (dir) => {
        const target = VirtualPath.resolve(currentCwd, String(dir));
        if (!vfs.existsSync(target)) {
          const err = new Error(`ENOENT: no such file or directory, chdir '${dir}'`);
          err.code = 'ENOENT';
          throw err;
        }
        if (!vfs.statSync(target).isDirectory()) {
          const err = new Error(`ENOTDIR: not a directory, chdir '${dir}'`);
          err.code = 'ENOTDIR';
          throw err;
        }
        currentCwd = target;
      },
      uptime: () => Math.max(0, (performance.now() - startTime) / 1000),
      memoryUsage: () => ({
        rss: 33554432,
        heapTotal: 16777216,
        heapUsed: 8388608,
        external: 1048576,
        arrayBuffers: 524288
      }),
      cpuUsage: (prev) => {
        const cur = { user: Math.round((performance.now() - startTime) * 1000), system: 200 };
        if (prev && typeof prev.user === 'number') {
          return { user: Math.max(0, cur.user - prev.user), system: Math.max(0, cur.system - (prev.system || 0)) };
        }
        return cur;
      },
      emitWarning: (warning, type, code) => {
        const warnObj = warning instanceof Error ? warning : new Error(String(warning));
        if (typeof type === 'string') warnObj.name = type;
        if (typeof code === 'string') warnObj.code = code;
        sandboxProcess.emit('warning', warnObj);
      },
      hrtime: hrtimeFn,
      stdout: { write: (s) => { emitStdout(String(s)); return true; }, isTTY: false },
      stderr: { write: (s) => { emitStderr(String(s)); return true; }, isTTY: false },
      stdin: new PassThrough(),
      nextTick: (cb, ...args) => queueMicrotask(() => cb(...args)),
      exit: (code = 0) => {
        exitCode = Number(code) || 0;
        if (!hasExited) {
          hasExited = true;
          try { sandboxProcess.emit('exit', exitCode); } catch (err) { _runtimeLogger.debug('process exit listener threw', err); }
        }
        if (syncExecDepth > 0) {
          throw new ProcessExitSignal(exitCode);
        }
      }
    });

    let isSigintAborted = false;

    const handleSigint = () => {
      if (hasExited) return;
      isSigintAborted = true;
      exitCode = 130;
      hasExited = true;

      try {
        sandboxProcess.emit('SIGINT');
      } catch (err) {
        emitStderr((err && err.stack ? err.stack : String(err)) + '\n');
      }

      // Immediately cancel all active timers and immediates
      for (const rawId of resourceTracker.allTimers) {
        clearTimeout(rawId);
        clearInterval(rawId);
      }
      resourceTracker.activeTimers.clear();
      resourceTracker.allTimers.clear();
      resourceTracker.activeImmediates.clear();
      resourceTracker.inFlightHttp.clear();

      if (!isBackground) {
        try { vhttp.closeAllServers(); } catch (err) { _runtimeLogger.debug('SIGINT vhttp closeAllServers failed', err); }
        try { vnet.closeAllServers(); } catch (err) { _runtimeLogger.debug('SIGINT vnet closeAllServers failed', err); }
      }
    };

    let signalListener = null;
    if (signal) {
      if (signal.aborted) {
        handleSigint();
      } else {
        signalListener = () => handleSigint();
        signal.addEventListener('abort', signalListener, { once: true });
      }
    }

    // Built-in `node:test` runner (`test`, `describe`, `it`, `before`, `after`, `beforeEach`, `afterEach`, `mock`)
    const rootSuite = {
      prefix: '',
      pendingBefore: [],
      afterCallbacks: [],
      beforeEach: [],
      afterEach: []
    };
    const suiteStack = [];
    function currentSuite() {
      return suiteStack.length > 0 ? suiteStack[suiteStack.length - 1] : rootSuite;
    }

    const activeMocks = [];
    function createMockFn(impl = () => undefined) {
      const calls = [];
      let currentImpl = impl;
      const onceQueue = [];
      const mockFn = function mocked(...args) {
        const fnToCall = onceQueue.length > 0 ? onceQueue.shift() : currentImpl;
        let result;
        let error;
        try {
          result = fnToCall.apply(this, args);
          calls.push({ arguments: args, result, error: undefined, this: this });
          return result;
        } catch (err) {
          error = err;
          calls.push({ arguments: args, result: undefined, error, this: this });
          throw err;
        }
      };
      mockFn.mock = {
        calls,
        callCount: () => calls.length,
        resetCalls: () => { calls.length = 0; },
        mockImplementation: (newImpl) => { currentImpl = newImpl; },
        mockImplementationOnce: (onceImpl) => { onceQueue.push(onceImpl); },
        restore: () => {}
      };
      activeMocks.push(mockFn.mock);
      return mockFn;
    }

    const mockObject = {
      fn: (impl) => createMockFn(impl),
      method: (obj, methodName, impl) => {
        const orig = obj[methodName];
        const wrapped = createMockFn(impl || (typeof orig === 'function' ? orig.bind(obj) : () => undefined));
        wrapped.mock.restore = () => { obj[methodName] = orig; };
        obj[methodName] = wrapped;
        return wrapped;
      },
      reset: () => {
        for (const m of activeMocks) {
          m.resetCalls();
          m.restore();
        }
        activeMocks.length = 0;
      },
      restoreAll: () => {
        for (const m of activeMocks) {
          m.restore();
        }
      }
    };

    let nodeTestChain = Promise.resolve();

    function enqueueNodeTest(fullName, fn, hooksSnapshot) {
      if (shouldSkipTest(fullName)) return Promise.resolve();
      const task = nodeTestChain.then(async () => {
        if (hasExited) return;
        for (const bf of hooksSnapshot.beforeToRun) {
          await bf();
        }
        hooksSnapshot.beforeToRun.length = 0;
        for (const be of hooksSnapshot.beforeEachList) {
          await be();
        }
        const tCtx = {
          name: fullName,
          mock: mockObject,
          diagnostic: (msg) => sandboxConsole.log(`# ${msg}`),
          test: (subName, subOpts, subFn) => nodeTestFn(`${fullName} > ${subName}`, subOpts, subFn)
        };
        const wrapped = wrapTestFn(fullName, () => fn(tCtx));
        try {
          await wrapped();
          sandboxConsole.log(`✓ ${fullName}`);
        } catch (e) {
          if (e && e._isProcessExit) throw e;
          exitCode = 1;
          sandboxConsole.log(`✗ ${fullName}\n  ${e && e.stack ? e.stack : e}`);
        } finally {
          for (const ae of hooksSnapshot.afterEachList) {
            try { await ae(); } catch (err) { _runtimeLogger.debug('node:test afterEach hook failed', err); }
          }
          for (const af of hooksSnapshot.afterToRun) {
            try { await af(); } catch (err) { _runtimeLogger.debug('node:test after hook failed', err); }
          }
          hooksSnapshot.afterToRun.length = 0;
        }
      });
      nodeTestChain = task.catch(() => {});
      resourceTracker.pendingTests.add(task);
      task.finally(() => resourceTracker.pendingTests.delete(task));
      return task;
    }

    function nodeTestFn(name, optsOrFn, maybeFn) {
      const fn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn;
      const opts = typeof optsOrFn === 'object' && optsOrFn !== null ? optsOrFn : {};
      if (opts.skip || typeof fn !== 'function') return Promise.resolve();
      const suite = currentSuite();
      const fullName = suite && suite.prefix ? `${suite.prefix} > ${name}` : name;
      const hooksSnapshot = {
        beforeToRun: suite ? suite.pendingBefore : [],
        afterToRun: [],
        beforeEachList: suite ? [...suite.beforeEach] : [],
        afterEachList: suite ? [...suite.afterEach] : []
      };
      return enqueueNodeTest(fullName, fn, hooksSnapshot);
    }

    function nodeDescribeFn(suiteName, optsOrFn, maybeFn) {
      const suiteFn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn;
      const opts = typeof optsOrFn === 'object' && optsOrFn !== null ? optsOrFn : {};
      if (opts.skip || typeof suiteFn !== 'function') return;
      const parent = currentSuite();
      const prefix = parent && parent.prefix ? `${parent.prefix} > ${suiteName}` : suiteName;
      const suiteCtx = {
        prefix,
        pendingBefore: [],
        afterCallbacks: [],
        beforeEach: parent ? [...parent.beforeEach] : [],
        afterEach: parent ? [...parent.afterEach] : []
      };
      suiteStack.push(suiteCtx);
      try {
        suiteFn();
      } finally {
        suiteStack.pop();
        if (suiteCtx.afterCallbacks.length > 0) {
          const afters = [...suiteCtx.afterCallbacks];
          const cleanupTask = nodeTestChain.then(async () => {
            for (const af of afters) {
              try { await af(); } catch (err) { _runtimeLogger.debug('node:test suite after hook failed', err); }
            }
          });
          nodeTestChain = cleanupTask.catch(() => {});
          resourceTracker.pendingTests.add(cleanupTask);
          cleanupTask.finally(() => resourceTracker.pendingTests.delete(cleanupTask));
        }
      }
    }

    nodeTestFn.test = nodeTestFn;
    nodeTestFn.describe = nodeDescribeFn;
    nodeTestFn.suite = nodeDescribeFn;
    nodeTestFn.it = nodeTestFn;
    nodeTestFn.before = (fn) => { const s = currentSuite(); if (s && typeof fn === 'function') s.pendingBefore.push(fn); };
    nodeTestFn.after = (fn) => { const s = currentSuite(); if (s && typeof fn === 'function') s.afterCallbacks.push(fn); };
    nodeTestFn.beforeEach = (fn) => { const s = currentSuite(); if (s && typeof fn === 'function') s.beforeEach.push(fn); };
    nodeTestFn.afterEach = (fn) => { const s = currentSuite(); if (s && typeof fn === 'function') s.afterEach.push(fn); };
    nodeTestFn.mock = mockObject;

    const VirtualTimers = {
      setTimeout: sandboxSetTimeout,
      clearTimeout: sandboxClearTimeout,
      setInterval: sandboxSetInterval,
      clearInterval: sandboxClearInterval,
      setImmediate: sandboxSetImmediate,
      clearImmediate: sandboxClearImmediate
    };

    const VirtualTimersPromises = {
      setTimeout: (delay = 0, value) => new Promise((resolve) => sandboxSetTimeout(() => resolve(value), delay)),
      setImmediate: (value) => new Promise((resolve) => sandboxSetImmediate(() => resolve(value)))
    };
    VirtualTimers.promises = VirtualTimersPromises;

    const perfEntries = [];
    const perfObservers = new Set();
    function notifyPerfObservers(entry) {
      for (const obs of perfObservers) {
        if (!obs._entryTypes || obs._entryTypes.includes(entry.entryType)) {
          obs._records.push(entry);
          const list = {
            getEntries: () => [entry],
            getEntriesByName: (n, t) => (entry.name === n && (!t || entry.entryType === t) ? [entry] : []),
            getEntriesByType: (t) => (entry.entryType === t ? [entry] : [])
          };
          try { obs._cb(list, obs); } catch (err) { _runtimeLogger.debug('PerformanceObserver callback failed', err); }
        }
      }
    }

    const virtualPerformance = {
      now: () => performance.now() - startTime,
      timeOrigin: performance.timeOrigin || Date.now(),
      mark(name, opts = {}) {
        const entry = {
          name: String(name),
          entryType: 'mark',
          startTime: opts && typeof opts.startTime === 'number' ? opts.startTime : virtualPerformance.now(),
          duration: 0,
          detail: opts && opts.detail !== undefined ? opts.detail : null
        };
        perfEntries.push(entry);
        notifyPerfObservers(entry);
        return entry;
      },
      measure(name, startOrOpts, endMark) {
        let startT = 0;
        let endT = virtualPerformance.now();
        let detail = null;
        if (typeof startOrOpts === 'object' && startOrOpts !== null) {
          detail = startOrOpts.detail !== undefined ? startOrOpts.detail : null;
          if (typeof startOrOpts.start === 'number') startT = startOrOpts.start;
          else if (typeof startOrOpts.start === 'string') {
            const m = [...perfEntries].reverse().find((e) => e.name === startOrOpts.start && e.entryType === 'mark');
            if (m) startT = m.startTime;
          }
          if (typeof startOrOpts.end === 'number') endT = startOrOpts.end;
          else if (typeof startOrOpts.end === 'string') {
            const m = [...perfEntries].reverse().find((e) => e.name === startOrOpts.end && e.entryType === 'mark');
            if (m) endT = m.startTime;
          } else if (typeof startOrOpts.duration === 'number') {
            endT = startT + startOrOpts.duration;
          }
        } else {
          if (typeof startOrOpts === 'string') {
            const m = [...perfEntries].reverse().find((e) => e.name === startOrOpts && e.entryType === 'mark');
            if (m) startT = m.startTime;
          }
          if (typeof endMark === 'string') {
            const m = [...perfEntries].reverse().find((e) => e.name === endMark && e.entryType === 'mark');
            if (m) endT = m.startTime;
          }
        }
        const entry = {
          name: String(name),
          entryType: 'measure',
          startTime: startT,
          duration: Math.max(0, endT - startT),
          detail
        };
        perfEntries.push(entry);
        notifyPerfObservers(entry);
        return entry;
      },
      getEntries: () => [...perfEntries],
      getEntriesByName: (name, type) => perfEntries.filter((e) => e.name === name && (!type || e.entryType === type)),
      getEntriesByType: (type) => perfEntries.filter((e) => e.entryType === type),
      clearMarks(name) {
        for (let i = perfEntries.length - 1; i >= 0; i--) {
          if (perfEntries[i].entryType === 'mark' && (!name || perfEntries[i].name === name)) perfEntries.splice(i, 1);
        }
      },
      clearMeasures(name) {
        for (let i = perfEntries.length - 1; i >= 0; i--) {
          if (perfEntries[i].entryType === 'measure' && (!name || perfEntries[i].name === name)) perfEntries.splice(i, 1);
        }
      },
      timerify(fn) {
        return function timerified(...args) {
          const t0 = virtualPerformance.now();
          try {
            return fn.apply(this, args);
          } finally {
            const t1 = virtualPerformance.now();
            const entry = { name: fn.name || 'anonymous', entryType: 'function', startTime: t0, duration: t1 - t0, detail: args };
            perfEntries.push(entry);
            notifyPerfObservers(entry);
          }
        };
      }
    };

    class VirtualPerformanceObserver {
      constructor(cb) {
        this._cb = cb;
        this._entryTypes = null;
        this._records = [];
      }
      observe(opts = {}) {
        if (Array.isArray(opts.entryTypes)) this._entryTypes = opts.entryTypes;
        else if (opts.type) this._entryTypes = [opts.type];
        perfObservers.add(this);
        if (opts.buffered && this._entryTypes) {
          const buffered = perfEntries.filter((e) => this._entryTypes.includes(e.entryType));
          if (buffered.length > 0) {
            const list = {
              getEntries: () => buffered,
              getEntriesByName: (n, t) => buffered.filter((e) => e.name === n && (!t || e.entryType === t)),
              getEntriesByType: (t) => buffered.filter((e) => e.entryType === t)
            };
            queueMicrotask(() => { try { this._cb(list, this); } catch (err) { _runtimeLogger.debug('PerformanceObserver buffered callback failed', err); } });
          }
        }
      }
      disconnect() {
        perfObservers.delete(this);
      }
      takeRecords() {
        const recs = [...this._records];
        this._records.length = 0;
        return recs;
      }
    }

    const VirtualPerfHooks = {
      performance: virtualPerformance,
      PerformanceObserver: VirtualPerformanceObserver,
      monitorEventLoopDelay: () => ({
        enable() { return true; },
        disable() { return true; },
        reset() {},
        percentile() { return 0; },
        min: 0,
        max: 0,
        mean: 0,
        stddev: 0,
        percentiles: new Map()
      }),
      constants: {
        NODE_PERFORMANCE_GC_MAJOR: 4,
        NODE_PERFORMANCE_GC_MINOR: 1
      }
    };

    // Virtual child_process implementation capable of running `node <script>` or shell commands in VFS
    let nextChildPid = 2000;
    function parseCommandArgs(cmdStr) {
      const tokens = [];
      let cur = '';
      let quote = null;
      for (let i = 0; i < cmdStr.length; i++) {
        const ch = cmdStr[i];
        if (quote) {
          if (ch === quote) quote = null;
          else if (ch === '\\' && quote === '"' && i + 1 < cmdStr.length) cur += cmdStr[++i];
          else cur += ch;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (/\s/.test(ch)) {
          if (cur.length > 0) { tokens.push(cur); cur = ''; }
        } else {
          cur += ch;
        }
      }
      if (cur.length > 0) tokens.push(cur);
      return tokens;
    }

    function executeSubCommandSync(command, args = [], opts = {}) {
      const cwd = opts.cwd ? VirtualPath.resolve(currentCwd, opts.cwd) : currentCwd;
      const env = Object.assign({}, sandboxProcess.env, opts.env || {});
      let out = '';
      let err = '';
      let status = 0;

      if (command === 'echo') {
        out = args.join(' ') + '\n';
      } else if (command === 'pwd') {
        out = cwd + '\n';
      } else if (command === 'true') {
        status = 0;
      } else if (command === 'false') {
        status = 1;
      } else if (command === 'env' || command === 'printenv') {
        out = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
      } else if (command === 'ls') {
        const target = args.find((a) => !a.startsWith('-')) || cwd;
        const abs = VirtualPath.resolve(cwd, target);
        try {
          out = vfs.readdirSync(abs).join('\n') + '\n';
        } catch (e) {
          err = e.message + '\n';
          status = 1;
        }
      } else if (command === 'cat') {
        for (const f of args) {
          const abs = VirtualPath.resolve(cwd, f);
          try {
            out += vfs.readFileSync(abs, 'utf8');
          } catch (e) {
            err += e.message + '\n';
            status = 1;
          }
        }
      } else if (command === 'node' || command === '/usr/local/bin/node') {
        let evalCode = null;
        let scriptArgIdx = -1;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-e' || args[i] === '--eval') {
            evalCode = args[i + 1] || '';
            break;
          } else if (args[i] === '-p' || args[i] === '--print') {
            evalCode = `console.log(${args[i + 1] || ''});`;
            break;
          } else if (!args[i].startsWith('-')) {
            scriptArgIdx = i;
            break;
          }
        }
        let subTruncated = false;
        const appendSubOut = (text) => {
          if (subTruncated || outputTruncated) return;
          const s = String(text);
          if (out.length + s.length > maxOutputBytes || totalOutputBytes + s.length > maxOutputBytes) {
            const rem = Math.max(0, Math.min(maxOutputBytes - out.length, maxOutputBytes - totalOutputBytes));
            if (rem > 0) {
              const slice = s.slice(0, rem);
              out += slice;
              totalOutputBytes += slice.length;
            }
            out += TRUNCATION_NOTICE;
            subTruncated = true;
            triggerTruncation(stdoutChunks, onStdout);
            return;
          }
          out += s;
          totalOutputBytes += s.length;
        };
        const appendSubErr = (text) => {
          if (subTruncated || outputTruncated) return;
          const s = String(text);
          if (err.length + s.length > maxOutputBytes || totalOutputBytes + s.length > maxOutputBytes) {
            const rem = Math.max(0, Math.min(maxOutputBytes - err.length, maxOutputBytes - totalOutputBytes));
            if (rem > 0) {
              const slice = s.slice(0, rem);
              err += slice;
              totalOutputBytes += slice.length;
            }
            err += TRUNCATION_NOTICE;
            subTruncated = true;
            triggerTruncation(stderrChunks, onStderr);
            return;
          }
          err += s;
          totalOutputBytes += s.length;
        };
        const subConsole = createConsole(appendSubOut, appendSubErr);
        const subProcess = Object.assign(new EventEmitter(), sandboxProcess, {
          env,
          argv: scriptArgIdx >= 0
            ? ['node', VirtualPath.resolve(cwd, args[scriptArgIdx]), ...args.slice(scriptArgIdx + 1)]
            : ['node'],
          cwd: () => cwd,
          stdout: { write: (s) => { appendSubOut(s); return true; }, isTTY: false },
          stderr: { write: (s) => { appendSubErr(s); return true; }, isTTY: false },
          exit: (c = 0) => {
            status = Number(c) || 0;
            throw new ProcessExitSignal(status);
          }
        });
        try {
          let sourceToRun = evalCode;
          let scriptFilename = VirtualPath.join(cwd, '__eval__.js');
          if (sourceToRun === null && scriptArgIdx >= 0) {
            const rawScriptArg = args[scriptArgIdx];
            const directCand = resolveFileOrDirCandidates(VirtualPath.resolve(cwd, rawScriptArg));
            scriptFilename = directCand || resolveModulePath(rawScriptArg, cwd);
            sourceToRun = vfs.readFileSync(scriptFilename, 'utf8');
          }
          if (sourceToRun !== null) {
            const scriptDir = VirtualPath.dirname(scriptFilename);
            const transpiled = transpileTS(sourceToRun, scriptFilename);
            const subMod = { id: scriptFilename, filename: scriptFilename, loaded: false, exports: {} };
            const subRequire = (id) => {
              if (Object.prototype.hasOwnProperty.call(builtinModules, id)) return builtinModules[id];
              if (injectedPackages.has(id)) return injectedPackages.get(id);
              const resolved = resolveModulePath(id, scriptDir);
              return loadModule(resolved, false);
            };
            const fn = new Function(
              'exports', 'require', 'module', '__filename', '__dirname', 'Buffer', 'process', 'console',
              transpiled
            );
            fn(subMod.exports, subRequire, subMod, scriptFilename, scriptDir, VirtualBuffer, subProcess, subConsole);
          }
        } catch (e) {
          if (e && e._isProcessExit) {
            status = e.exitCode;
          } else {
            status = 1;
            err += (e && e.stack ? e.stack : String(e)) + '\n';
          }
        }
      } else {
        err = `${command}: command not found\n`;
        status = 127;
      }

      return { status, stdout: out, stderr: err, pid: nextChildPid++ };
    }

    function runShellStringSync(cmdStr, opts = {}) {
      const tokens = parseCommandArgs(String(cmdStr).trim());
      if (tokens.length === 0) return { status: 0, stdout: '', stderr: '', pid: nextChildPid++ };
      return executeSubCommandSync(tokens[0], tokens.slice(1), opts);
    }

    const vchildProcess = {
      execSync(cmd, opts = {}) {
        const res = runShellStringSync(cmd, opts);
        const enc = typeof opts === 'string' ? opts : opts && opts.encoding;
        const outVal = enc && enc !== 'buffer' ? res.stdout : VirtualBuffer.from(res.stdout);
        const errVal = enc && enc !== 'buffer' ? res.stderr : VirtualBuffer.from(res.stderr);
        if (res.status !== 0) {
          const error = new Error(`Command failed: ${cmd}\n${res.stderr}`);
          error.status = res.status;
          error.stdout = outVal;
          error.stderr = errVal;
          throw error;
        }
        return outVal;
      },
      spawnSync(command, args = [], opts = {}) {
        if (!Array.isArray(args)) { opts = args || {}; args = []; }
        const res = opts.shell ? runShellStringSync([command, ...args].join(' '), opts) : executeSubCommandSync(command, args, opts);
        const enc = opts && opts.encoding;
        const outVal = enc && enc !== 'buffer' ? res.stdout : VirtualBuffer.from(res.stdout);
        const errVal = enc && enc !== 'buffer' ? res.stderr : VirtualBuffer.from(res.stderr);
        return {
          pid: res.pid,
          output: [null, outVal, errVal],
          stdout: outVal,
          stderr: errVal,
          status: res.status,
          signal: null,
          error: null
        };
      },
      exec(cmd, optsOrCb, maybeCb) {
        const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
        const opts = typeof optsOrCb === 'object' && optsOrCb !== null ? optsOrCb : {};
        const child = Object.assign(new EventEmitter(), {
          pid: nextChildPid++,
          stdout: new PassThrough(),
          stderr: new PassThrough(),
          stdin: new PassThrough(),
          killed: false,
          kill() { this.killed = true; return true; }
        });
        queueMicrotask(() => {
          const res = runShellStringSync(cmd, opts);
          if (res.stdout) child.stdout.write(res.stdout);
          child.stdout.end();
          if (res.stderr) child.stderr.write(res.stderr);
          child.stderr.end();
          child.emit('exit', res.status, null);
          child.emit('close', res.status, null);
          if (typeof cb === 'function') {
            if (res.status !== 0) {
              const error = new Error(`Command failed: ${cmd}\n${res.stderr}`);
              error.code = res.status;
              cb(error, res.stdout, res.stderr);
            } else {
              cb(null, res.stdout, res.stderr);
            }
          }
        });
        return child;
      },
      execFile(file, argsOrOptsOrCb, optsOrCb, maybeCb) {
        let args = [];
        let opts = {};
        let cb = maybeCb;
        if (Array.isArray(argsOrOptsOrCb)) {
          args = argsOrOptsOrCb;
          if (typeof optsOrCb === 'function') cb = optsOrCb;
          else if (optsOrCb) opts = optsOrCb;
        } else if (typeof argsOrOptsOrCb === 'function') {
          cb = argsOrOptsOrCb;
        } else if (argsOrOptsOrCb) {
          opts = argsOrOptsOrCb;
          if (typeof optsOrCb === 'function') cb = optsOrCb;
        }
        return vchildProcess.exec([file, ...args].join(' '), opts, cb);
      },
      spawn(command, args = [], opts = {}) {
        if (!Array.isArray(args)) { opts = args || {}; args = []; }
        const child = Object.assign(new EventEmitter(), {
          pid: nextChildPid++,
          stdout: new PassThrough(),
          stderr: new PassThrough(),
          stdin: new PassThrough(),
          killed: false,
          kill() { this.killed = true; return true; }
        });
        queueMicrotask(() => {
          const res = opts.shell ? runShellStringSync([command, ...args].join(' '), opts) : executeSubCommandSync(command, args, opts);
          if (res.stdout) child.stdout.write(VirtualBuffer.from(res.stdout));
          child.stdout.end();
          if (res.stderr) child.stderr.write(VirtualBuffer.from(res.stderr));
          child.stderr.end();
          child.emit('exit', res.status, null);
          child.emit('close', res.status, null);
        });
        return child;
      }
    };
    vchildProcess.exec[utilPromisify.custom] = (cmd, opts = {}) => new Promise((resolve, reject) => {
      vchildProcess.exec(cmd, opts, (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
    vchildProcess.execFile[utilPromisify.custom] = (file, args = [], opts = {}) => new Promise((resolve, reject) => {
      vchildProcess.execFile(file, args, opts, (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });

    const SqliteDatabase = createSqliteDatabase(vfs, () => sandboxProcess.cwd());

    function crc32Hash(str) {
      return VirtualZlib.crc32( typeof str === 'string' || str instanceof Uint8Array ? str : String(str) );
    }

    const bunHashFn = function hash(val) {
      return crc32Hash(val);
    };
    bunHashFn.crc32 = (val) => crc32Hash(val);
    bunHashFn.cityHash64 = (val) => {
      const h1 = crc32Hash(val);
      const h2 = crc32Hash(String(val) + ':seed64');
      return (BigInt(h1) << 32n) | BigInt(h2);
    };

    function deepEquals(a, b) {
      return isDeepEqual(a, b, true);
    }

    const BunObj = {
      version: '1.1.0',
      serve(opts = {}) {
        const port = Number(opts.port || 3000);
        const hostname = opts.hostname || '127.0.0.1';
        const serverObj = {
          port,
          hostname,
          development: false,
          stop() {
            activePortTable.unregisterServer(port);
          }
        };
        activePortTable.registerServer(port, {
          server: serverObj,
          name: opts.name || 'bun-server',
          port,
          pid: resourceTracker.pid || 1,
          fetch: opts.fetch ? opts.fetch.bind(serverObj) : undefined,
          stop: () => serverObj.stop()
        });
        return serverObj;
      },
      file(p) {
        const resolved = VirtualPath.resolve(sandboxProcess.cwd(), String(p));
        return {
          name: VirtualPath.basename(resolved),
          get size() {
            try {
              return vfs.statSync(resolved).size;
            } catch (_) {
              return 0;
            }
          },
          async exists() {
            return vfs.existsSync(resolved);
          },
          async text() {
            return vfs.readFileSync(resolved, 'utf8');
          },
          async json() {
            return JSON.parse(vfs.readFileSync(resolved, 'utf8'));
          },
          async arrayBuffer() {
            const buf = vfs.readFileSync(resolved);
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          }
        };
      },
      async write(dest, data) {
        const resolved = VirtualPath.resolve(sandboxProcess.cwd(), String(dest));
        const dir = VirtualPath.dirname(resolved);
        if (!vfs.existsSync(dir)) vfs.mkdirSync(dir, { recursive: true });
        let buf;
        if (typeof data === 'string') {
          buf = VirtualBuffer.from(data, 'utf8');
        } else if (data && data.arrayBuffer && typeof data.arrayBuffer === 'function') {
          const ab = await data.arrayBuffer();
          buf = VirtualBuffer.from(ab);
        } else if (data instanceof Uint8Array || VirtualBuffer.isBuffer(data)) {
          buf = VirtualBuffer.from(data);
        } else {
          buf = VirtualBuffer.from(String(data), 'utf8');
        }
        vfs.writeFileSync(resolved, buf);
        return buf.length;
      },
      sleep(ms) {
        return new Promise(resolve => sandboxSetTimeout(resolve, Number(ms) || 0));
      },
      hash: bunHashFn,
      deepEquals,
      inspect(val) {
        return VirtualUtil.inspect(val);
      },
      nanoseconds() {
        return Math.round(performance.now() * 1e6);
      }
    };

    const bunTestModule = (() => {
      function makeExpect(actual, isNot = false) {
        const pass = (condition, msg) => {
          const ok = isNot ? !condition : condition;
          if (!ok) {
            throw new Error(msg || `expect assertion failed: actual=${actual}`);
          }
        };

        const matchers = {
          toBe(expected) {
            pass(Object.is(actual, expected), `Expected ${actual} to be ${expected}`);
          },
          toEqual(expected) {
            pass(deepEquals(actual, expected), `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
          },
          toContain(item) {
            let contains = false;
            if (actual && typeof actual.includes === 'function') {
              contains = actual.includes(item);
            } else if (actual && typeof actual.has === 'function') {
              contains = actual.has(item);
            }
            pass(contains, `Expected collection to contain ${item}`);
          },
          toThrow(expected) {
            let threw = false;
            let thrownErr = null;
            try {
              if (typeof actual === 'function') actual();
            } catch (err) {
              threw = true;
              thrownErr = err;
            }
            if (!threw) {
              pass(false, `Expected function to throw`);
              return;
            }
            if (expected) {
              const msg = thrownErr && thrownErr.message ? thrownErr.message : String(thrownErr);
              if (typeof expected === 'string') {
                pass(msg.includes(expected), `Expected error message "${msg}" to contain "${expected}"`);
              } else if (expected instanceof RegExp) {
                pass(expected.test(msg), `Expected error message "${msg}" to match ${expected}`);
              }
            } else {
              pass(true);
            }
          },
          toBeTruthy() {
            pass(Boolean(actual) === true, `Expected ${actual} to be truthy`);
          },
          toBeFalsy() {
            pass(Boolean(actual) === false, `Expected ${actual} to be falsy`);
          },
          toBeGreaterThan(n) {
            pass(actual > n, `Expected ${actual} to be greater than ${n}`);
          },
          toBeLessThan(n) {
            pass(actual < n, `Expected ${actual} to be less than ${n}`);
          },
          toHaveBeenCalled() {
            const calls = (actual && actual.mock && actual.mock.calls) || [];
            pass(calls.length > 0, `Expected mock function to have been called`);
          },
          toHaveBeenCalledTimes(n) {
            const calls = (actual && actual.mock && actual.mock.calls) || [];
            pass(calls.length === n, `Expected mock function to have been called ${n} times, was called ${calls.length}`);
          },
          toHaveBeenCalledWith(...args) {
            const calls = (actual && actual.mock && actual.mock.calls) || [];
            const found = calls.some(callEntry => {
              const callArgs = Array.isArray(callEntry) ? callEntry : (callEntry && Array.isArray(callEntry.arguments) ? callEntry.arguments : []);
              return deepEquals(callArgs, args);
            });
            pass(found, `Expected mock to have been called with ${JSON.stringify(args)}`);
          }
        };

        if (!isNot) {
          matchers.not = makeExpect(actual, true);
        }
        return matchers;
      }

      function mockFn(impl) {
        const calls = [];
        const results = [];
        const fn = function(...args) {
          calls.push(args);
          let res;
          try {
            if (typeof impl === 'function') {
              res = impl.apply(this, args);
            }
            results.push({ type: 'return', value: res });
            return res;
          } catch (err) {
            results.push({ type: 'throw', value: err });
            throw err;
          }
        };
        fn.mock = {
          calls,
          results
        };
        return fn;
      }

      return {
        describe: (suiteName, fn) => nodeDescribeFn(suiteName, fn),
        test: (testName, fn) => nodeTestFn(testName, fn),
        it: (testName, fn) => nodeTestFn(testName, fn),
        expect: (actual) => makeExpect(actual),
        mock: (impl) => mockFn(impl),
        beforeAll: (fn) => nodeTestFn.before(fn),
        afterAll: (fn) => nodeTestFn.after(fn),
        beforeEach: (fn) => nodeTestFn.beforeEach(fn),
        afterEach: (fn) => nodeTestFn.afterEach(fn)
      };
    })();

    // Built-in Node module table
    // ── Additional Node builtin shims ────────────────────────────────────────
    // Widely-used packages require these at load time (e.g. `debug` requires
    // `tty`). Without an entry `require('tty')` throws MODULE_NOT_FOUND and the
    // whole app fails to start. Implementations are deliberately minimal but
    // shape-compatible; anything that genuinely cannot work in the sandbox
    // throws an explicit, descriptive error rather than silently misbehaving.
    const VirtualTty = {
      isatty() { return false; },
      ReadStream: class TtyReadStream extends EventEmitter {},
      WriteStream: class TtyWriteStream extends EventEmitter {
        constructor(fd) { super(); this.fd = fd; this.columns = 80; this.rows = 24; this.isTTY = false; }
        getColorDepth() { return 1; }
        hasColors() { return false; }
        cursorTo() { return true; }
        clearLine() { return true; }
        moveCursor() { return true; }
      }
    };

    function makeReadlineInterface() {
      const iface = new EventEmitter();
      iface.terminal = false;
      iface.line = '';
      iface.cursor = 0;
      iface.question = (query, cb) => { if (typeof cb === 'function') queueMicrotask(() => cb('')); };
      iface.prompt = () => {};
      iface.setPrompt = () => {};
      iface.getPrompt = () => '';
      iface.write = () => {};
      iface.pause = () => iface;
      iface.resume = () => iface;
      iface.close = () => { queueMicrotask(() => iface.emit('close')); return iface; };
      iface[Symbol.asyncIterator] = async function* () {};
      return iface;
    }
    const VirtualReadline = {
      createInterface: makeReadlineInterface,
      Interface: class ReadlineInterface extends EventEmitter {},
      clearLine: () => true,
      clearScreenDown: () => true,
      cursorTo: () => true,
      moveCursor: () => true,
      emitKeypressEvents: () => {}
    };
    const VirtualReadlinePromises = {
      createInterface: () => {
        const iface = makeReadlineInterface();
        iface.question = () => Promise.resolve('');
        return iface;
      },
      Interface: class ReadlinePromisesInterface extends EventEmitter {}
    };

    const VirtualAsyncHooks = {
      AsyncLocalStorage: class AsyncLocalStorage {
        constructor() { this._store = undefined; }
        getStore() { return this._store; }
        run(store, fn, ...args) {
          const prev = this._store;
          this._store = store;
          try { return fn(...args); } finally { this._store = prev; }
        }
        exit(fn, ...args) {
          const prev = this._store;
          this._store = undefined;
          try { return fn(...args); } finally { this._store = prev; }
        }
        enterWith(store) { this._store = store; }
        disable() { this._store = undefined; }
      },
      AsyncResource: class AsyncResource {
        constructor(type) { this.type = type || 'AsyncResource'; }
        runInAsyncScope(fn, thisArg, ...args) { return fn.apply(thisArg, args); }
        emitDestroy() { return this; }
        asyncId() { return 0; }
        triggerAsyncId() { return 0; }
        static bind(fn) { return fn; }
      },
      createHook() { return { enable() {}, disable() {} }; },
      executionAsyncId() { return 0; },
      triggerAsyncId() { return 0; },
      executionAsyncResource() { return null; }
    };

    const VirtualWorkerThreads = {
      isMainThread: true,
      threadId: 0,
      parentPort: null,
      workerData: null,
      resourceLimits: {},
      SHARE_ENV: Symbol('nodejs.worker_threads.SHARE_ENV'),
      receiveMessageOnPort() { return undefined; },
      Worker: class Worker extends EventEmitter {
        constructor(filename) {
          super();
          this.threadId = -1;
          this.filename = filename;
          queueMicrotask(() => this.emit('error', new Error('worker_threads.Worker is not supported in the virtual runtime.')));
        }
        postMessage() {}
        terminate() { return Promise.resolve(0); }
        ref() { return this; }
        unref() { return this; }
      },
      MessageChannel: class MessageChannel {},
      MessagePort: class MessagePort extends EventEmitter {}
    };

    const VirtualV8 = {
      serialize(value) { return VirtualBuffer.from(JSON.stringify(value === undefined ? null : value), 'utf8'); },
      deserialize(buf) { try { return JSON.parse(String(buf)); } catch (_) { return undefined; } },
      getHeapStatistics() {
        return {
          total_heap_size: 0, total_heap_size_executable: 0, total_physical_size: 0,
          total_available_size: 0, used_heap_size: 0, heap_size_limit: 0,
          malloced_memory: 0, peak_malloced_memory: 0, does_zap_garbage: 0,
          number_of_native_contexts: 1, number_of_detached_contexts: 0
        };
      },
      getHeapSpaceStatistics() { return []; },
      setFlagsFromString() {},
      cachedDataVersionTag() { return 0; },
      Serializer: class Serializer {
        constructor() { this._value = undefined; }
        writeHeader() {}
        writeValue(value) { this._value = value; }
        releaseBuffer() { return VirtualBuffer.from(JSON.stringify(this._value === undefined ? null : this._value), 'utf8'); }
      },
      Deserializer: class Deserializer {
        constructor(buffer) { this._buffer = buffer; }
        readHeader() { return true; }
        readValue() { try { return JSON.parse(String(this._buffer)); } catch (_) { return undefined; } }
      }
    };

    const VirtualVm = {
      createContext(sandbox) { return sandbox && typeof sandbox === 'object' ? sandbox : {}; },
      isContext() { return false; },
      createScript() { throw new Error('vm code compilation is not supported in the virtual runtime.'); },
      runInContext() { throw new Error('vm.runInContext is not supported in the virtual runtime.'); },
      runInNewContext() { throw new Error('vm.runInNewContext is not supported in the virtual runtime.'); },
      runInThisContext() { throw new Error('vm.runInThisContext is not supported in the virtual runtime.'); },
      compileFunction() { throw new Error('vm.compileFunction is not supported in the virtual runtime.'); },
      Script: class Script {
        runInThisContext() { throw new Error('vm.Script is not supported in the virtual runtime.'); }
        runInContext() { throw new Error('vm.Script is not supported in the virtual runtime.'); }
        runInNewContext() { throw new Error('vm.Script is not supported in the virtual runtime.'); }
      }
    };

    const VirtualDomain = {
      create() {
        const d = new EventEmitter();
        d.members = [];
        d.add = () => d;
        d.remove = () => d;
        d.bind = (fn) => fn;
        d.intercept = (fn) => fn;
        d.run = (fn, ...args) => fn(...args);
        d.dispose = () => d;
        return d;
      },
      createDomain() { return VirtualDomain.create(); }
    };

    const VirtualDiagnosticsChannel = {
      _channels: new Map(),
      channel(name) {
        const key = String(name);
        if (!VirtualDiagnosticsChannel._channels.has(key)) {
          const ch = new EventEmitter();
          ch.name = key;
          ch.hasSubscribers = false;
          ch.subscribe = () => { ch.hasSubscribers = true; };
          ch.unsubscribe = () => { ch.hasSubscribers = false; };
          VirtualDiagnosticsChannel._channels.set(key, ch);
        }
        return VirtualDiagnosticsChannel._channels.get(key);
      },
      subscribe(name, cb) {
        const ch = VirtualDiagnosticsChannel.channel(name);
        ch.subscribe();
        if (typeof cb === 'function') ch.on('message', cb);
      },
      unsubscribe(name) { VirtualDiagnosticsChannel.channel(name).unsubscribe(); },
      Channel: class Channel extends EventEmitter {}
    };

    const notSupported = (what) => () => { throw new Error(what + ' is not supported in the virtual runtime.'); };
    const VirtualTls = {
      DEFAULT_MIN_VERSION: 'TLSv1.2',
      DEFAULT_MAX_VERSION: 'TLSv1.3',
      rootCertificates: [],
      createSecureContext() { return { context: {} }; },
      SecureContext: class SecureContext {},
      TLSSocket: class TLSSocket extends EventEmitter {},
      Server: class TLSServer extends EventEmitter {},
      checkServerIdentity() { return undefined; },
      connect: notSupported('tls.connect'),
      createServer: notSupported('tls.createServer')
    };
    const VirtualDgram = {
      createSocket(type) {
        const sock = new EventEmitter();
        sock.type = type || 'udp4';
        sock.bind = (...args) => { const cb = args[args.length - 1]; if (typeof cb === 'function') queueMicrotask(cb); return sock; };
        sock.close = (cb) => { queueMicrotask(() => { sock.emit('close'); if (typeof cb === 'function') cb(); }); return sock; };
        sock.send = notSupported('dgram.send');
        sock.address = () => ({ address: '0.0.0.0', family: 'IPv4', port: 0 });
        sock.setBroadcast = () => sock;
        sock.setTTL = () => sock;
        sock.addMembership = () => {};
        sock.dropMembership = () => {};
        return sock;
      },
      Socket: class Socket extends EventEmitter {}
    };
    const VirtualHttp2 = {
      constants: { NGHTTP2_REFUSED_STREAM: 7, NGHTTP2_CANCEL: 8 },
      connect: notSupported('http2.connect'),
      createServer: notSupported('http2.createServer'),
      createSecureServer: notSupported('http2.createSecureServer')
    };
    const VirtualCluster = {
      isPrimary: true,
      isMaster: true,
      isWorker: false,
      workers: {},
      fork: notSupported('cluster.fork'),
      setupPrimary: notSupported('cluster.setupPrimary'),
      setupMaster: notSupported('cluster.setupMaster'),
      disconnect: () => {}
    };
    const VirtualRepl = { start: notSupported('repl.start') };
    const VirtualInspector = {
      open: () => null,
      close: () => {},
      url: () => '',
      Session: class Session { connect() {} disconnect() {} post() {} }
    };
    const VirtualTraceEvents = {
      createTracing: () => ({ enable() {}, disable() {} }),
      getEnabledCategories: () => ''
    };
    const VirtualWasi = createVirtualWasi({ vfs, onStdout: emitStdout, onStderr: emitStderr });

    const VirtualStreamWeb = {
      ReadableStream: typeof ReadableStream !== 'undefined' ? ReadableStream : undefined,
      WritableStream: typeof WritableStream !== 'undefined' ? WritableStream : undefined,
      TransformStream: typeof TransformStream !== 'undefined' ? TransformStream : undefined
    };
    async function consumeStream(kind, stream) {
      const chunks = [];
      if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of stream) chunks.push(chunk);
      } else if (stream && typeof stream.on === 'function') {
        await new Promise((resolve, reject) => {
          stream.on('data', (c) => chunks.push(c));
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      }
      const bufs = chunks.map((c) => (typeof c === 'string' ? VirtualBuffer.from(c) : VirtualBuffer.from(c)));
      const buf = VirtualBuffer.concat(bufs);
      if (kind === 'buffer') return buf;
      if (kind === 'arrayBuffer') return buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : new ArrayBuffer(0);
      if (kind === 'text') return buf.toString('utf8');
      if (kind === 'json') return JSON.parse(buf.toString('utf8'));
      return buf;
    }
    const VirtualStreamConsumers = {
      text: (s) => consumeStream('text', s),
      json: (s) => consumeStream('json', s),
      buffer: (s) => consumeStream('buffer', s),
      arrayBuffer: (s) => consumeStream('arrayBuffer', s)
    };

    const builtinModules = {
      fs: vfs,
      'node:fs': vfs,
      'fs/promises': vfs.promises,
      'node:fs/promises': vfs.promises,
      path: VirtualPath,
      'node:path': VirtualPath,
      os: VirtualOs,
      'node:os': VirtualOs,
      crypto: VirtualCrypto,
      'node:crypto': VirtualCrypto,
      zlib: VirtualZlib,
      'node:zlib': VirtualZlib,
      http: vhttp,
      'node:http': vhttp,
      https: vhttp,
      'node:https': vhttp,
      net: vnet,
      'node:net': vnet,
      dns: VirtualDns,
      'node:dns': VirtualDns,
      'dns/promises': VirtualDns.promises,
      'node:dns/promises': VirtualDns.promises,
      string_decoder: VirtualStringDecoder,
      'node:string_decoder': VirtualStringDecoder,
      child_process: vchildProcess,
      'node:child_process': vchildProcess,
      process: sandboxProcess,
      'node:process': sandboxProcess,
      console: sandboxConsole,
      'node:console': sandboxConsole,
      assert: assert,
      'node:assert': assert,
      'assert/strict': assert.strict,
      'node:assert/strict': assert.strict,
      events: EventEmitter,
      'node:events': EventEmitter,
      util: VirtualUtil,
      'node:util': VirtualUtil,
      url: VirtualUrl,
      'node:url': VirtualUrl,
      querystring: VirtualQuerystring,
      'node:querystring': VirtualQuerystring,
      stream: VirtualStream,
      'node:stream': VirtualStream,
      'stream/promises': VirtualStreamPromises,
      'node:stream/promises': VirtualStreamPromises,
      test: nodeTestFn,
      'node:test': nodeTestFn,
      perf_hooks: VirtualPerfHooks,
      'node:perf_hooks': VirtualPerfHooks,
      timers: VirtualTimers,
      'node:timers': VirtualTimers,
      'timers/promises': VirtualTimersPromises,
      'node:timers/promises': VirtualTimersPromises,
      buffer: { Buffer: VirtualBuffer },
      'node:buffer': { Buffer: VirtualBuffer },
      bun: BunObj,
      'node:bun': BunObj,
      'bun:test': bunTestModule,
      'bun:sqlite': { Database: SqliteDatabase },
      tty: VirtualTty,
      tls: VirtualTls,
      dgram: VirtualDgram,
      readline: VirtualReadline,
      'readline/promises': VirtualReadlinePromises,
      async_hooks: VirtualAsyncHooks,
      worker_threads: VirtualWorkerThreads,
      v8: VirtualV8,
      vm: VirtualVm,
      domain: VirtualDomain,
      diagnostics_channel: VirtualDiagnosticsChannel,
      http2: VirtualHttp2,
      cluster: VirtualCluster,
      repl: VirtualRepl,
      inspector: VirtualInspector,
      trace_events: VirtualTraceEvents,
      wasi: VirtualWasi,
      constants: vfs.constants,
      'util/types': VirtualUtil.types,
      'stream/web': VirtualStreamWeb,
      'stream/consumers': VirtualStreamConsumers
    };

    // Auto-alias every builtin under the `node:` prefix (node:tty, node:readline…)
    // so both spellings resolve identically without hand-maintaining two lists.
    for (const __builtinName of Object.keys(builtinModules)) {
      if (!__builtinName.startsWith('node:') && !__builtinName.startsWith('bun:')) {
        builtinModules['node:' + __builtinName] = builtinModules[__builtinName];
      }
    }

    // `module` must reference the now-complete builtin table, so it is attached
    // after the object literal above.
    const VirtualModule = {
      builtinModules: Object.keys(builtinModules),
      Module: class Module {},
      isBuiltin(name) { return Object.prototype.hasOwnProperty.call(builtinModules, String(name)); },
      createRequire(from) {
        const base = typeof from === 'string' ? from : '/workspace';
        const dir = /\.(?:js|mjs|cjs|ts|json)$/.test(base) ? VirtualPath.dirname(base) : base;
        const req = (id) => {
          if (Object.prototype.hasOwnProperty.call(builtinModules, id)) return builtinModules[id];
          return loadModule(resolveModulePath(id, dir), false);
        };
        req.resolve = (id) => resolveModulePath(id, dir);
        req.cache = {};
        return req;
      }
    };
    builtinModules.module = VirtualModule;
    builtinModules['node:module'] = VirtualModule;

    const moduleCache = new Map();
    let mainModule = null;

    function resolveFileOrDirCandidates(base) {
      const fileExts = ['', '.js', '.ts', '.mjs', '.cjs', '.json'];
      for (const ext of fileExts) {
        const p = base + ext;
        if (vfs.existsSync(p) && vfs.statSync(p).isFile()) return p;
      }
      if (vfs.existsSync(base) && vfs.statSync(base).isDirectory()) {
        const pkgJsonPath = VirtualPath.join(base, 'package.json');
        if (vfs.existsSync(pkgJsonPath) && vfs.statSync(pkgJsonPath).isFile()) {
          try {
            const pkg = JSON.parse(vfs.readFileSync(pkgJsonPath, 'utf8'));
            let entryRel = null;
            if (typeof pkg.exports === 'string') {
              entryRel = pkg.exports;
            } else if (pkg.exports && typeof pkg.exports === 'object') {
              const rootExp = pkg.exports['.'] || pkg.exports;
              if (typeof rootExp === 'string') entryRel = rootExp;
              else if (rootExp && typeof rootExp === 'object') {
                entryRel = rootExp.require || rootExp.import || rootExp.default || rootExp.node;
              }
            }
            if (!entryRel) entryRel = pkg.main || pkg.module || (typeof pkg.browser === 'string' ? pkg.browser : null);
            if (entryRel) {
              const resolvedEntry = resolveFileOrDirCandidates(VirtualPath.resolve(base, entryRel));
              if (resolvedEntry) return resolvedEntry;
            }
          } catch (err) {
            _runtimeLogger.debug('resolveFileOrDirCandidates package.json parse failed', err);
          }
        }
        const indexCandidates = ['index.js', 'index.ts', 'index.mjs', 'index.cjs', 'index.json'];
        for (const idx of indexCandidates) {
          const p = VirtualPath.join(base, idx);
          if (vfs.existsSync(p) && vfs.statSync(p).isFile()) return p;
        }
      }
      return null;
    }

    function resolveModulePath(arg1, arg2 = '/workspace') {
      let request = arg1;
      let fromDir = arg2;
      // Support both (request, fromDir) and (fromDir, request) calling conventions
      if (
        typeof arg1 === 'string' &&
        typeof arg2 === 'string' &&
        arg1.startsWith('/workspace') &&
        !arg2.startsWith('/workspace') &&
        vfs.existsSync(arg1) &&
        vfs.statSync(arg1).isDirectory()
      ) {
        fromDir = arg1;
        request = arg2;
      }

      if (request.startsWith('.') || request.startsWith('/')) {
        const base = request.startsWith('/')
          ? VirtualPath.normalize(request)
          : VirtualPath.resolve(fromDir, request);
        const found = resolveFileOrDirCandidates(base);
        if (found) return found;
      } else {
        // Bare module specifier: walk up node_modules directories
        const parts = request.split('/');
        const pkgName = request.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
        const subpath = request.startsWith('@') ? parts.slice(2).join('/') : parts.slice(1).join('/');

        let curr = VirtualPath.resolve('/workspace', fromDir || '/workspace');
        const searchDirs = [];
        while (true) {
          searchDirs.push(VirtualPath.join(curr, 'node_modules'));
          const parent = VirtualPath.dirname(curr);
          if (parent === curr) break;
          curr = parent;
        }
        if (!searchDirs.includes('/workspace/node_modules')) {
          searchDirs.push('/workspace/node_modules');
        }

        for (const nmDir of searchDirs) {
          const pkgRoot = VirtualPath.join(nmDir, pkgName);
          if (subpath) {
            // Check package.json subpath exports first
            const pkgJsonPath = VirtualPath.join(pkgRoot, 'package.json');
            if (vfs.existsSync(pkgJsonPath) && vfs.statSync(pkgJsonPath).isFile()) {
              try {
                const pkg = JSON.parse(vfs.readFileSync(pkgJsonPath, 'utf8'));
                const expKey = `./${subpath}`;
                if (pkg.exports && pkg.exports[expKey]) {
                  const subExp = pkg.exports[expKey];
                  const targetRel = typeof subExp === 'string'
                    ? subExp
                    : (subExp.require || subExp.import || subExp.default);
                  if (targetRel) {
                    const found = resolveFileOrDirCandidates(VirtualPath.resolve(pkgRoot, targetRel));
                    if (found) return found;
                  }
                }
              } catch (err) {
                _runtimeLogger.debug('resolveModulePath subpath package.json parse failed', err);
              }
            }
            const foundSub = resolveFileOrDirCandidates(VirtualPath.join(pkgRoot, subpath));
            if (foundSub) return foundSub;
          } else {
            const foundPkg = resolveFileOrDirCandidates(pkgRoot);
            if (foundPkg) return foundPkg;
          }
        }
      }

      const err = new Error(`Cannot find module '${request}' from '${fromDir}'`);
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }

    // Global fallback `test` / `it` / `describe` for custom user test scripts
    const globalTest = (name, optsOrFn, maybeFn) => nodeTestFn(name, optsOrFn, maybeFn);
    const globalDescribe = (suiteName, optsOrFn, maybeFn) => nodeDescribeFn(suiteName, optsOrFn, maybeFn);

    const virtualFetch = async (urlOrReq, init = {}) => {
      let urlStr;
      let finalInit = init || {};
      if (typeof urlOrReq === 'string') {
        urlStr = urlOrReq;
      } else if (urlOrReq && urlOrReq.url) {
        urlStr = urlOrReq.url;
        finalInit = Object.assign({
          method: urlOrReq.method,
          headers: urlOrReq.headers,
          body: urlOrReq.body
        }, init);
      } else {
        urlStr = String(urlOrReq);
      }

      let parsedLocal = null;
      try {
        const parsed = new URL(urlStr);
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0';
        if (isLocal) parsedLocal = parsed;
      } catch (err) {
        _runtimeLogger.debug('virtualFetch local URL parse skipped', err);
      }

      if (parsedLocal && activePortTable) {
        let dispatchInit = finalInit;
        if (!dispatchInit._fromPort && resourceTracker && resourceTracker.pid && typeof activePortTable.listServers === 'function') {
          const targetPort = Number(parsedLocal.port || (parsedLocal.protocol === 'https:' ? 443 : 80));
          const owned = activePortTable.listServers().find((s) => s && s.pid === resourceTracker.pid && Number(s.port) !== targetPort);
          if (owned) {
            dispatchInit = Object.assign({}, finalInit, { _fromPort: owned.port });
          }
        }
        return await activePortTable.dispatchRequest(urlStr, dispatchInit);
      }

      if (typeof globalThis.fetch === 'function') {
        return await globalThis.fetch(urlOrReq, init);
      }
      throw new Error(`fetch failed for ${urlStr}`);
    };

    const sandboxGlobal = {
      Buffer: VirtualBuffer,
      process: sandboxProcess,
      console: sandboxConsole,
      setTimeout: sandboxSetTimeout,
      clearTimeout: sandboxClearTimeout,
      setInterval: sandboxSetInterval,
      clearInterval: sandboxClearInterval,
      setImmediate: sandboxSetImmediate,
      clearImmediate: sandboxClearImmediate,
      queueMicrotask,
      TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : undefined,
      TextDecoder: typeof TextDecoder !== 'undefined' ? TextDecoder : undefined,
      performance: virtualPerformance,
      PerformanceObserver: VirtualPerformanceObserver,
      URL: VirtualUrl.URL,
      URLSearchParams: VirtualUrl.URLSearchParams,
      crypto: VirtualCrypto,
      fetch: virtualFetch,
      Request,
      Response,
      Headers,
      Bun: BunObj
    };
    sandboxGlobal.global = sandboxGlobal;
    sandboxGlobal.globalThis = sandboxGlobal;

    function loadModule(absPath, isMain = false) {
      if (moduleCache.has(absPath)) {
        return moduleCache.get(absPath).exports;
      }
      const mod = {
        id: absPath,
        filename: absPath,
        loaded: false,
        exports: {}
      };
      if (isMain) mainModule = mod;
      moduleCache.set(absPath, mod);

      const rawSource = vfs.readFileSync(absPath, 'utf8');
      if (absPath.endsWith('.json')) {
        mod.exports = JSON.parse(rawSource);
        mod.loaded = true;
        return mod.exports;
      }

      const dir = VirtualPath.dirname(absPath);
      const localRequire = function require(id) {
        if (Object.prototype.hasOwnProperty.call(builtinModules, id)) {
          return builtinModules[id];
        }
        if (injectedPackages.has(id)) {
          return injectedPackages.get(id);
        }
        const resolved = resolveModulePath(id, dir);
        return loadModule(resolved, false);
      };
      localRequire.main = mainModule;
      localRequire.resolve = (id) => resolveModulePath(id, dir);
      localRequire.cache = Object.fromEntries(moduleCache.entries());

      let transformed = transpileTS(rawSource, absPath);
      if (mode === 'test' || isMain || absPath.endsWith('test.js') || absPath.endsWith('test.ts')) {
        transformed = instrumentTestCode(transformed);
      }

      const moduleBody = '{\n' + transformed + '\n}\n//# sourceURL=' + absPath + '\n';

      const fn = compileFunction(
        [
          'exports',
          'require',
          'module',
          '__filename',
          '__dirname',
          'Buffer',
          'process',
          'console',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'clearImmediate',
          'global',
          '__shouldSkipTest',
          '__wrapTestFn',
          'test',
          'describe',
          'it',
          'Bun',
          'fetch',
          'Request',
          'Response',
          'Headers'
        ],
        moduleBody
      );

      syncExecDepth++;
      let execResult;
      try {
        execResult = fn(
          mod.exports,
          localRequire,
          mod,
          absPath,
          dir,
          VirtualBuffer,
          sandboxProcess,
          sandboxConsole,
          sandboxSetTimeout,
          sandboxClearTimeout,
          sandboxSetInterval,
          sandboxClearInterval,
          sandboxSetImmediate,
          sandboxClearImmediate,
          sandboxGlobal,
          shouldSkipTest,
          wrapTestFn,
          globalTest,
          globalDescribe,
          globalTest,
          BunObj,
          sandboxGlobal.fetch,
          Request,
          Response,
          Headers
        );
      } finally {
        syncExecDepth--;
      }

      if (execResult && typeof execResult.then === 'function') {
        resourceTracker.pendingTests.add(execResult);
        return execResult.then(() => {
          resourceTracker.pendingTests.delete(execResult);
          mod.loaded = true;
          return mod.exports;
        }).catch((err) => {
          resourceTracker.pendingTests.delete(execResult);
          throw err;
        });
      }

      mod.loaded = true;
      return mod.exports;
    }

    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    let __fnSeq = 0;
    function compileFunction(argNames, body) {
      try {
        return new Function(...argNames, body);
      } catch (err) {
        if (err instanceof SyntaxError && (/\bawait\b/.test(body) || /await/i.test(err.message))) {
          try {
            return new AsyncFunction(...argNames, body);
          } catch (asyncErr) {
            _runtimeLogger.debug('AsyncFunction compilation fallback failed', asyncErr);
          }
        }
        if (
          err &&
          err.name === 'EvalError' &&
          typeof importScripts === 'function' &&
          typeof Blob !== 'undefined' &&
          typeof URL !== 'undefined' &&
          typeof URL.createObjectURL === 'function'
        ) {
          const globalObj = typeof self !== 'undefined' ? self : globalThis;
          const fnKey = '__cl_fn_' + (++__fnSeq) + '_' + Math.random().toString(36).slice(2);
          const scriptSrc = `self[${JSON.stringify(fnKey)}] = function(${argNames.join(', ')}) {\n${body}\n};`;
          const blob = new Blob([scriptSrc], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          try {
            importScripts(blobUrl);
            const compiled = globalObj[fnKey];
            delete globalObj[fnKey];
            if (typeof compiled === 'function') return compiled;
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        }
        throw err;
      }
    }

    function raceWithAbort(promise) {
      if (!promise || typeof promise.then !== 'function') {
        return Promise.resolve(promise);
      }
      if (hasExited || isSigintAborted || Boolean(signal && signal.aborted)) {
        if (!hasExited) handleSigint();
        return Promise.resolve();
      }

      // Absorb late rejections after abort to avoid unhandled promise rejection warnings
      promise.catch(() => {});

      return new Promise((resolve, reject) => {
        let timer = null;
        let settled = false;

        const cleanup = () => {
          if (settled) return;
          settled = true;
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          if (signal && onAbort) {
            try {
              signal.removeEventListener('abort', onAbort);
            } catch (err) {
              _runtimeLogger.debug('raceWithAbort removeEventListener failed', err);
            }
          }
        };

        const onAbort = () => {
          cleanup();
          handleSigint();
          resolve();
        };

        if (signal) {
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
        }

        const remainingMs = timeoutMs - (performance.now() - startTime);
        if (remainingMs > 0 && Number.isFinite(remainingMs)) {
          timer = setTimeout(() => {
            cleanup();
            resolve();
          }, remainingMs);
          if (timer && typeof timer.unref === 'function') {
            timer.unref();
          }
        }

        promise.then(
          (val) => {
            cleanup();
            resolve(val);
          },
          (err) => {
            cleanup();
            reject(err);
          }
        );
      });
    }

    let replValue = undefined;
    try {
      if (hasExited || isSigintAborted || Boolean(signal && signal.aborted)) {
        if (!hasExited) handleSigint();
      } else if (mode === 'repl') {
        const replPath = '/workspace/__repl__.ts';
        vfs.writeFileSync(replPath, replCode || '');
        const dir = '/workspace';
        const localRequire = function require(id) {
          if (Object.prototype.hasOwnProperty.call(builtinModules, id)) return builtinModules[id];
          if (injectedPackages.has(id)) return injectedPackages.get(id);
          const resolved = resolveModulePath(id, dir);
          return loadModule(resolved, false);
        };
        const transpiledRepl = transpileTS(replCode || '', replPath);
        let body = transpiledRepl.trim();
        const semiIdx = body.lastIndexOf(';');
        let prefix = '';
        let candidate = body;
        if (semiIdx !== -1 && semiIdx < body.length - 1) {
          prefix = body.slice(0, semiIdx + 1) + '\n';
          candidate = body.slice(semiIdx + 1).trim();
        } else {
          const lines = body.split('\n');
          prefix = lines.slice(0, -1).join('\n') + '\n';
          candidate = (lines[lines.length - 1] || '').trim();
        }
        if (candidate && !/^\s*(const|let|var|function|class|if|for|while|switch|try|return|throw)\b/.test(candidate)) {
          const testBody = prefix + `return (${candidate.replace(/;+\s*$/, '')});`;
          try {
            compileFunction([], testBody);
            body = testBody;
          } catch (_) {
            body = transpiledRepl;
          }
        }
        const replFn = compileFunction(
          [
            'require',
            'Buffer',
            'process',
            'console',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'setImmediate',
            'clearImmediate',
            'Bun',
            'fetch'
          ],
          `return (async () => {\n${body}\n})();`
        );
        replValue = await raceWithAbort(
          replFn(
            localRequire,
            VirtualBuffer,
            sandboxProcess,
            sandboxConsole,
            sandboxSetTimeout,
            sandboxClearTimeout,
            sandboxSetInterval,
            sandboxClearInterval,
            sandboxSetImmediate,
            sandboxClearImmediate,
            BunObj,
            sandboxGlobal.fetch
          )
        );
        if (!hasExited && replValue !== undefined && options.printReplResult !== false) {
          emitStdout(formatConsoleArg(replValue) + '\n');
        }
      } else {
        let entryAbs = vfs.existsSync(entry) ? entry : `/workspace/${entry.replace(/^\/+/, '')}`;
        if (!vfs.existsSync(entryAbs)) {
          const alt = `/workspace/src/${entry.replace(/^\/+/, '')}`;
          if (vfs.existsSync(alt)) entryAbs = alt;
        }
        const isCppEntry = /\.(cpp|cc|cxx)$/i.test(entryAbs);
        const isPyEntry = /\.py$/i.test(entryAbs);
        const isWasmEntry = /\.wasm$/i.test(entryAbs) || Boolean(options.wasmBinary);
        if (isWasmEntry) {
          const wasmBytes = options.wasmBinary || vfs.readFileSync(entryAbs);
          const wasiRes = await executeWasiModule(wasmBytes, {
            vfs,
            args: argv || [entryAbs],
            env: Object.assign({}, sandboxProcess.env, options.env || {}),
            stdin: options.stdin || '',
            onStdout: emitStdout,
            onStderr: emitStderr
          });
          exitCode = wasiRes.exitCode;
          hasExited = true;
        } else if (isCppEntry) {
          const cppCompiler =
            options.cppCompiler ||
            (typeof globalThis !== 'undefined' && globalThis.__codelabCppCompiler) ||
            (rootScope && rootScope.__codelabCppCompiler);
          if (typeof cppCompiler !== 'function') {
            throw new Error(
              'C++ toolchain is not registered. Enable cppExtension from "@innovatorved/code-lab/extensions/cpp" to compile and run C++ files.'
            );
          }
          const compileRes = await cppCompiler({
            entry: entryAbs,
            vfs,
            files: typeof vfs.toSnapshot === 'function' ? vfs.toSnapshot('/workspace') : (files || {}),
            args: argv || [entryAbs],
            env: Object.assign({}, sandboxProcess.env, options.env || {}),
            stdin: options.stdin || '',
            testFilter,
            onStdout: emitStdout,
            onStderr: emitStderr
          });
          if (compileRes && compileRes.wasmBinary) {
            const wasiRes = await executeWasiModule(compileRes.wasmBinary, {
              vfs,
              args: compileRes.args || argv || [entryAbs],
              env: Object.assign({}, sandboxProcess.env, options.env || {}),
              stdin: options.stdin || '',
              onStdout: emitStdout,
              onStderr: emitStderr
            });
            exitCode = wasiRes.exitCode;
            hasExited = true;
          } else if (compileRes && typeof compileRes.exitCode === 'number') {
            exitCode = compileRes.exitCode;
            hasExited = true;
          }
        } else if (isPyEntry) {
          const pyCompiler =
            options.pythonCompiler ||
            (typeof globalThis !== 'undefined' && globalThis.__codelabPythonCompiler) ||
            (rootScope && rootScope.__codelabPythonCompiler);
          if (typeof pyCompiler !== 'function') {
            throw new Error(
              'Python WebAssembly toolchain is not registered. Enable pythonExtension from "@innovatorved/code-lab/extensions/python" to run Python files.'
            );
          }
          const pyRes = await pyCompiler({
            entry: entryAbs,
            vfs,
            files: typeof vfs.toSnapshot === 'function' ? vfs.toSnapshot('/workspace') : (files || {}),
            args: argv || [entryAbs],
            env: Object.assign({}, sandboxProcess.env, options.env || {}),
            stdin: options.stdin || '',
            testFilter,
            onStdout: emitStdout,
            onStderr: emitStderr
          });
          if (pyRes) {
            exitCode = typeof pyRes.exitCode === 'number' ? pyRes.exitCode : (pyRes.ok ? 0 : 1);
            if (pyRes.testResults && Array.isArray(pyRes.testResults)) {
              for (const tr of pyRes.testResults) {
                testResults.push(tr);
              }
            }
          }
          hasExited = true;
        } else {
          // Check if the file in VFS starts with WASM magic bytes (\0asm)
          let rawBuf = null;
          if (vfs.existsSync(entryAbs)) {
            try { rawBuf = vfs.readFileSync(entryAbs); } catch (err) { _runtimeLogger.debug('Failed to probe binary header', err); }
          }
          if (rawBuf && rawBuf.length >= 4 && rawBuf[0] === 0x00 && rawBuf[1] === 0x61 && rawBuf[2] === 0x73 && rawBuf[3] === 0x6d) {
            const wasiRes = await executeWasiModule(rawBuf, {
              vfs,
              args: argv || [entryAbs],
              env: Object.assign({}, sandboxProcess.env, options.env || {}),
              stdin: options.stdin || '',
              onStdout: emitStdout,
              onStderr: emitStderr
            });
            exitCode = wasiRes.exitCode;
            hasExited = true;
          } else {
            const res = loadModule(entryAbs, true);
            if (res && typeof res.then === 'function') {
              await raceWithAbort(res);
            }
          }
        }
      }

      const deadline = performance.now() + timeoutMs;
      let idleTicks = 0;
      while (!hasExited && performance.now() < deadline) {
        if (signal && signal.aborted) {
          handleSigint();
          break;
        }
        await Promise.resolve();
        await Promise.resolve();
        const busy =
          resourceTracker.activeTimers.size > 0 ||
          resourceTracker.activeImmediates.size > 0 ||
          resourceTracker.inFlightHttp.size > 0 ||
          resourceTracker.pendingTests.size > 0 ||
          (isBackground && vhttp.hasActiveServers());

        if (!busy) {
          idleTicks++;
          if (idleTicks >= 2) break;
        } else {
          idleTicks = 0;
        }
        await new Promise((r) => setTimeout(r, 2));
      }
    } catch (err) {
      if (err && err._isProcessExit) {
        exitCode = err.exitCode;
      } else {
        exitCode = 1;
        emitStderr((err && err.stack ? err.stack : String(err)) + '\n');
      }
    } finally {
      if (signal && signalListener) {
        try { signal.removeEventListener('abort', signalListener); } catch (err) { _runtimeLogger.debug('executeInVirtualRuntime removeEventListener failed', err); }
      }
      if (!hasExited) {
        hasExited = true;
        try { sandboxProcess.emit('exit', exitCode); } catch (err) { _runtimeLogger.debug('executeInVirtualRuntime exit listener failed', err); }
      }
      for (const rawId of resourceTracker.allTimers) {
        clearTimeout(rawId);
        clearInterval(rawId);
      }
      resourceTracker.activeTimers.clear();
      resourceTracker.allTimers.clear();
      resourceTracker.activeImmediates.clear();
      resourceTracker.inFlightHttp.clear();
      if (_stdoutLineBuf.length > 0) {
        const leftover = _stdoutLineBuf;
        _stdoutLineBuf = '';
        emitStdout(leftover + '\n');
      }
      if (!isBackground) {
        vhttp.closeAllServers();
        vnet.closeAllServers();
      }
    }

    const failedTests = testResults.filter((t) => !t.passed).length;
    if (failedTests > 0 && exitCode === 0) exitCode = 1;

    return {
      ok: exitCode === 0,
      exitCode,
      durationMs: Math.max(0, performance.now() - startTime),
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      cancelled: exitCode === 130 || isSigintAborted || Boolean(signal && signal.aborted),
      outputTruncated,
      testResults,
      testSummary: {
        total: testResults.length,
        passed: testResults.length - failedTests,
        failed: failedTests
      },
      fsSnapshot: typeof vfs.getSnapshot === 'function' ? vfs.getSnapshot() : [],
      httpTrace: [...vhttp.getTrace(), ...vnet.getTrace()],
      replValue: replValue !== undefined ? formatConsoleArg(replValue) : undefined
    };
  }

  // Transpile a source file so it can run natively in a browser as an ES module:
  // JSX is compiled to the classic runtime (auto-importing React when needed) and
  // TypeScript annotations are stripped, but `import`/`export` are preserved so an
  // import map can resolve bare specifiers to CDN ESM builds.
  function transpileForBrowser(source, filename = 'module.js') {
    return transpileTS(source, filename, { keepEsm: true });
  }

  function createSqliteDatabase(vfs = null, getCwd = null) {
    function stripSqlComments(sql) {
      return String(sql || '')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--[^\r\n]*/g, ' ')
        .trim();
    }

    function splitValueTuples(rawValues) {
      const tuples = [];
      let depth = 0;
      let inQuote = null;
      let start = -1;
      for (let i = 0; i < rawValues.length; i++) {
        const ch = rawValues[i];
        if (inQuote) {
          if (ch === inQuote && rawValues[i - 1] !== '\\') inQuote = null;
          continue;
        }
        if (ch === "'" || ch === '"') {
          inQuote = ch;
        } else if (ch === '(') {
          if (depth === 0) start = i + 1;
          depth++;
        } else if (ch === ')') {
          depth--;
          if (depth === 0 && start !== -1) {
            tuples.push(rawValues.slice(start, i));
            start = -1;
          }
        }
      }
      return tuples;
    }

    function splitCsvRespectingQuotes(str) {
      const out = [];
      let cur = '';
      let inQuote = null;
      let depth = 0;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (inQuote) {
          cur += ch;
          if (ch === inQuote && str[i - 1] !== '\\') inQuote = null;
          continue;
        }
        if (ch === "'" || ch === '"') {
          inQuote = ch;
          cur += ch;
        } else if (ch === '(') {
          depth++;
          cur += ch;
        } else if (ch === ')') {
          depth = Math.max(0, depth - 1);
          cur += ch;
        } else if (ch === ',' && depth === 0) {
          out.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    }

    return class SqliteDatabase {
      constructor(filename = ':memory:') {
        this.filename = filename || ':memory:';
        this.tables = new Map();
        this.indexes = new Map();
        this._loadFromVfs();
      }

      _resolveDbPath() {
        if (!this.filename || this.filename === ':memory:') return null;
        const cwd = typeof getCwd === 'function' ? getCwd() : '/workspace';
        return VirtualPath.resolve(cwd || '/workspace', String(this.filename));
      }

      _loadFromVfs() {
        const p = this._resolveDbPath();
        if (!p || !vfs || typeof vfs.existsSync !== 'function' || !vfs.existsSync(p)) return;
        try {
          const raw = vfs.readFileSync(p, 'utf8');
          const trimmed = String(raw || '').trim();
          if (!trimmed) return;
          if (trimmed.startsWith('{')) {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.__codelab_sqlite__) {
              if (parsed.tables && typeof parsed.tables === 'object') {
                for (const [tName, tVal] of Object.entries(parsed.tables)) {
                  this.tables.set(tName, tVal);
                }
              }
              if (parsed.indexes && typeof parsed.indexes === 'object') {
                for (const [iName, iVal] of Object.entries(parsed.indexes)) {
                  this.indexes.set(iName, iVal);
                }
              }
              return;
            }
          }
          this.exec(trimmed);
        } catch (err) {
          _runtimeLogger.debug('SqliteDatabase._loadFromVfs skipped', err);
        }
      }

      _persistToVfs() {
        const p = this._resolveDbPath();
        if (!p || !vfs || typeof vfs.writeFileSync !== 'function') return;
        try {
          const dir = VirtualPath.dirname(p);
          if (typeof vfs.existsSync === 'function' && !vfs.existsSync(dir) && typeof vfs.mkdirSync === 'function') {
            vfs.mkdirSync(dir, { recursive: true });
          }
          const payload = JSON.stringify({
            __codelab_sqlite__: 1,
            tables: Object.fromEntries(this.tables),
            indexes: Object.fromEntries(this.indexes)
          });
          vfs.writeFileSync(p, payload);
        } catch (err) {
          _runtimeLogger.debug('SqliteDatabase._persistToVfs failed', err);
        }
      }

      run(sql, params = []) {
        const stmt = stripSqlComments(sql).replace(/;$/, '').trim();
        if (!stmt) return { changes: 0, lastInsertRowid: 0 };

        if (/^CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TABLE/i.test(stmt)) {
          const match = stmt.match(/^CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]*)\)/i);
          if (match) {
            const tableName = match[1];
            const colDefs = splitCsvRespectingQuotes(match[2]);
            const cols = [];
            for (const c of colDefs) {
              if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|CHECK)\b/i.test(c)) continue;
              const parts = c.split(/\s+/);
              const colName = parts[0].replace(/^["'`]|["'`]$/g, '');
              const isPk = /PRIMARY\s+KEY/i.test(c);
              const isAuto = /AUTOINCREMENT/i.test(c) || (/INTEGER/i.test(parts[1] || '') && isPk);
              cols.push({ name: colName, type: parts[1] || 'TEXT', isPk, isAuto, raw: c });
            }
            if (!this.tables.has(tableName)) {
              this.tables.set(tableName, { columns: cols, rows: [], autoInc: 0, sql: stmt });
              this._persistToVfs();
            }
          }
          return { changes: 0, lastInsertRowid: 0 };
        }

        if (/^DROP\s+TABLE/i.test(stmt)) {
          const match = stmt.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
          if (match) {
            this.tables.delete(match[1]);
            this._persistToVfs();
          }
          return { changes: 0, lastInsertRowid: 0 };
        }

        if (/^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(stmt)) {
          const match = stmt.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
          if (match) {
            const unique = Boolean(match[1]);
            const idxName = match[2];
            const tblName = match[3];
            const cols = match[4].split(',').map((s) => s.trim().split(/\s+/)[0]);
            this.indexes.set(idxName, { name: idxName, table: tblName, columns: cols, unique, sql: stmt });
            this._persistToVfs();
          }
          return { changes: 0, lastInsertRowid: 0 };
        }

        if (/^DROP\s+INDEX/i.test(stmt)) {
          const match = stmt.match(/^DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
          if (match) {
            this.indexes.delete(match[1]);
            this._persistToVfs();
          }
          return { changes: 0, lastInsertRowid: 0 };
        }

        if (/^ALTER\s+TABLE/i.test(stmt)) {
          const match = stmt.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?([a-zA-Z0-9_]+)\s*(.*)$/i);
          if (match) {
            const table = this.tables.get(match[1]);
            if (table) {
              const colName = match[2];
              const colType = (match[3] || 'TEXT').split(/\s+/)[0] || 'TEXT';
              table.columns.push({ name: colName, type: colType, isPk: false, isAuto: false });
              this._persistToVfs();
            }
          }
          return { changes: 0, lastInsertRowid: 0 };
        }

        if (/^PRAGMA\s+/i.test(stmt)) {
          return { changes: 0, lastInsertRowid: 0 };
        }

        if (/^INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO/i.test(stmt)) {
          const match = stmt.match(/^INSERT\s+(?:OR\s+(REPLACE|IGNORE)\s+)?INTO\s+([a-zA-Z0-9_]+)(?:\s*\(([^)]+)\))?\s*VALUES\s*([\s\S]*)$/i);
          if (match) {
            const conflictMode = (match[1] || '').toUpperCase();
            const tableName = match[2];
            const table = this.tables.get(tableName);
            if (!table) throw new Error(`no such table: ${tableName}`);
            const explicitCols = match[3] ? match[3].split(',').map((s) => s.trim()) : null;
            const tuples = splitValueTuples(match[4]);
            const pList = Array.isArray(params) ? [...params] : [params];
            let insertedCount = 0;

            for (const tupleStr of (tuples.length > 0 ? tuples : [match[4].replace(/^\(|\)$/g, '')])) {
              const valExprs = splitCsvRespectingQuotes(tupleStr);
              const colNames = explicitCols
                ? explicitCols
                : (valExprs.length === table.columns.length
                  ? table.columns.map((c) => c.name)
                  : table.columns.filter((c) => !c.isPk).map((c) => c.name));
              const row = {};
              const pkCol = table.columns.find((c) => c.isPk);

              for (let i = 0; i < colNames.length; i++) {
                const cName = colNames[i];
                const expr = valExprs[i] !== undefined ? valExprs[i] : '?';
                if (expr === '?') {
                  row[cName] = pList.shift();
                } else if (/^['"][\s\S]*['"]$/.test(expr)) {
                  row[cName] = expr.slice(1, -1).replace(/''/g, "'");
                } else if (/^null$/i.test(expr)) {
                  row[cName] = null;
                } else if (!isNaN(Number(expr))) {
                  row[cName] = Number(expr);
                } else {
                  row[cName] = expr;
                }
              }

              if (pkCol) {
                if (row[pkCol.name] === undefined || row[pkCol.name] === null) {
                  table.autoInc++;
                  row[pkCol.name] = table.autoInc;
                } else if (typeof row[pkCol.name] === 'number' && row[pkCol.name] > table.autoInc) {
                  table.autoInc = row[pkCol.name];
                }
                const existingIdx = table.rows.findIndex((r) => String(r[pkCol.name]) === String(row[pkCol.name]));
                if (existingIdx !== -1) {
                  if (conflictMode === 'IGNORE') continue;
                  if (conflictMode === 'REPLACE') {
                    table.rows[existingIdx] = row;
                    insertedCount++;
                    continue;
                  }
                }
              } else {
                table.autoInc++;
              }

              table.rows.push(row);
              insertedCount++;
            }
            this._persistToVfs();
            return { changes: insertedCount, lastInsertRowid: table.autoInc };
          }
        }

        if (/^DELETE\s+FROM/i.test(stmt)) {
          const match = stmt.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]*))?$/i);
          if (match) {
            const table = this.tables.get(match[1]);
            if (!table) throw new Error(`no such table: ${match[1]}`);
            const whereClause = match[2] ? match[2].trim() : null;
            const pList = Array.isArray(params) ? [...params] : [params];
            const beforeLen = table.rows.length;
            if (!whereClause) {
              table.rows = [];
            } else {
              table.rows = table.rows.filter((r) => !this._matchWhere(r, whereClause, [...pList]));
            }
            this._persistToVfs();
            return { changes: beforeLen - table.rows.length, lastInsertRowid: table.autoInc };
          }
        }

        if (/^UPDATE\s+/i.test(stmt)) {
          const match = stmt.match(/^UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]*?)(?:\s+WHERE\s+([\s\S]*))?$/i);
          if (match) {
            const table = this.tables.get(match[1]);
            if (!table) throw new Error(`no such table: ${match[1]}`);
            const setParts = splitCsvRespectingQuotes(match[2]);
            const whereClause = match[3] ? match[3].trim() : null;
            const pList = Array.isArray(params) ? [...params] : [params];
            let changes = 0;
            for (const row of table.rows) {
              const rowParams = [...pList];
              const setUpdates = [];
              for (const sp of setParts) {
                const eqIdx = sp.indexOf('=');
                const col = sp.slice(0, eqIdx).trim();
                const valExpr = sp.slice(eqIdx + 1).trim();
                const val = valExpr === '?'
                  ? rowParams.shift()
                  : (/^['"][\s\S]*['"]$/.test(valExpr)
                    ? valExpr.slice(1, -1)
                    : (!isNaN(Number(valExpr)) ? Number(valExpr) : valExpr));
                setUpdates.push([col, val]);
              }
              if (!whereClause || this._matchWhere(row, whereClause, rowParams)) {
                for (const [col, val] of setUpdates) row[col] = val;
                changes++;
              }
            }
            this._persistToVfs();
            return { changes, lastInsertRowid: table.autoInc };
          }
        }

        return { changes: 0, lastInsertRowid: 0 };
      }

      _matchWhere(row, whereClause, pList) {
        if (!whereClause) return true;
        const andParts = whereClause.split(/\s+AND\s+/i);
        for (const part of andParts) {
          const trimmed = part.trim();
          const isNullMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+IS\s+(NOT\s+)?NULL$/i);
          if (isNullMatch) {
            const col = isNullMatch[1];
            const isNot = Boolean(isNullMatch[2]);
            const isNull = row[col] === null || row[col] === undefined;
            if (isNot ? isNull : !isNull) return false;
            continue;
          }
          const likeMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+LIKE\s+(.+)$/i);
          if (likeMatch) {
            const col = likeMatch[1];
            let pat = likeMatch[2].trim();
            if (pat === '?') pat = String(pList.shift() || '');
            else if (/^['"].*['"]$/.test(pat)) pat = pat.slice(1, -1);
            const re = new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
            if (!re.test(String(row[col] ?? ''))) return false;
            continue;
          }
          const eqMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>=|<=|>|<)\s*(.*)$/);
          if (eqMatch) {
            const col = eqMatch[1].trim();
            const op = eqMatch[2];
            let expected = eqMatch[3].trim();
            if (expected === '?') {
              expected = pList.shift();
            } else if (/^['"].*['"]$/.test(expected)) {
              expected = expected.slice(1, -1);
            } else if (!isNaN(Number(expected))) {
              expected = Number(expected);
            }
            const actual = row[col];
            let ok = true;
            if (op === '=') ok = String(actual) === String(expected);
            else if (op === '!=' || op === '<>') ok = String(actual) !== String(expected);
            else if (op === '>') ok = Number(actual) > Number(expected);
            else if (op === '<') ok = Number(actual) < Number(expected);
            else if (op === '>=') ok = Number(actual) >= Number(expected);
            else if (op === '<=') ok = Number(actual) <= Number(expected);
            if (!ok) return false;
          }
        }
        return true;
      }

      exec(sql) {
        const cleaned = stripSqlComments(sql);
        const statements = cleaned.split(';').map((s) => s.trim()).filter(Boolean);
        for (const s of statements) {
          this.run(s);
        }
      }

      transaction(fn) {
        return (...args) => fn(...args);
      }

      close() {
        this._persistToVfs();
      }

      query(sql) {
        const db = this;
        return {
          all(...args) {
            let params = args;
            if (args.length === 1 && Array.isArray(args[0])) params = args[0];
            return db._executeSelect(sql, params);
          },
          get(...args) {
            const rows = this.all(...args);
            return rows[0] || null;
          },
          values(...args) {
            const rows = this.all(...args);
            return rows.map((r) => Object.values(r));
          },
          run(...args) {
            let params = args;
            if (args.length === 1 && Array.isArray(args[0])) params = args[0];
            return db.run(sql, params);
          }
        };
      }

      prepare(sql) {
        return this.query(sql);
      }

      _evalAggregate(fn, aggCol, rows) {
        if (fn === 'COUNT') {
          if (aggCol === '*') return rows.length;
          return rows.filter((r) => r[aggCol] !== null && r[aggCol] !== undefined).length;
        }
        if (fn === 'AVG') {
          const sum = rows.reduce((acc, r) => acc + (Number(r[aggCol]) || 0), 0);
          return rows.length > 0 ? sum / rows.length : 0;
        }
        if (fn === 'SUM') {
          return rows.reduce((acc, r) => acc + (Number(r[aggCol]) || 0), 0);
        }
        if (fn === 'MIN') {
          return rows.length > 0 ? Math.min(...rows.map((r) => Number(r[aggCol]) || 0)) : null;
        }
        if (fn === 'MAX') {
          return rows.length > 0 ? Math.max(...rows.map((r) => Number(r[aggCol]) || 0)) : null;
        }
        return null;
      }

      _executeSelect(sql, params = []) {
        const s = stripSqlComments(sql).replace(/;$/, '').trim();
        if (!s) return [];

        if (/^EXPLAIN\s+QUERY\s+PLAN\s+/i.test(s)) {
          const inner = s.replace(/^EXPLAIN\s+QUERY\s+PLAN\s+/i, '').trim();
          const m = inner.match(/^SELECT\s+[\s\S]*?\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]*?))?(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/i);
          if (m) {
            const tblName = m[1];
            const whereRaw = (m[2] || '').replace(/'[^']*'|"[^"]*"/g, '');
            const table = this.tables.get(tblName);
            const pkCol = table && table.columns.find((c) => c.isPk);
            if (pkCol && new RegExp(`\\b${pkCol.name}\\b`, 'i').test(whereRaw)) {
              return [{ id: 0, parent: 0, notused: 0, detail: `SEARCH ${tblName} USING INTEGER PRIMARY KEY (rowid=?)` }];
            }
            for (const idx of this.indexes.values()) {
              if (idx.table === tblName && idx.columns.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(whereRaw))) {
                return [{ id: 0, parent: 0, notused: 0, detail: `SEARCH ${tblName} USING INDEX ${idx.name} (${idx.columns.join(',')}=?)` }];
              }
            }
            return [{ id: 0, parent: 0, notused: 0, detail: `SCAN ${tblName}` }];
          }
          return [{ id: 0, parent: 0, notused: 0, detail: 'SCAN' }];
        }

        if (/^PRAGMA\s+table_info\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i.test(s)) {
          const m = s.match(/^PRAGMA\s+table_info\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
          const tbl = m && this.tables.get(m[1]);
          if (!tbl) return [];
          return tbl.columns.map((c, idx) => ({
            cid: idx,
            name: c.name,
            type: c.type || 'TEXT',
            notnull: 0,
            dflt_value: null,
            pk: c.isPk ? 1 : 0
          }));
        }

        if (/^PRAGMA\s+index_list\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i.test(s)) {
          const m = s.match(/^PRAGMA\s+index_list\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
          const tblName = m ? m[1] : '';
          const out = [];
          let seq = 0;
          for (const idx of this.indexes.values()) {
            if (idx.table === tblName) {
              out.push({
                seq: seq++,
                name: idx.name,
                unique: idx.unique ? 1 : 0,
                origin: 'c',
                partial: 0
              });
            }
          }
          return out;
        }

        if (/^(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|PRAGMA)\b/i.test(s)) {
          this.run(s, params);
          return [];
        }

        const match = s.match(/^SELECT\s+(?:DISTINCT\s+)?([\s\S]*?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]*?))?(?:\s+GROUP\s+BY\s+([\s\S]*?))?(?:\s+ORDER\s+BY\s+([\s\S]*?))?(?:\s+LIMIT\s+(\d+|\?)(?:\s+OFFSET\s+(\d+|\?))?)?$/i);
        if (!match) {
          const noFromMatch = s.match(/^SELECT\s+([\s\S]+)$/i);
          if (noFromMatch) {
            const parts = splitCsvRespectingQuotes(noFromMatch[1]);
            const outRow = {};
            for (const p of parts) {
              const asMatch = p.match(/^([\s\S]*?)\s+AS\s+([a-zA-Z0-9_]+)$/i);
              const expr = (asMatch ? asMatch[1] : p).trim();
              const alias = (asMatch ? asMatch[2] : p).trim();
              if (/^sqlite_version\(\)$/i.test(expr)) outRow[alias] = '3.45.0';
              else if (/^['"].*['"]$/.test(expr)) outRow[alias] = expr.slice(1, -1);
              else if (!isNaN(Number(expr))) outRow[alias] = Number(expr);
              else outRow[alias] = expr;
            }
            return [outRow];
          }
          return [];
        }
        const selectColsRaw = match[1].trim();
        const tableName = match[2].trim();
        const whereClause = match[3] ? match[3].trim() : null;
        const groupByClause = match[4] ? match[4].trim() : null;
        const orderByClause = match[5] ? match[5].trim() : null;
        const limitRaw = match[6] ? match[6].trim() : null;
        const offsetRaw = match[7] ? match[7].trim() : null;

        const table = this.tables.get(tableName);
        if (!table) return [];

        const pList = Array.isArray(params) ? [...params] : [params];
        const filteredRows = table.rows.filter((row) => {
          const rowParams = [...pList];
          return this._matchWhere(row, whereClause, rowParams);
        });
        if (whereClause && whereClause.includes('?')) {
          const qCount = (whereClause.match(/\?/g) || []).length;
          pList.splice(0, qCount);
        }

        const colSpecs = [];
        let hasAggregate = false;
        if (selectColsRaw !== '*') {
          const parts = splitCsvRespectingQuotes(selectColsRaw);
          for (const p of parts) {
            const asMatch = p.match(/^([\s\S]*?)\s+(?:AS\s+)?([a-zA-Z0-9_]+)$/i);
            const isFuncWithSpace = /^(AVG|SUM|COUNT|MIN|MAX)\s*\([^)]+\)$/i.test(p.trim());
            const spec = (asMatch && !isFuncWithSpace)
              ? { expr: asMatch[1].trim(), alias: asMatch[2].trim() }
              : { expr: p.trim(), alias: p.trim() };
            if (/^(AVG|SUM|COUNT|MIN|MAX)\s*\(([^)]+)\)$/i.test(spec.expr)) {
              hasAggregate = true;
            }
            colSpecs.push(spec);
          }
        }

        let outputRows = [];
        if (groupByClause) {
          const groupCol = groupByClause.trim();
          const groups = new Map();
          for (const row of filteredRows) {
            const key = row[groupCol];
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
          }

          for (const [key, rows] of groups.entries()) {
            const outRow = {};
            for (const col of colSpecs) {
              const expr = col.expr;
              const alias = col.alias;
              const aggMatch = expr.match(/^(AVG|SUM|COUNT|MIN|MAX)\s*\(([^)]+)\)$/i);
              if (aggMatch) {
                outRow[alias] = this._evalAggregate(aggMatch[1].toUpperCase(), aggMatch[2].trim(), rows);
              } else if (expr === groupCol) {
                outRow[alias] = key;
              } else {
                outRow[alias] = rows[0] ? rows[0][expr] : null;
              }
            }
            outputRows.push(outRow);
          }
        } else if (hasAggregate) {
          const outRow = {};
          for (const col of colSpecs) {
            const aggMatch = col.expr.match(/^(AVG|SUM|COUNT|MIN|MAX)\s*\(([^)]+)\)$/i);
            if (aggMatch) {
              outRow[col.alias] = this._evalAggregate(aggMatch[1].toUpperCase(), aggMatch[2].trim(), filteredRows);
            } else {
              outRow[col.alias] = filteredRows[0] ? filteredRows[0][col.expr] : null;
            }
          }
          outputRows.push(outRow);
        } else {
          for (const row of filteredRows) {
            if (selectColsRaw === '*') {
              outputRows.push(Object.assign({}, row));
            } else {
              const outRow = {};
              for (const col of colSpecs) {
                outRow[col.alias] = row[col.expr];
              }
              outputRows.push(outRow);
            }
          }
        }

        if (orderByClause) {
          const parts = orderByClause.trim().split(/\s+/);
          const orderCol = parts[0];
          const desc = parts[1] && parts[1].toUpperCase() === 'DESC';
          outputRows.sort((a, b) => {
            const valA = a[orderCol];
            const valB = b[orderCol];
            if (valA === valB) return 0;
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;
            const res = valA > valB ? 1 : -1;
            return desc ? -res : res;
          });
        }

        if (limitRaw !== null) {
          const limitVal = limitRaw === '?' ? Number(pList.shift() || 0) : Number(limitRaw);
          const offsetVal = offsetRaw !== null ? (offsetRaw === '?' ? Number(pList.shift() || 0) : Number(offsetRaw)) : 0;
          outputRows = outputRows.slice(offsetVal, offsetVal + limitVal);
        }

        return outputRows;
      }
    };
  }

  return {
    VirtualBuffer,
    VirtualCrypto,
    VirtualZlib,
    VirtualPath,
    VirtualOs,
    VirtualAssert: assert,
    EventEmitter,
    VirtualUtil,
    VirtualUrl,
    VirtualQuerystring,
    VirtualStream,
    VirtualStreamPromises,
    VirtualStringDecoder,
    VirtualDns,
    createVirtualFs,
    createVirtualHttp,
    createVirtualNet,
    createSqliteDatabase,
    transpileTS,
    transpileForBrowser,
    preloadNpmPackages,
    createVirtualPortTable,
    createVirtualWasi,
    executeWasiModule,
    executeInVirtualRuntime
  };

}

function __workerMessageLoop(workerScope) {
  const runtime = workerScope.__virtualRuntime;
  workerScope.onmessage = async function (event) {
    const msg = event.data || {};
    const { requestId, type, payload = {} } = msg;
    if (type !== 'execute') return;
    try {
      const result = await runtime.executeInVirtualRuntime({
        ...payload,
        onStdout(text) {
          workerScope.postMessage({ requestId, type: 'stdout', text });
        },
        onStderr(text) {
          workerScope.postMessage({ requestId, type: 'stderr', text });
        },
        onTestResult(testResult) {
          workerScope.postMessage({ requestId, type: 'test-result', testResult });
        }
      });
      workerScope.postMessage({ requestId, type: 'complete', result });
    } catch (err) {
      workerScope.postMessage({
        requestId,
        type: 'error',
        error: { message: err && err.message ? err.message : String(err), stack: err && err.stack }
      });
    }
  };
}

function createWorkerRuntimeSource() {
  return `'use strict';\nself.__virtualRuntime = (${__initVirtualRuntime.toString()})(self);\n(${__workerMessageLoop.toString()})(self);\n`;
}

const _hostScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : global);
const _hostLogger = (_hostScope && _hostScope.CodeLabLogger && typeof _hostScope.CodeLabLogger.createLogger === 'function')
  ? _hostScope.CodeLabLogger.createLogger()
  : {
      debug() {},
      info() {},
      warn(msg, meta) { if (typeof console !== 'undefined' && console.warn) console.warn('[CodeLab]', msg, meta || ''); },
      error(msg, meta) { if (typeof console !== 'undefined' && console.error) console.error('[CodeLab]', msg, meta || ''); }
    };
const _hostRuntime = __initVirtualRuntime(_hostScope);
_hostRuntime.createWorkerRuntimeSource = createWorkerRuntimeSource;

let _cachedWorkerUrl = null;
let _warmWorker = null;
let _warmWorkerBusy = false;
const _activeWorkerJobs = new Map();

function _ensureWorkerUrl() {
  if (!_cachedWorkerUrl) {
    const blob = new Blob([createWorkerRuntimeSource()], { type: 'application/javascript' });
    _cachedWorkerUrl = URL.createObjectURL(blob);
  }
  return _cachedWorkerUrl;
}

function _ensureWarmWorker() {
  if (_warmWorker) return _warmWorker;
  _warmWorker = new Worker(_ensureWorkerUrl());
  return _warmWorker;
}

function _destroyWarmWorker() {
  if (_warmWorker) {
    try { _warmWorker.terminate(); } catch (err) { _hostLogger.debug('warmWorker.terminate failed', err); }
    _warmWorker = null;
  }
  _warmWorkerBusy = false;
}

_hostRuntime.cancelWorkerExecution = function cancelWorkerExecution(reason = 'Execution cancelled', instanceId) {
  let cancelledAny = false;
  for (const [jobId, job] of Array.from(_activeWorkerJobs.entries())) {
    if (!instanceId || job.instanceId === instanceId) {
      _activeWorkerJobs.delete(jobId);
      job.cancel(reason);
      cancelledAny = true;
    }
  }
  return cancelledAny;
};

_hostRuntime.executeInWorker = async function executeInWorker(options = {}) {
  const isNonJs =
    Boolean(options.wasmBinary) ||
    Boolean(options.cppCompiler) ||
    Boolean(options.pythonCompiler) ||
    (typeof options.entry === 'string' && /\.(cpp|cc|cxx|wasm|py)$/i.test(options.entry));
  if (
    isNonJs ||
    typeof Worker === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    !URL.createObjectURL
  ) {
    return _hostRuntime.executeInVirtualRuntime(options);
  }

  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const instanceId = options.instanceId || (options.concurrent ? requestId : 'default');

  // If a previous execution for this same instanceId is still in-flight, cancel only that instance's job
  if (!options.concurrent) {
    _hostRuntime.cancelWorkerExecution('Execution cancelled by new run', instanceId);
  }

  return new Promise((resolve) => {
    let worker;
    let isWarmWorker = false;
    try {
      if (!_warmWorkerBusy) {
        worker = _ensureWarmWorker();
        _warmWorkerBusy = true;
        isWarmWorker = true;
      } else {
        worker = new Worker(_ensureWorkerUrl());
        isWarmWorker = false;
      }
    } catch (_) {
      if (isWarmWorker) _warmWorkerBusy = false;
      resolve(_hostRuntime.executeInVirtualRuntime(options));
      return;
    }

    const timeoutMs = options.timeoutMs || 15000;
    let settled = false;
    let abortListener = null;

    function releaseWorker(terminateWorker) {
      if (options.signal && abortListener) {
        try { options.signal.removeEventListener('abort', abortListener); } catch (err) { _hostLogger.debug('executeInWorker removeEventListener failed', err); }
        abortListener = null;
      }
      _activeWorkerJobs.delete(requestId);
      if (isWarmWorker) {
        if (terminateWorker) {
          _destroyWarmWorker();
        } else {
          _warmWorkerBusy = false;
          if (_warmWorker) {
            _warmWorker.onmessage = null;
            _warmWorker.onerror = null;
          }
        }
      } else {
        try { worker.terminate(); } catch (err) { _hostLogger.debug('worker.terminate failed', err); }
      }
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      releaseWorker(true);
      resolve({
        ok: false,
        timedOut: true,
        exitCode: 124,
        durationMs: timeoutMs,
        stdout: '',
        stderr: `Execution timed out after ${timeoutMs}ms (infinite loop or hung timer terminated).\n`,
        testResults: [],
        fsSnapshot: [],
        httpTrace: [],
        error: { message: `Execution timed out after ${timeoutMs}ms` }
      });
    }, timeoutMs + 500);

    _activeWorkerJobs.set(requestId, {
      requestId,
      instanceId,
      cancel(reason = 'Execution cancelled by new run') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        releaseWorker(true);
        resolve({
          ok: false,
          cancelled: true,
          exitCode: 130,
          durationMs: 0,
          stdout: '',
          stderr: `${reason}\n`,
          testResults: [],
          fsSnapshot: [],
          httpTrace: [],
          error: { message: reason }
        });
      }
    });

    if (options.signal) {
      if (options.signal.aborted) {
        const job = _activeWorkerJobs.get(requestId);
        if (job) job.cancel('SIGINT: Interrupted by user (Ctrl+C)');
      } else {
        abortListener = () => {
          const job = _activeWorkerJobs.get(requestId);
          if (job) job.cancel('SIGINT: Interrupted by user (Ctrl+C)');
        };
        options.signal.addEventListener('abort', abortListener, { once: true });
      }
    }

    worker.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.requestId !== requestId) return;
      if (msg.type === 'stdout' && typeof options.onStdout === 'function') {
        options.onStdout(msg.text);
      } else if (msg.type === 'stderr' && typeof options.onStderr === 'function') {
        options.onStderr(msg.text);
      } else if (msg.type === 'test-result' && typeof options.onTestResult === 'function') {
        options.onTestResult(msg.testResult);
      } else if (msg.type === 'complete') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Release `_warmWorker` for instant reuse, or terminate ephemeral concurrent worker
        releaseWorker(false);
        resolve(msg.result);
      } else if (msg.type === 'error') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        releaseWorker(false);
        resolve({
          ok: false,
          exitCode: 1,
          durationMs: 0,
          stdout: '',
          stderr: (msg.error?.stack || msg.error?.message || 'Worker execution error') + '\n',
          testResults: [],
          fsSnapshot: [],
          httpTrace: [],
          error: { message: msg.error?.message || 'Worker execution error', stack: msg.error?.stack }
        });
      }
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      releaseWorker(true);
      resolve(_hostRuntime.executeInVirtualRuntime(options));
    };

    worker.postMessage({
      requestId,
      type: 'execute',
      payload: {
        files: options.files,
        entry: options.entry,
        mode: options.mode,
        replCode: options.replCode,
        testFilter: options.testFilter,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes,
        maxConsoleCalls: options.maxConsoleCalls,
        packages: options.packages,
        npmModules: options.npmModules,
        argv: options.argv,
        pid: options.pid,
        isBackground: options.isBackground,
        printReplResult: options.printReplResult,
        stdin: options.stdin,
        wasmBinary: options.wasmBinary,
        env: options.env
      }
    });
  });
};

if (typeof window !== 'undefined') {
  window.VirtualNodeRuntime = _hostRuntime;
  window.CodeLabRuntime = _hostRuntime;
}
if (typeof globalThis !== 'undefined') {
  globalThis.CodeLabRuntime = _hostRuntime;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _hostRuntime;
}


// ── TypeScript module surface (stripped from browser bundles) ──────────────
// The implementation above is a UMD script that attaches itself to the global
// object. These aliases give TypeScript consumers named exports without
// duplicating the implementation. tools/bundle.js removes this footer before
// concatenating the script into the browser bundle.
const _runtimeApi: any = (typeof globalThis !== 'undefined' ? (globalThis as any).CodeLabRuntime : undefined)
  || (typeof module !== 'undefined' && module.exports ? module.exports : {});

export const VirtualBuffer: any = _runtimeApi.VirtualBuffer;
export const VirtualCrypto: any = _runtimeApi.VirtualCrypto;
export const VirtualZlib: any = _runtimeApi.VirtualZlib;
export const VirtualPath: any = _runtimeApi.VirtualPath;
export const VirtualOs: any = _runtimeApi.VirtualOs;
export const VirtualAssert: any = _runtimeApi.VirtualAssert;
export const EventEmitter: any = _runtimeApi.EventEmitter;
export const VirtualUtil: any = _runtimeApi.VirtualUtil;
export const VirtualUrl: any = _runtimeApi.VirtualUrl;
export const VirtualQuerystring: any = _runtimeApi.VirtualQuerystring;
export const VirtualStream: any = _runtimeApi.VirtualStream;
export const VirtualStreamPromises: any = _runtimeApi.VirtualStreamPromises;
export const VirtualStringDecoder: any = _runtimeApi.VirtualStringDecoder;
export const VirtualDns: any = _runtimeApi.VirtualDns;
export const createVirtualFs: (options?: any) => any = _runtimeApi.createVirtualFs;
export const createVirtualHttp: (portTable?: any, vfs?: any) => any = _runtimeApi.createVirtualHttp;
export const createVirtualNet: (portTable?: any) => any = _runtimeApi.createVirtualNet;
export const createSqliteDatabase: (vfs?: any, getCwd?: () => string) => any = _runtimeApi.createSqliteDatabase;
export const transpileTS: (code: string, filename?: string) => string = _runtimeApi.transpileTS;
export const transpileForBrowser: (source: string, filename?: string) => string = _runtimeApi.transpileForBrowser;
export const preloadNpmPackages: (
  files?: Record<string, any>,
  onProgressOrCache?: ((pkg: string) => void) | Map<string, string>,
  onProgress?: (pkg: string) => void
) => Promise<Record<string, string>> = _runtimeApi.preloadNpmPackages;
export const createVirtualPortTable: () => any = _runtimeApi.createVirtualPortTable;
export const createVirtualWasi: (options?: any) => any = _runtimeApi.createVirtualWasi;
export const executeWasiModule: (wasmBytesOrModule: Uint8Array | ArrayBuffer | WebAssembly.Module, options?: any) => Promise<{ exitCode: number; stdout: string; stderr: string }> = _runtimeApi.executeWasiModule;
export const executeInVirtualRuntime: (options?: any) => Promise<any> = _runtimeApi.executeInVirtualRuntime;
const createWorkerRuntimeSourceExport: () => string = _runtimeApi.createWorkerRuntimeSource;
export { createWorkerRuntimeSourceExport as createWorkerRuntimeSource };
export const cancelWorkerExecution: (reason?: string, instanceId?: string) => boolean = _runtimeApi.cancelWorkerExecution;
export const executeInWorker: (options?: any) => Promise<any> = _runtimeApi.executeInWorker;

export default _runtimeApi;
