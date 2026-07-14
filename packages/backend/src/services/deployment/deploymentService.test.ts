import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  sampleDeploymentCreateRequest,
  sampleDockerBuildFailureOutput,
} from '@autodev/shared-types';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getDeploymentModel } from '../../models/deploymentModel.js';
import { getSessionModel } from '../../models/sessionModel.js';
import { getUserModel } from '../../models/userModel.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { ensureIndexes } from '../../database/indexes.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { eventBus } from '@autodev/infrastructure';
import { MockDockerClient } from './dockerClient.js';
import { MockHealthChecker } from './healthCheck.js';
import { DeploymentService } from './deploymentService.js';

describe('DeploymentService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getDeploymentModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getDeploymentModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
  });

  async function getUser() {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' });
    if (!user) {
      throw new Error('seed user missing');
    }
    return user;
  }

  it('requires explicit confirmation and never auto-deploys without token', async () => {
    const service = new DeploymentService({
      dockerClient: new MockDockerClient(),
      healthChecker: new MockHealthChecker(),
      awaitPipeline: true,
    });
    const user = await getUser();

    await expect(
      service.create(user, {
        workflowId: 'workflow-001',
        branch: 'feature/x',
        confirmationToken: '',
      } as never),
    ).rejects.toMatchObject({ error: 'DeploymentConfirmationRequired' });
  });

  it('transitions PENDING → BUILDING → DEPLOYING → RUNNING with health check', async () => {
    const docker = new MockDockerClient({ scenario: 'success' });
    const service = new DeploymentService({
      dockerClient: docker,
      healthChecker: new MockHealthChecker({
        outcomes: [
          { ok: false, statusCode: 503 },
          { ok: true, statusCode: 200 },
        ],
      }),
      healthMaxAttempts: 3,
      awaitPipeline: true,
    });
    const user = await getUser();

    const result = await service.create(user, {
      ...sampleDeploymentCreateRequest,
      projectDir: '/tmp/autodev-qa',
    });

    expect(result.status).toBe('RUNNING');
    expect(result.confirmed).toBe(true);
    expect(result.baseUrl).toBe('http://localhost:4000');
    expect(result.logs).toBeTruthy();
    expect(docker.calls.map((c) => c.operation)).toEqual(['build', 'up']);

    const history = eventBus.getHistory().map((e) => e.type);
    expect(history).toContain('DEPLOYMENT_STARTED');
    expect(history).toContain('DEPLOYMENT_COMPLETED');
    expect(history).not.toContain('DEPLOYMENT_FAILED');
  });

  it('marks FAILED with build logs when compose build fails', async () => {
    const docker = new MockDockerClient({
      scenario: 'build_failure',
      buildStdout: sampleDockerBuildFailureOutput,
    });
    const service = new DeploymentService({
      dockerClient: docker,
      healthChecker: new MockHealthChecker(),
      awaitPipeline: true,
    });
    const user = await getUser();

    const result = await service.create(user, {
      ...sampleDeploymentCreateRequest,
      confirmationToken: 'confirm-fail-001',
      projectDir: '/tmp/autodev-qa',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('DEPLOY_BUILD_FAILED');
    expect(result.logs).toContain('ERESOLVE');
    expect(eventBus.getHistory().map((e) => e.type)).toContain('DEPLOYMENT_FAILED');
  });

  it('fails when health checks never pass and includes container logs', async () => {
    const docker = new MockDockerClient({
      scenario: 'success',
      logsStdout: 'app-1  | Error: listen EADDRINUSE\n',
    });
    const service = new DeploymentService({
      dockerClient: docker,
      healthChecker: new MockHealthChecker({
        outcomes: [{ ok: false, statusCode: 503, error: 'unhealthy' }],
      }),
      healthMaxAttempts: 2,
      awaitPipeline: true,
    });
    const user = await getUser();

    const result = await service.create(user, {
      ...sampleDeploymentCreateRequest,
      confirmationToken: 'confirm-health-001',
      projectDir: '/tmp/autodev-qa',
    });

    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('DEPLOY_HEALTH_FAILED');
    expect(result.logs).toContain('EADDRINUSE');
    expect(docker.calls.map((c) => c.operation)).toEqual(['build', 'up', 'logs']);
  });

  it('stops a running deployment via compose down', async () => {
    const docker = new MockDockerClient();
    const service = new DeploymentService({
      dockerClient: docker,
      healthChecker: new MockHealthChecker(),
      awaitPipeline: true,
    });
    const user = await getUser();

    const created = await service.create(user, {
      ...sampleDeploymentCreateRequest,
      confirmationToken: 'confirm-stop-001',
      projectDir: '/tmp/autodev-qa',
    });
    expect(created.status).toBe('RUNNING');

    const stopped = await service.stop(user, created.id);
    expect(stopped.status).toBe('STOPPED');
    expect(stopped.stoppedAt).toBeTruthy();
    expect(docker.calls.some((c) => c.operation === 'down')).toBe(true);
  });

  it('uses configurable baseUrl when provided', async () => {
    const service = new DeploymentService({
      dockerClient: new MockDockerClient(),
      healthChecker: new MockHealthChecker(),
      awaitPipeline: true,
    });
    const user = await getUser();

    const result = await service.create(user, {
      ...sampleDeploymentCreateRequest,
      confirmationToken: 'confirm-url-001',
      baseUrl: 'http://localhost:4100',
      projectDir: '/tmp/autodev-qa',
    });

    expect(result.baseUrl).toBe('http://localhost:4100');
    expect(result.status).toBe('RUNNING');
  });
});
