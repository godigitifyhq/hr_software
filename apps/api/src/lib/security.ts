import crypto from 'crypto';

const tokenSalt = process.env.TOKEN_SALT || 'svgoi-token-salt';
const aesSecret = process.env.AES_KEY || 'change_this_aes_key_32bytes_long!';

function deriveKey(secret: string) {
    return crypto.createHash('sha256').update(secret).digest();
}

export function hashToken(token: string): string {
    return crypto.createHmac('sha256', tokenSalt).update(token).digest('hex');
}

export function createSecureToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
}

export function createFamilyId(): string {
    return crypto.randomUUID();
}

export function createJti(): string {
    return crypto.randomUUID();
}

export function createCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

export function timingSafeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function encryptSensitiveValue(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(aesSecret), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSensitiveValue(payload: string): string {
    const [ivHex, tagHex, encryptedHex] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(aesSecret), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
}
