import type { PrdResponse, PrdSections } from '../prd.js';
import { sampleAutoDevLikeContext } from './divergence.js';
import { sampleTicketIntent } from './ticketIntent.js';

export const samplePrdSections: PrdSections = {
  problemStatement:
    'Product owners need a structured PRD from ticket intent and codebase context before implementation begins.',
  solutionOutline:
    'Generate a versioned PRD via the LLM adapter that incorporates TicketIntent and CodebaseContext, then persist it for review.',
  userStories: [
    'As a product owner, I want an AI-generated PRD so I can approve scope before coding starts.',
    'As a developer, I want the PRD to reference existing modules and patterns so implementation stays aligned.',
  ],
  acceptanceCriteria: [
    'PRD includes all required sections',
    'PRD links to TicketIntent and optional ApprovalRequest',
    'Generation completes within 30 seconds for standard tickets',
  ],
  scopeBoundaries: [
    'In scope: PRD generation service, schema, versioning, and persistence',
    'Out of scope: PRD review UI and enforcement during implementation',
  ],
  dependencies: sampleTicketIntent.dependencies,
  risks: [
    'LLM output may omit sections and require retry',
    'Stale codebase context could misrepresent integration points',
  ],
  successMetrics: [
    'PRD generation latency under 30 seconds',
    'At least 60% of PRDs approved without major edits',
  ],
};

export const samplePrdLlmJsonResponse = JSON.stringify(
  {
    problemStatement: samplePrdSections.problemStatement,
    solutionOutline: samplePrdSections.solutionOutline,
    userStories: samplePrdSections.userStories,
    acceptanceCriteria: samplePrdSections.acceptanceCriteria,
    scopeBoundaries: samplePrdSections.scopeBoundaries,
    dependencies: samplePrdSections.dependencies,
    risks: samplePrdSections.risks,
    successMetrics: samplePrdSections.successMetrics,
  },
  null,
  2,
);

export const samplePrdWithXssAttempt: PrdSections = {
  ...samplePrdSections,
  problemStatement: 'Fix <script>alert("xss")</script> in auth flow',
  solutionOutline: 'Escape user content before render & persist safely',
  userStories: ['As a user, I want <img src=x onerror=alert(1)> blocked'],
};

export const sampleExpectedPrdResponse: PrdResponse = {
  id: 'prd-001',
  ticketKey: sampleTicketIntent.ticketKey,
  ticketIntentId: 'intent-001',
  approvalRequestId: 'approval-001',
  workflowId: 'workflow-001',
  owner: sampleAutoDevLikeContext.owner,
  repo: sampleAutoDevLikeContext.repo,
  version: 1,
  status: 'draft',
  isActive: true,
  sections: samplePrdSections,
  codebaseContext: {
    affectedModules: ['backend', 'auth', 'services', 'routes'],
    applicablePatterns: ['service-layer', 'repository'],
    integrationPoints: [
      'packages/backend/src/services',
      'packages/backend/src/routes',
      'packages/backend/src/models',
    ],
  },
  createdAt: '2026-07-13T10:00:00.000Z',
  updatedAt: '2026-07-13T10:00:00.000Z',
};

export const samplePrdVersionTwo: PrdResponse = {
  ...sampleExpectedPrdResponse,
  id: 'prd-002',
  version: 2,
  previousVersionId: 'prd-001',
  sections: {
    ...samplePrdSections,
    solutionOutline:
      'Revised solution outline after product owner feedback on scope boundaries.',
  },
  updatedAt: '2026-07-13T11:00:00.000Z',
};
