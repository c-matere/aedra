import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import { AEDRA_WORKFLOWS } from './workflow.registry';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowType, WorkflowStatus as PrismaStatus } from '@prisma/client';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowEvent,
  WorkflowStep,
  WorkflowStatus,
} from './workflow.types';

export interface WorkflowHandlers {
  executeRule(stepId: string, context: Record<string, any>): Promise<any>;
  executeTool(stepId: string, context: Record<string, any>): Promise<any>;
  executeAI(stepId: string, context: Record<string, any>): Promise<any>;
  onWait?(instance: WorkflowInstance, step: WorkflowStep): Promise<void> | void;
}

const defaultHandlers = (instanceId: string): WorkflowHandlers => ({
  executeRule: async () => {
    throw new Error(`WorkflowEngine rule handler not wired (Instance: ${instanceId}).`);
  },
  executeTool: async () => {
    throw new Error(`WorkflowEngine tool handler not wired (Instance: ${instanceId}).`);
  },
  executeAI: async () => {
    throw new Error(`WorkflowEngine AI handler not wired (Instance: ${instanceId}).`);
  },
  onWait: async () => {},
});

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);
  private readonly handlers: WorkflowHandlers;
  private readonly instanceId = randomUUID();

  // Temporary in-memory cache for pending workflow states (multi-turn info gathering)
  private readonly pendingStates = new Map<string, { intent: string; entities: Record<string, any> }>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Optional() handlers?: Partial<WorkflowHandlers>,
  ) {
    this.handlers = { ...defaultHandlers(this.instanceId), ...handlers } as WorkflowHandlers;
    this.logger.log(`WorkflowEngine instance created: ${this.instanceId}`);
  }

  async getPendingState(chatId: string) {
    return this.pendingStates.get(chatId);
  }

  async setPendingState(chatId: string, state: { intent: string; entities: Record<string, any> }) {
    this.pendingStates.set(chatId, state);
  }

  async clearPendingState(chatId: string) {
    this.pendingStates.delete(chatId);
  }

  setHandlers(handlers: Partial<WorkflowHandlers>) {
    this.logger.log(`[${this.instanceId}] Wiring new handlers: ${Object.keys(handlers).join(', ')}`);
    Object.assign(this.handlers, handlers);
  }

  hasHandlers(): boolean {
    // Check if executeRule is still the default throwing one or actually wired
    // Since we use Object.assign, we can't easily check the function body
    // but we can check if it was called via a flag if we wanted.
    // However, the error log says "WorkflowEngine tool handler not wired (Instance: ...)"
    // which comes from defaultHandlers.
    // For now, assume if setHandlers was called, we are good, 
    // but better to check if any handler is NOT the default one.
    return !this.handlers.executeTool.toString().includes('WorkflowEngine tool handler not wired');
  }

  async create(
    workflowId: string,
    userId: string,
    context: Record<string, any> = {},
    opts?: { deferExecution?: boolean },
  ): Promise<WorkflowInstance> {
    const workflow = this.getDefinition(workflowId);
    const now = new Date().toISOString();

    const instance: WorkflowInstance = {
      instanceId: randomUUID(),
      workflowId,
      userId,
      currentState:
        workflow.initialState || (workflow.states[0] ?? 'INITIATED'),
      currentStepIndex: 0,
      context: { ...context, workflowId },
      stagingJobId: context.jobId,
      createdAt: now,
      updatedAt: now,
      completedSteps: [],
      failedSteps: [],
      status: opts?.deferExecution ? 'WAITING' : 'RUNNING',
    };

    await this.persist(instance);
    await this.setActiveInstanceForUser(userId, instance.instanceId);
    if (opts?.deferExecution) return instance;
    return this.execute(instance);
  }

  async execute(instance: WorkflowInstance): Promise<WorkflowInstance> {
    const workflow = this.getDefinition(instance.workflowId);

    let keepRunning = true;

    while (keepRunning) {
      const step = workflow.steps[instance.currentStepIndex];

      if (!step) {
        instance.status = 'COMPLETED';
        instance.currentState =
          workflow.states[workflow.states.length - 1] || 'COMPLETED';
        instance.updatedAt = new Date().toISOString();
        await this.persist(instance);
        break;
      }

      const fromStatus = this.mapStatusToPrisma(instance.status);

      try {
        switch (step.type) {
          case 'RULE': {
            const result = await this.handlers.executeRule(
              step.id,
              instance.context,
            );
            instance.context[step.id] = result;
            instance.completedSteps.push(step.id);
            await this.advance(instance, workflow, step.id, fromStatus);
            break;
          }
          case 'TOOL': {
            const result = await this.handlers.executeTool(
              step.id,
              instance.context,
            );
            instance.context[step.id] = result;
            instance.completedSteps.push(step.id);
            await this.advance(instance, workflow, step.id, fromStatus);
            break;
          }
          case 'AI': {
            const result = await this.handlers.executeAI(
              step.id,
              instance.context,
            );
            instance.context[step.id] = result;
            instance.completedSteps.push(step.id);
            await this.advance(instance, workflow, step.id, fromStatus);
            break;
          }
          case 'WAIT': {
            instance.status = 'WAITING';
            instance.currentState =
              workflow.states[instance.currentStepIndex] || 'WAITING';
            instance.updatedAt = new Date().toISOString();
            await this.persist(instance);
            await this.handlers.onWait?.(instance, step);
            keepRunning = false;
            break;
          }
          default: {
            throw new Error(`Unknown workflow step type: ${step.type}`);
          }
        }
      } catch (error: any) {
        instance.status = 'FAILED';
        instance.failedSteps.push(step?.id || 'unknown');
        instance.updatedAt = new Date().toISOString();
        await this.persist(instance);
        this.logger.error(
          `Workflow ${instance.workflowId} failed at step ${step?.id}: ${error.message}`,
        );
        throw error;
      }
    }

    return instance;
  }

  async resume(
    instanceId: string,
    event: WorkflowEvent,
  ): Promise<WorkflowInstance> {
    const instance = await this.load(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    instance.context = { ...instance.context, resumeEvent: event };
    instance.status = 'RUNNING';
    instance.updatedAt = new Date().toISOString();
    await this.persist(instance);

    return this.execute(instance);
  }

  async getActiveInstance(userId: string): Promise<WorkflowInstance | null> {
    const instanceId =
      (await this.cache.get<string>(this.activeKey(userId))) || null;
    if (!instanceId) return null;
    return await this.load(instanceId);
  }

  async clearActiveInstance(userId: string): Promise<void> {
    await this.cache.del(this.activeKey(userId));
  }

  private async advance(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    stepId: string,
    fromStatus: PrismaStatus,
  ): Promise<void> {
    instance.currentStepIndex += 1;
    instance.currentState =
      workflow.states[instance.currentStepIndex] || instance.currentState;
    instance.updatedAt = new Date().toISOString();
    await this.persist(instance, { stepId, fromStatus });
  }

  private async persist(
    instance: WorkflowInstance,
    stepUpdate?: { stepId: string; fromStatus: PrismaStatus },
  ): Promise<void> {
    const status = this.mapStatusToPrisma(instance.status);

    // 1. Persist Instance
    let finalCompanyId = instance.context.companyId;

    if (!finalCompanyId || finalCompanyId === 'SYSTEM') {
      // Robust fallback for Super Admins or missing context
      const firstCompany = await this.prisma.company.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (firstCompany) {
        finalCompanyId = firstCompany.id;
        this.logger.warn(
          `[WorkflowEngine] Using fallback companyId ${finalCompanyId} for instance ${instance.instanceId}`,
        );
      } else {
        finalCompanyId = 'SYSTEM'; // Let it fail if no company exists at all
      }
    }

    await this.prisma.workflowInstance.upsert({
      where: { id: instance.instanceId },
      create: {
        id: instance.instanceId,
        type: this.mapWorkflowType(instance.workflowId),
        status: status,
        userId: instance.userId as any,
        companyId: finalCompanyId,
        metadata: instance.context as any,
      },
      update: {
        status: status,
        metadata: instance.context as any,
        updatedAt: new Date(instance.updatedAt),
      },
    });

    // 2. Persist Step if provided
    if (stepUpdate) {
      await this.prisma.workflowStep.create({
        data: {
          workflowInstanceId: instance.instanceId,
          action: stepUpdate.stepId,
          fromStatus: stepUpdate.fromStatus,
          toStatus: status,
          metadata: instance.context as any,
        },
      });
    }

    // 3. Update Cache for active tracking
    await this.cache.set(
      this.activeKey(instance.userId),
      instance.instanceId,
      7 * 24 * 60 * 60, // 7 days
    );
  }

  private async load(instanceId: string): Promise<WorkflowInstance | null> {
    const dbInstance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { steps: { orderBy: { timestamp: 'asc' } } },
    });

    if (!dbInstance) return null;

    const workflowId = this.mapTypeToRegistryId(dbInstance.type);
    const definition = AEDRA_WORKFLOWS[workflowId];
    const hasSteps = dbInstance.steps.length > 0;

    return {
      instanceId: dbInstance.id,
      workflowId,
      userId: (dbInstance as any).userId,
      currentState: hasSteps
        ? dbInstance.steps[dbInstance.steps.length - 1]?.action || 'INITIATED'
        : definition?.initialState || (definition?.states?.[0] ?? 'INITIATED'),
      currentStepIndex: hasSteps ? dbInstance.steps.length : 0,
      context: dbInstance.metadata as any,
      createdAt: dbInstance.createdAt.toISOString(),
      updatedAt: dbInstance.updatedAt.toISOString(),
      completedSteps: dbInstance.steps.map((s) => s.action),
      failedSteps: dbInstance.status === 'FAILED' ? [dbInstance.steps[dbInstance.steps.length - 1]?.action] : [],
      status: this.mapPrismaToWorkflowStatus(dbInstance.status),
    };
  }

  private mapStatusToPrisma(status: WorkflowStatus): PrismaStatus {
    switch (status) {
      case 'RUNNING':
        return PrismaStatus.ACTIVE;
      case 'WAITING':
        return PrismaStatus.AWAITING_INPUT;
      case 'COMPLETED':
        return PrismaStatus.COMPLETED;
      case 'FAILED':
        return PrismaStatus.FAILED;
      case 'CANCELLED':
        return PrismaStatus.CANCELLED;
      default:
        return PrismaStatus.PENDING;
    }
  }

  private mapPrismaToWorkflowStatus(status: PrismaStatus): WorkflowStatus {
    switch (status) {
      case PrismaStatus.ACTIVE:
        return 'RUNNING';
      case PrismaStatus.AWAITING_INPUT:
      case PrismaStatus.AWAITING_CONFIRMATION:
      case 'BACKGROUND_PAUSED' as any:
        return 'WAITING';
      case PrismaStatus.COMPLETED:
        return 'COMPLETED';
      case PrismaStatus.FAILED:
        return 'FAILED';
      case PrismaStatus.CANCELLED:
        return 'CANCELLED';
      default:
        return 'RUNNING';
    }
  }

  private mapWorkflowType(workflowId: string): WorkflowType {
    const id = workflowId.toLowerCase();
    if (id === 'tenant_import' || id === 'tenant_onboarding')
      return WorkflowType.TENANT_ONBOARDING;
    if (id === 'rent_collection_cycle' || id === 'rent_collection')
      return WorkflowType.RENT_COLLECTION;
    if (id === 'maintenance_resolution' || id === 'maintenance_lifecycle')
      return WorkflowType.MAINTENANCE_LIFECYCLE;
    if (id === 'autonomous_agent') return WorkflowType.AUTONOMOUS_AGENT;
    if (id === 'report_generation') return WorkflowType.RENT_COLLECTION; // Fallback for now if no specific type
    if (id === 'vacancy_to_let') return WorkflowType.RENT_COLLECTION; // Fallback
    return WorkflowType.RENT_COLLECTION;
  }

  private mapTypeToRegistryId(type: WorkflowType): string {
    switch (type) {
      case WorkflowType.TENANT_ONBOARDING:
        return 'tenant_import';
      case WorkflowType.RENT_COLLECTION:
        return 'rent_collection_cycle';
      case WorkflowType.MAINTENANCE_LIFECYCLE:
        return 'maintenance_resolution';
      case WorkflowType.AUTONOMOUS_AGENT:
        return 'autonomous_agent';
      default:
        return type.toString().toLowerCase();
    }
  }

  private async setActiveInstanceForUser(
    userId: string,
    instanceId: string,
  ): Promise<void> {
    await this.cache.set(
      this.activeKey(userId),
      instanceId,
      7 * 24 * 60 * 60,
    );
  }

  private getDefinition(workflowId: string): WorkflowDefinition {
    const workflow = AEDRA_WORKFLOWS[workflowId];
    if (!workflow) {
      throw new Error(`Workflow definition not found for id "${workflowId}"`);
    }
    return workflow;
  }

  private activeKey(userId: string): string {
    return `workflow:active:${userId}`;
  }
}
