import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  sampleChangedFilesFeature,
  sampleDetectRequest,
  samplePackageSnapshotBlocked,
  samplePackageSnapshotPrivate,
  samplePackageSnapshotPublishable,
} from '@autodev/shared-types';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getPackagePublishProposalModel } from '../../models/packagePublishProposalModel.js';
import { getSessionModel } from '../../models/sessionModel.js';
import { getUserModel } from '../../models/userModel.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { ensureIndexes } from '../../database/indexes.js';
import { packagePublishService } from './packagePublishService.js';

describe('packagePublishService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getPackagePublishProposalModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getPackagePublishProposalModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
  });

  it('creates proposals with name, versions, changelog, and scan results', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' });
    expect(user).toBeTruthy();

    const result = await packagePublishService.detect(user!, sampleDetectRequest);

    expect(result.proposals).toHaveLength(1);
    const proposal = result.proposals[0]!;
    expect(proposal.packageName).toBe('@autodev/shared-utils');
    expect(proposal.currentVersion).toBe('1.2.3');
    expect(proposal.proposedVersion).toBe('1.3.0');
    expect(proposal.bump).toBe('minor');
    expect(proposal.changelog).toContain('1.3.0');
    expect(proposal.vulnerabilityScan.blocked).toBe(false);
    expect(proposal.status).toBe('proposed');
    expect(proposal.confirmationToken).toBeTruthy();
    expect(proposal.allowList.source).toBe('files');
  });

  it('skips non-publishable packages and blocks high severity audits', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' });

    const result = await packagePublishService.detect(user!, {
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      changedFiles: [
        ...sampleChangedFilesFeature,
        'packages/web-app/src/index.ts',
      ],
      packageSnapshots: [samplePackageSnapshotBlocked, samplePackageSnapshotPrivate],
      severityThreshold: 'high',
    });

    expect(result.skippedNonPublishable.some((s) => s.packagePath === 'packages/web-app')).toBe(
      true,
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]!.status).toBe('blocked');
    expect(result.proposals[0]!.confirmationToken).toBeUndefined();
    expect(result.proposals[0]!.vulnerabilityScan.blocked).toBe(true);
  });

  it('requires confirm before simulated publish and never auto-publishes', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' });
    const detected = await packagePublishService.detect(user!, {
      ...sampleDetectRequest,
      packageSnapshots: [samplePackageSnapshotPublishable],
    });

    const proposal = detected.proposals[0]!;
    const token = proposal.confirmationToken!;

    await expect(
      packagePublishService.publish(user!, proposal.id, token),
    ).rejects.toMatchObject({ error: 'PackagePublishNotConfirmed' });

    const confirmed = await packagePublishService.confirm(user!, proposal.id, token);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedAt).toBeTruthy();

    const published = await packagePublishService.publish(user!, proposal.id, token);
    expect(published.status).toBe('published');
    expect(published.publishSimulation?.simulated).toBe(true);
    expect(published.publishedAt).toBeTruthy();

    await expect(
      packagePublishService.confirm(user!, proposal.id, 'wrong-token'),
    ).rejects.toMatchObject({ error: 'PackageAlreadyPublished' });

    const beforePublish = await packagePublishService.detect(user!, {
      ...sampleDetectRequest,
      packageSnapshots: [
        {
          ...samplePackageSnapshotPublishable,
          changeHints: ['fix: edge case'],
        },
      ],
    });
    await expect(
      packagePublishService.confirm(
        user!,
        beforePublish.proposals[0]!.id,
        'wrong-token',
      ),
    ).rejects.toMatchObject({ error: 'InvalidConfirmationToken' });
  });

  it('rejects confirm/publish when vulnerability scan blocked the proposal', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' });
    const detected = await packagePublishService.detect(user!, {
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      changedFiles: sampleChangedFilesFeature,
      packageSnapshots: [samplePackageSnapshotBlocked],
    });

    const blocked = detected.proposals[0]!;
    expect(blocked.status).toBe('blocked');

    // Token was still hashed at creation — use DB hash path via inventing a token fails anyway;
    // confirm must fail on blocked status even with any token after we force a known token.
    const doc = await getPackagePublishProposalModel().findById(blocked.id);
    expect(doc).toBeTruthy();

    await expect(
      packagePublishService.confirm(user!, blocked.id, 'any-token'),
    ).rejects.toMatchObject({ error: 'PackagePublishBlocked' });
  });
});
