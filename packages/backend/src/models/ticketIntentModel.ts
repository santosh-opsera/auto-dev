import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface GapItemRecord {
  field: string;
  severity: 'critical' | 'warning';
  description: string;
  suggestedAction: string;
}

export interface TicketIntentRecordDocument extends AuditFields {
  userId: string;
  ticketKey: string;
  problemStatement: string;
  proposedApproach: string;
  acceptanceCriteria: string[];
  affectedComponents: string[];
  dependencies: string[];
  constraints: string[];
  metadata: {
    sourceSummary: string;
    labels: string[];
    sprintContext?: {
      id?: string;
      name?: string;
      state?: string;
    };
    issueType?: string;
    parsedAt: string;
  };
  gaps: GapItemRecord[];
  canProceedToAnalysis: boolean;
  latestDivergenceRecordId?: string;
}

export type TicketIntentRecord = HydratedDocument<TicketIntentRecordDocument>;

const ticketIntentSchema = createBaseSchema({
  userId: { type: String, required: true },
  ticketKey: { type: String, required: true },
  problemStatement: { type: String, required: true },
  proposedApproach: { type: String, required: true },
  acceptanceCriteria: { type: [String], required: true },
  affectedComponents: { type: [String], required: true },
  dependencies: { type: [String], required: true },
  constraints: { type: [String], required: true },
  metadata: {
    sourceSummary: { type: String, required: true },
    labels: { type: [String], required: true },
    sprintContext: {
      id: { type: String, required: false },
      name: { type: String, required: false },
      state: { type: String, required: false },
    },
    issueType: { type: String, required: false },
    parsedAt: { type: String, required: true },
  },
  gaps: [
    {
      field: { type: String, required: true },
      severity: { type: String, enum: ['critical', 'warning'], required: true },
      description: { type: String, required: true },
      suggestedAction: { type: String, required: true },
    },
  ],
  canProceedToAnalysis: { type: Boolean, required: true },
  latestDivergenceRecordId: { type: String, required: false },
});

ticketIntentSchema.index({ userId: 1, ticketKey: 1, createdAt: -1 });

export function getTicketIntentModel(): Model<TicketIntentRecordDocument> {
  if (mongoose.models.TicketIntentRecord) {
    return mongoose.models.TicketIntentRecord as Model<TicketIntentRecordDocument>;
  }

  return mongoose.model<TicketIntentRecordDocument>(
    'TicketIntentRecord',
    ticketIntentSchema,
    'ticket_intents',
  );
}
