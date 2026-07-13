import { randomUUID } from 'node:crypto';
import {
  buildChangelogLink,
  isVersionOutdated,
  type DependencyConsumer,
  type DependencyGraph,
  type DependencyScanRequest,
  type DependencyScanResponse,
  type DependencyUpdateProposal,
  type OutdatedDependenciesResponse,
  type PackageBumpNotifyRequest,
  type PackageBumpNotifyResponse,
  type PackageConsumersResponse,
  type DependencyUpdateProposalListResponse,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import {
  getDependencyEdgeModel,
  getDependencyUpdateProposalModel,
  type DependencyUpdateProposalRecord,
} from '../../models/dependencyTrackingModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '../events/eventBus.js';
import { buildDependencyGraph, findConsumers } from './dependencyGraph.js';

function mapProposal(doc: DependencyUpdateProposalRecord): DependencyUpdateProposal {
  const proposal: DependencyUpdateProposal = {
    id: doc._id.toString(),
    packageName: doc.packageName,
    currentVersion: doc.currentVersion,
    proposedVersion: doc.proposedVersion,
    changelogLink: doc.changelogLink,
    owner: doc.owner,
    repo: doc.repo,
    packagePath: doc.packagePath,
    dependencyField: doc.dependencyField,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  if (doc.sourceOwner) {
    proposal.sourceOwner = doc.sourceOwner;
  }
  if (doc.sourceRepo) {
    proposal.sourceRepo = doc.sourceRepo;
  }

  return proposal;
}

function graphFromEdges(
  edges: Array<{
    packageName: string;
    owner: string;
    repo: string;
    packagePath: string;
    dependencyField: DependencyConsumer['dependencyField'];
    currentVersion: string;
  }>,
  scannedRepositories: number,
  scannedPackageJsonFiles: number,
): DependencyGraph {
  const byPackage = new Map<string, DependencyConsumer[]>();
  for (const edge of edges) {
    const consumer: DependencyConsumer = {
      packageName: edge.packageName,
      owner: edge.owner,
      repo: edge.repo,
      packagePath: edge.packagePath,
      dependencyField: edge.dependencyField,
      currentVersion: edge.currentVersion,
    };
    const list = byPackage.get(edge.packageName) ?? [];
    list.push(consumer);
    byPackage.set(edge.packageName, list);
  }

  const packages = [...byPackage.entries()]
    .map(([packageName, consumers]) => ({ packageName, consumers }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));

  return {
    packages,
    scannedRepositories,
    scannedPackageJsonFiles,
    edgeCount: edges.length,
  };
}

export class DependencyTrackingService {
  /**
   * Scan connected repository package.json snapshots and persist package→consumer edges.
   */
  async scanRepositories(
    user: UserDocument,
    request: DependencyScanRequest,
  ): Promise<DependencyScanResponse> {
    const graph = buildDependencyGraph(request.repositories);
    const userId = user._id.toString();

    await getDependencyEdgeModel().deleteMany({ userId });

    if (graph.edgeCount > 0) {
      const docs = graph.packages.flatMap((node) =>
        node.consumers.map((consumer) => ({
          userId,
          packageName: consumer.packageName,
          owner: consumer.owner,
          repo: consumer.repo,
          packagePath: consumer.packagePath,
          dependencyField: consumer.dependencyField,
          currentVersion: consumer.currentVersion,
          createdBy: userId,
          updatedBy: userId,
          dataClassification: 'internal' as const,
        })),
      );
      await getDependencyEdgeModel().insertMany(docs);
    }

    await auditService.logSafe({
      actor: userId,
      resource: 'packages/dependency-graph',
      operation: 'create',
      newValue: {
        scannedRepositories: graph.scannedRepositories,
        edgeCount: graph.edgeCount,
      },
    });

    return { graph };
  }

  async getPersistedGraph(user: UserDocument): Promise<DependencyGraph> {
    const userId = user._id.toString();
    const edges = await getDependencyEdgeModel().find({ userId }).lean();
    const repoKeys = new Set(edges.map((e) => `${e.owner}/${e.repo}`));
    const fileKeys = new Set(edges.map((e) => `${e.owner}/${e.repo}:${e.packagePath}`));
    return graphFromEdges(
      edges.map((e) => ({
        packageName: e.packageName,
        owner: e.owner,
        repo: e.repo,
        packagePath: e.packagePath,
        dependencyField: e.dependencyField,
        currentVersion: e.currentVersion,
      })),
      repoKeys.size,
      fileKeys.size,
    );
  }

  async getConsumers(user: UserDocument, packageName: string): Promise<PackageConsumersResponse> {
    const normalized = decodeURIComponent(packageName).trim();
    if (!normalized) {
      throw new AppError(
        'InvalidPackageName',
        'Package name is required.',
        400,
        'Provide a non-empty package name.',
      );
    }

    const edges = await getDependencyEdgeModel()
      .find({ userId: user._id.toString(), packageName: normalized })
      .lean();

    const consumers: DependencyConsumer[] = edges.map((e) => ({
      owner: e.owner,
      repo: e.repo,
      packagePath: e.packagePath,
      dependencyField: e.dependencyField,
      packageName: e.packageName,
      currentVersion: e.currentVersion,
    }));

    return {
      packageName: normalized,
      consumers,
      count: consumers.length,
    };
  }

  /**
   * When a package version is bumped, identify consumers and persist update proposals.
   * Emits DEPENDENCY_UPDATE_AVAILABLE for each affected repository consumer.
   */
  async proposeUpdatesForBump(
    user: UserDocument,
    request: PackageBumpNotifyRequest,
  ): Promise<PackageBumpNotifyResponse> {
    const userId = user._id.toString();
    const packageName = request.packageName.trim();
    const changelogLink =
      request.changelogLink.trim() || buildChangelogLink(packageName, request.proposedVersion);

    const edges = await getDependencyEdgeModel().find({ userId, packageName }).lean();
    const consumers = edges.filter((edge) =>
      isVersionOutdated(edge.currentVersion, request.proposedVersion),
    );

    const proposals: DependencyUpdateProposal[] = [];

    for (const consumer of consumers) {
      const existing = await getDependencyUpdateProposalModel().findOne({
        userId,
        packageName,
        owner: consumer.owner,
        repo: consumer.repo,
        packagePath: consumer.packagePath,
        dependencyField: consumer.dependencyField,
        proposedVersion: request.proposedVersion,
        status: 'proposed',
      });

      let doc = existing;
      if (!doc) {
        doc = await getDependencyUpdateProposalModel().create({
          userId,
          packageName,
          currentVersion: consumer.currentVersion,
          proposedVersion: request.proposedVersion,
          changelogLink,
          owner: consumer.owner,
          repo: consumer.repo,
          packagePath: consumer.packagePath,
          dependencyField: consumer.dependencyField,
          status: 'proposed',
          sourceOwner: request.sourceOwner,
          sourceRepo: request.sourceRepo,
          createdBy: userId,
          updatedBy: userId,
          dataClassification: 'internal',
        });
      }

      const proposal = mapProposal(doc);
      proposals.push(proposal);

      await eventBus.publish(
        {
          type: 'DEPENDENCY_UPDATE_AVAILABLE',
          payload: {
            proposalId: proposal.id,
            packageName: proposal.packageName,
            currentVersion: proposal.currentVersion,
            proposedVersion: proposal.proposedVersion,
            changelogLink: proposal.changelogLink,
            owner: proposal.owner,
            repo: proposal.repo,
            packagePath: proposal.packagePath,
          },
          metadata: {
            eventId: randomUUID(),
            correlationId: `dep-update:${packageName}:${proposal.owner}/${proposal.repo}`,
            actor: userId,
            userId,
            timestamp: new Date().toISOString(),
          },
        },
        { awaitHandlers: true },
      );
    }

    await auditService.logSafe({
      actor: userId,
      resource: `packages/${packageName}/dependency-updates`,
      operation: 'create',
      newValue: {
        packageName,
        proposedVersion: request.proposedVersion,
        proposalCount: proposals.length,
      },
    });

    return {
      packageName,
      proposedVersion: request.proposedVersion,
      consumersIdentified: consumers.length,
      proposals,
    };
  }

  async getOutdatedDependencies(
    user: UserDocument,
    owner: string,
    repo: string,
  ): Promise<OutdatedDependenciesResponse> {
    const proposals = await getDependencyUpdateProposalModel()
      .find({
        userId: user._id.toString(),
        owner,
        repo,
        status: 'proposed',
      })
      .sort({ createdAt: -1 });

    const outdated = proposals.map(mapProposal);
    return {
      owner,
      repo,
      outdated,
      count: outdated.length,
    };
  }

  async listProposals(user: UserDocument): Promise<DependencyUpdateProposalListResponse> {
    const docs = await getDependencyUpdateProposalModel()
      .find({ userId: user._id.toString() })
      .sort({ createdAt: -1 });
    return { proposals: docs.map(mapProposal) };
  }

  async getProposal(user: UserDocument, proposalId: string): Promise<DependencyUpdateProposal> {
    const doc = await getDependencyUpdateProposalModel().findById(proposalId);
    if (!doc || doc.userId !== user._id.toString()) {
      throw new AppError(
        'DependencyUpdateNotFound',
        'Dependency update proposal was not found.',
        404,
        'Verify the proposal id and retry.',
      );
    }
    return mapProposal(doc);
  }
}

export const dependencyTrackingService = new DependencyTrackingService();

/** Pure helpers re-exported for unit tests. */
export { buildDependencyGraph, findConsumers };
