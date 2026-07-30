import { Router, Request, Response } from 'express';
import { loginSchema } from '../types/schemas';
import { authService, AuthError } from '../services/auth.service';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user with username and password.
 * Returns JWT token and user info on success.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body with Zod
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid login credentials format',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const { username, password } = parseResult.data;

    // Authenticate via AuthService
    const result = await authService.authenticate(username, password);

    res.status(200).json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: 'Authentication failed',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during authentication',
    });
  }
});

/**
 * POST /api/auth/logout
 * Stateless JWT logout - mainly for client-side cleanup.
 * In a stateless JWT setup, the server acknowledges the logout
 * and the client discards the token.
 */
router.post('/logout', (_req: Request, res: Response): void => {
  res.status(200).json({
    message: 'Logged out successfully',
  });
});

export default router;
