import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SENSITIVE_ACTIONS_REGISTRY } from './sensitive-actions.registry';
import { AuthorizationStatus } from '@prisma/client';

export interface ApprovalState {
  id: string;
  actionType: string;
  payload: any;
  approverIds: string[];
  quorumRequired: number;
  createdAt: Date;
}

@Injectable()
export class QuorumBridgeService {
  private readonly logger = new Logger(QuorumBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks if an action requires quorum and returns the current approval state.
   */
  async evaluateAction(
    toolName: string,
    args: any,
    userId: string,
  ): Promise<{ authorized: boolean; actionId?: string; message?: string }> {
    const config = SENSITIVE_ACTIONS_REGISTRY[toolName];
    if (!config || config.quorumRequired <= 0) {
      return { authorized: true };
    }

    // Find if this exact action is already pending
    const pending = await this.prisma.authorizationRequest.findMany({
      where: {
        actionType: toolName,
        status: AuthorizationStatus.PENDING,
      },
    });

    let request = pending.find(
      (r) => JSON.stringify(r.payload) === JSON.stringify(args),
    );

    if (!request) {
      request = await this.prisma.authorizationRequest.create({
        data: {
          actionType: toolName,
          requestedBy: userId,
          approverIds: [], // Don't automatically approve; require explicit click/auth
          status: AuthorizationStatus.PENDING,
          payload: args,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });
      this.logger.log(
        `Created new quorum request ${request.id} for ${toolName}`,
      );
    }

    if (request.approverIds.length >= config.quorumRequired) {
      await this.prisma.authorizationRequest.update({
        where: { id: request.id },
        data: {
          status: AuthorizationStatus.QUORUM_MET,
          updatedAt: new Date(),
        },
      });
      return { authorized: true };
    }

    return {
      authorized: false,
      actionId: request.id,
      message: `⚠️ Action "${toolName}" requires quorum of ${config.quorumRequired} admins. Currently approved by ${request.approverIds.length}. Need ${config.quorumRequired - request.approverIds.length} more.`,
    };
  }

  async addApproval(actionId: string, userId: string): Promise<any | null> {
    const request = await this.prisma.authorizationRequest.findUnique({
      where: { id: actionId },
    });
    if (!request) return null;

    if (!request.approverIds.includes(userId)) {
      const updatedIds = [...request.approverIds, userId];
      const config = SENSITIVE_ACTIONS_REGISTRY[request.actionType];
      const quorumMet = config && updatedIds.length >= config.quorumRequired;

      return this.prisma.authorizationRequest.update({
        where: { id: actionId },
        data: {
          approverIds: updatedIds,
          status: quorumMet ? AuthorizationStatus.QUORUM_MET : AuthorizationStatus.PENDING,
          updatedAt: new Date(),
        },
      });
    }

    return request;
  }

  async getPendingActions(): Promise<any[]> {
    return this.prisma.authorizationRequest.findMany({
      where: { status: AuthorizationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }
}
