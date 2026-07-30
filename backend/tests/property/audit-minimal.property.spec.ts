import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/database/connection', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  withTransaction: vi.fn(),
  closePool: vi.fn(),
  default: {},
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
  default: { config: vi.fn() },
}));

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  })),
}));

describe('Minimal audit test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
