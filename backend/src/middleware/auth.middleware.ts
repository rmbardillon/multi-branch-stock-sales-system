import { Request, Response, NextFunction } from 'express';
import { authService, AuthError, SessionInfo } from '../services/auth.service';

/**
 * Authentication middleware.
 * Extracts Bearer token from Authorization header, validates the JWT,
 * checks session timeout, and attaches user info to the request.
 * Updates last_activity on each authenticated request.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No valid authorization token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No valid authorization token provided',
      });
      return;
    }

    // Validate the session (checks JWT, user active status, session timeout)
    const sessionInfo = await authService.validateSession(token);

    // Update last_activity timestamp
    await authService.updateLastActivity(sessionInfo.userId);

    // Attach user info to request
    req.user = sessionInfo;

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: 'Authentication failed',
        message: error.message,
      });
      return;
    }

    res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token',
    });
  }
}
