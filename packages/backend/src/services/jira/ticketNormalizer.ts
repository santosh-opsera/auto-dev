import type { NormalizedTicket } from '@autodev/shared-types';

interface JiraDocNode {
  type?: string;
  text?: string;
  content?: JiraDocNode[];
}

interface JiraIssueLink {
  type?: { outward?: string; name?: string; inward?: string };
  outwardIssue?: { key?: string; fields?: { summary?: string } };
  inwardIssue?: { key?: string; fields?: { summary?: string } };
}

interface JiraAttachment {
  id?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

interface JiraSprintField {
  id?: number | string;
  name?: string;
  state?: string;
}

export interface JiraIssueResponse {
  id?: string;
  key?: string;
  fields?: {
    summary?: string;
    description?: string | JiraDocNode | null;
    labels?: string[];
    attachment?: JiraAttachment[];
    issuelinks?: JiraIssueLink[];
    customfield_10020?: JiraSprintField[] | JiraSprintField | null;
    issuetype?: { name?: string };
  };
}

function extractText(node: JiraDocNode | undefined): string {
  if (!node) {
    return '';
  }

  if (node.type === 'text' && node.text) {
    return node.text;
  }

  return (node.content ?? []).map((child) => extractText(child)).join(' ').trim();
}

function extractAcceptanceCriteria(description: JiraDocNode | string | null | undefined): string[] {
  if (!description || typeof description === 'string') {
    return [];
  }

  const criteria: string[] = [];
  let inCriteriaSection = false;

  for (const block of description.content ?? []) {
    if (block.type === 'heading') {
      const heading = extractText(block);
      inCriteriaSection = /acceptance criteria/i.test(heading);
      continue;
    }

    if (!inCriteriaSection) {
      continue;
    }

    if (block.type === 'bulletList' || block.type === 'orderedList') {
      for (const item of block.content ?? []) {
        const text = extractText(item);
        if (text) {
          criteria.push(text);
        }
      }
    }
  }

  return criteria;
}

function extractDescriptionText(description: JiraDocNode | string | null | undefined): string {
  if (!description) {
    return '';
  }

  if (typeof description === 'string') {
    return description;
  }

  const paragraphs = (description.content ?? [])
    .filter((block) => block.type === 'paragraph')
    .map((block) => extractText(block))
    .filter(Boolean);

  return paragraphs.join('\n');
}

export function normalizeJiraIssue(issue: JiraIssueResponse): NormalizedTicket {
  const ticketKey = issue.key ?? 'UNKNOWN';
  const fields = issue.fields ?? {};

  const linkedIssues = (fields.issuelinks ?? [])
    .flatMap((link) => {
      if (link.outwardIssue?.key) {
        return [
          {
            key: link.outwardIssue.key,
            summary: link.outwardIssue.fields?.summary ?? '',
            linkType: link.type?.outward ?? link.type?.name ?? 'related',
          },
        ];
      }

      if (link.inwardIssue?.key) {
        return [
          {
            key: link.inwardIssue.key,
            summary: link.inwardIssue.fields?.summary ?? '',
            linkType: link.type?.inward ?? link.type?.name ?? 'related',
          },
        ];
      }

      return [];
    });

  const sprintField = fields.customfield_10020;
  const sprint = Array.isArray(sprintField) ? sprintField[0] : sprintField;

  return {
    ticketKey,
    summary: fields.summary ?? '',
    description: extractDescriptionText(fields.description),
    acceptanceCriteria: extractAcceptanceCriteria(fields.description),
    linkedIssues,
    attachments: (fields.attachment ?? []).map((attachment) => ({
      id: String(attachment.id ?? ''),
      filename: attachment.filename ?? 'attachment',
      mimeType: attachment.mimeType,
      size: attachment.size,
    })),
    labels: fields.labels ?? [],
    sprintContext: sprint
      ? {
          id: sprint.id !== undefined ? String(sprint.id) : undefined,
          name: sprint.name,
          state: sprint.state,
        }
      : undefined,
    issueType: fields.issuetype?.name,
  };
}
