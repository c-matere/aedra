import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiHistoryService {
  private readonly logger = new Logger(AiHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalizes history entries into the format expected by Gemini.
   */
  normalizeHistory(history: any[]): any[] {
    if (!history || !Array.isArray(history)) return [];
    return history.map((h) => {
      const role = h.role === 'assistant' ? 'model' : h.role || 'user';
      if (h.parts) return { role, parts: h.parts };

      const content = h.content || h.message || '';
      return {
        role,
        parts: [{ text: content }],
      };
    });
  }

  /**
   * Normalizes history entries into the format expected by OpenAI/Groq.
   */
  normalizeHistoryForOpenAI(history: any[]): any[] {
    const messages: any[] = [];
    for (const turn of history) {
      const role =
        turn.role === 'model' || turn.role === 'assistant'
          ? 'assistant'
          : turn.role === 'function'
            ? 'tool'
            : 'user';

      if (role === 'user') {
        const text =
          turn.parts
            ?.map((p: any) => p.text)
            .filter(Boolean)
            .join('\n') ||
          turn.content ||
          '';
        if (text) messages.push({ role: 'user', content: text });
      } else if (role === 'assistant') {
        const text =
          turn.parts
            ?.map((p: any) => p.text)
            .filter(Boolean)
            .join('\n') ||
          turn.content ||
          '';
        const toolCalls = turn.parts
          ?.filter((p: any) => p.functionCall)
          .map((p: any, idx: number) => ({
            id: `hist_${messages.length}_${idx}`,
            type: 'function',
            function: {
              name: p.functionCall.name,
              arguments: JSON.stringify(p.functionCall.args),
            },
          }));

        messages.push({
          role: 'assistant',
          content: text || '',
          tool_calls: toolCalls?.length > 0 ? toolCalls : undefined,
        });
      } else if (role === 'tool') {
        const prevAssistant = [...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.tool_calls);
        turn.parts?.forEach((p: any, idx: number) => {
          if (p.functionResponse) {
            const callId =
              prevAssistant?.tool_calls?.find(
                (tc: any) => tc.function.name === p.functionResponse.name,
              )?.id || `hist_call_${idx}`;
            messages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify(p.functionResponse.response),
            });
          }
        });
      }
    }
    return messages;
  }

  /**
   * Retrieves messages for a specific chat from the database.
   */
  async getMessageHistory(chatId: string): Promise<any[]> {
    return this.prisma.chatMessage.findMany({
      where: { chatHistoryId: chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Completely wipes messages and history records for a given context.
   */
  async clearMessageHistory(chatId: string, userId: string): Promise<{ messages: number; history: number }> {
    await this.prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { chatHistory: { userId: userId } },
          { chatHistory: { companyId: userId } },
          { chatHistoryId: chatId },
        ],
      },
    }).catch((e) => this.logger.warn(`Failed to wipe messages: ${e.message}`));

    await this.prisma.chatHistory.deleteMany({
      where: {
        OR: [{ userId: userId }, { id: chatId }],
      },
    }).catch((e) => this.logger.warn(`Failed to wipe histories: ${e.message}`));

    const [msgCount, histCount] = await Promise.all([
      this.prisma.chatMessage.count({ where: { chatHistoryId: chatId } }),
      this.prisma.chatHistory.count({ where: { id: chatId } }),
    ]);

    this.logger.log(`[HISTORY-SERVICE] FINAL state for ${chatId}: messages=${msgCount}, history=${histCount}`);
    return { messages: msgCount, history: histCount };
  }

  /**
   * Persists both a user message and an assistant response to the database.
   */
  async persistUserAndAssistant(
    chatId: string,
    userText: string,
    assistantText: string,
  ): Promise<{ response: string; chatId: string }> {
    try {
      if (chatId) {
        await this.prisma.chatMessage.create({
          data: { chatHistoryId: chatId, role: 'user', content: userText },
        });
        await this.prisma.chatMessage.create({
          data: { chatHistoryId: chatId, role: 'assistant', content: assistantText },
        });
      }
    } catch (e) {
      this.logger.error(`[HISTORY-SERVICE] Failed to persist messages: ${e.message}`);
    }
    return { response: assistantText, chatId: chatId || 'unknown' };
  }
}
