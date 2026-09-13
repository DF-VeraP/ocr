import multer from 'multer';
import path from 'path';
import fs from 'fs';

const tempDir = path.resolve(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const multerUpload = multer({
  storage,
  limits: {
    // RNF-035: Sin límite estricto de tamaño por ahora (permitir hasta 100MB)
    fileSize: 100 * 1024 * 1024,
  },
}).fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'excel', maxCount: 1 },
]);

export const uploadDualFiles = (req: any, res: any, next: any) => {
  multerUpload(req, res, (err: any) => {
    if (err) {
      console.error('⚠️ [MULTER ERROR]:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido (100MB)' });
      }
      return res.status(400).json({ error: `Error en la carga de archivos: ${err.message}` });
    }
    next();
  });
};
