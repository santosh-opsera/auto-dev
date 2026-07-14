import type { Model, UpdateQuery } from 'mongoose';
import type { AuditFields } from './auditFields.js';

export class BaseRepository<T extends AuditFields> {
  constructor(private readonly model: Model<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async create(data: Partial<T>, actorId?: string): Promise<T> {
    const document = new this.model({
      ...data,
      ...(actorId ? { createdBy: actorId, updatedBy: actorId } : {}),
    });

    return document.save();
  }

  async updateById(id: string, data: UpdateQuery<T>, actorId?: string): Promise<T | null> {
    const update: UpdateQuery<T> = {
      ...data,
      ...(actorId ? { updatedBy: actorId } : {}),
    };

    return this.model
      .findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true })
      .exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }
}
