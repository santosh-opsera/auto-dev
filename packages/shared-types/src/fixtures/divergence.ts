import type { CodebaseContext } from '../codebaseContext.js';
import type { Divergence } from '../divergence.js';
import type { TicketIntent } from '../ticketIntent.js';
import { sampleTicketIntent } from './ticketIntent.js';

export const sampleAlignedTicketIntent: TicketIntent = {
  ...sampleTicketIntent,
  ticketKey: 'OPL-3001',
  proposedApproach:
    'Add a userService in packages/backend/src/services with camelCase naming and route handlers in packages/backend/src/routes.',
  affectedComponents: ['services', 'routes'],
};

export const sampleNamingConflictTicketIntent: TicketIntent = {
  ...sampleTicketIntent,
  ticketKey: 'OPL-3002',
  proposedApproach:
    'Create user_service.ts with function get_user_by_id() and snake_case module names across the backend.',
  acceptanceCriteria: ['get_user_by_id returns the user record'],
  affectedComponents: ['backend'],
};

export const samplePatternConflictTicketIntent: TicketIntent = {
  ...sampleTicketIntent,
  ticketKey: 'OPL-3003',
  proposedApproach:
    'Implement using MVC with fat controllers that contain all business logic in controller classes.',
  affectedComponents: ['controllers'],
};

export const sampleArchitectureConflictTicketIntent: TicketIntent = {
  ...sampleTicketIntent,
  ticketKey: 'OPL-3004',
  proposedApproach:
    'Place all business logic in packages/backend/src/controllers and avoid separate service modules.',
  affectedComponents: ['controllers'],
};

export const sampleAutoDevLikeContext: Pick<
  CodebaseContext,
  | 'namingConventions'
  | 'designPatterns'
  | 'architecturalLayers'
  | 'owner'
  | 'repo'
  | 'branch'
  | 'totalLocEstimate'
  | 'strategy'
  | 'fileStructureMap'
  | 'dependencyGraph'
  | 'analyzedAt'
> = {
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  branch: 'main',
  totalLocEstimate: 8000,
  strategy: 'on-demand',
  fileStructureMap: [],
  dependencyGraph: [],
  analyzedAt: '2026-07-11T08:00:00.000Z',
  namingConventions: [
    {
      category: 'file',
      pattern: 'camelCase filenames',
      examples: ['packages/backend/src/services/userService.ts'],
      confidence: 0.9,
    },
    {
      category: 'test',
      pattern: '*.test.* / *.spec.* suffix',
      examples: ['packages/backend/src/routes/authRoutes.test.ts'],
      confidence: 0.85,
    },
  ],
  designPatterns: [
    {
      pattern: 'repository',
      evidence: ['packages/backend/src/repositories'],
      confidence: 0.9,
    },
    {
      pattern: 'service-layer',
      evidence: ['packages/backend/src/services'],
      confidence: 0.9,
    },
  ],
  architecturalLayers: [
    { layer: 'routes', paths: ['packages/backend/src/routes'] },
    { layer: 'services', paths: ['packages/backend/src/services'] },
    { layer: 'models', paths: ['packages/backend/src/models'] },
    { layer: 'components', paths: ['packages/frontend/src/components'] },
  ],
};

export const sampleExpectedNamingDivergence: Divergence = {
  type: 'naming',
  ticketApproach: 'Ticket text proposes snake_case identifiers such as user_service or get_user_by_id.',
  codebaseConvention: 'Repository uses camelCase filenames and camelCase service/controller modules.',
  recommendation:
    'Follow codebase camelCase naming for files and functions instead of snake_case identifiers from the ticket.',
  severity: 'suggestion',
  affectedFiles: [],
};

export const sampleExpectedPatternDivergence: Divergence = {
  type: 'pattern',
  ticketApproach: 'Ticket proposes MVC-style fat controllers for business logic.',
  codebaseConvention: 'Repository uses service-layer and repository patterns instead of MVC controllers.',
  recommendation:
    'Implement business logic in service modules and keep routes thin, matching existing service-layer conventions.',
  severity: 'critical',
  affectedFiles: [],
};

export const sampleExpectedArchitectureDivergence: Divergence = {
  type: 'architecture',
  ticketApproach: 'Ticket directs implementation into controllers layer.',
  codebaseConvention: 'Backend code is organized into routes and services layers rather than controllers.',
  recommendation:
    'Place HTTP handlers in routes and business logic in services to match the existing architectural layers.',
  severity: 'critical',
  affectedFiles: ['packages/backend/src/routes', 'packages/backend/src/services'],
};
