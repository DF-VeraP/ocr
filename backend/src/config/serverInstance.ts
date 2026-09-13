import crypto from 'crypto';

/**
 * Identificador único del ciclo de vida del servidor (en memoria).
 * Se genera un nuevo UUID cada vez que el proceso de Node.js arranca.
 * Si el servidor se apaga, cae o se reinicia, este ID cambia automáticamente,
 * invalidando de inmediato cualquier token de sesión emitido con anterioridad.
 */
const SERVER_INSTANCE_ID = crypto.randomUUID();
const SERVER_START_TIME = new Date();

export function getServerInstanceId(): string {
  return SERVER_INSTANCE_ID;
}

export function getServerStartTime(): Date {
  return SERVER_START_TIME;
}
