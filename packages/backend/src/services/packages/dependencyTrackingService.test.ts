import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  sampleDependencyScanRequest,
  samplePackageBumpNotifyRequest,
} from '@autodev/shared-types';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import {
  getDependencyEdgeModel,
  getDependencyUpdateProposalModel,
} from '../../models/dependencyTrackingModel.js';
import { getUserModel } from '../../models/userModel.js';
import { ensureIndexes } from '../../database/indexes.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { eventBus } from '../events/eventBus.js';
import { dependencyTrackingService } from './dependencyTrackingService.js';

describe('dependencyTrackingService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getDependencyEdgeModel(),
      getDependencyUpdateProposalModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getUserModel().deleteMany({});
    await getDependencyEdgeModel().deleteMany({});
    await getDependencyUpdateProposalModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
    eventBus.clearHistory();
  });

  it('scans repositories, persists graph, and returns consumers', async () => {
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email });
    expect(user).toBeTruthy();

    const scanned = await dependencyTrackingService.scanRepositories(
      user!,
      sampleDependencyScanRequest,
    );
    expect(scanned.graph.scannedRepositories).toBe(4);

    const consumers = await dependencyTrackingService.getConsumers(
      user!,
      '@autodev/shared-utils',
    );
    expect(consumers.count).toBe(3);
    expect(consumers.consumers.every((c) => c.packageName === '@autodev/shared-utils')).toBe(
      true,
    );
  });

  it('generates persisted proposals and emits DEPENDENCY_UPDATE_AVAILABLE on bump', async () => {
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email });
    await dependencyTrackingService.scanRepositories(user!, sampleDependencyScanRequest);

    const result = await dependencyTrackingService.proposeUpdatesForBump(
      user!,
      samplePackageBumpNotifyRequest,
    );

    expect(result.consumersIdentified).toBe(3);
    expect(result.proposals).toHaveLength(3);
    expect(result.proposals[0]!.changelogLink).toContain('1.3.0');
    expect(result.proposals.every((p) => p.status === 'proposed')).toBe(true);

    const persisted = await getDependencyUpdateProposalModel().find({
      userId: user!._id.toString(),
    });
    expect(persisted).toHaveLength(3);

    const events = eventBus.getHistory().filter((e) => e.type === 'DEPENDENCY_UPDATE_AVAILABLE');
    expect(events).toHaveLength(3);
    expect(events[0]!.payload).toMatchObject({
      packageName: '@autodev/shared-utils',
      proposedVersion: '1.3.0',
    });
  });

  it('lists outdated dependencies per consumer repository', async () => {
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email });
    await dependencyTrackingService.scanRepositories(user!, sampleDependencyScanRequest);
    await dependencyTrackingService.proposeUpdatesForBump(user!, samplePackageBumpNotifyRequest);

    const web = await dependencyTrackingService.getOutdatedDependencies(user!, 'acme', 'web-app');
    expect(web.count).toBe(1);
    expect(web.outdated[0]!.packageName).toBe('@autodev/shared-utils');
    expect(web.outdated[0]!.currentVersion).toBe('^1.2.3');
    expect(web.outdated[0]!.proposedVersion).toBe('1.3.0');

    const api = await dependencyTrackingService.getOutdatedDependencies(
      user!,
      'acme',
      'api-gateway',
    );
    expect(api.count).toBe(2);

    const docs = await dependencyTrackingService.getOutdatedDependencies(
      user!,
      'acme',
      'docs-site',
    );
    expect(docs.count).toBe(0);
  });

  it('skips proposals when consumer already on proposed version', async () => {
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email });
    await dependencyTrackingService.scanRepositories(user!, {
      repositories: [
        {
          owner: 'acme',
          repo: 'web-app',
          packageJsonFiles: [
            {
              path: 'package.json',
              packageJson: {
                name: '@acme/web-app',
                version: '1.0.0',
                dependencies: {
                  '@autodev/shared-utils': '1.3.0',
                },
              },
            },
          ],
        },
      ],
    });

    const result = await dependencyTrackingService.proposeUpdatesForBump(user!, {
      packageName: '@autodev/shared-utils',
      proposedVersion: '1.3.0',
      changelogLink: 'https://example.com/changelog#1.3.0',
    });

    expect(result.consumersIdentified).toBe(0);
    expect(result.proposals).toHaveLength(0);
    expect(eventBus.getHistory()).toHaveLength(0);
  });
});
