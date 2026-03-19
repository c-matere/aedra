import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import { AEDRA_WORKFLOWS } from './workflow.registry';
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

const defaultHandlers: WorkflowHandlers = {
    executeRule: async () => {
        throw new Error('WorkflowEngine rule handler not wired.');
    },
    executeTool: async () => {
        throw new Error('WorkflowEngine tool handler not wired.');
    },
    executeAI: async () => {
        throw new Error('WorkflowEngine AI handler not wired.');
    },
    onWait: async () => {},
};

@Injectable()
export class WorkflowEngine {
    private readonly logger = new Logger(WorkflowEngine.name);
    private readonly instanceTtlSeconds: number;
    private readonly handlers: WorkflowHandlers;

    constructor(
        @Inject(CACHE_MANAGER) private readonly cache: Cache,
        @Optional() handlers?: Partial<WorkflowHandlers>,
        @Optional() instanceTtlSeconds = 7 * 24 * 60 * 60, // default 7 days
    ) {
        this.instanceTtlSeconds = typeof instanceTtlSeconds === 'number' ? instanceTtlSeconds : 7 * 24 * 60 * 60;
        this.handlers = { ...defaultHandlers, ...handlers };
    }

    setHandlers(handlers: Partial<WorkflowHandlers>) {
        Object.assign(this.handlers, handlers);
    }

    async create(workflowId: string, userId: string, context: Record<string, any> = {}): Promise<WorkflowInstance> {
        const workflow = this.getDefinition(workflowId);
        const now = new Date().toISOString();

        const instance: WorkflowInstance = {
            instanceId: randomUUID(),
            workflowId,
            userId,
            currentState: workflow.initialState || (workflow.states[0] ?? 'INITIATED'),
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
                instance.currentState = workflow.states[workflow.states.length - 1] || 'COMPLETED';
                instance.updatedAt = new Date().toISOString();
                await this.persist(instance);
                break;
            }

            try {
                switch (step.type) {
                    case 'RULE': {
                        const result = await this.handlers.executeRule(step.id, instance.context);
                        instance.context[step.id] = result;
                        instance.completedSteps.push(step.id);
                        await this.advance(instance, workflow);
                        break;
                    }
                    case 'TOOL': {
                        const result = await this.handlers.executeTool(step.id, instance.context);
                        instance.context[step.id] = result;
                        instance.completedSteps.push(step.id);
                        await this.advance(instance, workflow);
                        break;
                    }
                    case 'AI': {
                        const result = await this.handlers.executeAI(step.id, instance.context);
                        instance.context[step.id] = result;
                        instance.completedSteps.push(step.id);
                        await this.advance(instance, workflow);
                        break;
                    }
                    case 'WAIT': {
                        instance.status = 'WAITING';
                        instance.currentState = workflow.states[instance.currentStepIndex] || 'WAITING';
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
                this.logger.error(`Workflow ${instance.workflowId} failed at step ${step?.id}: ${error.message}`);
                throw error;
            }
        }

        return instance;
    }

    async resume(instanceId: string, event: WorkflowEvent): Promise<WorkflowInstance> {
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
        const instanceId = (await this.cache.get<string>(this.activeKey(userId))) || null;
        if (!instanceId) return null;
        return await this.load(instanceId);
    }

    async clearActiveInstance(userId: string): Promise<void> {
        await this.cache.del(this.activeKey(userId));
    }

    private async advance(instance: WorkflowInstance, workflow: WorkflowDefinition): Promise<void> {
        instance.currentStepIndex += 1;
        instance.currentState = workflow.states[instance.currentStepIndex] || instance.currentState;
        instance.updatedAt = new Date().toISOString();
        await this.persist(instance);
    }

    private async persist(instance: WorkflowInstance): Promise<void> {
        await this.cache.set(this.instanceKey(instance.instanceId), instance, this.instanceTtlSeconds);
        await this.cache.set(this.activeKey(instance.userId), instance.instanceId, this.instanceTtlSeconds);
    }

    private async load(instanceId: string): Promise<WorkflowInstance | null> {
        const instance = await this.cache.get<WorkflowInstance>(this.instanceKey(instanceId));
        return instance || null;
    }

    private async setActiveInstanceForUser(userId: string, instanceId: string): Promise<void> {
        await this.cache.set(this.activeKey(userId), instanceId, this.instanceTtlSeconds);
    }

    private getDefinition(workflowId: string): WorkflowDefinition {
        const workflow = AEDRA_WORKFLOWS[workflowId];
        if (!workflow) {
            throw new Error(`Workflow definition not found for id "${workflowId}"`);
        }
        return workflow;
    }

    private instanceKey(instanceId: string): string {
        return `workflow:instance:${instanceId}`;
    }

    private activeKey(userId: string): string {
        return `workflow:active:${userId}`;
    }
}
