import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * RF-003: Valida que la contraseña cumpla:
 * - Mínimo 1 mayúscula
 * - Mínimo 4 números
 * - Mínimo 1 símbolo
 */
export function validatePasswordPolicy(password: string): { isValid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'La contraseña es requerida' };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const numberCount = (password.match(/[0-9]/g) || []).length;
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasUpperCase) {
    return { isValid: false, message: 'La contraseña debe contener al menos 1 letra mayúscula' };
  }
  if (numberCount < 4) {
    return { isValid: false, message: 'La contraseña debe contener al menos 4 números' };
  }
  if (!hasSymbol) {
    return { isValid: false, message: 'La contraseña debe contener al menos 1 símbolo o carácter especial' };
  }

  return { isValid: true };
}

/**
 * RF-004: Hash con bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * RF-010: Genera una contraseña temporal aleatoria que cumple las políticas
 */
export function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const symbols = '!@#$%&*';
  const digits = '23456789';

  // Al menos 1 mayúscula
  const upper = letters.charAt(crypto.randomInt(0, letters.length));
  // 4 números
  let nums = '';
  for (let i = 0; i < 4; i++) {
    nums += digits.charAt(crypto.randomInt(0, digits.length));
  }
  // 1 símbolo
  const sym = symbols.charAt(crypto.randomInt(0, symbols.length));
  // Caracteres aleatorios adicionales para longitud segura de 10 caracteres
  const extra = 'abcdefghijkmnpqrstuvwxyz' + digits;
  let tail = '';
  for (let i = 0; i < 4; i++) {
    tail += extra.charAt(crypto.randomInt(0, extra.length));
  }

  return `${upper}${tail}${sym}${nums}`;
}
