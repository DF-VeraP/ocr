import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { ENV } from './config/env';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import batchRoutes from './routes/batch.routes';
import { ocrService } from './services/ocr.service';

const app = express();

// Middlewares de seguridad y parsing
app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Servir archivos estáticos de rostros locales
const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

import { getServerInstanceId, getServerStartTime } from './config/serverInstance';

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    instanceId: getServerInstanceId(),
    startTime: getServerStartTime(),
    timestamp: new Date().toISOString(),
    service: 'SENA OCR Cédulas Backend',
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/batches', batchRoutes);

// Manejador centralizado de errores (RNF-029)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Error global no capturado:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Ha ocurrido un error inesperado en el servidor',
  });
});

// Iniciar servidor
const server = app.listen(ENV.PORT, () => {
  console.log(`\n🚀 Servidor SENA OCR ejecutándose en http://localhost:${ENV.PORT}`);
  console.log(`   Ambiente: ${ENV.NODE_ENV}`);
  console.log(`   Frontend permitido: ${ENV.CLIENT_URL}`);
  console.log(`   Admin predeterminado: ${ENV.ADMIN_EMAIL}\n`);

  // Pre-calentar el motor PaddleOCR (ONNX Runtime) en segundo plano para eliminar el cold-start (5s)
  ocrService
    .getOcrInstance()
    .then(() => {
      console.log('⚡ [PaddleOCR] Modelos ONNX pre-calentados y listos en memoria.');
    })
    .catch((err: any) => {
      console.warn('⚠️ [PaddleOCR] Advertencia al pre-calentar modelo OCR:', err?.message || err);
    });
});

// Aumentar timeouts del servidor para subidas de archivos grandes (10 minutos)
server.timeout = 600000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

export default app;
