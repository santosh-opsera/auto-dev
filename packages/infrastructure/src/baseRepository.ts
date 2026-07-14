import type { Model, UpdateQuery } from 'mongoose';
import type { AuditFields } from './auditFields.js';

/**
 * Thin CRUD wrapper over a Mongoose model with optional actor audit fields.
 * Requires the `mongoose` peer dependency in the consuming package.
 */
export class BaseRepository<T extends AuditFields> {
  /** @param model - Mongoose model bound to documents extending {@link AuditFields} */
  constructor(private readonly model: Model<T>) {}

  /** Find a document by string id. */
  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  /**
   * Insert a document, stamping `createdBy` / `updatedBy` when `actorId` is provided.
   * @returns The saved document
   */
  async create(data: Partial<T>, actorId?: string): Promise<T> {
    const document = new this.model({
      ...data,
      ...(actorId ? { createdBy: actorId, updatedBy: actorId } : {}),
    });

    return document.save();
  }

  /**
   * Update by id with validators; stamps `updatedBy` when `actorId` is provided.
   * @returns The updated document or `null` if missing
   */
  async updateById(id: string, data: UpdateQuery<T>, actorId?: string): Promise<T | null> {
    const update: UpdateQuery<T> = {
      ...data,
      ...(actorId ? { updatedBy: actorId } : {}),
    };

    return this.model
      .findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true })
      .exec();
  }

  /** Delete by id. @returns `true` when a document was removed */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }

  /** Find the first document matching a partial filter. */
  async findOne(filter: Partial<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }
}
