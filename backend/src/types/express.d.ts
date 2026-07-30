import type { Role } from './entities';

/**
 * Extend Express Request to include authenticated user information.
 * This is populated by the auth middleware after successful JWT validation.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        role: Role;
        assignedBranchId: string | null;
      };
    }
  }
}

export {};
