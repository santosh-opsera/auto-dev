/** Default ports for Express fixture servers used in mock mode. */
export const MOCK_PORTS = {
  github: Number(process.env.E2E_MOCK_GITHUB_PORT ?? 9101),
  jira: Number(process.env.E2E_MOCK_JIRA_PORT ?? 9102),
  llm: Number(process.env.E2E_MOCK_LLM_PORT ?? 9103),
} as const;

export function mockBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}
