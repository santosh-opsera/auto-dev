import type { Page, Route } from '@playwright/test';
import type { ApprovalItem, ApprovalRequestResponse } from '@autodev/shared-types';
import {
  uiActiveConventions,
  uiApprovalRequest,
  uiConventionDefaults,
  uiMeResponse,
  uiParseComplete,
  uiParseWithGaps,
  uiTicketResponse,
  uiWarningMeResponse,
} from '../fixtures/ui.js';
import { e2eConventionSettings } from '../fixtures/auth.js';

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Seed an authenticated SPA session by stubbing bootstrap + heartbeat APIs. */
export async function stubAuthenticatedSession(
  page: Page,
  options?: { warning?: boolean },
): Promise<void> {
  const me = options?.warning ? uiWarningMeResponse : uiMeResponse;

  await page.route('**/api/v1/auth/me', (route) => json(route, me));
  await page.route('**/api/v1/auth/heartbeat', (route) =>
    json(route, {
      session: me.session,
      warning: me.session.warning ? 'Your session will expire in less than 5 minutes.' : undefined,
    }),
  );
  await page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await page.route('**/api/v1/events/stream**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"type":"connected"}\n\n',
    }),
  );
}

export async function stubConventionApis(page: Page): Promise<void> {
  let saved: typeof e2eConventionSettings | null = null;

  await page.route('**/api/v1/conventions/defaults', (route) =>
    json(route, uiConventionDefaults),
  );
  await page.route('**/api/v1/conventions', async (route) => {
    if (route.request().method() === 'GET') {
      await json(
        route,
        saved
          ? { settings: { id: 'conv-1', version: 1, isActive: true, ...saved } }
          : uiActiveConventions,
      );
      return;
    }
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON() as typeof e2eConventionSettings;
      await json(route, { id: 'conv-1', version: 1, isActive: true, ...saved }, 201);
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/v1/conventions/history**', (route) =>
    json(route, { versions: [] }),
  );
}

export async function stubTicketApis(page: Page, withGaps = false): Promise<void> {
  await page.route('**/api/v1/tickets/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/parse') && route.request().method() === 'POST') {
      await json(route, withGaps ? uiParseWithGaps : uiParseComplete);
      return;
    }
    if (route.request().method() === 'GET') {
      await json(route, uiTicketResponse);
      return;
    }
    await route.fallback();
  });
}

export async function stubApprovalApis(page: Page): Promise<void> {
  const resolvedIds = new Set<string>();

  const buildRequest = (): ApprovalRequestResponse => ({
    ...uiApprovalRequest,
    status: resolvedIds.size >= uiApprovalRequest.items.length ? 'cleared' : 'open',
    items: uiApprovalRequest.items.map((item) =>
      resolvedIds.has(item.itemId)
        ? ({
            ...item,
            status: 'approved',
            decision: { action: 'approve', decidedAt: new Date().toISOString() },
          } as ApprovalItem)
        : item,
    ),
  });

  const buildStatus = () => {
    const totalCount = uiApprovalRequest.items.length;
    const resolvedCount = resolvedIds.size;
    return {
      canProceed: resolvedCount >= totalCount,
      pendingCount: Math.max(0, totalCount - resolvedCount),
      resolvedCount,
      totalCount,
      status: resolvedCount >= totalCount ? 'cleared' : 'open',
      expiresAt: uiApprovalRequest.expiresAt,
    };
  };

  await page.route('**/api/v1/approvals/approval-e2e-001/status', (route) =>
    json(route, buildStatus()),
  );
  await page.route('**/api/v1/approvals/approval-e2e-001', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, buildRequest());
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/v1/approvals/approval-e2e-001/items/*/resolve', async (route) => {
    const match = route.request().url().match(/items\/([^/]+)\/resolve/);
    const itemId = match?.[1] ? decodeURIComponent(match[1]) : undefined;
    if (itemId) {
      resolvedIds.add(itemId);
    }
    await json(route, buildRequest());
  });

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
}
