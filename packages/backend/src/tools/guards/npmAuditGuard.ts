/**
 * Parse npm audit JSON and decide whether high/critical findings should block.
 */

export type AuditSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical';

export type AuditVulnerabilitySummary = {
  name: string;
  severity: AuditSeverity;
  via: string;
  range?: string;
  url?: string;
};

export type NpmAuditReport = {
  /** npm audit v2+ advisories keyed by id, or legacy vulnerabilities map */
  vulnerabilities?: Record<
    string,
    {
      name?: string;
      severity?: string;
      via?: Array<string | { title?: string; url?: string; severity?: string }>;
      range?: string;
      url?: string;
    }
  >;
  metadata?: {
    vulnerabilities?: Partial<Record<AuditSeverity | 'total', number>>;
  };
};

const BLOCKING: ReadonlySet<string> = new Set(['high', 'critical']);

export function normalizeSeverity(value: string | undefined): AuditSeverity {
  const lower = (value ?? 'info').toLowerCase();
  if (lower === 'critical' || lower === 'high' || lower === 'moderate' || lower === 'low') {
    return lower;
  }
  return 'info';
}

export function collectBlockingVulnerabilities(
  report: NpmAuditReport,
): AuditVulnerabilitySummary[] {
  const results: AuditVulnerabilitySummary[] = [];
  const vulns = report.vulnerabilities ?? {};

  for (const [key, entry] of Object.entries(vulns)) {
    const severity = normalizeSeverity(entry.severity);
    if (!BLOCKING.has(severity)) {
      continue;
    }

    const viaTitle = Array.isArray(entry.via)
      ? entry.via
          .map((item) => (typeof item === 'string' ? item : item.title ?? item.url ?? ''))
          .filter(Boolean)
          .join(', ')
      : '';

    results.push({
      name: entry.name ?? key,
      severity,
      via: viaTitle || key,
      range: entry.range,
      url: entry.url,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function shouldBlockAudit(
  report: NpmAuditReport,
  blockingSeverities: readonly string[] = ['high', 'critical'],
): boolean {
  const blocking = new Set(blockingSeverities.map((s) => s.toLowerCase()));
  const meta = report.metadata?.vulnerabilities;
  if (meta) {
    for (const severity of blocking) {
      const count = meta[severity as AuditSeverity] ?? 0;
      if (count > 0) {
        return true;
      }
    }
  }
  return collectBlockingVulnerabilities(report).some((v) => blocking.has(v.severity));
}

export function formatAuditBlockMessage(vulns: readonly AuditVulnerabilitySummary[]): string {
  if (vulns.length === 0) {
    return '';
  }

  const lines = [
    '✖ npm audit found high/critical dependency vulnerabilities — commit blocked.',
    '',
    'Vulnerabilities:',
  ];

  for (const vuln of vulns) {
    lines.push(`  • [${vuln.severity}] ${vuln.name}${vuln.range ? ` (${vuln.range})` : ''}`);
    if (vuln.via) {
      lines.push(`      via: ${vuln.via}`);
    }
    if (vuln.url) {
      lines.push(`      ${vuln.url}`);
    }
  }

  lines.push('');
  lines.push('Fix: upgrade or replace the affected packages, then re-run `npm audit`.');
  lines.push('      Use `npm audit fix` when safe, or pin to a patched version.');
  return lines.join('\n');
}

export function parseNpmAuditJson(raw: string): NpmAuditReport {
  const parsed = JSON.parse(raw) as NpmAuditReport;
  return parsed;
}
