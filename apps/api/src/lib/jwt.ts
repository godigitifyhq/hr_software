import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '30d';

export function signAccessToken(payload: object) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(payload: object) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyToken<T = any>(token: string): T {
    return jwt.verify(token, JWT_SECRET) as T;
}

// AES encrypt/decrypt helpers for sensitive payloads
const AES_KEY = process.env.AES_KEY || 'change_this_aes_key_32bytes_long!';

function deriveAesKey(value: string) {
    return crypto.createHash('sha256').update(value).digest();
}

export function aesEncrypt(text: string) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', deriveAesKey(AES_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function aesDecrypt(data: string) {
    const parts = data.split(':');
    const iv = Buffer.from(parts.shift() || '', 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', deriveAesKey(AES_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
