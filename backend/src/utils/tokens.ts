import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { getServerInstanceId } from '../config/serverInstance';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'USER';
  requiresPasswordChange?: boolean;
  instanceId?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  const finalPayload: TokenPayload = {
    ...payload,
    instanceId: payload.instanceId || getServerInstanceId(),
  };

  return jwt.sign(finalPayload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as any,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  const finalPayload: TokenPayload = {
    ...payload,
    instanceId: payload.instanceId || getServerInstanceId(),
  };

  return jwt.sign(finalPayload, ENV.JWT_REFRESH_SECRET, {
    expiresIn: ENV.JWT_REFRESH_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}
