import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import { ensureIndexes } from '../../backend/src/database/indexes.js';
import { sampleUserDocuments, seedDocuments } from '../../backend/src/fixtures/database.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../../backend/src/fixtures/auth.js';
import { resetAuthRateLimits } from '../../backend/src/middleware/appRateLimits.js';
import { resetLockouts } from '../../backend/src/auth/lockoutService.js';
import { getApprovalRequestModel } from '../../backend/src/models/approvalRequestModel.js';
import { getAuditLogModel } from '../../backend/src/models/auditLogModel.js';
import { getConventionSettingsModel } from '../../backend/src/models/conventionSettingsModel.js';
import { getDivergenceRecordModel } from '../../backend/src/models/divergenceRecordModel.js';
import { getLockoutModel } from '../../backend/src/models/lockoutModel.js';
import { getRateLimitModel } from '../../backend/src/models/rateLimitModel.js';
import { getSessionModel } from '../../backend/src/models/sessionModel.js';
import { getTicketIntentModel } from '../../backend/src/models/ticketIntentModel.js';
import { getUserModel } from '../../backend/src/models/userModel.js';
import { eventBus } from '../../backend/src/services/events/eventBus.js';
import {
  startMemoryMongo,
  stopMemoryMongo,
} from '../../backend/src/testHelpers/memoryServer.js';
import { exchangeGitHubCode } from '../../backend/src/services/auth/githubAuthService.js';

export function installE2EApiHarness(): void {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getLockoutModel(),
      getRateLimitModel(),
      getConventionSettingsModel(),
      getTicketIntentModel(),
      getDivergenceRecordModel(),
      getApprovalRequestModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetAuthRateLimits();
    await resetLockouts();
    eventBus.clearHistory();

    await Promise.all([
      getUserModel().deleteMany({}),
      getSessionModel().deleteMany({}),
      getAuditLogModel().deleteMany({}),
      getLockoutModel().deleteMany({}),
      getRateLimitModel().deleteMany({}),
      getConventionSettingsModel().deleteMany({}),
      getTicketIntentModel().deleteMany({}),
      getDivergenceRecordModel().deleteMany({}),
      getApprovalRequestModel().deleteMany({}),
    ]);

    await seedDocuments(getUserModel(), sampleUserDocuments);

    vi.mocked(exchangeGitHubCode).mockResolvedValue({
      provider: 'github',
      providerUserId: String(mockGitHubUserResponse.id),
      email: mockGitHubUserResponse.email ?? 'alex.dev@example.com',
      displayName: mockGitHubUserResponse.name ?? mockGitHubUserResponse.login,
      accessToken: mockGitHubTokenResponse.access_token,
      refreshToken: mockGitHubTokenResponse.refresh_token,
      scopes: ['read:user', 'user:email', 'repo'],
    });
  });
}
