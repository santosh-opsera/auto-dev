const SAMPLE_BRANCH_NAMES = [
  'feature/OPL-1234',
  'bugfix/OPL-35139',
  'feature/OPL-99',
];

export function insertTemplateVariable(
  value: string,
  variable: string,
  selectionStart?: number | null,
  selectionEnd?: number | null,
): string {
  const token = `{${variable}}`;
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  return value.slice(0, start) + token + value.slice(end);
}

export function previewBranchName(pattern: string): string {
  if (!pattern.trim()) {
    return 'Enter a regex pattern to preview a sample branch name.';
  }

  try {
    const regex = new RegExp(pattern);
    const match = SAMPLE_BRANCH_NAMES.find((candidate) => regex.test(candidate));
    return match ?? 'No sample branch matched — adjust the pattern or try ^(feature|bugfix)/OPL-\\d+$';
  } catch {
    return 'Invalid regex — fix syntax to preview a branch name.';
  }
}

export function getChangedConventionFields(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const changed: string[] = [];

  for (const key of keys) {
    if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
      changed.push(key);
    }
  }

  return changed;
}
