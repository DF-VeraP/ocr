import { Router } from 'express';
import { batchController } from '../controllers/batch.controller';
import { authenticateToken, checkMustChangePassword } from '../middlewares/auth.middleware';
import { uploadDualFiles } from '../middlewares/upload.middleware';

const router = Router();

// Ruta de carga: primero Multer procesa el stream multipart para no resetear la conexión, luego autentica
router.post('/upload', uploadDualFiles, authenticateToken, checkMustChangePassword, (req, res) => batchController.uploadBatch(req, res));

// Rutas de consulta y procesamiento que requieren autenticación
router.use(authenticateToken, checkMustChangePassword);
router.get('/', (req, res) => batchController.getAllBatches(req, res));
router.get('/latest', (req, res) => batchController.getLatestBatch(req, res));
router.get('/:batchId/status', (req, res) => batchController.getBatchStatus(req, res));
router.get('/:batchId/stream', (req, res) => batchController.streamBatchProgress(req, res));
router.post('/:batchId/pause', (req, res) => batchController.pauseBatch(req, res));
router.post('/:batchId/resume', (req, res) => batchController.resumeBatch(req, res));
router.post('/:batchId/cancel', (req, res) => batchController.cancelBatch(req, res));
router.get('/:batchId/documents', (req, res) => batchController.getBatchDocuments(req, res));
router.patch('/:batchId/documents/:documentId', (req, res) => batchController.updateBatchDocument(req, res));
router.get('/:batchId/report', (req, res) => batchController.getBatchReport(req, res));
router.get('/:batchId/export/excel', (req, res) => batchController.exportBatchExcel(req, res));
router.delete('/:batchId', (req, res) => batchController.deleteBatch(req, res));
router.delete('/', (req, res) => batchController.deleteAllBatches(req, res));

export default router;
