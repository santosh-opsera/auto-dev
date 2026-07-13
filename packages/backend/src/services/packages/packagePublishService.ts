import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  DEFAULT_AUDIT_SEVERITY_THRESHOLD,
  type PackageDetectRequest,
  type PackageDetectResponse,
  type PackagePublishProposal,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import {
  getPackagePublishProposalModel,
  type PackagePublishProposalRecord,
} from '../../models/packagePublishProposalModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { validateAllowList } from './allowList.js';
import { detectAffectedPackages } from './packageDetection.js';
import { evaluateVulnerabilityScan } from './npmAuditParser.js';
import { analyzeVersionBump, buildChangelog } from './versionBump.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapProposal(
  doc: PackagePublishProposalRecord,
  confirmationToken?: string,
): PackagePublishProposal {
  const proposal: PackagePublishProposal = {
    id: doc._id.toString(),
    owner: doc.owner,
    repo: doc.repo,
    packagePath: doc.packagePath,
    packageName: doc.packageName,
    currentVersion: doc.currentVersion,
    proposedVersion: doc.proposedVersion,
    bump: doc.bump,
    changelog: doc.changelog,
    vulnerabilityScan: clonePlain(doc.vulnerabilityScan),
    allowList: clonePlain(doc.allowList),
    affectedFiles: [...doc.affectedFiles],
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  if (confirmationToken && (doc.status === 'proposed' || doc.status === 'confirmed')) {
    proposal.confirmationToken = confirmationToken;
  }

  if (doc.confirmedAt) {
    proposal.confirmedAt = doc.confirmedAt.toISOString();
  }

  if (doc.publishedAt) {
    proposal.publishedAt = doc.publishedAt.toISOString();
  }

  if (doc.publishSimulation) {
    proposal.publishSimulation = {
      registry: doc.publishSimulation.registry,
      tarballName: doc.publishSimulation.tarballName,
      simulated: true,
    };
  }

  return proposal;
}

function filesForPackage(
  changedFiles: readonly string[],
  packagePath: string,
): string[] {
  const root = packagePath.replace(/\\/g, '/');
  if (root === '.' || root === '') {
    return [...changedFiles];
  }
  return changedFiles.filter(
    (f) => f === root || f.startsWith(`${root}/`) || f.replace(/\\/g, '/').startsWith(`${root}/`),
  );
}

export class PackagePublishService {
  /**
   * Detect publishable packages affected by changes and create publish proposals.
   * Publishing is NEVER automatic — proposals wait for explicit confirm + publish.
   */
  async detect(
    user: UserDocument,
    request: PackageDetectRequest,
  ): Promise<PackageDetectResponse> {
    const snapshots = request.packageSnapshots ?? [];
    const detected = detectAffectedPackages(request.changedFiles, snapshots);
    const threshold = request.severityThreshold ?? DEFAULT_AUDIT_SEVERITY_THRESHOLD;

    const proposals: PackagePublishProposal[] = [];
    const skippedNonPublishable: PackageDetectResponse['skippedNonPublishable'] = [];

    for (const item of detected) {
      if (!item.publishable || !item.snapshot) {
        skippedNonPublishable.push({
          packagePath: item.packagePath,
          reason: item.reason ?? 'Not publishable',
        });
        continue;
      }

      const snapshot = item.snapshot;
      const affectedFiles = filesForPackage(request.changedFiles, snapshot.packagePath);
      const bumpAnalysis = analyzeVersionBump({
        currentVersion: snapshot.packageJson.version,
        changeHints: snapshot.changeHints ?? [],
        changedFiles: affectedFiles,
        useLlmStub: request.useLlmBumpStub === true,
      });

      const vulnerabilityScan = evaluateVulnerabilityScan(snapshot.auditReport, threshold);
      const allowList = validateAllowList({
        packagePath: snapshot.packagePath,
        filesField: snapshot.packageJson.files,
        npmignore: snapshot.npmignore,
        packageFiles: snapshot.packageFiles ?? affectedFiles,
      });

      const changelog = buildChangelog({
        packageName: snapshot.packageJson.name,
        proposedVersion: bumpAnalysis.proposedVersion,
        changeHints: snapshot.changeHints ?? affectedFiles,
        rationale: bumpAnalysis.rationale,
      });

      const confirmationToken = randomBytes(24).toString('hex');
      const status = vulnerabilityScan.blocked ? 'blocked' : 'proposed';

      const doc = await getPackagePublishProposalModel().create({
        userId: user._id.toString(),
        owner: request.owner,
        repo: request.repo,
        packagePath: snapshot.packagePath,
        packageName: snapshot.packageJson.name,
        currentVersion: snapshot.packageJson.version,
        proposedVersion: bumpAnalysis.proposedVersion,
        bump: bumpAnalysis.bump,
        changelog,
        vulnerabilityScan,
        allowList,
        affectedFiles,
        status,
        confirmationTokenHash: hashToken(confirmationToken),
        createdBy: user._id.toString(),
        updatedBy: user._id.toString(),
        dataClassification: 'internal',
      });

      await auditService.logSafe({
        actor: user._id.toString(),
        resource: `packages/proposals/${doc._id.toString()}`,
        operation: 'create',
        newValue: {
          packageName: snapshot.packageJson.name,
          status,
          proposedVersion: bumpAnalysis.proposedVersion,
          blocked: vulnerabilityScan.blocked,
        },
      });

      // Only return confirmation token for non-blocked proposals (still never auto-publish)
      proposals.push(
        mapProposal(doc, status === 'proposed' ? confirmationToken : undefined),
      );
    }

    return {
      owner: request.owner,
      repo: request.repo,
      proposals,
      skippedNonPublishable,
    };
  }

  async getProposal(user: UserDocument, proposalId: string): Promise<PackagePublishProposal> {
    const doc = await getPackagePublishProposalModel().findById(proposalId);
    if (!doc || doc.userId !== user._id.toString()) {
      throw new AppError(
        'PackageProposalNotFound',
        'Package publish proposal was not found.',
        404,
        'Verify the proposal id and retry.',
      );
    }

    return mapProposal(doc);
  }

  /**
   * Explicit user confirmation gate — required before publish. Never automatic.
   */
  async confirm(
    user: UserDocument,
    proposalId: string,
    confirmationToken: string,
  ): Promise<PackagePublishProposal> {
    const doc = await getPackagePublishProposalModel().findById(proposalId);
    if (!doc || doc.userId !== user._id.toString()) {
      throw new AppError(
        'PackageProposalNotFound',
        'Package publish proposal was not found.',
        404,
        'Verify the proposal id and retry.',
      );
    }

    if (doc.status === 'blocked') {
      throw new AppError(
        'PackagePublishBlocked',
        doc.vulnerabilityScan.summary,
        409,
        'Resolve vulnerabilities above the severity threshold, then create a new proposal.',
      );
    }

    if (doc.status === 'published') {
      throw new AppError(
        'PackageAlreadyPublished',
        'This proposal has already been published.',
        409,
        'Create a new detection proposal for subsequent releases.',
      );
    }

    if (!tokensEqual(doc.confirmationTokenHash, hashToken(confirmationToken))) {
      throw new AppError(
        'InvalidConfirmationToken',
        'Confirmation token is invalid.',
        403,
        'Use the confirmationToken returned from detect, then retry.',
      );
    }

    if (doc.status === 'confirmed') {
      return mapProposal(doc);
    }

    doc.status = 'confirmed';
    doc.confirmedAt = new Date();
    doc.updatedBy = user._id.toString();
    await doc.save();

    await auditService.logSafe({
      actor: user._id.toString(),
      resource: `packages/proposals/${doc._id.toString()}`,
      operation: 'update',
      newValue: { status: 'confirmed' },
    });

    return mapProposal(doc);
  }

  /**
   * Simulate npm publish AFTER confirm. Requires the same confirmation token.
   * Never runs automatically.
   */
  async publish(
    user: UserDocument,
    proposalId: string,
    confirmationToken: string,
  ): Promise<PackagePublishProposal> {
    const doc = await getPackagePublishProposalModel().findById(proposalId);
    if (!doc || doc.userId !== user._id.toString()) {
      throw new AppError(
        'PackageProposalNotFound',
        'Package publish proposal was not found.',
        404,
        'Verify the proposal id and retry.',
      );
    }

    if (doc.status === 'blocked') {
      throw new AppError(
        'PackagePublishBlocked',
        doc.vulnerabilityScan.summary,
        409,
        'Resolve vulnerabilities above the severity threshold, then create a new proposal.',
      );
    }

    if (!tokensEqual(doc.confirmationTokenHash, hashToken(confirmationToken))) {
      throw new AppError(
        'InvalidConfirmationToken',
        'Confirmation token is invalid.',
        403,
        'Use the confirmationToken returned from detect, then retry.',
      );
    }

    if (doc.status === 'proposed') {
      throw new AppError(
        'PackagePublishNotConfirmed',
        'Publishing requires explicit confirmation before publish.',
        409,
        'POST /api/v1/packages/proposals/:id/confirm with the confirmation token first.',
      );
    }

    if (doc.status === 'published') {
      return mapProposal(doc);
    }

    const safeName = doc.packageName.replace(/^@/, '').replace(/\//g, '-');
    doc.status = 'published';
    doc.publishedAt = new Date();
    doc.publishSimulation = {
      registry: 'https://registry.npmjs.org',
      tarballName: `${safeName}-${doc.proposedVersion}.tgz`,
      simulated: true,
    };
    doc.updatedBy = user._id.toString();
    await doc.save();

    await auditService.logSafe({
      actor: user._id.toString(),
      resource: `packages/proposals/${doc._id.toString()}`,
      operation: 'update',
      newValue: {
        status: 'published',
        proposedVersion: doc.proposedVersion,
        simulated: true,
      },
    });

    return mapProposal(doc);
  }
}

export const packagePublishService = new PackagePublishService();
