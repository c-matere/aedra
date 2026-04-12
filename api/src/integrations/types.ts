export interface IConnector {
  name: string;
  connect(): Promise<void>;
  fetchData(params?: any): Promise<any>;
  disconnect(): Promise<void>;
}

export interface ConnectorConfig {
  domain?: string;
  baseUrl?: string;
  credentials?: {
    username?: string;
    password?: string;
  };
}
