import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { 
  JengaAuthConfig, 
  JengaTokenResponse, 
  JengaStkPushRequest, 
  JengaStkPushResponse 
} from './types';
import { IConnector } from '../types';

@Injectable()
export class JengaConnector implements IConnector {
  private readonly logger = new Logger(JengaConnector.name);
  public name = 'Jenga API';
  
  private config: JengaAuthConfig;
  private token: JengaTokenResponse | null = null;
  private tokenExpiry: number = 0;

  constructor(config: JengaAuthConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    await this.ensureToken();
  }

  async disconnect(): Promise<void> {
    this.token = null;
    this.tokenExpiry = 0;
  }

  private async ensureToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiry) {
      return this.token.access_token;
    }

    this.logger.log('Acquiring fresh Jenga OAuth token...');
    const url = 'https://api.jengaapi.io/authentication/v1/login';
    
    // In Jenga, credentials are sent as x-www-form-urlencoded or JSON depending on version
    // Typically: username=merchantCode&password=apiKey
    const params = new URLSearchParams();
    params.append('username', this.config.merchantCode);
    params.append('password', this.config.apiKey);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': this.config.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Failed to get Jenga token: ${errorText}`);
      throw new Error(`Jenga authentication failed: ${response.statusText}`);
    }

    const data = (await response.json()) as JengaTokenResponse;
    this.token = data;
    // expires_in is usually in seconds
    this.tokenExpiry = now + parseInt(data.expires_in) * 1000 - 60000; // 1 min buffer
    
    return data.access_token;
  }

  /**
   * Generates a digital signature for the request.
   * Jenga requires signing a concatenated string of specific fields.
   */
  private generateSignature(data: string): string {
    const signer = crypto.createSign('SHA256');
    signer.update(data);
    signer.end();
    
    const signature = signer.sign(this.config.privateKey, 'base64');
    return signature;
  }

  async fetchData(params: any): Promise<any> {
    // Generic method if needed for IConnector interface
    return null;
  }

  /**
   * Initiate an STK Push payment request.
   */
  async initiateStkPush(request: JengaStkPushRequest): Promise<JengaStkPushResponse> {
    const accessToken = await this.ensureToken();
    const url = 'https://api.jengaapi.io/transaction/v1/stkpush';

    // Signature concatenation for STK Push (standard Jenga pattern):
    // amount + currency + reference + merchantCode
    // Note: Actual fields depend on Jenga documentation version. 
    // This is a common pattern.
    const signatureData = `${request.transaction.amount}KES${request.transaction.reference}${this.config.merchantCode}`;
    const signature = this.generateSignature(signatureData);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Signature': signature,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: request.customer,
        transaction: request.transaction,
      }),
    });

    const result = await response.json();
    return result as JengaStkPushResponse;
  }

  /**
   * Check account balance.
   */
  async getAccountBalance(accountId: string, countryCode: string = 'KE'): Promise<any> {
    const accessToken = await this.ensureToken();
    const url = `https://api.jengaapi.io/account/v1/accounts/balance/${countryCode}/${accountId}`;

    const signatureData = `${this.config.merchantCode}${accountId}${countryCode}`;
    const signature = this.generateSignature(signatureData);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Signature': signature,
      },
    });

    return await response.json();
  }
}
