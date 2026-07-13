import {
  PRD_SECTION_KEYS,
  formatPrdSectionValue,
  type PrdSectionKey,
  type PrdSections,
} from '@autodev/shared-types';

export type DiffLineKind = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  leftLineNumber?: number;
  rightLineNumber?: number;
}

export interface SectionDiff {
  key: PrdSectionKey;
  changed: boolean;
  lines: DiffLine[];
}

export interface PrdSectionsDiff {
  sections: SectionDiff[];
  changedSectionCount: number;
}

/**
 * Line-oriented compare of two PRD section maps (array fields joined by newlines).
 */
export function diffPrdSections(left: PrdSections, right: PrdSections): PrdSectionsDiff {
  const sections = PRD_SECTION_KEYS.map((key) => {
    const leftText = formatPrdSectionValue(left[key]);
    const rightText = formatPrdSectionValue(right[key]);
    const lines = diffLines(leftText, rightText);
    const changed = lines.some((line) => line.kind !== 'unchanged');
    return { key, changed, lines };
  });

  return {
    sections,
    changedSectionCount: sections.filter((section) => section.changed).length,
  };
}

export function diffLines(leftText: string, rightText: string): DiffLine[] {
  const leftLines = splitLines(leftText);
  const rightLines = splitLines(rightText);
  const matrix = buildLcsMatrix(leftLines, rightLines);
  const result: DiffLine[] = [];

  let i = leftLines.length;
  let j = rightLines.length;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      stack.push({
        kind: 'unchanged',
        text: leftLines[i - 1]!,
        leftLineNumber: i,
        rightLineNumber: j,
      });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || matrix[i]![j - 1]! >= matrix[i - 1]![j]!)) {
      stack.push({
        kind: 'added',
        text: rightLines[j - 1]!,
        rightLineNumber: j,
      });
      j -= 1;
    } else if (i > 0) {
      stack.push({
        kind: 'removed',
        text: leftLines[i - 1]!,
        leftLineNumber: i,
      });
      i -= 1;
    }
  }

  while (stack.length > 0) {
    result.push(stack.pop()!);
  }

  return result;
}

function splitLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }
  return value.split('\n');
}

function buildLcsMatrix(left: string[], right: string[]): number[][] {
  const rows = left.length;
  const cols = right.length;
  const matrix: number[][] = Array.from({ length: rows + 1 }, () =>
    Array.from({ length: cols + 1 }, () => 0),
  );

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]! + 1;
      } else {
        matrix[i]![j] = Math.max(matrix[i - 1]![j]!, matrix[i]![j - 1]!);
      }
    }
  }

  return matrix;
}
