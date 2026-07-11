import type { CodebaseContext, Divergence, TicketIntent } from '@autodev/shared-types';

function collectTicketText(intent: TicketIntent): string {
  return [
    intent.proposedApproach,
    ...intent.acceptanceCriteria,
    ...intent.affectedComponents,
    ...intent.constraints,
  ]
    .join(' ')
    .toLowerCase();
}

function hasCamelCaseConvention(context: CodebaseContext): boolean {
  return context.namingConventions.some(
    (convention) =>
      convention.category === 'file' && convention.pattern.toLowerCase().includes('camelcase'),
  );
}

function hasSnakeCaseConvention(context: CodebaseContext): boolean {
  return context.namingConventions.some((convention) =>
    convention.pattern.toLowerCase().includes('snake_case'),
  );
}

function extractSnakeCaseTokens(text: string): string[] {
  const matches = text.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g) ?? [];
  return [...new Set(matches)];
}

export function detectNamingDivergences(
  intent: TicketIntent,
  context: CodebaseContext,
): Divergence[] {
  const ticketText = collectTicketText(intent);
  const snakeCaseTokens = extractSnakeCaseTokens(ticketText);

  if (snakeCaseTokens.length === 0) {
    return [];
  }

  if (!hasCamelCaseConvention(context) || hasSnakeCaseConvention(context)) {
    return [];
  }

  const examples = snakeCaseTokens.slice(0, 3).join(', ');

  return [
    {
      type: 'naming',
      ticketApproach: `Ticket text proposes snake_case identifiers such as ${examples}.`,
      codebaseConvention:
        'Repository uses camelCase filenames and camelCase service/controller modules.',
      recommendation:
        'Follow codebase camelCase naming for files and functions instead of snake_case identifiers from the ticket.',
      severity: 'suggestion',
      affectedFiles: [],
    },
  ];
}

function contextUsesPattern(context: CodebaseContext, pattern: string): boolean {
  return context.designPatterns.some((entry) => entry.pattern === pattern);
}

export function detectPatternDivergences(
  intent: TicketIntent,
  context: CodebaseContext,
): Divergence[] {
  const ticketText = collectTicketText(intent);
  const divergences: Divergence[] = [];

  const proposesMvc =
    ticketText.includes('mvc') ||
    ticketText.includes('model-view-controller') ||
    (ticketText.includes('controller') && ticketText.includes('business logic'));

  if (
    proposesMvc &&
    !contextUsesPattern(context, 'mvc') &&
    (contextUsesPattern(context, 'service-layer') || contextUsesPattern(context, 'repository'))
  ) {
    divergences.push({
      type: 'pattern',
      ticketApproach: 'Ticket proposes MVC-style fat controllers for business logic.',
      codebaseConvention: `Repository uses ${context.designPatterns
        .map((pattern) => pattern.pattern)
        .join(', ')} patterns instead of MVC controllers.`,
      recommendation:
        'Implement business logic in service modules and keep routes thin, matching existing service-layer conventions.',
      severity: 'critical',
      affectedFiles: [],
    });
  }

  const proposesSingleton = ticketText.includes('singleton');
  if (proposesSingleton && !contextUsesPattern(context, 'singleton')) {
    divergences.push({
      type: 'pattern',
      ticketApproach: 'Ticket proposes a singleton pattern for shared state.',
      codebaseConvention: `Detected patterns: ${context.designPatterns
        .map((pattern) => pattern.pattern)
        .join(', ') || 'none'}.`,
      recommendation:
        'Avoid introducing singletons unless the codebase already uses that pattern; prefer existing module exports or dependency injection style.',
      severity: 'suggestion',
      affectedFiles: [],
    });
  }

  return divergences;
}

function layerNames(context: CodebaseContext): string[] {
  return context.architecturalLayers.map((layer) => layer.layer.toLowerCase());
}

function layerPaths(context: CodebaseContext, layerName: string): string[] {
  return (
    context.architecturalLayers.find((layer) => layer.layer.toLowerCase() === layerName)?.paths ??
    []
  );
}

export function detectArchitectureDivergences(
  intent: TicketIntent,
  context: CodebaseContext,
): Divergence[] {
  const ticketText = collectTicketText(intent);
  const layers = layerNames(context);
  const divergences: Divergence[] = [];

  const mentionsControllers =
    ticketText.includes('controller') ||
    intent.affectedComponents.some((component) => component.toLowerCase().includes('controller'));

  if (mentionsControllers && layers.includes('routes') && !layers.includes('controllers')) {
    divergences.push({
      type: 'architecture',
      ticketApproach: 'Ticket directs implementation into controllers layer.',
      codebaseConvention: `Backend code is organized into ${layers.join(' and ')} layers rather than controllers.`,
      recommendation:
        'Place HTTP handlers in routes and business logic in services to match the existing architectural layers.',
      severity: 'critical',
      affectedFiles: [
        ...layerPaths(context, 'routes'),
        ...layerPaths(context, 'services'),
      ],
    });
  }

  const proposesUtilsLayer =
    ticketText.includes('utils/') ||
    ticketText.includes('utilities') ||
    intent.affectedComponents.some((component) => component.toLowerCase().includes('util'));

  if (proposesUtilsLayer && layers.includes('services') && !layers.includes('utils')) {
    divergences.push({
      type: 'architecture',
      ticketApproach: 'Ticket proposes placing business logic in utility modules.',
      codebaseConvention: 'Business logic belongs in services rather than generic utils folders.',
      recommendation:
        'Create or extend a service module instead of adding business logic under utils.',
      severity: 'suggestion',
      affectedFiles: layerPaths(context, 'services'),
    });
  }

  return divergences;
}

export function detectDivergences(intent: TicketIntent, context: CodebaseContext): Divergence[] {
  return [
    ...detectNamingDivergences(intent, context),
    ...detectPatternDivergences(intent, context),
    ...detectArchitectureDivergences(intent, context),
  ];
}

export function buildDivergenceSummary(divergences: Divergence[]): string {
  if (divergences.length === 0) {
    return 'Ticket approach aligns with codebase conventions.';
  }

  const counts = divergences.reduce<Record<string, number>>((accumulator, divergence) => {
    accumulator[divergence.type] = (accumulator[divergence.type] ?? 0) + 1;
    return accumulator;
  }, {});

  const parts = Object.entries(counts).map(([type, count]) => `${count} ${type}`);
  return `Detected ${divergences.length} divergence(s): ${parts.join(', ')}.`;
}
