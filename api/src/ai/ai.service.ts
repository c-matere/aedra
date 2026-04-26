import { Injectable, Logger } from '@nestjs/common';
import { AiBrainClient } from './ai-brain.client';
import { AiServiceChatResponse, TruthObject } from './ai-contracts.types';
import { PrismaService } from '../prisma/prisma.service';
import { AiReadToolService } from './ai-read-tool.service';
import { AiWriteToolService } from './ai-write-tool.service';
import { UserRole } from '../auth/roles.enum';
import { QuorumBridgeService } from './quorum-bridge.service';
import { AiStateEngineService } from './ai-state-engine.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly brainClient: AiBrainClient,
    private readonly prisma: PrismaService,
    private readonly readTools: AiReadToolService,
    private readonly writeTools: AiWriteToolService,
    private readonly quorum: QuorumBridgeService,
    private readonly stateEngine: AiStateEngineService,
  ) {}

  getSystemInstruction(): string {
    return "Operational instructions are now managed by the central Brain reasoning engine.";
  }

  /**
   * Main entry point for AI interactions in Aedra.
   * Proxies the reasoning to the Brain while keeping history/execution in Aedra.
   */
  async chat(
    history: any[],
    message: string,
    chatId?: string,
    companyId?: string,
    companyName?: string,
    attachments?: any[],
    language: string = 'en',
    classification?: any,
    phone?: string,
    temperature?: number,
    confirmed?: boolean,
  ): Promise<AiServiceChatResponse> {
    // 1. Proxy reasoning to Brain
    const response = await this.brainClient.chat(
      message,
      { companyId, companyName, language, phone },
      'SYSTEM',
      chatId,
      phone,
      companyId,
    );

    // 2. If the Brain returned tools/steps, they should be handled here or by the orchestrator.
    // In Aedra's architecture, we often return the plan so the frontend/WhatsApp orch can execute.
    return response;
  }

  // --- Session & History Management (Local Aedra DB) ---

  async getChatHistory(chatId: string) {
    return this.prisma.chatMessage.findMany({
      where: { chatHistoryId: chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOrCreateChat(userId: string, companyId?: string, waPhone?: string) {
    const chat = await this.prisma.chatHistory.findFirst({
      where: {
        userId: userId === 'unidentified' ? null : userId,
        waPhone,
        deletedAt: null,
      },
    });

    if (chat) return chat.id;

    const newChat = await this.prisma.chatHistory.create({
      data: {
        userId: userId === 'unidentified' ? null : userId,
        companyId,
        waPhone,
      },
    });
    return newChat.id;
  }

  async getChatSessions(userId: string) {
    return this.prisma.chatHistory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async deleteChatSession(chatId: string) {
    return this.prisma.chatHistory.update({
      where: { id: chatId },
      data: { deletedAt: new Date() },
    });
  }

  // --- Tool Execution Orchestration (Local Aedra Host) ---

  async executeTool(name: string, args: any, context: any, role: UserRole, language: string) {
    this.logger.log(`[AiService] Orchestrating local tool execution: ${name}`);
    const toolService = name.startsWith('get_') || name.startsWith('list_') || name.includes('search') ? this.readTools : this.writeTools;
    if (typeof (toolService as any).executeReadTool === 'function' && (toolService === this.readTools)) {
        return this.readTools.executeReadTool(name, args, context, role, language);
    }
    if (typeof (toolService as any).executeWriteTool === 'function' && (toolService === this.writeTools)) {
        return this.writeTools.executeWriteTool(name, args, context, role, language);
    }
    return (toolService as any)[name](args, context, role, language);
  }

  async executePlan(userId: string, phone: string) {
    this.logger.log(`[AiService] Orchestrating plan execution for ${userId || phone}`);
    // Planning is now handled by the standalone Brain. 
    // This is a placeholder or should call the Brain's execution trigger if one exists.
    return { response: "Plan execution is now managed by the central reasoning engine." };
  }

  async executeApprovedAction(actionId: string, userId: string) {
    return this.quorum.addApproval(actionId, userId);
  }

  async listActiveWorkflows(userId: string) {
    // This normally calls a workflow service or prisma
    return this.prisma.chatHistory.findMany({
      where: { userId, deletedAt: null },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });
  }

  async formatToolResponse(result: any, sender: any, companyId: string, language: string) {
    // Formatting moved to standalone brain or specialized formatters
    return { 
      text: typeof result === 'string' ? result : JSON.stringify(result),
      interactive: null
    };
  }

  async generateTakeoverAdvice(input: any, history: any[]) {
    return this.brainClient.generateTakeoverAdvice(input, history);
  }

  async submitFeedback(messageId: string, score: number, note?: string) {
    // Feedback is stored on the ChatMessage itself in the current schema
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { feedbackScore: score, feedbackNote: note },
    });
  }

  async resetSession(userId: string, chatId: string): Promise<any> {
    return this.brainClient.resetSession(userId, chatId);
  }

  async transcribeAudio(buffer: Buffer, mimeType: string, language?: string) {
    // Audio logic still local for now or proxying to Groq
    return null;
  }

  async summarizeForWhatsApp(text: string, language: string) {
    return this.brainClient.summarizeForWhatsApp(text, language);
  }

  async getCollectionRate(companyId: string, propertyId?: string) {
    // This could be a prisma query or proxied
    return 0.85; // Placeholder
  }
}
