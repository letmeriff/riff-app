import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'utf8');
const ivLength = 16; // AES block size

/**
 * Encrypts a string using AES-256-CBC
 * @param text The text to encrypt
 * @returns An object containing the initialization vector and encrypted text
 */
export const encrypt = (text: string): { iv: string; encrypted: string } => {
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-character string');
  }
  
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), encrypted };
};

/**
 * Decrypts an encrypted string using AES-256-CBC
 * @param iv The initialization vector as a hex string
 * @param encrypted The encrypted text as a hex string
 * @returns The decrypted string
 */
export const decrypt = (iv: string, encrypted: string): string => {
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-character string');
  }
  
  const decipher = createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}; 