import { z } from 'zod';

export const TICKET_KEY_PATTERN = /^[A-Za-z0-9-]+$/;

export const ticketKeySchema = z
  .string()
  .regex(
    TICKET_KEY_PATTERN,
    'Ticket key must contain only letters, numbers, and hyphens. Example: OPL-1234',
  );

export const ticketKeyParamsSchema = z.object({
  ticketKey: ticketKeySchema,
});

export const linkedIssueSchema = z.object({
  key: ticketKeySchema,
  summary: z.string(),
  linkType: z.string(),
});

export const ticketAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});

export const sprintContextSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  state: z.string().optional(),
});

export const normalizedTicketSchema = z.object({
  ticketKey: ticketKeySchema,
  summary: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  linkedIssues: z.array(linkedIssueSchema),
  attachments: z.array(ticketAttachmentSchema),
  labels: z.array(z.string()),
  sprintContext: sprintContextSchema.optional(),
  issueType: z.string().optional(),
});

export type NormalizedTicket = z.infer<typeof normalizedTicketSchema>;

export const ticketSourceSchema = z.enum(['jira-rest']);

export type TicketSource = z.infer<typeof ticketSourceSchema>;

export const ticketResponseSchema = z.object({
  ticket: normalizedTicketSchema,
  source: ticketSourceSchema,
  fallbackUsed: z.boolean().optional(),
});

export type TicketResponse = z.infer<typeof ticketResponseSchema>;
