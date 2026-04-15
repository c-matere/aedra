import { Injectable, Logger } from '@nestjs/common';
import { ZuriLeaseConnector } from './zuri-lease.connector';
import { ConnectorConfig } from '../types';
import { ZuriLeaseData } from './types';

@Injectable()
export class ZuriLeaseService {
  private readonly logger = new Logger(ZuriLeaseService.name);

  async syncData(
    config: ConnectorConfig,
    propertyId: string,
  ): Promise<ZuriLeaseData> {
    const connector = new ZuriLeaseConnector(config);

    try {
      this.logger.log(
        `Starting sync for Zuri Lease property ${propertyId} on domain ${config.baseUrl || config.domain}`,
      );
      await connector.connect();
      const data = await connector.fetchData({ propertyId });
      this.logger.log(`Sync completed successfully for property ${propertyId}`);
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to sync data from Zuri Lease: ${error.message}`,
      );
      throw error;
    } finally {
      await connector.disconnect();
    }
  }

  async listAvailableProperties(config: ConnectorConfig): Promise<string[]> {
    const connector = new ZuriLeaseConnector(config);
    try {
      this.logger.log(
        `Discovering properties for Zuri Lease on domain ${config.baseUrl || config.domain}`,
      );
      await connector.connect();
      const propertyIds = await connector.listProperties();
      this.logger.log(
        `Discovered ${propertyIds.length} properties: ${propertyIds.join(', ')}`,
      );
      return propertyIds;
    } catch (error) {
      this.logger.error(`Failed to discover properties: ${error.message}`);
      throw error;
    } finally {
      await connector.disconnect();
    }
  }
}
