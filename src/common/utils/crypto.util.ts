import * as crypto from 'crypto';

const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.CONFIG_SECRET || 'default-secretdda5456$$A')
  .digest(); // 32字节

const IV_LENGTH = 16;

/**
 * 🔐 加密
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    SECRET_KEY,
    iv,
  );

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 🔓 解密
 */
export function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');

  if (!ivHex || !encryptedHex) {
    throw new Error('无效的加密文件');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    SECRET_KEY,
    iv,
  );

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}