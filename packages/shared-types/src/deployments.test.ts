import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  DEPLOYMENT_STATUSES,
  deploymentCreateRequestSchema,
  deploymentResponseSchema,
  dockerComposeCommandSchema,
  healthCheckResultSchema,
} from './deployments.js';
import {
  sampleComposeUpCommand,
  sampleDeploymentCreateRequest,
  sampleDeploymentFailed,
  sampleDeploymentPending,
  sampleDeploymentRunning,
  sampleDeploymentStopped,
  sampleDockerBuildFailureOutput,
  sampleDockerBuildOutput,
  sampleDockerComposeYaml,
  sampleHealthCheckFailing,
  sampleHealthCheckPassing,
} from './fixtures/deployments.js';

describe('deployment schemas', () => {
  it('exposes all required deployment statuses', () => {
    expect(DEPLOYMENT_STATUSES).toEqual([
      'PENDING',
      'BUILDING',
      'DEPLOYING',
      'RUNNING',
      'FAILED',
      'STOPPED',
    ]);
  });

  it('requires confirmationToken and never allows empty confirmation', () => {
    expect(deploymentCreateRequestSchema.safeParse(sampleDeploymentCreateRequest).success).toBe(
      true,
    );
    expect(
      deploymentCreateRequestSchema.safeParse({
        workflowId: 'wf-1',
        branch: 'feature/x',
      }).success,
    ).toBe(false);
    expect(
      deploymentCreateRequestSchema.safeParse({
        workflowId: 'wf-1',
        branch: 'feature/x',
        confirmationToken: 'short',
      }).success,
    ).toBe(false);
  });

  it('defaults local base URL constant for QA environments', () => {
    expect(DEFAULT_LOCAL_DEPLOYMENT_BASE_URL).toBe('http://localhost:4000');
  });

  it('validates deployment response fixtures across lifecycle states', () => {
    expect(deploymentResponseSchema.safeParse(sampleDeploymentPending).success).toBe(true);
    expect(deploymentResponseSchema.safeParse(sampleDeploymentRunning).success).toBe(true);
    expect(deploymentResponseSchema.safeParse(sampleDeploymentFailed).success).toBe(true);
    expect(deploymentResponseSchema.safeParse(sampleDeploymentStopped).success).toBe(true);
    expect(sampleDeploymentFailed.logs).toContain('npm ERR!');
    expect(sampleDeploymentFailed.error?.code).toBe('DEPLOY_BUILD_FAILED');
  });

  it('validates compose command and health check fixtures', () => {
    expect(dockerComposeCommandSchema.safeParse(sampleComposeUpCommand).success).toBe(true);
    expect(healthCheckResultSchema.safeParse(sampleHealthCheckPassing).success).toBe(true);
    expect(healthCheckResultSchema.safeParse(sampleHealthCheckFailing).success).toBe(true);
    expect(sampleDockerComposeYaml).toContain('healthcheck:');
    expect(sampleDockerBuildOutput).toContain('autodev-qa:local');
    expect(sampleDockerBuildOutput).toContain('node:22.23-alpine3.18');
    expect(sampleDockerBuildOutput).not.toContain('node:20');
    expect(sampleDockerBuildFailureOutput).toContain('ERESOLVE');
  });
});
