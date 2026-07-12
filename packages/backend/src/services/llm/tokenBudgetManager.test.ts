import { describe, expect, it } from 'vitest';
import { AppError } from '../../utils/errors.js';
import { TokenBudgetManager } from './tokenBudgetManager.js';

describe('TokenBudgetManager', () => {
  it('enforces per-request token limits', () => {
    const budget = new TokenBudgetManager(10, 1000);
    expect(() => budget.assertWithinBudget(11)).toThrow(AppError);
  });

  it('enforces daily token limits and records usage', () => {
    const budget = new TokenBudgetManager(100, 50);
    budget.assertWithinBudget(40);
    budget.recordUsage(40);
    expect(budget.getDailyUsage()).toBe(40);
    expect(() => budget.assertWithinBudget(20)).toThrow(AppError);
  });
});
