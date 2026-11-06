/**
 * 端到端加密 (Day 7) — Web Crypto, AES-GCM。
 * 用户在设备上生成密钥 (由 PIN 派生), 数据加密后存本地/同步, 任何接收方无密钥都读不到。
 * "数据不出设备"的隐私卖点由这套加密背书。
 *
 * 注意: 这是"敏感数据加密存储"用途, 不是传输加密 (传输由 HTTPS 负责)。
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** 类型定义里 BufferSource 要求 ArrayBuffer 视图; 统一 cast 兜底 */
function buf(v: ArrayBuffer | Uint8Array | ArrayBufferView): ArrayBuffer {
  return v as unknown as ArrayBuffer;
}

/** 由 4 位 PIN 派生 256-bit AES 密钥 (PBKDF2, 加盐)。
 * MVP: 本地数据快照加密 (见 lib/report.ts "加密备份");
 * 未来: 云同步的 E2E 加密, 届时把 encryptJson 产物存远端即可。 */
export async function deriveKey(pin: string, saltHex: string): Promise<CryptoKey> {
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey('raw', buf(enc.encode(pin)), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 随机盐 (16 字节, hex 返回) */
export function randomSaltHex(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

/** 加密 JSON 对象 → base64 (含 iv) */
export async function encryptJson(
  key: CryptoKey,
  obj: unknown,
): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buf(iv) },
    key,
    enc.encode(JSON.stringify(obj)),
  );
  return {
    iv: bytesToHex(iv),
    ct: bufToB64(ct),
  };
}

/** 解密 → 原始对象 */
export async function decryptJson<T>(key: CryptoKey, iv: string, ct: string): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf(hexToBytes(iv)) },
    key,
    b64ToBuf(ct),
  );
  return JSON.parse(dec.decode(plain)) as T;
}

/* ── helpers ── */
function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) {
    b[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return b;
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
function bufToB64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64);
  const buf = new ArrayBuffer(s.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return buf;
}

/* 新版 TS 下 Uint8Array<ArrayBuffer> 即 BufferSource, 直接透传即可 */