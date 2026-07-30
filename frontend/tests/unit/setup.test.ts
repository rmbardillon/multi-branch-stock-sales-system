import { describe, it, expect } from 'vitest';

describe('Frontend Test Setup', () => {
  it('should have jsdom environment available', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });

  it('should have matchMedia mock available', () => {
    expect(window.matchMedia).toBeDefined();
    const mql = window.matchMedia('(min-width: 768px)');
    expect(mql.matches).toBe(false);
    expect(mql.media).toBe('(min-width: 768px)');
  });

  it('should have IntersectionObserver mock available', () => {
    const observer = new IntersectionObserver(() => {});
    expect(observer.observe).toBeDefined();
    expect(observer.disconnect).toBeDefined();
  });

  it('should have ResizeObserver mock available', () => {
    const observer = new ResizeObserver(() => {});
    expect(observer.observe).toBeDefined();
    expect(observer.disconnect).toBeDefined();
  });
});
