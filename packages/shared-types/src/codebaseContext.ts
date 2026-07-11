import { z } from 'zod';
import { repositoryOwnerSchema, repositoryNameSchema } from './repositories.js';

export const namingConventionSchema = z.object({
  category: z.enum(['variable', 'function', 'file', 'class', 'component', 'test']),
  pattern: z.string(),
  examples: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type NamingConvention = z.infer<typeof namingConventionSchema>;

export const designPatternSchema = z.object({
  pattern: z.enum([
    'mvc',
    'repository',
    'service-layer',
    'factory',
    'singleton',
    'observer',
  ]),
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type DesignPattern = z.infer<typeof designPatternSchema>;

export const dependencyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(['import', 'require']),
});

export type DependencyEdge = z.infer<typeof dependencyEdgeSchema>;

export const architecturalLayerSchema = z.object({
  layer: z.string(),
  paths: z.array(z.string()),
});

export type ArchitecturalLayer = z.infer<typeof architecturalLayerSchema>;

export const fileStructureNodeSchema: z.ZodType<FileStructureNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'dir']),
    children: z.array(fileStructureNodeSchema).optional(),
  }),
);

export interface FileStructureNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileStructureNode[];
}

export const codebaseContextSchema = z.object({
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  branch: z.string(),
  treeSha: z.string().optional(),
  totalLocEstimate: z.number().int().nonnegative(),
  strategy: z.enum(['on-demand', 'indexed']),
  fileStructureMap: z.array(fileStructureNodeSchema),
  namingConventions: z.array(namingConventionSchema),
  designPatterns: z.array(designPatternSchema),
  dependencyGraph: z.array(dependencyEdgeSchema),
  architecturalLayers: z.array(architecturalLayerSchema),
  analyzedAt: z.string().datetime(),
});

export type CodebaseContext = z.infer<typeof codebaseContextSchema>;

export const codebaseAnalysisResponseSchema = z.object({
  context: codebaseContextSchema,
  persistedId: z.string(),
  cacheHit: z.boolean(),
});

export type CodebaseAnalysisResponse = z.infer<typeof codebaseAnalysisResponseSchema>;

export const codebaseAnalysisRequestSchema = z.object({
  ticketKey: z.string().optional(),
  workflowId: z.string().optional(),
  forceRefresh: z.boolean().optional(),
});

export type CodebaseAnalysisRequest = z.infer<typeof codebaseAnalysisRequestSchema>;
