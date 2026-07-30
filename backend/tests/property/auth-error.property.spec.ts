/**
 * Property 2: Invalid Credentials Produce Uniform Error
 *
 * For any set of invalid credentials (wrong username, wrong password, or both),
 * the authentication system SHALL return an identical error response that does not
 * distinguish which field was incorrect.
 *
 * **Validates: Requirements 1.2**
 *
 * Feature: multi-branch-stock-sales-system
 * Property 2: Invalid Credentials Produce Uniform Error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { defaultPropertyConfig } from '../factories/arbitraries';

// Mock the database module before importing the auth service
vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
}));

// Mock bcrypt to avoid slow hashing in property tests
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

import { AuthService, AuthError } from '../../src/services/auth.service';
import { query } from '../../src/database/connection';
import bcrypt from 'bcrypt';

const mockedQuery = vi.mocked(query);
const mockedBcryptCompare = vi.mocked(bcrypt.compare);

// Arbitrary for generating random non-empty usernames
const arbUsername = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// Arbitrary for generating random non-empty passwords
const arbPassword = fc.string({ minLength: 1, maxLength: 128 }).filter(s => s.trim().length > 0);

const EXPECTED_ERROR_MESSAGE = 'Invalid username or password';
const EXPECTED_STATUS_CODE = 401;

/**
 * Validates that the error message does not leak which specific field was wrong.
 * The generic message "Invalid username or password" is acceptable since it doesn't
 * distinguish between a wrong username and a wrong password.
 * We check that the message doesn't contain phrases that would reveal which field failed.
 */
function assertNoInformationLeakage(error: AuthError): void {
  const msg = error.message;
  // Must not indicate specifically which field was incorrect
  expect(msg).not.toContain('not found');
  expect(msg).not.toContain('does not exist');
  expect(msg).not.toContain('incorrect password');
  expect(msg).not.toContain('wrong password');
  expect(msg).not.toContain('user not found');
  expect(msg).not.toContain('unknown user');
  expect(msg).not.toContain('no such user');
  expect(msg).not.toContain('password mismatch');
  expect(msg).not.toContain('invalid password');
  expect(msg).not.toContain('bad password');
}

describe('Property 2: Invalid Credentials Produce Uniform Error', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  it('returns uniform error when username does not exist (user not found)', async () => {
    await fc.assert(
      fc.asyncProperty(arbUsername, arbPassword, async (username, password) => {
        vi.clearAllMocks();
        // Mock: no user found in the database
        mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

        try {
          await authService.authenticate(username, password);
          expect.fail('Expected AuthError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AuthError);
          const authError = error as AuthError;
          expect(authError.message).toBe(EXPECTED_ERROR_MESSAGE);
          expect(authError.statusCode).toBe(EXPECTED_STATUS_CODE);
          assertNoInformationLeakage(authError);
        }
      }),
      { ...defaultPropertyConfig, numRuns: 100 }
    );
  });

  it('returns uniform error when password is wrong (user exists, wrong password)', async () => {
    await fc.assert(
      fc.asyncProperty(arbUsername, arbPassword, async (username, password) => {
        vi.clearAllMocks();

        // Mock: user found in database
        const fakeUser = {
          id: '00000000-0000-0000-0000-000000000001',
          username,
          password_hash: '$2b$12$somehashvalue',
          role: 'Sales_Staff',
          assigned_branch_id: null,
          failed_login_attempts: 0,
          locked_until: null,
          last_activity: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockedQuery.mockResolvedValue({ rows: [fakeUser], rowCount: 1 } as any);

        // Mock bcrypt.compare to return false (wrong password)
        mockedBcryptCompare.mockResolvedValue(false as never);

        try {
          await authService.authenticate(username, password);
          expect.fail('Expected AuthError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AuthError);
          const authError = error as AuthError;
          expect(authError.message).toBe(EXPECTED_ERROR_MESSAGE);
          expect(authError.statusCode).toBe(EXPECTED_STATUS_CODE);
          assertNoInformationLeakage(authError);
        }
      }),
      { ...defaultPropertyConfig, numRuns: 100 }
    );
  });

  it('returns uniform error when both username and password are wrong', async () => {
    await fc.assert(
      fc.asyncProperty(arbUsername, arbPassword, async (username, password) => {
        vi.clearAllMocks();
        // Mock: no user found (both fields are wrong)
        mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

        try {
          await authService.authenticate(username, password);
          expect.fail('Expected AuthError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AuthError);
          const authError = error as AuthError;
          expect(authError.message).toBe(EXPECTED_ERROR_MESSAGE);
          expect(authError.statusCode).toBe(EXPECTED_STATUS_CODE);
          assertNoInformationLeakage(authError);
        }
      }),
      { ...defaultPropertyConfig, numRuns: 100 }
    );
  });

  it('error responses are identical regardless of failure reason (user missing vs wrong password)', async () => {
    await fc.assert(
      fc.asyncProperty(arbUsername, arbPassword, async (username, password) => {
        // Case 1: User does not exist
        vi.clearAllMocks();
        mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

        let errorWhenUserMissing: AuthError | null = null;
        try {
          await authService.authenticate(username, password);
        } catch (error) {
          errorWhenUserMissing = error as AuthError;
        }

        // Case 2: User exists but password is wrong
        vi.clearAllMocks();
        const fakeUser = {
          id: '00000000-0000-0000-0000-000000000001',
          username,
          password_hash: '$2b$12$somehashvalue',
          role: 'Sales_Staff',
          assigned_branch_id: null,
          failed_login_attempts: 0,
          locked_until: null,
          last_activity: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockedQuery.mockResolvedValue({ rows: [fakeUser], rowCount: 1 } as any);
        mockedBcryptCompare.mockResolvedValue(false as never);

        let errorWhenPasswordWrong: AuthError | null = null;
        try {
          await authService.authenticate(username, password);
        } catch (error) {
          errorWhenPasswordWrong = error as AuthError;
        }

        // Both error responses MUST be identical
        expect(errorWhenUserMissing).not.toBeNull();
        expect(errorWhenPasswordWrong).not.toBeNull();
        expect(errorWhenUserMissing!.message).toBe(errorWhenPasswordWrong!.message);
        expect(errorWhenUserMissing!.statusCode).toBe(errorWhenPasswordWrong!.statusCode);
      }),
      { ...defaultPropertyConfig, numRuns: 100 }
    );
  });
});
