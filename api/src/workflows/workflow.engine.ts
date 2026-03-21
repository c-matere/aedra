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

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Optional() handlers?: Partial<WorkflowHandlers>,
  ) {
    this.handlers = { ...defaultHandlers(this.instanceId), ...handlers } as WorkflowHandlers;
    this.logger.log(`WorkflowEngine instance created: ${this.instanceId}`);
  }

  setHandlers(handlers: Partial<WorkflowHandlers>) {
    this.logger.log(`[${this.instanceId}] Wiring new handlers: ${Object.keys(handlers).join(', ')}`);
    Object.assign(this.handlers, handlers);
  }

  async create(
    workflowId: string,
    userId: string,
    context: Record<string, any> = {},
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
      context,
      stagingJobId: context.jobId,
      createdAt: now,
      updatedAt: now,
      completedSteps: [],
      failedSteps: [],
      status: 'RUNNING',
    };

    await this.persist(instance);
    await this.setActiveInstanceForUser(userId, instance.instanceId);
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
        await this.persist(instance, 'COMPLETED');
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
            await this.persist(instance, 'WAITING');
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
        await this.persist(instance, 'FAILED');
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
    await this.persist(instance, 'ACTIVE');

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
    await this.persist(instance, 'ACTIVE', { stepId, fromStatus });
  }

  private async persist(
    instance: WorkflowInstance,
    prismaStatusOverride?: string,
    stepUpdate?: { stepId: string; fromStatus: PrismaStatus },
  ): Promise<void> {
    const status =
      (prismaStatusOverride as PrismaStatus) ||
      this.mapStatusToPrisma(instance.status);

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

    return {
      instanceId: dbInstance.id,
      workflowId: dbInstance.type.toString().toLowerCase(),
      userId: (dbInstance as any).userId,
      currentState: dbInstance.steps[dbInstance.steps.length - 1]?.action || 'INITIATED',
      currentStepIndex: dbInstance.steps.length,
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
    const id = workflowId.toUpperCase();
    if (id === 'TENANT_IMPORT') return WorkflowType.TENANT_ONBOARDING;
    if (id === 'RENT_COLLECTION_CYCLE') return WorkflowType.RENT_COLLECTION;
    if (id === 'MAINTENANCE_RESOLUTION') return WorkflowType.MAINTENANCE_LIFECYCLE;
    if (id === 'AUTONOMOUS_AGENT') return 'AUTONOMOUS_AGENT' as any;
    return WorkflowType.RENT_COLLECTION; // Default
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
