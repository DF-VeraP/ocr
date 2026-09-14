import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import {
  validatePasswordPolicy,
  hashPassword,
  comparePassword,
} from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens';
import { getServerInstanceId } from '../config/serverInstance';
import { mailService } from '../services/mail.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AuthController {
  /**
   * RF-001 al RF-005, RF-007: Crear solicitud de registro
   */
  async registerRequest(req: Request, res: Response): Promise<void> {
    try {
      const email = (req.body?.email || '').trim().toLowerCase();
      const password = req.body?.password || '';

      if (!email || !password) {
        res.status(400).json({ error: 'El correo electrónico y la contraseña son obligatorios' });
        return;
      }

      // RF-003: Validación de política de contraseñas
      const policy = validatePasswordPolicy(password);
      if (!policy.isValid) {
        res.status(400).json({ error: policy.message });
        return;
      }

      // RF-002: Validar correo único (usuarios o solicitudes pendientes)
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado como usuario' });
        return;
      }

      const existingRequest = await prisma.registrationRequest.findUnique({ where: { email } });
      if (existingRequest && existingRequest.status === 'PENDING') {
        res.status(409).json({ error: 'Ya existe una solicitud pendiente de aprobación para este correo' });
        return;
      }

      // RF-004: Hash bcrypt
      const passwordHash = await hashPassword(password);

      // RF-005: Guardar solicitud en estado PENDING
      if (existingRequest) {
        await prisma.registrationRequest.update({
          where: { email },
          data: {
            passwordHash,
            status: 'PENDING',
            createdAt: new Date(),
          },
        });
      } else {
        await prisma.registrationRequest.create({
          data: {
            email,
            passwordHash,
            status: 'PENDING',
          },
        });
      }

      // RF-007: Notificar al administrador por correo
      mailService.notifyAdminNewRequest(email).catch(console.error);

      res.status(201).json({
        mensaje: 'Solicitud de registro enviada con éxito. El administrador revisará y autorizará su acceso.',
      });
    } catch (error) {
      console.error('Error en registerRequest:', error);
      res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud' });
    }
  }

  /**
   * RF-014 al RF-017, RF-020, RF-021: Inicio de sesión con control de bloqueo
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const email = (req.body?.email || '').trim().toLowerCase();
      const password = req.body?.password || '';
      const rememberMe = Boolean(req.body?.rememberMe);

      if (!email || !password) {
        res.status(400).json({ error: 'El correo electrónico y la contraseña son requeridos' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: 'Su cuenta ha sido desactivada por el administrador' });
        return;
      }

      const now = new Date();

      // RF-016 y RF-017: Comprobar si la cuenta está bloqueada (30 minutos)
      if (user.lockedUntil && user.lockedUntil > now) {
        const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
        res.status(423).json({
          error: `Cuenta bloqueada temporalmente por 3 intentos fallidos. Intente nuevamente en ${remainingMinutes} minutos o restablezca su contraseña.`,
        });
        return;
      }

      // Verificar contraseña
      const isPasswordValid = await comparePassword(password, user.passwordHash);

      if (!isPasswordValid) {
        const newAttempts = (user.failedAttempts || 0) + 1;
        let updateData: any = { failedAttempts: newAttempts };

        if (newAttempts >= 3) {
          // Bloquear por 30 minutos
          const lockedUntil = new Date(now.getTime() + 30 * 60 * 1000);
          updateData.lockedUntil = lockedUntil;
          await prisma.user.update({ where: { id: user.id }, data: updateData });

          res.status(423).json({
            error: 'Ha superado el número máximo de intentos fallidos (3). Su cuenta ha sido bloqueada por 30 minutos.',
          });
          return;
        }

        await prisma.user.update({ where: { id: user.id }, data: updateData });
        const attemptsLeft = 3 - newAttempts;
        res.status(401).json({
          error: `Contraseña incorrecta. Le restan ${attemptsLeft} intento(s) antes del bloqueo.`,
        });
        return;
      }

      // Credenciales válidas: reiniciar intentos fallidos y bloqueo
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      // Generar tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        requiresPasswordChange: user.requiresPasswordChange,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Guardar refresh token en cookie segura
      const refreshMaxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: refreshMaxAge,
      });

      // Guardar access token en cookie para peticiones que no permiten cabeceras (SSE, descargas)
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        mensaje: 'Inicio de sesión exitoso',
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          requiresPasswordChange: user.requiresPasswordChange,
        },
      });
    } catch (error: any) {
      console.error('Error en login:', error);
      res.status(500).json({ error: error?.message || 'Error interno del servidor al iniciar sesión' });
    }
  }

  /**
   * RF-020: Refrescar token de acceso
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

      if (!refreshToken) {
        res.status(401).json({ error: 'Refresh token no proporcionado' });
        return;
      }

      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        res.status(401).json({ error: 'Refresh token inválido o expirado' });
        return;
      }

      if (!payload.instanceId || payload.instanceId !== getServerInstanceId()) {
        res.status(401).json({
          error: 'La sesión expiró porque el servidor fue reiniciado',
          code: 'SERVER_RESTARTED',
        });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || !user.isActive) {
        res.status(403).json({ error: 'Usuario no disponible o desactivado' });
        return;
      }

      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        requiresPasswordChange: user.requiresPasswordChange,
      });

      res.cookie('access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.json({ accessToken: newAccessToken });
    } catch (error) {
      res.status(500).json({ error: 'Error al renovar token' });
    }
  }

  /**
   * RF-022: Cerrar sesión
   */
  async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('refresh_token');
    res.clearCookie('access_token');
    res.status(200).json({ mensaje: 'Sesión finalizada con éxito' });
  }

  /**
   * RF-015, RF-023: Cambiar contraseña
   */
  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { currentPassword, newPassword } = req.body;

      if (!userId || !newPassword) {
        res.status(400).json({ error: 'La nueva contraseña es obligatoria' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      // Si no es el primer inicio de sesión obligatorio, validar la contraseña actual
      if (!user.requiresPasswordChange) {
        if (!currentPassword) {
          res.status(400).json({ error: 'Debe ingresar su contraseña actual' });
          return;
        }
        const isMatch = await comparePassword(currentPassword, user.passwordHash);
        if (!isMatch) {
          res.status(400).json({ error: 'La contraseña actual no es correcta' });
          return;
        }
      }

      // Validar políticas de la nueva contraseña
      const policy = validatePasswordPolicy(newPassword);
      if (!policy.isValid) {
        res.status(400).json({ error: policy.message });
        return;
      }

      const passwordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          requiresPasswordChange: false,
        },
      });

      res.status(200).json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (error) {
      console.error('Error en changePassword:', error);
      res.status(500).json({ error: 'Error interno al cambiar la contraseña' });
    }
  }

  /**
   * RF-018, RF-081: Solicitar restablecimiento de contraseña
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const email = (req.body?.email || '').trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'El correo electrónico es requerido' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Por seguridad, responder de forma genérica para no revelar existencia de emails
        res.status(200).json({
          mensaje: 'Si el correo está registrado en el sistema, recibirá un enlace de restablecimiento.',
        });
        return;
      }

      // Generar token seguro con expiración de 30 minutos
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Invalidar tokens previos
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Enviar correo con token
      await mailService.sendPasswordResetEmail(user.email, token);

      res.status(200).json({
        mensaje: 'Si el correo está registrado en el sistema, recibirá un enlace de restablecimiento.',
      });
    } catch (error) {
      console.error('Error en forgotPassword:', error);
      res.status(500).json({ error: 'Error al procesar solicitud de recuperación' });
    }
  }

  /**
   * RF-018, RF-019: Ejecutar restablecimiento con token
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({ error: 'Token y nueva contraseña son obligatorios' });
        return;
      }

      const resetRecord = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
        res.status(400).json({ error: 'El enlace de restablecimiento es inválido o ha expirado (30 min)' });
        return;
      }

      const policy = validatePasswordPolicy(newPassword);
      if (!policy.isValid) {
        res.status(400).json({ error: policy.message });
        return;
      }

      const passwordHash = await hashPassword(newPassword);

      // Actualizar contraseña y reiniciar intentos fallidos (RF-019)
      await prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          requiresPasswordChange: false,
        },
      });

      // Marcar token como utilizado
      await prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });

      res.status(200).json({ mensaje: 'Contraseña restablecida con éxito. Ya puede iniciar sesión.' });
    } catch (error) {
      console.error('Error en resetPassword:', error);
      res.status(500).json({ error: 'Error al restablecer la contraseña' });
    }
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          requiresPasswordChange: true,
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: 'Error al consultar perfil' });
    }
  }
}

export const authController = new AuthController();
