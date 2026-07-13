/* eslint-disable @typescript-eslint/no-explicit-any */
// WebAuthn Client Utilities for SafeGuard

// Helper: Convert Hex String to Uint8Array
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Helper: Convert Uint8Array to Hex String
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert String to Uint8Array (UTF-8 encoding)
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// secp256r1 curve order n and n/2 as byte arrays for low-S normalization
// n = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
const SECP256R1_N = new Uint8Array([
  0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xbc, 0xe6, 0xfa, 0xad, 0xa7, 0x17, 0x9e, 0x84,
  0xf3, 0xb9, 0xca, 0xc2, 0xfc, 0x63, 0x25, 0x51,
]);

// n/2 = 0x7FFFFFFF800000007FFFFFFFFFFFFFFFDE737D56D38BCF4279DCE5617E3192A8
const SECP256R1_N_HALF = new Uint8Array([
  0x7f, 0xff, 0xff, 0xff, 0x80, 0x00, 0x00, 0x00,
  0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xde, 0x73, 0x7d, 0x56, 0xd3, 0x8b, 0xcf, 0x42,
  0x79, 0xdc, 0xe5, 0x61, 0x7e, 0x31, 0x92, 0xa8,
]);

// Compare two 32-byte big-endian byte arrays: returns -1, 0, or 1
function cmpBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < 32; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

// Subtract two 32-byte big-endian byte arrays: returns a - b (assumes a >= b)
function subBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(32);
  let borrow = 0;
  for (let i = 31; i >= 0; i--) {
    const diff = a[i] - b[i] - borrow;
    result[i] = diff & 0xff;
    borrow = diff < 0 ? 1 : 0;
  }
  return result;
}

// Normalize S to low form: if s > n/2, replace with n - s.
// Stellar's secp256r1_verify() host function requires low-S (BIP-62 canonical).
// Note: s == n/2 is already valid low-S, so we only normalize when strictly greater.
function normalizeLowS(s: Uint8Array): Uint8Array {
  // cmpBytes returns 1 when s > SECP256R1_N_HALF
  if (cmpBytes(s, SECP256R1_N_HALF) > 0) {
    return subBytes(SECP256R1_N, s);
  }
  return s;
}

// Helper: Parse DER-encoded EC signature into 64-byte raw signature (R || S)
export function parseDerSignature(der: ArrayBuffer): Uint8Array {
  const buf = new Uint8Array(der);
  let offset = 0;
  if (buf[offset++] !== 0x30) throw new Error('Invalid signature: not a sequence');
  const len = buf[offset++];
  if (len & 0x80) {
    offset += len & 0x7f;
  }

  if (buf[offset++] !== 0x02) throw new Error('Invalid signature: expected integer for r');
  const rLen = buf[offset++];
  let r = buf.subarray(offset, offset + rLen);
  offset += rLen;

  if (buf[offset++] !== 0x02) throw new Error('Invalid signature: expected integer for s');
  const sLen = buf[offset++];
  let s = buf.subarray(offset, offset + sLen);

  // Clean leading 00 bytes from DER padding
  if (r.length === 33 && r[0] === 0x00) r = r.subarray(1);
  if (s.length === 33 && s[0] === 0x00) s = s.subarray(1);

  const rawR = new Uint8Array(32);
  rawR.set(r, 32 - r.length);

  const rawS = new Uint8Array(32);
  rawS.set(s, 32 - s.length);

  // Normalize S to low form — Stellar requires this for secp256r1 signatures
  const normalizedS = normalizeLowS(rawS);

  const rawSig = new Uint8Array(64);
  rawSig.set(rawR, 0);
  rawSig.set(normalizedS, 32);

  return rawSig;
}

// 1. Register Passkey (Create Credentials)
export async function registerPasskey(
  username: string,
  challengeHex: string
): Promise<{ credentialIdHex: string; publicKeyHex: string }> {
  if (!navigator.credentials || !navigator.credentials.create) {
    throw new Error('WebAuthn is not supported on this browser/device.');
  }

  const challenge = hexToBytes(challengeHex);
  const userId = stringToBytes(username);

  const options: CredentialCreationOptions = {
    publicKey: {
      challenge: challenge as any,
      rp: {
        name: 'SafeGuard Inheritance Protocol',
        id: window.location.hostname,
      },
      user: {
        id: userId as any,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        {
          type: 'public-key',
          alg: -7, // ES256 (secp256r1/NIST P-256)
        },
      ],
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Enforce on-device biometrics (FaceID/TouchID/Windows Hello)
        userVerification: 'required',
        requireResidentKey: false,
      },
      attestation: 'none',
    },
  };

  const credential = (await navigator.credentials.create(options)) as PublicKeyCredential;
  if (!credential) {
    throw new Error('Failed to create biometric credential.');
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  // Extract the raw 65-byte uncompressed P-256 public key (0x04 || X || Y)
  // Using SubtleCrypto is the only reliable cross-browser method — SPKI byte
  // offsets are browser-dependent and fragile with slice(-65).
  const spki = response.getPublicKey();
  if (!spki) {
    throw new Error('Could not retrieve public key from credential response.');
  }

  let publicKeyBytes: Uint8Array;
  try {
    // Import the SPKI-encoded key so SubtleCrypto can export it in raw form
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,   // extractable
      ['verify']
    );
    const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
    publicKeyBytes = new Uint8Array(rawKey); // always 65 bytes: 0x04 || X || Y
  } catch {
    // Fallback: attempt the SPKI slice for environments where import/export fails
    const spkiBytes = new Uint8Array(spki);
    if (spkiBytes.length < 65) {
      throw new Error('Unexpected SPKI key length — cannot extract public key.');
    }
    publicKeyBytes = spkiBytes.slice(-65);
  }

  if (publicKeyBytes[0] !== 0x04 || publicKeyBytes.length !== 65) {
    throw new Error(
      `Public key has unexpected format: prefix=0x${publicKeyBytes[0].toString(16)}, length=${publicKeyBytes.length}. Expected uncompressed P-256 (0x04, 65 bytes).`
    );
  }

  return {
    credentialIdHex: bytesToHex(new Uint8Array(credential.rawId)),
    publicKeyHex: bytesToHex(publicKeyBytes),
  };
}

// 2. Generate Heartbeat Assertion (Get Credentials / Sign Challenge)
export async function getHeartbeatAssertion(
  challengeHex: string,
  credentialIdHex: string
): Promise<{
  signatureHex: string;
  clientDataJsonHex: string;
  authenticatorDataHex: string;
}> {
  if (!navigator.credentials || !navigator.credentials.get) {
    throw new Error('WebAuthn assertion is not supported on this browser/device.');
  }

  const challenge = hexToBytes(challengeHex);
  const credentialId = hexToBytes(credentialIdHex);

  const options: CredentialRequestOptions = {
    publicKey: {
      challenge: challenge as any,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          type: 'public-key',
          id: credentialId as any,
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  };

  const assertion = (await navigator.credentials.get(options)) as PublicKeyCredential;
  if (!assertion) {
    throw new Error('Biometric authorization failed.');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  const rawSignature = parseDerSignature(response.signature);

  return {
    signatureHex: bytesToHex(rawSignature),
    clientDataJsonHex: bytesToHex(new Uint8Array(response.clientDataJSON)),
    authenticatorDataHex: bytesToHex(new Uint8Array(response.authenticatorData)),
  };
}
