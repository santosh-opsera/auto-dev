import { z } from 'zod';

export const healthCheckSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthCheckResponse = z.infer<typeof healthCheckSchema>;

export const userFixtureSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(['user', 'admin']),
  createdAt: z.string().datetime(),
});

export type UserFixture = z.infer<typeof userFixtureSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  supportReferenceId: z.string(),
  suggestedAction: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const fieldValidationErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type FieldValidationError = z.infer<typeof fieldValidationErrorSchema>;

export const validationErrorResponseSchema = errorResponseSchema.extend({
  fields: z.array(fieldValidationErrorSchema),
});

export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

export const dbHealthConnectedSchema = z.object({
  status: z.literal('connected'),
  latencyMs: z.number().nonnegative(),
  database: z.string().optional(),
});

export const dbHealthDisconnectedSchema = z.object({
  status: z.literal('disconnected'),
  error: z.string(),
});

export type DbHealthConnected = z.infer<typeof dbHealthConnectedSchema>;
export type DbHealthDisconnected = z.infer<typeof dbHealthDisconnectedSchema>;

export const auditDocumentSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
});
