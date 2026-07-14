import { createHash, randomUUID } from 'node:crypto';
import {
  DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  type DeploymentCreateRequest,
  type DeploymentResponse,
  type DeploymentStatus,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import {
  getDeploymentModel,
  type DeploymentRecord,
} from '../../models/deploymentModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '@autodev/infrastructure';
import {
  DEFAULT_COMPOSE_FILE,
  DEFAULT_HEALTH_CHECK_PATH,
  buildComposeBuildCommand,
  buildComposeDownCommand,
  buildComposeLogsCommand,
  buildComposeUpCommand,
  sanitizeProjectName,
} from './composeCommands.js';
import type { DockerClient } from './dockerClient.js';
import { MockDockerClient, ProcessDockerClient } from './dockerClient.js';
import {
  type HealthChecker,
  FetchHealthChecker,
  MockHealthChecker,
  buildHealthCheckUrl,
  waitForHealthy,
} from './healthCheck.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function appendLogs(...parts: Array<string | undefined>): string {
  return parts.filter((part) => part && part.trim().length > 0).join('\n');
}

function mapDeployment(doc: DeploymentRecord): DeploymentResponse {
  const response: DeploymentResponse = {
    id: doc._id.toString(),
    workflowId: doc.workflowId,
    branch: doc.branch,
    status: doc.status,
    baseUrl: doc.baseUrl,
    composeFile: doc.composeFile,
    projectName: doc.projectName,
    healthCheckPath: doc.healthCheckPath,
    confirmed: true,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  if (doc.logs) {
    response.logs = doc.logs;
  }
  if (doc.error) {
    response.error = {
      message: doc.error.message,
      ...(doc.error.code ? { code: doc.error.code } : {}),
      ...(doc.error.phase ? { phase: doc.error.phase } : {}),
    };
  }
  if (doc.startedAt) {
    response.startedAt = doc.startedAt.toISOString();
  }
  if (doc.completedAt) {
    response.completedAt = doc.completedAt.toISOString();
  }
  if (doc.stoppedAt) {
    response.stoppedAt = doc.stoppedAt.toISOString();
  }

  return response;
}

export interface DeploymentServiceDeps {
  dockerClient?: DockerClient;
  healthChecker?: HealthChecker;
  healthMaxAttempts?: number;
  healthDelayMs?: number;
  /** When true (default in tests), run the deploy pipeline synchronously. */
  awaitPipeline?: boolean;
}

export class DeploymentService {
  private dockerClient: DockerClient;
  private healthChecker: HealthChecker;
  private healthMaxAttempts: number;
  private healthDelayMs: number;
  private awaitPipeline: boolean;

  constructor(deps: DeploymentServiceDeps = {}) {
    const useMocks = process.env.NODE_ENV === 'test';
    this.dockerClient =
      deps.dockerClient ?? (useMocks ? new MockDockerClient() : new ProcessDockerClient());
    this.healthChecker =
      deps.healthChecker ?? (useMocks ? new MockHealthChecker() : new FetchHealthChecker());
    this.healthMaxAttempts = deps.healthMaxAttempts ?? (useMocks ? 3 : 10);
    this.healthDelayMs = deps.healthDelayMs ?? (useMocks ? 0 : 1_000);
    this.awaitPipeline = deps.awaitPipeline ?? useMocks;
  }

  /** Test helper to swap Docker / health dependencies. */
  setDeps(deps: DeploymentServiceDeps): void {
    if (deps.dockerClient) {
      this.dockerClient = deps.dockerClient;
    }
    if (deps.healthChecker) {
      this.healthChecker = deps.healthChecker;
    }
    if (deps.healthMaxAttempts !== undefined) {
      this.healthMaxAttempts = deps.healthMaxAttempts;
    }
    if (deps.healthDelayMs !== undefined) {
      this.healthDelayMs = deps.healthDelayMs;
    }
    if (deps.awaitPipeline !== undefined) {
      this.awaitPipeline = deps.awaitPipeline;
    }
  }

  /**
   * Start a local deployment. Requires explicit confirmationToken — never automatic.
   */
  async create(user: UserDocument, request: DeploymentCreateRequest): Promise<DeploymentResponse> {
    const userId = user._id.toString();
    const confirmationToken = request.confirmationToken?.trim();
    if (!confirmationToken || confirmationToken.length < 8) {
      throw new AppError(
        'DeploymentConfirmationRequired',
        'Local deployment requires explicit user confirmation via confirmationToken.',
        400,
        'Include confirmationToken (min 8 characters) in POST /api/v1/deployments. Deployments never start automatically.',
      );
    }

    const baseUrl = request.baseUrl?.trim() || DEFAULT_LOCAL_DEPLOYMENT_BASE_URL;
    const composeFile = request.composeFile?.trim() || DEFAULT_COMPOSE_FILE;
    const projectDir = request.projectDir?.trim() || process.cwd();
    const projectName = sanitizeProjectName(request.workflowId);
    const now = new Date();

    const doc = await getDeploymentModel().create({
      userId,
      workflowId: request.workflowId,
      branch: request.branch,
      status: 'PENDING' satisfies DeploymentStatus,
      baseUrl,
      composeFile,
      projectName,
      projectDir,
      healthCheckPath: DEFAULT_HEALTH_CHECK_PATH,
      confirmationTokenHash: hashToken(confirmationToken),
      confirmed: true,
      startedAt: now,
      createdBy: userId,
      updatedBy: userId,
      dataClassification: 'internal',
    });

    await eventBus.publish(
      {
        type: 'DEPLOYMENT_STARTED',
        payload: {
          deploymentId: doc._id.toString(),
          workflowId: doc.workflowId,
          branch: doc.branch,
          baseUrl: doc.baseUrl,
        },
        metadata: {
          eventId: randomUUID(),
          correlationId: `deployment:${doc._id.toString()}`,
          actor: userId,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
      { awaitHandlers: true },
    );

    await auditService.logSafe({
      actor: userId,
      resource: `deployments/${doc._id.toString()}`,
      operation: 'create',
      newValue: { workflowId: doc.workflowId, branch: doc.branch, status: doc.status },
      correlationId: `deployment:${doc._id.toString()}`,
    });

    if (this.awaitPipeline) {
      await this.runPipeline(doc._id.toString(), userId);
      const refreshed = await getDeploymentModel().findById(doc._id);
      if (!refreshed) {
        throw new AppError(
          'DeploymentNotFound',
          'Deployment disappeared during pipeline.',
          500,
          'Retry the deployment request.',
        );
      }
      return mapDeployment(refreshed);
    }

    void this.runPipeline(doc._id.toString(), userId);
    return mapDeployment(doc);
  }

  async get(user: UserDocument, id: string): Promise<DeploymentResponse> {
    const doc = await this.findOwned(user, id);
    return mapDeployment(doc);
  }

  async stop(user: UserDocument, id: string): Promise<DeploymentResponse> {
    const doc = await this.findOwned(user, id);
    const userId = user._id.toString();

    if (doc.status === 'STOPPED') {
      return mapDeployment(doc);
    }

    if (doc.status === 'FAILED') {
      throw new AppError(
        'DeploymentNotRunning',
        'Cannot stop a failed deployment.',
        409,
        'Create a new deployment after fixing the failure.',
      );
    }

    const previousStatus = doc.status;
    const downCmd = buildComposeDownCommand({
      composeFile: doc.composeFile,
      projectName: doc.projectName,
      cwd: doc.projectDir,
    });
    const downResult = await this.dockerClient.down(downCmd);
    const logs = appendLogs(doc.logs, downResult.stdout, downResult.stderr);

    doc.status = 'STOPPED';
    doc.logs = logs;
    doc.stoppedAt = new Date();
    doc.updatedBy = userId;
    await doc.save();

    await auditService.logSafe({
      actor: userId,
      resource: `deployments/${doc._id.toString()}`,
      operation: 'update',
      previousValue: { status: previousStatus },
      newValue: { status: 'STOPPED' },
      correlationId: `deployment:${doc._id.toString()}`,
    });

    return mapDeployment(doc);
  }

  private async findOwned(user: UserDocument, id: string): Promise<DeploymentRecord> {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new AppError(
        'DeploymentNotFound',
        'Deployment not found.',
        404,
        'Verify the deployment id and retry.',
      );
    }

    const doc = await getDeploymentModel().findOne({
      _id: id,
      userId: user._id.toString(),
    });

    if (!doc) {
      throw new AppError(
        'DeploymentNotFound',
        'Deployment not found.',
        404,
        'Verify the deployment id and retry.',
      );
    }

    return doc;
  }

  private async runPipeline(deploymentId: string, userId: string): Promise<void> {
    const doc = await getDeploymentModel().findById(deploymentId);
    if (!doc) {
      return;
    }

    const cmdInput = {
      composeFile: doc.composeFile,
      projectName: doc.projectName,
      cwd: doc.projectDir,
      branch: doc.branch,
      baseUrl: doc.baseUrl,
    };

    try {
      doc.status = 'BUILDING';
      doc.updatedBy = userId;
      await doc.save();

      const buildCmd = buildComposeBuildCommand(cmdInput);
      const buildResult = await this.dockerClient.build(buildCmd);
      doc.logs = appendLogs(doc.logs, buildResult.stdout, buildResult.stderr);
      if (buildResult.exitCode !== 0) {
        await this.failDeployment(doc, userId, {
          message: 'Docker Compose build failed',
          code: 'DEPLOY_BUILD_FAILED',
          phase: 'BUILDING',
        });
        return;
      }

      doc.status = 'DEPLOYING';
      doc.updatedBy = userId;
      await doc.save();

      const upCmd = buildComposeUpCommand(cmdInput);
      const upResult = await this.dockerClient.up(upCmd);
      doc.logs = appendLogs(doc.logs, upResult.stdout, upResult.stderr);
      if (upResult.exitCode !== 0) {
        await this.failDeployment(doc, userId, {
          message: 'Docker Compose up failed',
          code: 'DEPLOY_UP_FAILED',
          phase: 'DEPLOYING',
        });
        return;
      }

      const healthUrl = buildHealthCheckUrl(doc.baseUrl, doc.healthCheckPath);
      const health = await waitForHealthy({
        url: healthUrl,
        checker: this.healthChecker,
        maxAttempts: this.healthMaxAttempts,
        delayMs: this.healthDelayMs,
      });

      if (!health.healthy) {
        const logsCmd = buildComposeLogsCommand({
          composeFile: doc.composeFile,
          projectName: doc.projectName,
          cwd: doc.projectDir,
        });
        const logsResult = await this.dockerClient.logs(logsCmd);
        doc.logs = appendLogs(doc.logs, logsResult.stdout, logsResult.stderr);
        await this.failDeployment(doc, userId, {
          message: health.lastError ?? 'Health check failed before RUNNING',
          code: 'DEPLOY_HEALTH_FAILED',
          phase: 'DEPLOYING',
        });
        return;
      }

      doc.status = 'RUNNING';
      doc.completedAt = new Date();
      doc.updatedBy = userId;
      await doc.save();

      await eventBus.publish(
        {
          type: 'DEPLOYMENT_COMPLETED',
          payload: {
            deploymentId: doc._id.toString(),
            workflowId: doc.workflowId,
            branch: doc.branch,
            baseUrl: doc.baseUrl,
            status: 'RUNNING',
          },
          metadata: {
            eventId: randomUUID(),
            correlationId: `deployment:${doc._id.toString()}`,
            actor: userId,
            userId,
            timestamp: new Date().toISOString(),
          },
        },
        { awaitHandlers: true },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected deployment failure';
      await this.failDeployment(doc, userId, {
        message,
        code: 'DEPLOY_UNEXPECTED',
        phase: doc.status,
      });
    }
  }

  private async failDeployment(
    doc: DeploymentRecord,
    userId: string,
    error: { message: string; code: string; phase: DeploymentStatus },
  ): Promise<void> {
    doc.status = 'FAILED';
    doc.error = error;
    doc.completedAt = new Date();
    doc.updatedBy = userId;
    await doc.save();

    await eventBus.publish(
      {
        type: 'DEPLOYMENT_FAILED',
        payload: {
          deploymentId: doc._id.toString(),
          workflowId: doc.workflowId,
          branch: doc.branch,
          baseUrl: doc.baseUrl,
          errorMessage: error.message,
          errorCode: error.code,
          phase: error.phase,
        },
        metadata: {
          eventId: randomUUID(),
          correlationId: `deployment:${doc._id.toString()}`,
          actor: userId,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
      { awaitHandlers: true },
    );
  }
}

export const deploymentService = new DeploymentService();
