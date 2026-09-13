import { Request, Response, NextFunction } from 'express';

interface RequestRecord {
  count: number;
  firstRequestTime: number;
}

// Almacén en memoria para limitar solicitudes de registro por correo (RF-006)
const emailRequests = new Map<string, RequestRecord>();

const WINDOW_MS = 4 * 60 * 60 * 1000; // 4 horas
const MAX_REQUESTS = 3;

export function registrationRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const email = (req.body?.email || '').trim().toLowerCase();

  if (!email) {
    res.status(400).json({ error: 'El correo electrónico es requerido' });
    return;
  }

  const now = Date.now();
  const record = emailRequests.get(email);

  if (!record) {
    emailRequests.set(email, { count: 1, firstRequestTime: now });
    return next();
  }

  // Si ya pasaron las 4 horas, reiniciar la ventana
  if (now - record.firstRequestTime > WINDOW_MS) {
    emailRequests.set(email, { count: 1, firstRequestTime: now });
    return next();
  }

  // Si aún está dentro de las 4 horas
  if (record.count >= MAX_REQUESTS) {
    const remainingMinutes = Math.ceil((WINDOW_MS - (now - record.firstRequestTime)) / (60 * 1000));
    res.status(429).json({
      error: `Ha superado el límite de 3 solicitudes cada 4 horas para este correo. Intente nuevamente en aproximadamente ${remainingMinutes} minutos.`,
    });
    return;
  }

  record.count += 1;
  return next();
}
