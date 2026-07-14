import { describe, expect, it, vi } from 'vitest';
import type { AuditFields } from './auditFields.js';
import { BaseRepository } from './baseRepository.js';

type Doc = AuditFields & { id: string; email: string; displayName: string };

function createModelMock(store: Doc[]) {
  return {
    findById: vi.fn((id: string) => ({
      exec: async () => store.find((row) => row.id === id) ?? null,
    })),
    findOne: vi.fn((filter: Partial<Doc>) => ({
      exec: async () =>
        store.find((row) => Object.entries(filter).every(([k, v]) => row[k as keyof Doc] === v)) ??
        null,
    })),
    findByIdAndUpdate: vi.fn((id: string, update: Partial<Doc>) => ({
      exec: async () => {
        const index = store.findIndex((row) => row.id === id);
        if (index < 0) return null;
        store[index] = { ...store[index], ...update } as Doc;
        return store[index];
      },
    })),
    findByIdAndDelete: vi.fn((id: string) => ({
      exec: async () => {
        const index = store.findIndex((row) => row.id === id);
        if (index < 0) return null;
        const [removed] = store.splice(index, 1);
        return removed;
      },
    })),
  };
}

describe('BaseRepository', () => {
  it('creates documents with actor audit fields', async () => {
    const store: Doc[] = [];
    const modelMock = createModelMock(store);
    const ModelCtor = vi.fn(function MockModel(this: Doc, data: Partial<Doc>) {
      Object.assign(this, data, {
        id: 'doc-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        dataClassification: 'internal',
      });
      this.save = async () => {
        store.push({ ...this });
        return this;
      };
      return this;
    }) as unknown as {
      new (data: Partial<Doc>): Doc & { save: () => Promise<Doc> };
    };
    Object.assign(ModelCtor, modelMock);

    const repository = new BaseRepository<Doc>(ModelCtor as never);
    const created = await repository.create(
      { email: 'alex@example.com', displayName: 'Alex' } as Partial<Doc>,
      'actor-1',
    );

    expect(created.email).toBe('alex@example.com');
    expect(created.createdBy).toBe('actor-1');
    expect(created.updatedBy).toBe('actor-1');
    expect(store).toHaveLength(1);
  });

  it('finds, updates, and deletes by id', async () => {
    const store: Doc[] = [
      {
        id: 'doc-2',
        email: 'dana@example.com',
        displayName: 'Dana',
        createdAt: new Date(),
        updatedAt: new Date(),
        dataClassification: 'internal',
      },
    ];
    const modelMock = createModelMock(store);
    const repository = new BaseRepository<Doc>(modelMock as never);

    expect((await repository.findById('doc-2'))?.email).toBe('dana@example.com');

    const updated = await repository.updateById('doc-2', { displayName: 'Dana Lead' } as never, 'actor-2');
    expect(updated?.displayName).toBe('Dana Lead');
    expect(updated?.updatedBy).toBe('actor-2');

    expect(await repository.deleteById('doc-2')).toBe(true);
    expect(await repository.findById('doc-2')).toBeNull();
    expect(await repository.deleteById('missing')).toBe(false);
  });
});
