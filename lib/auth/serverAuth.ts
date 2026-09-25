import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SECRET_FILE = path.join(process.cwd(), '.admin-secret.json');
const activeTokens = new Set<string>();

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function isSetupRequired(): boolean {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() !== '') {
    return false;
  }
  return !fs.existsSync(SECRET_FILE);
}

export function setAdminPassword(password: string): boolean {
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    fs.writeFileSync(SECRET_FILE, JSON.stringify({ salt, hash, created_at: new Date().toISOString() }));
    return true;
  } catch (err) {
    console.error('[Auth] Error saving admin secret:', err);
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() !== '') {
    return password === process.env.ADMIN_PASSWORD.trim();
  }

  if (fs.existsSync(SECRET_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf-8'));
      if (data.salt && data.hash) {
        const computedHash = hashPassword(password, data.salt);
        return computedHash === data.hash;
      }
    } catch (e) {
      console.error('[Auth] Error reading admin secret:', e);
    }
  }

  return false;
}

export function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  return token;
}

export function validateAdminSession(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  return activeTokens.has(token);
}

export function destroyAdminSession(token: string | null | undefined): void {
  if (token && typeof token === 'string') {
    activeTokens.delete(token);
  }
}
