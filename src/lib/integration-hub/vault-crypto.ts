import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "academyos-vault-v1", KEY_LENGTH);
}

function getVaultKey(): Buffer {
  const secret = process.env.VAULT_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("VAULT_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY required for credential vault");
  }
  return deriveKey(secret);
}

/** Encrypt a credential secret for storage in encrypted_ref (prefixed enc:v1:). */
export function encryptCredentialSecret(plaintext: string): string {
  const key = getVaultKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64url");
  return `enc:v1:${payload}`;
}

/** Decrypt a credential secret from encrypted_ref. Returns null if not encrypted format. */
export function decryptCredentialSecret(encryptedRef: string): string | null {
  if (!encryptedRef.startsWith("enc:v1:")) return null;
  try {
    const key = getVaultKey();
    const raw = Buffer.from(encryptedRef.slice("enc:v1:".length), "base64url");
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isEncryptedCredentialRef(ref: string): boolean {
  return ref.startsWith("enc:v1:");
}
