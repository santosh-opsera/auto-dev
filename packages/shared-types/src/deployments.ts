import { z } from 'zod';

export const DEPLOYMENT_STATUSES = [
  'PENDING',
  'BUILDING',
  'DEPLOYING',
  'RUNNING',
  'FAILED',
  'STOPPED',
] as const;

export const deploymentStatusSchema = z.enum(DEPLOYMENT_STATUSES);
export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;

/** Default local QA URL when `baseUrl` is omitted. */
export const DEFAULT_LOCAL_DEPLOYMENT_BASE_URL = 'http://localhost:4000';

export const deploymentCreateRequestSchema = z.object({
  workflowId: z.string().min(1),
  branch: z.string().min(1),
  /** Explicit confirmation gate — required; deployments never start automatically. */
  confirmationToken: z.string().min(8),
  baseUrl: z.string().url().optional(),
  /** Optional compose file path relative to project root (tests/fixtures). */
  composeFile: z.string().min(1).optional(),
  /** Optional working directory for compose (defaults to cwd). */
  projectDir: z.string().min(1).optional(),
});

export type DeploymentCreateRequest = z.infer<typeof deploymentCreateRequestSchema>;

export const deploymentIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type DeploymentIdParams = z.infer<typeof deploymentIdParamsSchema>;

export const deploymentErrorSchema = z.object({
  message: z.string().min(1),
  code: z.string().min(1).optional(),
  phase: deploymentStatusSchema.optional(),
});

export type DeploymentError = z.infer<typeof deploymentErrorSchema>;

export const deploymentResponseSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  branch: z.string().min(1),
  status: deploymentStatusSchema,
  baseUrl: z.string().url(),
  composeFile: z.string().min(1),
  projectName: z.string().min(1),
  healthCheckPath: z.string().min(1),
  confirmed: z.literal(true),
  logs: z.string().optional(),
  error: deploymentErrorSchema.optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  stoppedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DeploymentResponse = z.infer<typeof deploymentResponseSchema>;

export const dockerComposeCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  cwd: z.string().min(1),
  env: z.record(z.string()).optional(),
});

export type DockerComposeCommand = z.infer<typeof dockerComposeCommandSchema>;

export const healthCheckResultSchema = z.object({
  healthy: z.boolean(),
  statusCode: z.number().int().optional(),
  url: z.string().url(),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().optional(),
});

export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;
