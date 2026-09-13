import { Response } from 'express';
import { prisma } from '../config/db';
import { generateTempPassword, hashPassword } from '../utils/password';
import { mailService } from '../services/mail.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AdminController {
  /**
   * RF-008, RF-072: Ver solicitudes pendientes
   */
  async getPendingRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const requests = await prisma.registrationRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ requests });
    } catch (error) {
      console.error('Error al obtener solicitudes pendientes:', error);
      res.status(500).json({ error: 'Error al consultar solicitudes pendientes' });
    }
  }

  /**
   * RF-073: Ver todas las solicitudes (historial)
   */
  async getAllRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const requests = await prisma.registrationRequest.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.json({ requests });
    } catch (error) {
      res.status(500).json({ error: 'Error al consultar historial de solicitudes' });
    }
  }

  /**
   * RF-009, RF-010, RF-011, RF-075, RF-080: Aceptar solicitud
   */
  async acceptRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const adminEmail = req.user?.email || 'admin@sena.edu.co';

      const request = await prisma.registrationRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        res.status(404).json({ error: 'Solicitud no encontrada' });
        return;
      }

      if (request.status !== 'PENDING') {
        res.status(400).json({ error: `La solicitud ya se encuentra en estado: ${request.status}` });
        return;
      }

      // RF-010: Generar contraseña temporal aleatoria
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      // Crear o activar el usuario en la BD con requiresPasswordChange = true (RF-015)
      await prisma.$transaction([
        prisma.user.upsert({
          where: { email: request.email },
          update: {
            passwordHash,
            isActive: true,
            requiresPasswordChange: true,
            failedAttempts: 0,
            lockedUntil: null,
          },
          create: {
            email: request.email,
            passwordHash,
            role: 'USER',
            isActive: true,
            requiresPasswordChange: true,
          },
        }),
        prisma.registrationRequest.update({
          where: { id: requestId },
          data: {
            status: 'ACCEPTED',
            reviewedAt: new Date(),
            reviewedBy: adminEmail,
          },
        }),
      ]);

      // RF-011, RF-080: Enviar correo al solicitante con la contraseña temporal
      await mailService.sendTemporaryPassword(request.email, tempPassword);

      res.status(200).json({
        mensaje: `Solicitud de ${request.email} aceptada exitosamente. Se ha generado y enviado su contraseña temporal por correo.`,
      });
    } catch (error) {
      console.error('Error al aceptar solicitud:', error);
      res.status(500).json({ error: 'Error interno al aceptar la solicitud' });
    }
  }

  /**
   * RF-012, RF-013, RF-076, RF-082: Rechazar solicitud
   */
  async rejectRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const adminEmail = req.user?.email || 'admin@sena.edu.co';

      const request = await prisma.registrationRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        res.status(404).json({ error: 'Solicitud no encontrada' });
        return;
      }

      if (request.status !== 'PENDING') {
        res.status(400).json({ error: `La solicitud ya se encuentra en estado: ${request.status}` });
        return;
      }

      // RF-012, RF-013: Marcar rechazada y NO enviar ningún correo
      await prisma.registrationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedBy: adminEmail,
        },
      });

      res.status(200).json({
        mensaje: `Solicitud de ${request.email} rechazada. No se ha emitido ninguna notificación al solicitante.`,
      });
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      res.status(500).json({ error: 'Error interno al rechazar la solicitud' });
    }
  }

  /**
   * RF-077: Listado de usuarios
   */
  async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          requiresPasswordChange: true,
          failedAttempts: true,
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  }

  /**
   * RF-078: Desactivar / activar usuario
   */
  async toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });

      if (!targetUser) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      // Evitar desactivar al superadmin
      if (targetUser.email === 'admin@sena.edu.co') {
        res.status(400).json({ error: 'No es posible desactivar al Administrador principal del sistema' });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isActive: !targetUser.isActive },
        select: { id: true, email: true, isActive: true },
      });

      res.json({
        mensaje: `Usuario ${updated.email} ${updated.isActive ? 'activado' : 'desactivado'} con éxito`,
        user: updated,
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al cambiar estado de usuario' });
    }
  }
}

export const adminController = new AdminController();
