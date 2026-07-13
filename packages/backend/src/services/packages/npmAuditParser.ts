import {
  DEFAULT_AUDIT_SEVERITY_THRESHOLD,
  severityMeetsThreshold,
  type AuditSeverity,
  type VulnerabilityFinding,
  type VulnerabilityScanResult,
} from '@autodev/shared-types';

const SEVERITIES: AuditSeverity[] = ['critical', 'high', 'moderate', 'low', 'info'];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function coerceSeverity(value: unknown): AuditSeverity {
  if (typeof value === 'string' && SEVERITIES.includes(value as AuditSeverity)) {
    return value as AuditSeverity;
  }
  return 'info';
}

/**
 * Parse npm audit --json output (v2 vulnerabilities map or legacy advisories).
 */
export function parseNpmAuditReport(auditReport: unknown): VulnerabilityFinding[] {
  const root = asRecord(auditReport);
  if (!root) {
    return [];
  }

  const findings: VulnerabilityFinding[] = [];

  const vulnerabilities = asRecord(root.vulnerabilities);
  if (vulnerabilities) {
    for (const [pkgName, entry] of Object.entries(vulnerabilities)) {
      const vuln = asRecord(entry);
      if (!vuln) {
        continue;
      }

      const severity = coerceSeverity(vuln.severity);
      const via = Array.isArray(vuln.via) ? vuln.via : [];
      const viaObjects = via.filter((v) => v && typeof v === 'object') as Record<
        string,
        unknown
      >[];

      if (viaObjects.length > 0) {
        for (const item of viaObjects) {
          findings.push({
            id: String(item.source ?? item.url ?? `${pkgName}-${severity}`),
            title: String(item.title ?? `${pkgName} vulnerability`),
            severity: coerceSeverity(item.severity ?? severity),
            packageName: String(item.name ?? pkgName),
            path: Array.isArray(vuln.nodes) ? String(vuln.nodes[0] ?? '') : undefined,
          });
        }
      } else {
        findings.push({
          id: `${pkgName}-${severity}`,
          title: `${pkgName} vulnerability`,
          severity,
          packageName: pkgName,
          path: Array.isArray(vuln.nodes) ? String(vuln.nodes[0] ?? '') : undefined,
        });
      }
    }
    return findings;
  }

  // Legacy npm audit format
  const advisories = asRecord(root.advisories);
  if (advisories) {
    for (const [id, entry] of Object.entries(advisories)) {
      const advisory = asRecord(entry);
      if (!advisory) {
        continue;
      }
      findings.push({
        id,
        title: String(advisory.title ?? 'Advisory'),
        severity: coerceSeverity(advisory.severity),
        packageName: String(advisory.module_name ?? 'unknown'),
        path: typeof advisory.findings === 'object' ? undefined : undefined,
      });
    }
  }

  return findings;
}

export function evaluateVulnerabilityScan(
  auditReport: unknown,
  severityThreshold: AuditSeverity = DEFAULT_AUDIT_SEVERITY_THRESHOLD,
): VulnerabilityScanResult {
  const findings = parseNpmAuditReport(auditReport);
  const blocking = findings.filter((f) =>
    severityMeetsThreshold(f.severity, severityThreshold),
  );
  const blockingSeverities = [
    ...new Set(blocking.map((f) => f.severity)),
  ] as AuditSeverity[];

  const blocked = blocking.length > 0;

  return {
    findings,
    severityThreshold,
    blocked,
    blockingSeverities,
    summary: blocked
      ? `Publishing blocked: ${blocking.length} finding(s) at or above ${severityThreshold}.`
      : `No vulnerabilities at or above ${severityThreshold}.`,
  };
}
