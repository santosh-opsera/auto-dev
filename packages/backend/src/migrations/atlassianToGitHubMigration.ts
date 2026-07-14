import { auditService } from '../services/audit/auditService.js';
import { getUserModel, type UserRecord } from '../models/userModel.js';
import { logger } from '../utils/logger.js';

export type MigrationMode = 'dry-run' | 'execute';

export interface MigrationCandidateSnapshot {
  userId: string;
  email: string;
  connectedProviders: string[];
  requiresGitHubReauth: boolean;
  hasAtlassianTokens: boolean;
  hasGitHubProvider: boolean;
}

export interface MigrationChangePlan {
  userId: string;
  email: string;
  previous: MigrationCandidateSnapshot;
  next: MigrationCandidateSnapshot;
  action: 'flag_for_github_reauth' | 'noop_already_flagged' | 'skip_has_github';
}

export interface MigrationRunResult {
  mode: MigrationMode;
  scanned: number;
  planned: number;
  modified: number;
  skipped: number;
  changes: MigrationChangePlan[];
}

function toSnapshot(user: UserRecord): MigrationCandidateSnapshot {
  return {
    userId: String(user._id),
    email: user.email,
    connectedProviders: [...user.connectedProviders],
    requiresGitHubReauth: user.requiresGitHubReauth === true,
    hasAtlassianTokens: Boolean(
      user.atlassian?.encryptedAccessToken || user.atlassian?.encryptedRefreshToken,
    ),
    hasGitHubProvider: user.connectedProviders.includes('github') || Boolean(user.github),
  };
}

/**
 * Atlassian-only users: have Atlassian linked and do not yet have GitHub.
 * Dual-provider and GitHub-only users are not migration candidates.
 */
export function isAtlassianOnlyUser(user: {
  connectedProviders: string[];
  github?: unknown;
  atlassian?: unknown;
}): boolean {
  const hasAtlassian =
    user.connectedProviders.includes('atlassian') || Boolean(user.atlassian);
  const hasGitHub = user.connectedProviders.includes('github') || Boolean(user.github);
  return hasAtlassian && !hasGitHub;
}

export function planMigrationChange(user: UserRecord): MigrationChangePlan {
  const previous = toSnapshot(user);

  if (previous.hasGitHubProvider) {
    return {
      userId: previous.userId,
      email: previous.email,
      previous,
      next: previous,
      action: 'skip_has_github',
    };
  }

  if (previous.requiresGitHubReauth) {
    return {
      userId: previous.userId,
      email: previous.email,
      previous,
      next: previous,
      action: 'noop_already_flagged',
    };
  }

  return {
    userId: previous.userId,
    email: previous.email,
    previous,
    next: {
      ...previous,
      requiresGitHubReauth: true,
    },
    action: 'flag_for_github_reauth',
  };
}

/**
 * Idempotent Atlassian→GitHub migration.
 *
 * - dry-run: logs planned changes; no document writes; no audit entries
 * - execute: sets requiresGitHubReauth=true for Atlassian-only users; audit per change
 * - Does NOT invalidate sessions (active Atlassian sessions expire naturally)
 * - Does NOT modify encrypted Atlassian/Jira token fields
 */
export async function runAtlassianToGitHubMigration(
  mode: MigrationMode,
): Promise<MigrationRunResult> {
  const users = await getUserModel().find({}).exec();
  const changes: MigrationChangePlan[] = [];
  let modified = 0;
  let skipped = 0;

  for (const user of users) {
    if (!isAtlassianOnlyUser(user)) {
      skipped += 1;
      continue;
    }

    const plan = planMigrationChange(user);
    changes.push(plan);

    if (plan.action !== 'flag_for_github_reauth') {
      skipped += 1;
      logger.info(`Migration ${mode}: ${plan.action} for ${plan.email}`, {
        resource: 'users',
        operation: 'migration',
        actor: 'system',
      });
      continue;
    }

    logger.info(
      `Migration ${mode}: would flag ${plan.email} for GitHub re-auth (preserve Jira tokens=${String(plan.previous.hasAtlassianTokens)})`,
      {
        resource: 'users',
        operation: 'migration',
        actor: 'system',
      },
    );

    if (mode === 'dry-run') {
      continue;
    }

    const updated = await getUserModel()
      .findByIdAndUpdate(
        user._id,
        {
          requiresGitHubReauth: true,
          updatedBy: 'system:atlassian-to-github-migration',
        },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new Error(`Failed to flag user ${plan.email} during migration`);
    }

    // Confirm Jira tokens were not wiped by the update.
    if (
      plan.previous.hasAtlassianTokens &&
      !updated.atlassian?.encryptedAccessToken &&
      !updated.atlassian?.encryptedRefreshToken
    ) {
      throw new Error(`Migration wiped Atlassian tokens for ${plan.email}`);
    }

    await auditService.log({
      resource: `users/${plan.userId}`,
      operation: 'update',
      actor: 'system:atlassian-to-github-migration',
      previousValue: plan.previous,
      newValue: {
        ...plan.next,
        requiresGitHubReauth: updated.requiresGitHubReauth === true,
      },
      correlationId: `migration-atlassian-github-${plan.userId}`,
    });

    modified += 1;
  }

  const result: MigrationRunResult = {
    mode,
    scanned: users.length,
    planned: changes.filter((c) => c.action === 'flag_for_github_reauth').length,
    modified: mode === 'execute' ? modified : 0,
    skipped,
    changes,
  };

  logger.info(
    `Migration ${mode} complete: scanned=${String(result.scanned)} planned=${String(result.planned)} modified=${String(result.modified)} skipped=${String(result.skipped)}`,
    { resource: 'users', operation: 'migration', actor: 'system' },
  );

  return result;
}
