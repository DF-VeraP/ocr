import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { registrationRateLimiter } from '../middlewares/rateLimit.middleware';
import { authenticateToken, checkMustChangePassword } from '../middlewares/auth.middleware';

const router = Router();

// Rutas públicas
router.post('/register', registrationRateLimiter, (req, res) => authController.registerRequest(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/refresh-token', (req, res) => authController.refreshToken(req, res));
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

// Rutas autenticadas
router.post('/logout', authenticateToken, (req, res) => authController.logout(req, res));
router.post('/change-password', authenticateToken, (req, res) => authController.changePassword(req, res));
router.get('/me', authenticateToken, checkMustChangePassword, (req, res) => authController.getMe(req, res));

export default router;
