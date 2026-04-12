import { Controller, Post, Body, Logger, Param } from '@nestjs/common';
import { MpesaService, MpesaWebhookDto } from './mpesa.service';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('payments/c-p')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly mpesaService: MpesaService) {}

  /**
   * C2B Validation URL (Daraja)
   * Daraja will POST here to ask if the transaction is valid.
   */
  @Post('validate')
  async validateOperation(@Body() body: any) {
    this.logger.log(`M-Pesa Validation Request: ${JSON.stringify(body)}`);
    // Rule: We accept all at the validation stage for now,
    // real logic happens in confirmation.
    return {
      ResultCode: 0,
      ResultDesc: 'Accepted',
    };
  }

  /**
   * C2B Confirmation URL (Daraja)
   * Daraja will POST here when the transaction is completed.
   */
  @Post('confirm')
  async confirmOperation(@Body() body: MpesaWebhookDto) {
    return this.mpesaService.handleC2BWebhook(body);
  }

  /**
   * STK Push Callback URL (Daraja/LNM)
   */
  @Post('callback/:companyId?')
  async handleCallback(@Body() body: any, @Param('companyId') paramCompanyId?: string) {
    this.logger.log(`M-Pesa STK Callback: ${JSON.stringify(body)}`);
    
    // Check if companyId was provided in URL (preferred for multi-tenancy)
    const companyId = paramCompanyId;

    // STK push has a different structure (Body.stkCallback)
    const callbackData = body?.Body?.stkCallback;
    if (!callbackData) return { ResultCode: 1, ResultDesc: 'Invalid Payload' };

    if (callbackData.ResultCode !== 0) {
      this.logger.warn(`STK Push Failed: ${callbackData.ResultDesc}`);
      return { ResultCode: 0, ResultDesc: 'Acknowledged Failure' };
    }

    // Extract item values from MetaData
    const items = callbackData.CallbackMetadata?.Item || [];
    const getVal = (name: string) =>
      items.find((i: any) => i.Name === name)?.Value;

    const webhookDto: MpesaWebhookDto = {
      TransID: getVal('MpesaReceiptNumber'),
      TransAmount: String(getVal('Amount')),
      MSISDN: String(getVal('PhoneNumber')),
      TransTime: String(new Date().toISOString()), // Callback doesn't have raw TransTime usually
      BillRefNumber: 'STK_PUSH', // reference?
    };

    if (!webhookDto.TransID || !webhookDto.TransAmount) {
      this.logger.error('Incomplete STK callback metadata');
      return { ResultCode: 1, ResultDesc: 'Incomplete Metadata' };
    }

    return this.mpesaService.handleC2BWebhook(webhookDto, companyId);
  }

  /**
   * TEST ENDPOINT: Trigger STK Push
   */
  @Post('test/stk-push')
  async testStkPush(@Body() body: { phone: string, amount: number, reference: string }) {
    return this.mpesaService.stkPush(body.phone, body.amount, body.reference);
  }

  /**
   * TEST ENDPOINT: Register C2B URLs
   */
  @Post('test/register-urls')
  async testRegisterUrls() {
    return this.mpesaService.registerUrls();
  }

  /**
   * TEST ENDPOINT: Get Access Token
   */
  @Post('test/token')
  async testToken() {
    return this.mpesaService.getAccessToken();
  }
}
