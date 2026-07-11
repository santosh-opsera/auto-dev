/**
 * Forge resolver entry points for AutoDev Jira integration.
 * Deploy with `forge deploy` from packages/forge-app after linking the app.
 */

interface ForgeContext {
  extension: {
    issue: {
      key: string;
    };
  };
}

export async function handler(context: ForgeContext): Promise<{ body: string }> {
  return {
    body: JSON.stringify({
      ticketKey: context.extension.issue.key,
      message: 'AutoDev Forge issue panel scaffold is installed.',
    }),
  };
}

export async function fetchIssue(context: ForgeContext): Promise<{ body: string }> {
  return {
    body: JSON.stringify({
      key: context.extension.issue.key,
    }),
  };
}
