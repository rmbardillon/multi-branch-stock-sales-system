/**
 * Property-Based Tests: Password Validation Correctness
 *
 * Feature: multi-branch-stock-sales-system
 * Property 1: Password Validation Correctness
 *
 * For any string, the password validator SHALL accept it if and only if it has
 * 8-128 characters AND contains at least one uppercase letter AND at least one
 * lowercase letter AND at least one numeric digit.
 *
 * **Validates: Requirements 1.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { passwordSchema } from '../../src/types/schemas';
import {
  arbValidPassword,
  arbInvalidPassword,
  defaultPropertyConfig,
} from '../factories/arbitraries';

describe('Property 1: Password Validation Correctness', () => {
  /**
   * Helper: checks if a string meets all password requirements
   */
  function meetsPasswordRequirements(s: string): boolean {
    return (
      s.length >= 8 &&
      s.length <= 128 &&
      /[A-Z]/.test(s) &&
      /[a-z]/.test(s) &&
      /[0-9]/.test(s)
    );
  }

  it('should accept all valid passwords (8-128 chars, 1+ uppercase, 1+ lowercase, 1+ digit)', () => {
    fc.assert(
      fc.property(arbValidPassword, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      }),
      defaultPropertyConfig,
    );
  });

  it('should reject all invalid passwords (too short, too long, missing uppercase, missing lowercase, missing digit)', () => {
    fc.assert(
      fc.property(arbInvalidPassword, (password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      }),
      defaultPropertyConfig,
    );
  });

  it('should accept a string if and only if it meets all password conditions (bidirectional)', () => {
    // Generate arbitrary strings and verify the schema agrees with our reference implementation
    const arbAnyString = fc.oneof(
      // Short strings
      fc.string({ minLength: 0, maxLength: 10 }),
      // Medium strings in the valid length range
      fc.string({ minLength: 8, maxLength: 128 }),
      // Long strings
      fc.string({ minLength: 100, maxLength: 200 }),
      // Strings guaranteed to have some character classes
      arbValidPassword,
      arbInvalidPassword,
    );

    fc.assert(
      fc.property(arbAnyString, (password) => {
        const result = passwordSchema.safeParse(password);
        const shouldBeValid = meetsPasswordRequirements(password);

        expect(result.success).toBe(shouldBeValid);
      }),
      defaultPropertyConfig,
    );
  });
});
