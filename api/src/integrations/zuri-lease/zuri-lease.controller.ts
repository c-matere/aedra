import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ZuriLeaseService } from './zuri-lease.service';
import { AedraImportService } from './aedra-import.service';
import { ConnectorConfig } from '../types';

import { CompaniesService } from '../../companies/companies.service';

@Controller('integrations/zuri-lease')
export class ZuriLeaseController {
  constructor(
    private readonly zuriLeaseService: ZuriLeaseService,
    private readonly aedraImportService: AedraImportService,
    private readonly companiesService: CompaniesService,
  ) {}

  @Post('trigger-sync')
  async triggerSync(
    @Body() body: { companyId: string; propertyIds?: string[] },
  ) {
    try {
      if (!body.companyId) {
        throw new HttpException('Missing companyId', HttpStatus.BAD_REQUEST);
      }

      const company = await this.companiesService.findOne(body.companyId);
      if (!company.zuriUsername || !company.zuriPassword) {
        throw new HttpException(
          'Zuri Lease credentials not configured for this company',
          HttpStatus.BAD_REQUEST,
        );
      }

      const config: ConnectorConfig = {
        credentials: {
          username: company.zuriUsername,
          password: company.zuriPassword,
        },
        baseUrl: company.zuriDomain || 'https://zuriproperties.co.ke',
      };

      // Default to dynamic discovery if no property IDs provided
      let propertyIds = body.propertyIds;
      if (!propertyIds || propertyIds.length === 0) {
        propertyIds =
          await this.zuriLeaseService.listAvailableProperties(config);
      }

      if (propertyIds.length === 0) {
        return {
          message: 'Sync completed: No properties discovered for this account.',
          results: [],
        };
      }

      const results = await this.aedraImportService.importFromZuriLease(
        config,
        propertyIds,
        body.companyId,
      );

      return {
        message: 'Sync completed',
        results,
      };
    } catch (error) {
      throw new HttpException(
        `Sync failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
