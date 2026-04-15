import {
  Controller,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JengaService } from './jenga.service';

@Controller('integrations/jenga')
export class JengaController {
  private readonly logger = new Logger(JengaController.name);

  constructor(private readonly jengaService: JengaService) {}

  /**
   * Universal Webhook callback for Jenga transactions.
   * Path: POST /integrations/jenga/callback/:companyId
   */
  @Post('callback/:companyId')
  @HttpCode(HttpStatus.OK)
  async handleCallback(
    @Param('companyId') companyId: string,
    @Body() payload: any,
  ) {
    this.logger.log(
      `Received Jenga callback for company ${companyId}: ${JSON.stringify(payload)}`,
    );

    try {
      const result = await this.jengaService.reconcilePayment(
        companyId,
        payload,
      );

      if (result.reconciled) {
        this.logger.log(
          `Successfully reconciled payment to invoice ${result.invoiceId}`,
        );
      } else {
        this.logger.warn(`Payment reconciliation failed: ${result.reason}`);
      }

      return {
        status: result.reconciled ? 'SUCCESS' : 'PENDING',
        message: result.reconciled
          ? 'Payment matched and reconciled'
          : result.reason,
      };
    } catch (error) {
      this.logger.error(
        `Error processing Jenga callback for company ${companyId}: ${error.message}`,
      );
      // Still return 200 to Jenga to avoid infinite retries if the error is internal
      return { status: 'ERROR', message: 'Internal processing error' };
    }
  }

  /**
   * Manual trigger for STK Push (for testing or manual admin action)
   */
  @Post('stkpush/:invoiceId')
  async triggerStkPush(@Param('invoiceId') invoiceId: string) {
    return await this.jengaService.initiatePayment(invoiceId);
  }
}
