import { z } from 'zod';

/** Lifecycle status for a registered integration adapter. */
export const ADAPTER_STATUSES = ['active', 'inactive', 'error'] as const;
export const adapterStatusSchema = z.enum(ADAPTER_STATUSES);
export type AdapterStatus = z.infer<typeof adapterStatusSchema>;

/** Built-in adapter names used at launch. */
export const INTEGRATION_ADAPTER_NAMES = ['jira', 'github', 'opsera'] as const;
export const integrationAdapterNameSchema = z.enum(INTEGRATION_ADAPTER_NAMES);
export type IntegrationAdapterName = z.infer<typeof integrationAdapterNameSchema>;

export const adapterHealthResultSchema = z.object({
  healthy: z.boolean(),
  message: z.string().optional(),
  checkedAt: z.string().datetime(),
});

export type AdapterHealthResult = z.infer<typeof adapterHealthResultSchema>;

export const integrationAdapterInfoSchema = z.object({
  name: z.string().min(1),
  status: adapterStatusSchema,
  capabilities: z.array(z.string().min(1)),
  lastHealthCheck: adapterHealthResultSchema.optional(),
  /** Human-readable note (e.g. Opsera "coming soon"). */
  message: z.string().optional(),
});

export type IntegrationAdapterInfo = z.infer<typeof integrationAdapterInfoSchema>;

export const integrationsListResponseSchema = z.object({
  adapters: z.array(integrationAdapterInfoSchema),
});

export type IntegrationsListResponse = z.infer<typeof integrationsListResponseSchema>;

/** Default periodic health-check interval (5 minutes). */
export const DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
