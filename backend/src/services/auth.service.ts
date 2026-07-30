import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection';
import type { User, Role } from '../types/entities';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10);
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_WINDOW_MINUTES = 30;
const LOCKOUT_DURATION_MINUTES = 15;

export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  assignedBranchId: string | null;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    username: string;
    role: Role;
    assignedBranchId: string | null;
  };
}

export interface SessionInfo {
  userId: string;
  username: string;
  role: Role;
  assignedBranchId: string | null;
}

const INVALID_CREDENTIALS_ERROR = 'Invalid username or password';

export class AuthService {
  /**
   * Authenticate a user with username and password.
   * Returns a JWT token on success.
   * Implements account lockout after 3 failed attempts within 30 minutes.
   */
  async authenticate(username: string, password: string): Promise<AuthResult> {
    // Find user by username
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    const user: User | undefined = result.rows[0];

    if (!user) {
      // Don't reveal that the user doesn't exist
      throw new AuthError(INVALID_CREDENTIALS_ERROR, 401);
    }

    // Check if account is inactive
    if (!user.is_active) {
      throw new AuthError(INVALID_CREDENTIALS_ERROR, 401);
    }

    // Check if account is currently locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AuthError(
        'Account is temporarily locked. Please try again later.',
        423
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await this.handleFailedAttempt(user);
      throw new AuthError(INVALID_CREDENTIALS_ERROR, 401);
    }

    // Successful login - reset failed attempts and update last_activity
    await query(
      `UPDATE users 
       SET failed_login_attempts = 0, 
           locked_until = NULL, 
           last_activity = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Generate JWT token
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role as Role,
      assignedBranchId: user.assigned_branch_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role as Role,
        assignedBranchId: user.assigned_branch_id,
      },
    };
  }

  /**
   * Validate a session token.
   * Checks JWT validity, user existence, active status, and session timeout.
   */
  async validateSession(token: string): Promise<SessionInfo> {
    let payload: JwtPayload;

    try {
      payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      throw new AuthError('Invalid or expired token', 401);
    }

    // Check user exists and is active
    const result = await query(
      'SELECT id, username, role, assigned_branch_id, is_active, last_activity FROM users WHERE id = $1',
      [payload.userId]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      throw new AuthError('User not found or inactive', 401);
    }

    // Check session timeout (30 minutes of inactivity)
    if (user.last_activity) {
      const lastActivity = new Date(user.last_activity);
      const now = new Date();
      const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

      if (minutesSinceActivity > SESSION_TIMEOUT_MINUTES) {
        throw new AuthError('Session expired due to inactivity', 401);
      }
    }

    // Return current role/branch from the database (not from the JWT payload)
    // so that role changes take immediate effect on the user's next request
    return {
      userId: user.id,
      username: user.username,
      role: user.role as Role,
      assignedBranchId: user.assigned_branch_id,
    };
  }

  /**
   * Lock a user account for 15 minutes.
   */
  async lockAccount(userId: string): Promise<void> {
    const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

    await query(
      `UPDATE users 
       SET locked_until = $1, updated_at = NOW() 
       WHERE id = $2`,
      [lockUntil.toISOString(), userId]
    );
  }

  /**
   * Unlock a user account and reset failed login attempts.
   */
  async unlockAccount(userId: string): Promise<void> {
    await query(
      `UPDATE users 
       SET locked_until = NULL, 
           failed_login_attempts = 0, 
           updated_at = NOW() 
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Handle a failed login attempt.
   * Increments failed_login_attempts and locks account if threshold reached.
   */
  private async handleFailedAttempt(user: User): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);

    // If the user's last failed attempt was outside the window, reset the count
    // We track this by checking if failed_login_attempts > 0 and updated_at is within window
    const updatedAt = new Date(user.updated_at);
    let currentAttempts = user.failed_login_attempts;

    if (currentAttempts > 0 && updatedAt < windowStart) {
      // Reset - previous failures are outside the 30-minute window
      currentAttempts = 0;
    }

    const newAttempts = currentAttempts + 1;

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      // Lock the account
      const lockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      await query(
        `UPDATE users 
         SET failed_login_attempts = $1, 
             locked_until = $2, 
             updated_at = NOW() 
         WHERE id = $3`,
        [newAttempts, lockUntil.toISOString(), user.id]
      );
    } else {
      // Increment failed attempts
      await query(
        `UPDATE users 
         SET failed_login_attempts = $1, 
             updated_at = NOW() 
         WHERE id = $2`,
        [newAttempts, user.id]
      );
    }
  }

  /**
   * Update last_activity timestamp for a user (called on each authenticated request).
   */
  async updateLastActivity(userId: string): Promise<void> {
    await query(
      'UPDATE users SET last_activity = NOW() WHERE id = $1',
      [userId]
    );
  }

  /**
   * Hash a password using bcrypt.
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}

export class AuthError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

export const authService = new AuthService();
