import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleNormalizedTicket,
  sampleTicketWithMissingAc,
} from '@autodev/shared-types';
import { createApp } from '../../../backend/src/index.js';
import { getTicketIntentModel } from '../../../backend/src/models/ticketIntentModel.js';
import { ticketService } from '../../../backend/src/services/jira/ticketService.js';
import { installE2EApiHarness } from '../../helpers/apiHarness.js';
import { loginAsE2EUser } from '../../helpers/login.js';

installE2EApiHarness();

describe('E2E API · ticket ingestion flow', () => {
  it('selects a ticket, parses intent, detects gaps, resolves via clean re-parse, and proceeds', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsE2EUser(app);

    vi.mocked(ticketService.getTicket).mockResolvedValue({
      ticket: sampleTicketWithMissingAc,
      source: 'jira-rest',
    });

    const selected = await request(app)
      .get('/api/v1/tickets/OPL-2001')
      .set('Cookie', sessionCookie);
    expect(selected.status).toBe(200);
    expect(selected.body.ticket.ticketKey).toBe('OPL-2001');

    const parsedWithGaps = await request(app)
      .post('/api/v1/tickets/OPL-2001/parse')
      .set('Cookie', sessionCookie);
    expect(parsedWithGaps.status).toBe(200);
    expect(parsedWithGaps.body.canProceedToAnalysis).toBe(false);
    expect(parsedWithGaps.body.gaps[0]?.severity).toBe('critical');
    expect(parsedWithGaps.body.gaps[0]?.field).toBe('acceptanceCriteria');

    // Resolve gaps: ticket is updated upstream (mock), then re-parsed.
    vi.mocked(ticketService.getTicket).mockResolvedValue({
      ticket: {
        ...sampleNormalizedTicket,
        ticketKey: 'OPL-2001',
        summary: sampleTicketWithMissingAc.summary,
      },
      source: 'jira-rest',
    });

    const resolved = await request(app)
      .post('/api/v1/tickets/OPL-2001/parse')
      .set('Cookie', sessionCookie);
    expect(resolved.status).toBe(200);
    expect(resolved.body.canProceedToAnalysis).toBe(true);
    expect(resolved.body.gaps.filter((gap: { severity: string }) => gap.severity === 'critical')).toEqual(
      [],
    );

    const persisted = await getTicketIntentModel()
      .findById(resolved.body.persistedId)
      .exec();
    expect(persisted?.canProceedToAnalysis).toBe(true);
  });

  it('happy-path: select → parse → proceed with no gaps', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsE2EUser(app);

    vi.mocked(ticketService.getTicket).mockResolvedValue({
      ticket: sampleNormalizedTicket,
      source: 'jira-rest',
    });

    const selected = await request(app)
      .get('/api/v1/tickets/OPL-1234')
      .set('Cookie', sessionCookie);
    expect(selected.status).toBe(200);

    const parsed = await request(app)
      .post('/api/v1/tickets/OPL-1234/parse')
      .set('Cookie', sessionCookie);
    expect(parsed.status).toBe(200);
    expect(parsed.body.canProceedToAnalysis).toBe(true);
    expect(parsed.body.intent.ticketKey).toBe('OPL-1234');
  });
});
