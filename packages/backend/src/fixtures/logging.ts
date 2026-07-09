import type { RequestContext } from '../utils/requestContext.js';

export const sampleRequestContext: RequestContext = {
  correlationId: 'corr-fixture-001',
  actor: 'user@example.com',
  resource: '/api/v1/workflows',
  operation: 'POST',
};

export const sampleErrorObjects = {
  validation: new Error('Invalid workflow payload'),
  notFound: Object.assign(new Error('Workflow not found'), { name: 'NotFoundError' }),
  internal: Object.assign(new Error('/app/src/services/workflow.ts:42:13'), {
    name: 'TypeError',
    stack: 'TypeError: Cannot read property\n    at /app/src/services/workflow.ts:42:13',
  }),
};
