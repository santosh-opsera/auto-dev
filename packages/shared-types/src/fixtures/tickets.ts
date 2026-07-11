import type { NormalizedTicket } from '../tickets.js';

export const sampleJiraIssueResponse = {
  id: '10001',
  key: 'OPL-1234',
  fields: {
    summary: 'Add OAuth support',
    description: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Acceptance Criteria' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'User can sign in with GitHub OAuth' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Session persists for 8 hours' }],
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Implement PKCE flow for secure auth.' }],
        },
      ],
    },
    labels: ['backend', 'auth'],
    attachment: [
      {
        id: '10002',
        filename: 'oauth-flow.png',
        mimeType: 'image/png',
        size: 2048,
      },
    ],
    issuelinks: [
      {
        type: { outward: 'blocks', name: 'Blocks' },
        outwardIssue: {
          key: 'OPL-1200',
          fields: { summary: 'Set up auth middleware' },
        },
      },
    ],
    customfield_10020: [
      {
        id: 42,
        name: 'Sprint 12',
        state: 'active',
      },
    ],
  },
};

export const samplePartialJiraIssueResponse = {
  id: '10003',
  key: 'OPL-9999',
  fields: {
    summary: 'Partial ticket',
    description: null,
    labels: [],
    attachment: [],
    issuelinks: [],
  },
};

export const sampleNormalizedTicket: NormalizedTicket = {
  ticketKey: 'OPL-1234',
  summary: 'Add OAuth support',
  description: 'Implement PKCE flow for secure auth.',
  acceptanceCriteria: [
    'User can sign in with GitHub OAuth',
    'Session persists for 8 hours',
  ],
  linkedIssues: [
    {
      key: 'OPL-1200',
      summary: 'Set up auth middleware',
      linkType: 'blocks',
    },
  ],
  attachments: [
    {
      id: '10002',
      filename: 'oauth-flow.png',
      mimeType: 'image/png',
      size: 2048,
    },
  ],
  labels: ['backend', 'auth'],
  sprintContext: {
    id: '42',
    name: 'Sprint 12',
    state: 'active',
  },
};
