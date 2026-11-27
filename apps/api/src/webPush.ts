export interface WebPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendWebPushOptions {
  subscription: WebPushSubscriptionInput;
  payload: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  ttlSeconds?: number;
}

export interface SendWebPushResult {
  ok: boolean;
  status: number;
  expired: boolean;
  error?: string;
}

const textEncoder = new TextEncoder();

export function base64UrlEncode(input: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < input.byteLength; i += 1) {
    binary += String.fromCharCode(input[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const buffer = new ArrayBuffer(total);
  const out = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes as Uint8Array<ArrayBuffer>;
  }
  const buffer = new ArrayBuffer(bytes.byteLength);
  const copy = new Uint8Array(buffer);
  copy.set(bytes);
  return copy;
}

async function hmacSha256(
  keyBytes: Uint8Array,
  dataBytes: Uint8Array
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBufferView(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, toArrayBufferView(dataBytes));
  return new Uint8Array(sig);
}

/**
 * Normaliza una firma ECDSA P-256 al formato raw IEEE P1363 (r || s de 64 bytes).
 * Web Crypto en Workers/Node devuelve IEEE P1363 (64 bytes), y si llegara DER lo convierte.
 */
function normalizeP256Signature(sigBytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (sigBytes.byteLength === 64) {
    return toArrayBufferView(sigBytes);
  }
  if (sigBytes[0] === 0x30) {
    let offset = 2;
    if (sigBytes[1]! & 0x80) {
      offset = 2 + (sigBytes[1]! & 0x7f);
    }
    if (sigBytes[offset] !== 0x02) {
      throw new Error('INVALID_DER_SIGNATURE');
    }
    const rLen = sigBytes[offset + 1]!;
    const rBytes = sigBytes.slice(offset + 2, offset + 2 + rLen);
    offset = offset + 2 + rLen;
    if (sigBytes[offset] !== 0x02) {
      throw new Error('INVALID_DER_SIGNATURE');
    }
    const sLen = sigBytes[offset + 1]!;
    const sBytes = sigBytes.slice(offset + 2, offset + 2 + sLen);

    const out = new Uint8Array(new ArrayBuffer(64));
    const rTrimmed = rBytes.byteLength > 32 ? rBytes.slice(-32) : rBytes;
    const sTrimmed = sBytes.byteLength > 32 ? sBytes.slice(-32) : sBytes;
    out.set(rTrimmed, 32 - rTrimmed.byteLength);
    out.set(sTrimmed, 64 - sTrimmed.byteLength);
    return out;
  }
  throw new Error(`UNEXPECTED_ECDSA_SIG_LENGTH_${sigBytes.byteLength}`);
}

export async function buildVapidAuthHeader(params: {
  endpoint: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
  expSeconds?: number;
}): Promise<string> {
  const cleanPublicKey = params.vapidPublicKey.trim().replace(/^["']|["']$/g, '');
  const cleanPrivateKey = params.vapidPrivateKey.trim().replace(/^["']|["']$/g, '');
  const cleanSubject = params.subject.trim();
  if (
    !cleanSubject.startsWith('https://') &&
    !cleanSubject.startsWith('mailto:')
  ) {
    throw new Error('INVALID_VAPID_SUBJECT');
  }

  const pubBytes = base64UrlDecode(cleanPublicKey);
  if (pubBytes.byteLength !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('INVALID_VAPID_PUBLIC_KEY');
  }

  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d: cleanPrivateKey,
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const headerB64 = base64UrlEncode(
    textEncoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const exp =
    params.expSeconds ?? Math.floor(Date.now() / 1000) + 12 * 3600;
  const payloadB64 = base64UrlEncode(
    textEncoder.encode(
      JSON.stringify({
        aud: new URL(params.endpoint).origin,
        exp,
        sub: cleanSubject,
      })
    )
  );

  const unsigned = `${headerB64}.${payloadB64}`;
  const rawSig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    textEncoder.encode(unsigned)
  );
  const sigB64 = base64UrlEncode(normalizeP256Signature(new Uint8Array(rawSig)));
  return `vapid t=${unsigned}.${sigB64}, k=${cleanPublicKey}`;
}

/**
 * Cifra un payload Web Push según RFC 8291 + RFC 8188 (aes128gcm) usando Web Crypto API nativa.
 */
export async function encryptWebPushPayload(params: {
  payloadText: string;
  p256dh: string;
  auth: string;
  salt?: Uint8Array;
  serverKeyPair?: CryptoKeyPair;
}): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublicBytes = base64UrlDecode(params.p256dh);
  if (uaPublicBytes.byteLength !== 65 || uaPublicBytes[0] !== 0x04) {
    throw new Error('INVALID_SUBSCRIPTION_P256DH');
  }
  const authSecretBytes = base64UrlDecode(params.auth);
  if (authSecretBytes.byteLength !== 16) {
    throw new Error('INVALID_SUBSCRIPTION_AUTH');
  }

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const asKeyPair =
    params.serverKeyPair ??
    ((await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    )) as CryptoKeyPair);

  const asPublicRaw = await crypto.subtle.exportKey('raw', asKeyPair.publicKey);
  const asPublicBytes = new Uint8Array(asPublicRaw);

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPublicKey },
    asKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const prkKey = await hmacSha256(authSecretBytes, sharedSecret);
  const keyInfo = concatBytes(
    textEncoder.encode('WebPush: info\0'),
    uaPublicBytes,
    asPublicBytes
  );
  const ikm = await hmacSha256(
    prkKey,
    concatBytes(keyInfo, Uint8Array.of(1))
  );

  const salt = params.salt
    ? toArrayBufferView(params.salt)
    : crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));

  const prk = await hmacSha256(salt, ikm);
  const cekFull = await hmacSha256(
    prk,
    concatBytes(textEncoder.encode('Content-Encoding: aes128gcm\0'), Uint8Array.of(1))
  );
  const cek = cekFull.slice(0, 16);

  const nonceFull = await hmacSha256(
    prk,
    concatBytes(textEncoder.encode('Content-Encoding: nonce\0'), Uint8Array.of(1))
  );
  const nonce = nonceFull.slice(0, 12);

  const plaintext = concatBytes(
    textEncoder.encode(params.payloadText),
    Uint8Array.of(2)
  );
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    plaintext
  );
  const ciphertext = new Uint8Array(ciphertextBuf);

  const recordSize = Math.max(4096, plaintext.byteLength + 18);
  const header = new Uint8Array(new ArrayBuffer(16 + 4 + 1 + 65));
  header.set(salt, 0);
  const dv = new DataView(header.buffer);
  dv.setUint32(16, recordSize, false);
  header[20] = asPublicBytes.byteLength;
  header.set(asPublicBytes, 21);

  return concatBytes(header, ciphertext);
}

export async function sendWebPushNotification(
  options: SendWebPushOptions
): Promise<SendWebPushResult> {
  try {
    const [authHeader, encryptedBody] = await Promise.all([
      buildVapidAuthHeader({
        endpoint: options.subscription.endpoint,
        vapidPublicKey: options.vapidPublicKey,
        vapidPrivateKey: options.vapidPrivateKey,
        subject: options.vapidSubject,
      }),
      encryptWebPushPayload({
        payloadText: options.payload,
        p256dh: options.subscription.p256dh,
        auth: options.subscription.auth,
      }),
    ]);

    const response = await fetch(options.subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttlSeconds ?? 3600),
        Urgency: 'high',
      },
      body: encryptedBody,
    });

    const expired = response.status === 404 || response.status === 410;
    if (response.ok) {
      return { ok: true, status: response.status, expired: false };
    }

    const errText = await response.text().catch(() => '');
    return {
      ok: false,
      status: response.status,
      expired,
      error: errText.slice(0, 200) || `HTTP_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      expired: false,
      error: error instanceof Error ? error.message : 'WEB_PUSH_SEND_ERROR',
    };
  }
}

export async function signReminderActionToken(
  secret: string,
  taskId: string,
  userId: string,
  ttlSeconds = 48 * 3600
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadB64 = base64UrlEncode(
    textEncoder.encode(JSON.stringify({ taskId, userId, exp }))
  );
  const sig = await hmacSha256(
    textEncoder.encode(secret),
    textEncoder.encode(payloadB64)
  );
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

export async function verifyReminderActionToken(
  secret: string,
  token: string
): Promise<{ taskId: string; userId: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  let providedSig: Uint8Array<ArrayBuffer>;
  try {
    providedSig = base64UrlDecode(sigB64);
  } catch {
    return null;
  }

  const expectedSig = await hmacSha256(
    textEncoder.encode(secret),
    textEncoder.encode(payloadB64)
  );

  if (providedSig.byteLength !== expectedSig.byteLength) {
    return null;
  }

  let diff = 0;
  for (let i = 0; i < expectedSig.byteLength; i += 1) {
    diff |= providedSig[i]! ^ expectedSig[i]!;
  }
  if (diff !== 0) return null;

  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    ) as { taskId?: unknown; userId?: unknown; exp?: unknown };
    if (
      typeof parsed.taskId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { taskId: parsed.taskId, userId: parsed.userId };
  } catch {
    return null;
  }
}
