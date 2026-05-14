import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for API key encryption');
  }
  return key;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encrypt(text: string): string {
  const masterKey = getEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();
  if (!tag || tag.length !== TAG_LENGTH) {
    throw new Error('Failed to generate authentication tag');
  }

  return [
    salt.toString('hex'),
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted
  ].join(':');
}

export function decrypt(encryptedText: string): string {
  const masterKey = getEncryptionKey();
  const parts = encryptedText.split(':');

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted text format');
  }

  const [saltHex, ivHex, tagHex, encrypted] = parts;

  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid authentication tag length');
  }

  const key = deriveKey(masterKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 4 && parts.every(part => /^[0-9a-f]+$/.test(part));
}
