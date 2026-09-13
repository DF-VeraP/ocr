import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (ENV.SMTP_USER && ENV.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        secure: ENV.SMTP_PORT === 465,
        auth: {
          user: ENV.SMTP_USER,
          pass: ENV.SMTP_PASS,
        },
      });
    }
  }

  /**
   * RF-007: Notificar al administrador sobre nueva solicitud
   */
  async notifyAdminNewRequest(applicantEmail: string): Promise<void> {
    const subject = 'Nueva Solicitud de Registro - Sistema SENA OCR';
    const text = `Se ha recibido una nueva solicitud de registro para el correo: ${applicantEmail}. Ingrese al panel administrativo para revisarla y aprobarla o rechazarla.`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #39a900;">SENA | Sistema OCR de Cédulas</h2>
        <p>Se ha recibido una nueva solicitud de acceso al sistema.</p>
        <p><strong>Correo del solicitante:</strong> ${applicantEmail}</p>
        <p>Por favor ingrese al panel de administración para aceptar o rechazar la solicitud.</p>
      </div>
    `;

    await this.sendMail(ENV.ADMIN_EMAIL, subject, text, html);
  }

  /**
   * RF-011: Enviar contraseña temporal al usuario aceptado
   */
  async sendTemporaryPassword(toEmail: string, tempPassword: string): Promise<void> {
    const subject = 'Solicitud Aprobada - Contraseña Temporal de Acceso';
    const loginUrl = `${ENV.CLIENT_URL}/login`;
    const text = `Su solicitud de registro ha sido aprobada. Su contraseña temporal es: ${tempPassword}. Inicie sesión en ${loginUrl} y cámbiela en su primer ingreso.`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #39a900;">¡Bienvenido al Sistema SENA OCR!</h2>
        <p>Su solicitud de acceso ha sido <strong>aprobada</strong> por el administrador.</p>
        <p>Su contraseña temporal de ingreso es:</p>
        <div style="background: #f4f4f4; padding: 12px; font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #00324d; display: inline-block;">
          ${tempPassword}
        </div>
        <p><em>Por motivos de seguridad, el sistema le solicitará cambiar esta contraseña en su primer inicio de sesión.</em></p>
        <p><a href="${loginUrl}" style="background: #39a900; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Iniciar Sesión</a></p>
      </div>
    `;

    await this.sendMail(toEmail, subject, text, html);
  }

  /**
   * RF-018: Enviar enlace de restablecimiento de contraseña (token 30 min)
   */
  async sendPasswordResetEmail(toEmail: string, token: string): Promise<void> {
    const resetUrl = `${ENV.CLIENT_URL}/reset-password?token=${token}`;
    const subject = 'Restablecimiento de Contraseña - Sistema SENA OCR';
    const text = `Para restablecer su contraseña, ingrese al siguiente enlace (válido por 30 minutos): ${resetUrl}`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #39a900;">Restablecer Contraseña</h2>
        <p>Ha solicitado restablecer su contraseña de acceso. Haga clic en el siguiente enlace:</p>
        <p><a href="${resetUrl}" style="background: #00324d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Restablecer mi Contraseña</a></p>
        <p><small>Este enlace tiene una validez de 30 minutos. Si usted no solicitó este cambio, ignore este mensaje.</small></p>
      </div>
    `;

    await this.sendMail(toEmail, subject, text, html);
  }

  private async sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
    console.log(`\n📧 [SIMULACIÓN / ENVÍO DE CORREO]`);
    console.log(`   Destinatario: ${to}`);
    console.log(`   Asunto: ${subject}`);
    console.log(`   Contenido: ${text}`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `"SENA OCR" <${ENV.SMTP_USER}>`,
          to,
          subject,
          text,
          html,
        });
        console.log(`   ✅ Correo enviado satisfactoriamente vía SMTP`);
      } catch (error) {
        console.error(`   ⚠️ No se pudo enviar el correo real vía SMTP (usando log local):`, error);
      }
    } else {
      console.log(`   ℹ️ SMTP no configurado en .env; correo simulado en consola.`);
    }
  }
}

export const mailService = new MailService();
