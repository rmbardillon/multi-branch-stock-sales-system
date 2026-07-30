import { Router } from 'express';
import authRoutes from './auth.routes';
import branchRoutes from './branch.routes';
import stockItemRoutes from './stock-item.routes';
import inventoryRoutes from './inventory.routes';
import salesRoutes from './sales.routes';
import transferRoutes from './transfer.routes';
import reportRoutes from './report.routes';
import userRoutes from './user.routes';
import auditRoutes from './audit.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Auth routes (no auth middleware required for login/logout)
router.use('/auth', authRoutes);

// Branch routes (require authentication)
router.use('/branches', authMiddleware, branchRoutes);

// Stock item routes (require authentication)
router.use('/stock-items', authMiddleware, stockItemRoutes);

// Inventory routes (require authentication)
router.use('/inventory', authMiddleware, inventoryRoutes);

// Sales routes (require authentication)
router.use('/sales', authMiddleware, salesRoutes);

// Transfer routes (require authentication)
router.use('/transfers', authMiddleware, transferRoutes);

// Report routes (require authentication)
router.use('/reports', authMiddleware, reportRoutes);

// User routes (require authentication)
router.use('/users', authMiddleware, userRoutes);

// Audit routes (require authentication)
router.use('/audit', authMiddleware, auditRoutes);

export default router;
