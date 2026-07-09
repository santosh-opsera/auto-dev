import { Schema, type SchemaDefinition } from 'mongoose';

export const DATA_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  dataClassification: DataClassification;
}

export const auditFieldDefinition = {
  createdBy: { type: String, required: false },
  updatedBy: { type: String, required: false },
  dataClassification: {
    type: String,
    enum: DATA_CLASSIFICATIONS,
    default: 'internal',
  },
} satisfies SchemaDefinition;

export function createBaseSchema(definition: SchemaDefinition): Schema {
  return new Schema(
    {
      ...definition,
      ...auditFieldDefinition,
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );
}
