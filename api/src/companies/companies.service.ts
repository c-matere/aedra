import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { VaultService } from '../common/vault.service';

const SENSITIVE_FIELDS = [
  'mpesaConsumerKey',
  'mpesaConsumerSecret',
  'mpesaPasskey',
  'africaTalkingApiKey',
  'mapboxAccessToken',
  'waAccessToken',
  'zuriPassword',
  'jengaMerchantCode',
  'jengaConsumerSecret',
  'jengaApiKey',
  'jengaPrivateKey',
];

export interface UpdateCompanyDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string | null;
  pinNumber?: string;
  waAccessToken?: string;
  waVerifyToken?: string;
  waPhoneNumberId?: string;
  waBusinessAccountId?: string;
  waOwnerPhone?: string;
  // Security settings
  sessionDurationHours?: number;
  passwordPolicy?: string;
  twoFactorAuthEnabled?: boolean;
  ipAllowlist?: string;
  // Notification settings
  rentReminderDaysBefore?: number;
  leaseExpiryAlertDaysBefore?: number;
  paymentReceiptsEnabled?: boolean;
  maintenanceUpdatesEnabled?: boolean;
  waAlertsEnabled?: boolean;
  waOtpEnabled?: boolean;
  waPaymentConfirmationsEnabled?: boolean;
  // Integration settings
  smsProvider?: string;
  africaTalkingUsername?: string;
  africaTalkingApiKey?: string;
  mapProvider?: string;
  mapboxAccessToken?: string;
  mpesaConsumerKey?: string;
  mpesaConsumerSecret?: string;
  mpesaPasskey?: string;
  // Billing & Invoicing
  autoInvoicingEnabled?: boolean;
  invoicingDay?: number;
  // Zuri Lease
  zuriDomain?: string;
  zuriUsername?: string;
  zuriPassword?: string;
  // Jenga API
  jengaMerchantCode?: string;
  jengaConsumerSecret?: string;
  jengaApiKey?: string;
  jengaPrivateKey?: string;
  jengaEnabled?: boolean;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vaultService: VaultService,
  ) {}

  async findAll() {

    const companies = await this.prisma.company.findMany({
      orderBy: { name: 'asc' },
    });

    return companies.map((c) => this.decryptCompany(c));
  }

  async findOne(id: string) {

    try {
      const company = await this.prisma.company.findUnique({
        where: { id },
      });

      if (!company) {
        throw new NotFoundException('Company not found.');
      }

      return this.decryptCompany(company);
    } catch (error: any) {
      console.error('[CompaniesService] findOne error:', error.message, error.stack);
      throw error;
    }
  }

  async update(id: string, data: UpdateCompanyDto) {


    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    // Encrypt sensitive fields using Vault
    const encryptedData = this.vaultService.encryptObject(
        data,
        SENSITIVE_FIELDS
    );

    // Strip out fields that should not be passed to Prisma update
    const { id: _, companyId: __, ...updatePayload } = encryptedData as any;

    const updated = await this.prisma.company.update({
      where: { id },
      data: updatePayload,
    });

    return this.decryptCompany(updated);
  }

  private decryptCompany(company: any) {
    return this.vaultService.decryptObject(company, SENSITIVE_FIELDS);
  }

  private mergeDecryptedData(stored: any, incoming: UpdateCompanyDto) {
    return { ...stored, ...incoming };
  }

  async testMpesa(id: string, incoming: UpdateCompanyDto) {
    const stored = await this.findOne(id);
    const company = this.mergeDecryptedData(stored, incoming);
    
    if (!company.mpesaConsumerKey || !company.mpesaConsumerSecret) {
      return { success: false, message: 'Missing M-Pesa credentials' };
    }

    const baseUrl = company.mpesaEnvironment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    const auth = Buffer.from(`${company.mpesaConsumerKey}:${company.mpesaConsumerSecret}`).toString('base64');

    try {
      const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
      console.log(`[M-Pesa Test] Requesting token from: ${url}`);
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      console.log(`[M-Pesa Test] Response status: ${res.status}`);

      if (res.ok) {
        return { success: true, message: 'M-Pesa credentials verified (OAuth token generated)' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.log(`[M-Pesa Test] Error response:`, JSON.stringify(errorData));
        
        let message = `M-Pesa verification failed: ${errorData.errorMessage || res.statusText}`;
        if (res.status === 400) {
          message += ". This often indicates invalid Consumer Key/Secret format or an issue with the Safaricom Sandbox environment. Please ensure there are no trailing spaces and that the keys match the selected environment.";
        }
        return { success: false, message };
      }
    } catch (e) {
      return { success: false, message: `Network error connecting to M-Pesa: ${(e as Error).message}` };
    }
  }

  async testSms(id: string, incoming: UpdateCompanyDto) {
    const stored = await this.findOne(id);
    const company = this.mergeDecryptedData(stored, incoming);

    if (!company.africaTalkingUsername || !company.africaTalkingApiKey) {
      return { success: false, message: 'Missing Africa\'s Talking credentials' };
    }

    try {
      const res = await fetch(`https://api.africastalking.com/version1/user?username=${company.africaTalkingUsername}`, {
        headers: {
          'apiKey': company.africaTalkingApiKey,
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        return { success: true, message: 'Africa\'s Talking credentials verified' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, message: `SMS verification failed: ${errorData.errorMessage || res.statusText}` };
      }
    } catch (e) {
      return { success: false, message: `Network error connecting to Africa's Talking: ${(e as Error).message}` };
    }
  }

  async testMaps(id: string, incoming: UpdateCompanyDto) {
    const stored = await this.findOne(id);
    const company = this.mergeDecryptedData(stored, incoming);

    if (!company.mapboxAccessToken) {
      return { success: false, message: 'Missing Mapbox access token' };
    }

    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/Nairobi.json?access_token=${company.mapboxAccessToken}&limit=1`);

      if (res.ok) {
        return { success: true, message: 'Mapbox access token verified' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, message: `Mapbox verification failed: ${errorData.message || res.statusText}` };
      }
    } catch (e) {
      return { success: false, message: `Network error connecting to Mapbox: ${(e as Error).message}` };
    }
  }

  async testJenga(id: string, incoming: UpdateCompanyDto) {
    const stored = await this.findOne(id);
    const company = this.mergeDecryptedData(stored, incoming);

    if (!company.jengaMerchantCode || !company.jengaApiKey) {
      return { success: false, message: 'Missing Jenga credentials' };
    }

    try {
      const url = 'https://api.jengaapi.io/authentication/v1/login';
      const params = new URLSearchParams();
      params.append('username', company.jengaMerchantCode);
      params.append('password', company.jengaApiKey);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Api-Key': company.jengaApiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (res.ok) {
        return { success: true, message: 'Jenga credentials verified (OAuth token generated)' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, message: `Jenga verification failed: ${errorData.message || res.statusText}` };
      }
    } catch (e) {
      return { success: false, message: `Network error connecting to Jenga: ${(e as Error).message}` };
    }
  }

  async testWhatsApp(id: string, incoming: UpdateCompanyDto) {
    const stored = await this.findOne(id);
    const company = this.mergeDecryptedData(stored, incoming);

    if (!company.waAccessToken || !company.waPhoneNumberId) {
      return { success: false, message: 'Missing WhatsApp (Meta) credentials' };
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${company.waPhoneNumberId}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${company.waAccessToken}`,
        },
      });

      if (res.ok) {
        return { success: true, message: 'WhatsApp API credentials verified' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { 
          success: false, 
          message: `WhatsApp verification failed: ${errorData.error?.message || res.statusText}` 
        };
      }
    } catch (e) {
      return { success: false, message: `Network error connecting to Meta: ${(e as Error).message}` };
    }
  }
}
