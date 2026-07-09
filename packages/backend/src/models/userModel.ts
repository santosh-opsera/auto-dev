import mongoose, { type HydratedDocument } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface UserDocument extends AuditFields {
  email: string;
  displayName: string;
  role: 'user' | 'admin';
}

export type UserRecord = HydratedDocument<UserDocument>;

const userSchema = createBaseSchema({
  email: { type: String, required: true },
  displayName: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], required: true },
});

userSchema.index({ email: 1 }, { unique: true });

export function getUserModel(): mongoose.Model<UserDocument> {
  if (mongoose.models.User) {
    return mongoose.models.User as mongoose.Model<UserDocument>;
  }

  return mongoose.model<UserDocument>('User', userSchema);
}
