import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import { AiService } from './ai.service';
import { WhatsappService } from '../messaging/whatsapp.service';
import { WorkflowStatus as PrismaStatus, WorkflowType } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_BACKGROUND_QUEUE } from './ai.constants';

@Injectable()
export class AutonomousAgentService {
  private readonly logger = new Logger(AutonomousAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    private readonly whatsappService: WhatsappService,
    @InjectQueue(AI_BACKGROUND_QUEUE) private readonly aiQueue: Queue,
  ) {}

  /**
   * Scans for agents in BACKGROUND_PAUSED state and triggers their next heartbeat.
   */
  async processHeartbeats() {
    this.logger.log('[AgentService] Scanning for paused agents...');
    const pausedAgents = await this.prisma.workflowInstance.findMany({
      where: {
        type: WorkflowType.AUTONOMOUS_AGENT,
        status: 'BACKGROUND_PAUSED' as any,
      },
    });

    this.logger.log(`[AgentService] Found ${pausedAgents.length} agents to resume.`);

    for (const agent of pausedAgents) {
      this.logger.log(`[AgentService] Resuming agent ${agent.id}...`);
      await this.workflowEngine.resume(agent.id, {
        type: 'BACKGROUND_HEARTBEAT',
        content: 'Heartbeat trigger',
      });
    }
  }

  /**
   * Core logic for the analyze_goal step.
   */
  async analyzeGoal(context: any): Promise<any> {
    const goal = context.goal || 'No goal provided';
    this.logger.log(`[AgentService] Analyzing goal: ${goal}`);

    const prompt = `Goal: ${goal}
Context: ${JSON.stringify(context)}

Analyze the goal and break it down into an execution plan. 
Return a JSON object with:
- plan: string[] (high level steps)
- tasks: { action: string, args: any, status: 'pending'|'done' }[] (concrete tool calls)
- progress: 0
- total: number of tasks
- current_page: 1 (if it's a multi-page document)

JSON_STRUCTURED_OUTPUT:`;

    const result = await this.aiService.chat([], prompt, context.chatId);
    try {
      const match = result.response.match(/JSON_STRUCTURED_OUTPUT:\s*({.*})/s);
      if (match) return JSON.parse(match[1]);
    } catch (e) {
      this.logger.error(`Failed to parse agent plan: ${e.message}`);
    }
    return { plan: ['Failed to generate plan'], tasks: [], progress: 0 };
  }

  /**
   * Sends the plan to the user for approval using buttons.
   */
  async notifyPlan(context: any) {
    const planResult = context.analyze_goal || {};
    const planSteps = (planResult.plan || []).map((s: string) => `• ${s}`).join('\n');
    
    const message = `🤖 *Autonomous Agent Plan*\nI've analyzed your goal and proposed the following steps:\n\n${planSteps}\n\nDo you want me to proceed?`;

    if (context.phone) {
      await this.whatsappService.sendInteractiveButtons({
        companyId: context.companyId,
        to: context.phone,
        text: message,
        buttons: [
          { id: `WF_RESUME_${context.instanceId}_APPROVE`, title: 'Approve & Start' },
          { id: `WF_RESUME_${context.instanceId}_NOTES`, title: 'Add Notes' },
        ],
      });
    }
    return { status: 'AWAITING_APPROVAL' };
  }

  /**
   * Adjusts the plan based on user feedback.
   */
  async processFeedback(context: any): Promise<any> {
    const feedback = context.user_feedback || 'No feedback provided';
    const originalPlan = context.analyze_goal || {};

    this.logger.log(`[AgentService] Processing feedback: ${feedback}`);

    const prompt = `Original Goal: ${context.goal}
User Feedback: ${feedback}
Current Plan: ${JSON.stringify(originalPlan)}

Adjust the execution plan based on the feedback.
Return a updated JSON object with the same structure as before.

JSON_STRUCTURED_OUTPUT:`;

    const result = await this.aiService.chat([], prompt, context.chatId);
    try {
      const match = result.response.match(/JSON_STRUCTURED_OUTPUT:\s*({.*})/s);
      if (match) return JSON.parse(match[1]);
    } catch (e) {
      this.logger.error(`Failed to parse updated plan: ${e.message}`);
    }
    return originalPlan;
  }

  /**
   * Logic for evaluating progress and deciding if more heartbeats are needed.
   */
  async evaluateProgress(context: any): Promise<any> {
    const tasks = context.analyze_goal?.tasks || [];
    const pending = tasks.filter((t: any) => t.status === 'pending');

    this.logger.log(`[AgentService] Evaluation: ${pending.length} tasks remaining.`);

    if (pending.length === 0) {
      return { status: 'COMPLETED', message: 'All tasks finished successfully.' };
    }

    return { status: 'CONTINUE', message: `${pending.length} tasks still pending.` };
  }

  /**
   * Sends a WhatsApp update to the user.
   */
  async sendHeartbeatUpdate(context: any) {
    const planResult = context.analyze_goal || {};
    const progress = context.evaluate_progress || {};
    const tasks = planResult.tasks || [];
    const done = tasks.filter((t: any) => t.status === 'done').length;
    const total = tasks.length;
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

    const message = `🤖 *Autonomous Agent Update*
Goal: ${context.goal}
Progress: ${percentage}% (${done}/${total} tasks)

Current Status: ${progress.message || 'Processing...'}
_Wait for the next update._`;

    if (context.phone) {
      await this.whatsappService.sendTextMessage({
        companyId: context.companyId,
        to: context.phone,
        text: message,
      });
    }
  }
}
