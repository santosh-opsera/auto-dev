/** Mock Jira API error response bodies (WO-011). */
export const mockJiraErrorBodies = {
  unauthorized: { message: 'Client must be authenticated' },
  forbidden: { errorMessages: ['You do not have permission to view this issue.'] },
  notFound: { errorMessages: ['Issue Does Not Exist'] },
  rateLimited: { message: 'Rate limit exceeded' },
  badGateway: { message: 'Bad Gateway' },
  unavailable: { message: 'Service Unavailable' },
};
