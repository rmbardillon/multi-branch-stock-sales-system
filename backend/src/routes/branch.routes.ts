import { Router, Request, Response } from 'express';
import { createBranchSchema, updateBranchSchema } from '../types/schemas';
import { branchService, BranchServiceError } from '../services/branch.service';
import { requireAdmin } from '../middleware/rbac.middleware';
import type { BranchStatus } from '../types/entities';

const router = Router();

/**
 * GET /api/branches
 * List all branches with optional filtering.
 * Any authenticated user can list branches.
 * Query params: status (Active|Inactive), search (string)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;

    const filters: { status?: BranchStatus; search?: string } = {};

    if (status && (status === 'Active' || status === 'Inactive')) {
      filters.status = status as BranchStatus;
    }

    if (search && typeof search === 'string') {
      filters.search = search;
    }

    const branches = await branchService.list(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.status(200).json({ data: branches });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while listing branches',
    });
  }
});

/**
 * POST /api/branches
 * Create a new branch.
 * Admin only.
 */
router.post('/', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = createBranchSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid branch data',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const branch = await branchService.create(parseResult.data);

    res.status(201).json({ data: branch });
  } catch (error) {
    if (error instanceof BranchServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 409 ? 'Conflict' : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the branch',
    });
  }
});

/**
 * GET /api/branches/:id
 * Get a single branch by ID.
 * Any authenticated user.
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const branch = await branchService.getById(id);

    res.status(200).json({ data: branch });
  } catch (error) {
    if (error instanceof BranchServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 404 ? 'Not found' : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching the branch',
    });
  }
});

/**
 * PUT /api/branches/:id
 * Update a branch.
 * Admin only.
 */
router.put('/:id', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const parseResult = updateBranchSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid branch data',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const branch = await branchService.update(id, parseResult.data);

    res.status(200).json({ data: branch });
  } catch (error) {
    if (error instanceof BranchServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 409 ? 'Conflict' : error.statusCode === 404 ? 'Not found' : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating the branch',
    });
  }
});

/**
 * PATCH /api/branches/:id
 * Deactivate a branch.
 * Admin only.
 * Returns warning about pending transactions if any exist.
 */
router.patch('/:id', requireAdmin(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await branchService.deactivate(id);

    const response: Record<string, unknown> = { data: result.branch };

    if (result.pendingWarning) {
      response.warning = {
        message: `Branch has ${result.pendingWarning.sales} recent sale(s) and ${result.pendingWarning.transfers} pending transfer(s)`,
        pending_sales: result.pendingWarning.sales,
        pending_transfers: result.pendingWarning.transfers,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof BranchServiceError) {
      res.status(error.statusCode).json({
        error: error.statusCode === 404 ? 'Not found' : 'Error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while deactivating the branch',
    });
  }
});

export default router;
