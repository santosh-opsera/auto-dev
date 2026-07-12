import { AppError } from '../../utils/errors.js';

export class TokenBudgetManager {
  private dailyUsage = 0;
  private dayKey: string;
  private readonly perRequestLimit: number;
  private readonly dailyLimit: number;
  private readonly now: () => number;

  constructor(
    perRequestLimit = Number(process.env.LLM_PER_REQUEST_TOKEN_LIMIT ?? 8000),
    dailyLimit = Number(process.env.LLM_DAILY_TOKEN_LIMIT ?? 100_000),
    now: () => number = Date.now,
  ) {
    this.perRequestLimit = perRequestLimit;
    this.dailyLimit = dailyLimit;
    this.now = now;
    this.dayKey = this.currentDayKey();
  }

  assertWithinBudget(estimatedTokens: number): void {
    this.refreshDayWindow();

    if (estimatedTokens > this.perRequestLimit) {
      throw new AppError(
        'LlmTokenBudgetExceeded',
        `Request exceeds per-request token limit of ${String(this.perRequestLimit)}.`,
        429,
        'Reduce prompt size or raise LLM_PER_REQUEST_TOKEN_LIMIT.',
      );
    }

    if (this.dailyUsage + estimatedTokens > this.dailyLimit) {
      throw new AppError(
        'LlmTokenBudgetExceeded',
        `Request would exceed daily token limit of ${String(this.dailyLimit)}.`,
        429,
        'Wait until the next day or raise LLM_DAILY_TOKEN_LIMIT.',
      );
    }
  }

  recordUsage(totalTokens: number): void {
    this.refreshDayWindow();
    this.dailyUsage += Math.max(0, totalTokens);
  }

  getDailyUsage(): number {
    this.refreshDayWindow();
    return this.dailyUsage;
  }

  reset(): void {
    this.dailyUsage = 0;
    this.dayKey = this.currentDayKey();
  }

  private refreshDayWindow(): void {
    const nextKey = this.currentDayKey();
    if (nextKey !== this.dayKey) {
      this.dayKey = nextKey;
      this.dailyUsage = 0;
    }
  }

  private currentDayKey(): string {
    return new Date(this.now()).toISOString().slice(0, 10);
  }
}
