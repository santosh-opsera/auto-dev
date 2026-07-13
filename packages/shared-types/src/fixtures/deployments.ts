import type {
  DeploymentCreateRequest,
  DeploymentResponse,
  DockerComposeCommand,
  HealthCheckResult,
} from '../deployments.js';
import { DEFAULT_LOCAL_DEPLOYMENT_BASE_URL } from '../deployments.js';

/** Sample Docker Compose configuration for local QA deployments. */
export const sampleDockerComposeYaml = `services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: autodev-qa:local
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: test
      PORT: "4000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/v1/health"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
`;

/** Sample successful build output from docker compose build. */
export const sampleDockerBuildOutput = `#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 512B done
#2 [internal] load .dockerignore
#2 transferring context: 64B done
#3 [1/5] FROM docker.io/library/node:20-alpine
#3 DONE 0.1s
#4 [2/5] WORKDIR /app
#4 DONE 0.0s
#5 [3/5] COPY package*.json ./
#5 DONE 0.1s
#6 [4/5] RUN npm ci
#6 DONE 12.4s
#7 [5/5] COPY . .
#7 DONE 0.2s
#8 exporting to image
#8 naming to docker.io/library/autodev-qa:local done
#8 DONE 0.3s
`;

/** Sample failed build output for debugging failed deployments. */
export const sampleDockerBuildFailureOutput = `#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 512B done
#2 [3/5] COPY package*.json ./
#2 DONE 0.1s
#3 [4/5] RUN npm ci
#3 2.104 npm ERR! code ERESOLVE
#3 2.105 npm ERR! ERESOLVE unable to resolve dependency tree
#3 ERROR: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
ERROR: failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
`;

export const sampleComposeUpCommand: DockerComposeCommand = {
  command: 'docker',
  args: [
    'compose',
    '-f',
    'docker-compose.qa.yml',
    '-p',
    'autodev-qa-workflow-001',
    'up',
    '-d',
    '--build',
  ],
  cwd: '/tmp/autodev-qa',
  env: {
    AUTODEV_BRANCH: 'feature/qa-handoff',
    AUTODEV_BASE_URL: DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  },
};

export const sampleComposeDownCommand: DockerComposeCommand = {
  command: 'docker',
  args: ['compose', '-f', 'docker-compose.qa.yml', '-p', 'autodev-qa-workflow-001', 'down', '-v'],
  cwd: '/tmp/autodev-qa',
};

export const sampleHealthCheckPassing: HealthCheckResult = {
  healthy: true,
  statusCode: 200,
  url: `${DEFAULT_LOCAL_DEPLOYMENT_BASE_URL}/api/v1/health`,
  attempts: 2,
};

export const sampleHealthCheckFailing: HealthCheckResult = {
  healthy: false,
  statusCode: 503,
  url: `${DEFAULT_LOCAL_DEPLOYMENT_BASE_URL}/api/v1/health`,
  attempts: 5,
  lastError: 'Health check returned 503',
};

export const sampleDeploymentCreateRequest: DeploymentCreateRequest = {
  workflowId: 'workflow-001',
  branch: 'feature/qa-handoff',
  confirmationToken: 'confirm-deploy-001',
  baseUrl: DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  composeFile: 'docker-compose.qa.yml',
};

export const sampleDeploymentPending: DeploymentResponse = {
  id: 'deployment-001',
  workflowId: 'workflow-001',
  branch: 'feature/qa-handoff',
  status: 'PENDING',
  baseUrl: DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  composeFile: 'docker-compose.qa.yml',
  projectName: 'autodev-qa-workflow-001',
  healthCheckPath: '/api/v1/health',
  confirmed: true,
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
};

export const sampleDeploymentRunning: DeploymentResponse = {
  ...sampleDeploymentPending,
  status: 'RUNNING',
  logs: sampleDockerBuildOutput,
  startedAt: '2026-07-13T10:00:01.000Z',
  completedAt: '2026-07-13T10:00:45.000Z',
  updatedAt: '2026-07-13T10:00:45.000Z',
};

export const sampleDeploymentFailed: DeploymentResponse = {
  ...sampleDeploymentPending,
  id: 'deployment-002',
  status: 'FAILED',
  logs: sampleDockerBuildFailureOutput,
  error: {
    message: 'Docker Compose build failed',
    code: 'DEPLOY_BUILD_FAILED',
    phase: 'BUILDING',
  },
  startedAt: '2026-07-13T10:01:00.000Z',
  completedAt: '2026-07-13T10:01:12.000Z',
  updatedAt: '2026-07-13T10:01:12.000Z',
};

export const sampleDeploymentStopped: DeploymentResponse = {
  ...sampleDeploymentRunning,
  id: 'deployment-003',
  status: 'STOPPED',
  stoppedAt: '2026-07-13T11:00:00.000Z',
  updatedAt: '2026-07-13T11:00:00.000Z',
};
