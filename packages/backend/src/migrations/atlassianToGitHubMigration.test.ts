import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import {
  alreadyFlaggedAtlassianUserFixture,
  atlassianOnlyUserFixture,
  dualProviderUserFixture,
  githubOnlyUserFixture,
} from '../fixtures/userMigration.js';
import { upsertUserFromOAuth } from '../services/auth/userAuthService.js';
import {
  isAtlassianOnlyUser,
  planMigrationChange,
  runAtlassianToGitHubMigration,
} from './atlassianToGitHubMigration.js';

describe('atlassianToGitHubMigration helpers', () => {
  it('identifies Atlassian-only users', () => {
    expect(isAtlassianOnlyUser(atlassianOnlyUserFixture)).toBe(true);
    expect(isAtlassianOnlyUser(githubOnlyUserFixture)).toBe(false);
    expect(isAtlassianOnlyUser(dualProviderUserFixture)).toBe(false);
  });

  it('plans flag for unflagged Atlassian-only users and skips GitHub users', () => {
    const flagPlan = planMigrationChange({
      _id: 'user-1',
      ...atlassianOnlyUserFixture,
    } as never);
    expect(flagPlan.action).toBe('flag_for_github_reauth');
    expect(flagPlan.next.requiresGitHubReauth).toBe(true);

    const skipPlan = planMigrationChange({
      _id: 'user-2',
      ...githubOnlyUserFixture,
    } as never);
    expect(skipPlan.action).toBe('skip_has_github');
  });
});

describe('atlassianToGitHubMigration (mongodb-memory-server)', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getUserModel().deleteMany({});
    // Bypass append-only Mongoose hooks for test isolation.
    await getAuditLogModel().collection.deleteMany({});
  });

  it('dry-run logs planned changes without modifying documents or writing audits', async () => {
    await getUserModel().create([
      atlassianOnlyUserFixture,
      githubOnlyUserFixture,
      dualProviderUserFixture,
    ]);

    const result = await runAtlassianToGitHubMigration('dry-run');

    expect(result.mode).toBe('dry-run');
    expect(result.scanned).toBe(3);
    expect(result.planned).toBe(1);
    expect(result.modified).toBe(0);

    const legacy = await getUserModel().findOne({ email: atlassianOnlyUserFixture.email }).exec();
    expect(legacy?.requiresGitHubReauth).toBeFalsy();
    expect(await getAuditLogModel().countDocuments()).toBe(0);
  });

  it('execute mode flags Atlassian-only users, preserves Jira tokens, writes audits, is idempotent', async () => {
    await getUserModel().create([
      atlassianOnlyUserFixture,
      alreadyFlaggedAtlassianUserFixture,
      githubOnlyUserFixture,
      dualProviderUserFixture,
    ]);

    const first = await runAtlassianToGitHubMigration('execute');
    expect(first.modified).toBe(1);
    expect(first.planned).toBe(1);

    const flagged = await getUserModel().findOne({ email: atlassianOnlyUserFixture.email }).exec();
    expect(flagged?.requiresGitHubReauth).toBe(true);
    expect(flagged?.atlassian?.encryptedAccessToken).toBe(
      atlassianOnlyUserFixture.atlassian?.encryptedAccessToken,
    );
    expect(flagged?.atlassian?.encryptedRefreshToken).toBe(
      atlassianOnlyUserFixture.atlassian?.encryptedRefreshToken,
    );

    const audits = await getAuditLogModel().find({}).exec();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.operation).toBe('update');
    expect(audits[0]?.previousValue).toMatchObject({ requiresGitHubReauth: false });
    expect(audits[0]?.newValue).toMatchObject({ requiresGitHubReauth: true });

    const second = await runAtlassianToGitHubMigration('execute');
    expect(second.modified).toBe(0);
    expect(await getAuditLogModel().countDocuments()).toBe(1);
  });

  it('GitHub re-auth merges by email, preserves Atlassian tokens, clears flag (no duplicate)', async () => {
    const created = await getUserModel().create({
      ...atlassianOnlyUserFixture,
      requiresGitHubReauth: true,
    });

    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const merged = await upsertUserFromOAuth({
      provider: 'github',
      providerUserId: '991122',
      email: atlassianOnlyUserFixture.email,
      displayName: 'Legacy via GitHub',
      accessToken: 'gho_test_access',
      refreshToken: 'gho_test_refresh',
      scopes: ['read:user', 'user:email'],
    });

    expect(String(merged._id)).toBe(String(created._id));
    expect(merged.connectedProviders).toEqual(expect.arrayContaining(['github', 'atlassian']));
    expect(merged.requiresGitHubReauth).toBe(false);
    expect(merged.atlassian?.encryptedAccessToken).toBe(
      atlassianOnlyUserFixture.atlassian?.encryptedAccessToken,
    );
    expect(merged.atlassian?.encryptedRefreshToken).toBe(
      atlassianOnlyUserFixture.atlassian?.encryptedRefreshToken,
    );
    expect(merged.github?.providerUserId).toBe('991122');

    expect(await getUserModel().countDocuments({ email: atlassianOnlyUserFixture.email })).toBe(1);
  });

  it('handles email conflicts by not creating a second user when GitHub email matches Atlassian user', async () => {
    await getUserModel().create({
      ...atlassianOnlyUserFixture,
      requiresGitHubReauth: true,
    });
    await getUserModel().create(githubOnlyUserFixture);

    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Different GitHub identity, same email as Atlassian legacy → merge, not insert
    await upsertUserFromOAuth({
      provider: 'github',
      providerUserId: 'conflict-merge',
      email: atlassianOnlyUserFixture.email,
      displayName: 'Merged',
      accessToken: 'gho_conflict',
      scopes: ['read:user'],
    });

    const all = await getUserModel().find({}).exec();
    expect(all).toHaveLength(2);
    const legacy = all.find((u) => u.email === atlassianOnlyUserFixture.email);
    expect(legacy?.github?.providerUserId).toBe('conflict-merge');
    expect(legacy?.connectedProviders).toContain('atlassian');
  });

  it('does not invalidate sessions — migration only updates user docs', async () => {
    const invalidateSpy = vi.fn();
    await getUserModel().create(atlassianOnlyUserFixture);

    await runAtlassianToGitHubMigration('execute');

    expect(invalidateSpy).not.toHaveBeenCalled();
    const user = await getUserModel().findOne({ email: atlassianOnlyUserFixture.email }).exec();
    expect(user?.requiresGitHubReauth).toBe(true);
  });
});
