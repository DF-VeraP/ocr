import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de administración requieren autenticación y rol ADMIN
router.use(authenticateToken, requireAdmin);

router.get('/requests/pending', (req, res) => adminController.getPendingRequests(req, res));
router.get('/requests/history', (req, res) => adminController.getAllRequests(req, res));
router.post('/requests/:requestId/accept', (req, res) => adminController.acceptRequest(req, res));
router.post('/requests/:requestId/reject', (req, res) => adminController.rejectRequest(req, res));

router.get('/users', (req, res) => adminController.getUsers(req, res));
router.patch('/users/:userId/toggle-status', (req, res) => adminController.toggleUserStatus(req, res));

export default router;
