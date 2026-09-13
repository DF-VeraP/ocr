import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/tokens';
import { prisma } from '../config/db';
import { getServerInstanceId } from '../config/serverInstance';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : (req.cookies?.access_token || queryToken);

  if (!token) {
    res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Acceso no autorizado: Token inválido o expirado' });
    return;
  }

  // RF-022: Validar si el token corresponde a la instancia activa del servidor.
  // Si el servidor se reinició, cayó o se apagó el PC, todos los tokens previos quedan invalidados de inmediato.
  if (!payload.instanceId || payload.instanceId !== getServerInstanceId()) {
    res.status(401).json({
      error: 'Su sesión ha expirado porque el servidor fue reiniciado o se interrumpió la conexión. Inicie sesión nuevamente.',
      code: 'SERVER_RESTARTED',
    });
    return;
  }

  // Verificar en base de datos si el usuario sigue activo
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || !user.isActive) {
    res.status(403).json({ error: 'Su cuenta ha sido desactivada o no existe' });
    return;
  }

  req.user = {
    userId: user.id,
    email: user.email,
    role: user.role,
    requiresPasswordChange: user.requiresPasswordChange,
  };

  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de Administrador' });
    return;
  }
  next();
}

export function checkMustChangePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.requiresPasswordChange && req.path !== '/change-password' && req.path !== '/logout') {
    res.status(403).json({
      error: 'Debe cambiar su contraseña temporal antes de continuar utilizando el sistema',
      requiresPasswordChange: true,
    });
    return;
  }
  next();
}
