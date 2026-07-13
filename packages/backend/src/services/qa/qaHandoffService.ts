import { randomUUID } from 'node:crypto';
import {
  DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  buildVerificationChecklist,
  type ChangeSummary,
  type HandoffCoverageReport,
  type HandoffJiraTicket,
  type QaFeedbackItem,
  type QaHandoffApproveRequest,
  type QaHandoffGenerateRequest,
  type QaHandoffRequestChangesRequest,
  type QaHandoffResponse,
  type VerificationChecklistItem,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import { getChunkTestReportModel } from '../../models/chunkTestReportModel.js';
import { getDeploymentModel } from '../../models/deploymentModel.js';
import {
  getQaHandoffModel,
  type QaHandoffRecord,
} from '../../models/qaHandoffModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '../events/eventBus.js';
import { buildJiraTicketUrl } from '../github/prHelpers.js';

function mapHandoff(doc: QaHandoffRecord): QaHandoffResponse {
  const response: QaHandoffResponse = {
    id: doc._id.toString(),
    workflowDocumentId: doc.workflowDocumentId,
    workflowId: doc.workflowId,
    status: doc.status,
    changeSummary: {
      filesChanged: [...doc.changeSummary.filesChanged],
      linesAdded: doc.changeSummary.linesAdded,
      linesRemoved: doc.changeSummary.linesRemoved,
      ...(doc.changeSummary.affectedModules
        ? { affectedModules: [...doc.changeSummary.affectedModules] }
        : {}),
    },
    jiraTicket: {
      ticketKey: doc.jiraTicket.ticketKey,
      summary: doc.jiraTicket.summary,
      acceptanceCriteria: [...doc.jiraTicket.acceptanceCriteria],
      ...(doc.jiraTicket.url ? { url: doc.jiraTicket.url } : {}),
    },
    coverageReport: {
      coveragePercent: doc.coverageReport.coveragePercent,
      uncoveredLines: doc.coverageReport.uncoveredLines.map((entry) => ({
        filePath: entry.filePath,
        lines: [...entry.lines],
      })),
      ...(doc.coverageReport.lines !== undefined ? { lines: doc.coverageReport.lines } : {}),
      ...(doc.coverageReport.branches !== undefined
        ? { branches: doc.coverageReport.branches }
        : {}),
      ...(doc.coverageReport.functions !== undefined
        ? { functions: doc.coverageReport.functions }
        : {}),
      ...(doc.coverageReport.statements !== undefined
        ? { statements: doc.coverageReport.statements }
        : {}),
    },
    verificationChecklist: doc.verificationChecklist.map((item) => ({
      id: item.id,
      acceptanceCriterion: item.acceptanceCriterion,
      status: item.status,
      ...(item.notes ? { notes: item.notes } : {}),
    })),
    deploymentUrl: doc.deploymentUrl,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  if (doc.feedbackItems?.length) {
    response.feedbackItems = doc.feedbackItems.map((item) => ({
      id: item.id,
      description: item.description,
      ...(item.checklistItemId ? { checklistItemId: item.checklistItemId } : {}),
    }));
  }
  if (doc.approvedAt) {
    response.approvedAt = doc.approvedAt.toISOString();
  }
  if (doc.changesRequestedAt) {
    response.changesRequestedAt = doc.changesRequestedAt.toISOString();
  }

  return response;
}

/** Pure helper — derive checklist items from acceptance criteria. */
export function generateVerificationChecklist(
  acceptanceCriteria: string[],
): VerificationChecklistItem[] {
  return buildVerificationChecklist(acceptanceCriteria);
}

/** Pure helper — average coverage across chunk test reports. */
export function assembleCoverageFromReports(
  reports: Array<{
    coverage: {
      overallPercent: number;
      lines: number;
      branches: number;
      functions: number;
      statements: number;
    };
    sourceFilesSnapshot?: Record<string, string>;
  }>,
): HandoffCoverageReport {
  if (reports.length === 0) {
    return {
      coveragePercent: 0,
      uncoveredLines: [],
      lines: 0,
      branches: 0,
      functions: 0,
      statements: 0,
    };
  }

  const totals = reports.reduce(
    (acc, report) => ({
      overall: acc.overall + report.coverage.overallPercent,
      lines: acc.lines + report.coverage.lines,
      branches: acc.branches + report.coverage.branches,
      functions: acc.functions + report.coverage.functions,
      statements: acc.statements + report.coverage.statements,
    }),
    { overall: 0, lines: 0, branches: 0, functions: 0, statements: 0 },
  );

  const count = reports.length;
  const uncoveredLines = reports.flatMap((report) => {
    const snapshot = report.sourceFilesSnapshot ?? {};
    return Object.keys(snapshot).map((filePath) => ({
      filePath,
      lines: [] as number[],
    }));
  });

  return {
    coveragePercent: Math.round((totals.overall / count) * 10) / 10,
    lines: Math.round(totals.lines / count),
    branches: Math.round(totals.branches / count),
    functions: Math.round(totals.functions / count),
    statements: Math.round(totals.statements / count),
    uncoveredLines,
  };
}

export class QaHandoffService {
  async generate(
    user: UserDocument,
    workflowDocumentId: string,
    request: QaHandoffGenerateRequest = {},
  ): Promise<QaHandoffResponse> {
    const userId = user._id.toString();
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);

    const existing = await getQaHandoffModel().findOne({
      userId,
      workflowDocumentId: workflow._id.toString(),
    });

    if (existing && !request.force) {
      return mapHandoff(existing);
    }

    const assembled = await this.assemblePackage(user, workflow, request);
    const checklist = generateVerificationChecklist(assembled.jiraTicket.acceptanceCriteria);

    if (existing && request.force) {
      existing.status = 'READY';
      existing.changeSummary = assembled.changeSummary;
      existing.jiraTicket = assembled.jiraTicket;
      existing.coverageReport = assembled.coverageReport;
      existing.verificationChecklist = checklist;
      existing.deploymentUrl = assembled.deploymentUrl;
      existing.feedbackItems = undefined;
      existing.approvedAt = undefined;
      existing.changesRequestedAt = undefined;
      existing.updatedBy = userId;
      await existing.save();

      await this.publishReady(existing, userId, workflow.ticketKey);
      await auditService.logSafe({
        actor: userId,
        resource: `qa-handoffs/${existing._id.toString()}`,
        operation: 'update',
        newValue: { status: 'READY', workflowId: workflow.workflowId },
        correlationId: `qa-handoff:${existing._id.toString()}`,
      });

      return mapHandoff(existing);
    }

    const doc = await getQaHandoffModel().create({
      userId,
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      status: 'READY',
      changeSummary: assembled.changeSummary,
      jiraTicket: assembled.jiraTicket,
      coverageReport: assembled.coverageReport,
      verificationChecklist: checklist,
      deploymentUrl: assembled.deploymentUrl,
      createdBy: userId,
      updatedBy: userId,
      dataClassification: 'internal',
    });

    await this.publishReady(doc, userId, workflow.ticketKey);
    await auditService.logSafe({
      actor: userId,
      resource: `qa-handoffs/${doc._id.toString()}`,
      operation: 'create',
      newValue: { status: 'READY', workflowId: workflow.workflowId },
      correlationId: `qa-handoff:${doc._id.toString()}`,
    });

    return mapHandoff(doc);
  }

  async get(user: UserDocument, workflowDocumentId: string): Promise<QaHandoffResponse> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const doc = await getQaHandoffModel().findOne({
      userId: user._id.toString(),
      workflowDocumentId: workflow._id.toString(),
    });

    if (!doc) {
      throw new AppError(
        'QaHandoffNotFound',
        'QA handoff package was not found for this workflow.',
        404,
        'Generate a handoff via POST /api/v1/workflows/:id/qa-handoff first.',
      );
    }

    return mapHandoff(doc);
  }

  async approve(
    user: UserDocument,
    workflowDocumentId: string,
    request: QaHandoffApproveRequest = {},
  ): Promise<QaHandoffResponse> {
    const userId = user._id.toString();
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const doc = await this.requireHandoff(userId, workflow._id.toString());

    if (doc.status === 'APPROVED') {
      return mapHandoff(doc);
    }

    if (doc.status === 'CHANGES_REQUESTED') {
      throw new AppError(
        'QaHandoffInvalidState',
        'Cannot approve a handoff that has outstanding change requests.',
        409,
        'Regenerate the handoff after developer fixes, then approve.',
      );
    }

    const previousStatus = doc.status;
    doc.status = 'APPROVED';
    doc.approvedAt = new Date();
    doc.verificationChecklist = doc.verificationChecklist.map((item) => ({
      id: item.id,
      acceptanceCriterion: item.acceptanceCriterion,
      status: 'checked' as const,
      ...(item.notes ? { notes: item.notes } : {}),
    }));
    doc.updatedBy = userId;
    await doc.save();

    await eventBus.publish(
      {
        type: 'QA_HANDOFF_APPROVED',
        payload: {
          handoffId: doc._id.toString(),
          workflowId: doc.workflowId,
          ticketKey: doc.jiraTicket.ticketKey,
        },
        metadata: {
          eventId: randomUUID(),
          correlationId: `qa-handoff:${doc._id.toString()}`,
          actor: userId,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
      { awaitHandlers: true },
    );

    await auditService.logSafe({
      actor: userId,
      resource: `qa-handoffs/${doc._id.toString()}`,
      operation: 'update',
      previousValue: { status: previousStatus },
      newValue: {
        status: 'APPROVED',
        ...(request.notes ? { notes: request.notes } : {}),
      },
      correlationId: `qa-handoff:${doc._id.toString()}`,
    });

    return mapHandoff(doc);
  }

  async requestChanges(
    user: UserDocument,
    workflowDocumentId: string,
    request: QaHandoffRequestChangesRequest,
  ): Promise<QaHandoffResponse> {
    const userId = user._id.toString();
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const doc = await this.requireHandoff(userId, workflow._id.toString());

    if (doc.status === 'APPROVED') {
      throw new AppError(
        'QaHandoffInvalidState',
        'Cannot request changes on an already approved handoff.',
        409,
        'Regenerate the handoff if further changes are needed.',
      );
    }

    const previousStatus = doc.status;
    const feedbackItems: QaFeedbackItem[] = request.feedbackItems.map((item) => ({
      id: item.id,
      description: item.description,
      ...(item.checklistItemId ? { checklistItemId: item.checklistItemId } : {}),
    }));

    doc.status = 'CHANGES_REQUESTED';
    doc.feedbackItems = feedbackItems;
    doc.changesRequestedAt = new Date();
    doc.updatedBy = userId;
    await doc.save();

    // Route change requests back to developers via EventBus (dashboard SSE consumers).
    await eventBus.publish(
      {
        type: 'QA_CHANGES_REQUESTED',
        payload: {
          handoffId: doc._id.toString(),
          workflowId: doc.workflowId,
          ticketKey: doc.jiraTicket.ticketKey,
          feedbackItems,
          feedbackCount: feedbackItems.length,
        },
        metadata: {
          eventId: randomUUID(),
          correlationId: `qa-handoff:${doc._id.toString()}`,
          actor: userId,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
      { awaitHandlers: true },
    );

    await auditService.logSafe({
      actor: userId,
      resource: `qa-handoffs/${doc._id.toString()}`,
      operation: 'update',
      previousValue: { status: previousStatus },
      newValue: { status: 'CHANGES_REQUESTED', feedbackCount: feedbackItems.length },
      correlationId: `qa-handoff:${doc._id.toString()}`,
    });

    return mapHandoff(doc);
  }

  private async publishReady(
    doc: QaHandoffRecord,
    userId: string,
    ticketKey: string,
  ): Promise<void> {
    await eventBus.publish(
      {
        type: 'QA_HANDOFF_READY',
        payload: {
          handoffId: doc._id.toString(),
          workflowId: doc.workflowId,
          ticketKey,
          deploymentUrl: doc.deploymentUrl,
        },
        metadata: {
          eventId: randomUUID(),
          correlationId: `qa-handoff:${doc._id.toString()}`,
          actor: userId,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
      { awaitHandlers: true },
    );
  }

  private async assemblePackage(
    user: UserDocument,
    workflow: WorkflowRecord,
    request: QaHandoffGenerateRequest,
  ): Promise<{
    changeSummary: ChangeSummary;
    jiraTicket: HandoffJiraTicket;
    coverageReport: HandoffCoverageReport;
    deploymentUrl: string;
  }> {
    const jiraTicket =
      request.jiraTicket ?? (await this.resolveJiraTicket(user, workflow.ticketKey));
    const coverageReport =
      request.coverageReport ?? (await this.resolveCoverage(user, workflow));
    const deploymentUrl =
      request.deploymentUrl ?? (await this.resolveDeploymentUrl(user, workflow.workflowId));
    const changeSummary = request.changeSummary ?? this.resolveChangeSummary(workflow);

    return { changeSummary, jiraTicket, coverageReport, deploymentUrl };
  }

  private async resolveJiraTicket(
    user: UserDocument,
    ticketKey: string,
  ): Promise<HandoffJiraTicket> {
    const intent = await getTicketIntentModel()
      .findOne({ userId: String(user._id), ticketKey })
      .exec();

    if (!intent) {
      throw new AppError(
        'TicketIntentRequired',
        `No ticket intent found for ${ticketKey}; cannot assemble QA handoff.`,
        409,
        'Parse the Jira ticket before generating a QA handoff package.',
      );
    }

    if (intent.acceptanceCriteria.length === 0) {
      throw new AppError(
        'AcceptanceCriteriaRequired',
        'Ticket has no acceptance criteria; verification checklist cannot be generated.',
        409,
        'Add acceptance criteria to the Jira ticket and re-parse before generating handoff.',
      );
    }

    return {
      ticketKey,
      summary: intent.metadata.sourceSummary || intent.problemStatement,
      acceptanceCriteria: [...intent.acceptanceCriteria],
      url: buildJiraTicketUrl(ticketKey),
    };
  }

  private async resolveCoverage(
    user: UserDocument,
    workflow: WorkflowRecord,
  ): Promise<HandoffCoverageReport> {
    const reports = await getChunkTestReportModel()
      .find({
        userId: String(user._id),
        workflowDocumentId: workflow._id.toString(),
      })
      .exec();

    if (reports.length === 0) {
      return {
        coveragePercent: 0,
        uncoveredLines: [],
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      };
    }

    return assembleCoverageFromReports(
      reports.map((report) => ({
        coverage: report.coverage,
        sourceFilesSnapshot: report.sourceFilesSnapshot,
      })),
    );
  }

  private async resolveDeploymentUrl(user: UserDocument, workflowId: string): Promise<string> {
    const deployment = await getDeploymentModel()
      .findOne({
        userId: String(user._id),
        workflowId,
        status: 'RUNNING',
      })
      .sort({ createdAt: -1 })
      .exec();

    return deployment?.baseUrl ?? DEFAULT_LOCAL_DEPLOYMENT_BASE_URL;
  }

  private resolveChangeSummary(workflow: WorkflowRecord): ChangeSummary {
    const pr = workflow.pullRequest;
    if (pr) {
      return {
        filesChanged: [],
        linesAdded: 0,
        linesRemoved: 0,
        affectedModules: [pr.changeType],
      };
    }

    return {
      filesChanged: [],
      linesAdded: 0,
      linesRemoved: 0,
    };
  }

  private async requireHandoff(
    userId: string,
    workflowDocumentId: string,
  ): Promise<QaHandoffRecord> {
    const doc = await getQaHandoffModel().findOne({ userId, workflowDocumentId });
    if (!doc) {
      throw new AppError(
        'QaHandoffNotFound',
        'QA handoff package was not found for this workflow.',
        404,
        'Generate a handoff via POST /api/v1/workflows/:id/qa-handoff first.',
      );
    }
    return doc;
  }

  private async loadOwnedWorkflow(
    user: UserDocument,
    workflowDocumentId: string,
  ): Promise<WorkflowRecord> {
    if (!/^[a-fA-F0-9]{24}$/.test(workflowDocumentId)) {
      throw new AppError(
        'WorkflowNotFound',
        'Workflow was not found.',
        404,
        'Provide a valid workflow id belonging to the signed-in user.',
      );
    }

    const workflow = await getWorkflowModel().findById(workflowDocumentId).exec();
    if (!workflow || workflow.userId !== String(user._id)) {
      throw new AppError(
        'WorkflowNotFound',
        'Workflow was not found.',
        404,
        'Provide a valid workflow id belonging to the signed-in user.',
      );
    }
    return workflow;
  }
}

export const qaHandoffService = new QaHandoffService();
