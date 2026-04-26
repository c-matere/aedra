import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { AI_TOOL_DEFINITIONS } from './ai-tool-definitions';
import * as crypto from 'crypto';

/**
 * BrainToolController
 * 
 * Part of the "Semantic Bridge" architecture.
 * See: /docs/ARCHITECTURE.md for security and communication protocols.
 */
@Controller('ai')
export class BrainToolController {
  private readonly logger = new Logger(BrainToolController.name);
  private readonly SHARED_SECRET = process.env.BRAIN_SHARED_SECRET || 'dev-secret-key';

  constructor(private readonly toolRegistry: AiToolRegistryService) {}

  /**
   * Tool Discovery Manifest.
   * Allows the Brain to dynamically learn about Aedra's capabilities.
   */
  @Get('manifest')
  getManifest(@Headers('X-Brain-Signature') signature: string) {
    // Optional: We can secure the manifest too, but it's just meta-data.
    // Let's assume the Brain signs the GET request too for consistency.
    const expectedSignature = crypto
      .createHmac('sha256', this.SHARED_SECRET)
      .update('manifest') // Simple payload for GET validation
      .digest('hex');

    // For now, let's keep it simple or check a token. 
    // If we want strict HMAC, the brain must send a signature of the string 'manifest'.
    
    return {
      appName: 'Aedra',
      tools: AI_TOOL_DEFINITIONS,
      permissions: this.toolRegistry.getRoleAllowlist(),
      metadata: this.toolRegistry.getManifestMetadata(),
    };
  }

  @Post('execute-tool')
  async executeTool(
    @Body() body: { toolName: string; args: any; context: any },
    @Headers('X-Brain-Signature') signature: string,
  ) {
    // 1. HMAC VALIDATION
    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', this.SHARED_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.logger.warn(`[BrainAuth] Invalid signature received for tool: ${body.toolName}`);
      throw new UnauthorizedException('Invalid Brain Signature');
    }

    this.logger.log(`[BrainAuth] Executing remote tool: ${body.toolName}`);

    // 2. DELEGATE TO LOCAL REGISTRY
    try {
      const result = await this.toolRegistry.executeTool(
        body.toolName,
        body.args,
        body.context,
        body.context.role,
        body.context.language || 'en',
      );

      return { success: true, result };
    } catch (error) {
      this.logger.error(`[BrainAuth] Tool execution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
