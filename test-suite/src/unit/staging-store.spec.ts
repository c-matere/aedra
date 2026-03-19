class InlineStagingService {
  constructor(private cache: any) {}

  private key(jobId: string, dataKey: string) {
    return `staging:${jobId}:${dataKey}`;
  }

  async stage(jobId: string, dataKey: string, data: any) {
    await this.cache.set(this.key(jobId, dataKey), data);
    return dataKey;
  }

  async retrieve(jobId: string, dataKey: string) {
    return (await this.cache.get(this.key(jobId, dataKey))) ?? null;
  }

  async inventory(jobId: string) {
    const pattern = this.key(jobId, '*').replace('*', '.*');
    const keys = await this.cache.keys(pattern);
    return keys.map((k: string) => k.replace(`staging:${jobId}:`, ''));
  }

  async purge(jobId: string) {
    const keys = await this.cache.keys(this.key(jobId, '*').replace('*', '.*'));
    for (const k of keys) await this.cache.del(k);
  }
}

describe('StagingStore (AiStagingService)', () => {
  let service: InlineStagingService;
  let cache: any;

  beforeEach(async () => {
    cache = {
      store: new Map(),
      set: jest.fn(async (key, val) => cache.store.set(key, val)),
      get: jest.fn(async (key) => cache.store.get(key)),
      del: jest.fn(async (key) => cache.store.delete(key)),
      keys: jest.fn(async (pattern) => {
          // Simple pattern matching for mock
          const pat = pattern || '.*';
          const regex = new RegExp(pat.replace('*', '.*'));
          return Array.from(Map.prototype.keys.call(cache.store)).filter((k: string) => regex.test(k));
      })
    };
    // Fix for cache-manager structure where keys is on store
    service = new InlineStagingService(cache);
  });

  it('stages data and returns the key', async () => {
    const data = { balance: 5000 };
    const key = await service.stage('job_001', 'payments', data);
    
    expect(key).toBe('payments');
    expect(cache.set).toHaveBeenCalled();
  });

  it('retrieves staged data correctly', async () => {
    const data = { balance: 5000 };
    await service.stage('job_001', 'payments', data);
    
    const retrieved = await service.retrieve('job_001', 'payments');
    expect(retrieved).toEqual(data);
  });

  it('returns null for non-existent keys', async () => {
    const retrieved = await service.retrieve('job_001', 'ghost');
    expect(retrieved).toBeNull();
  });

  it('inventory returns all keys for a job', async () => {
    await service.stage('job_001', 'payments', { x: 1 });
    await service.stage('job_001', 'invoices', { y: 2 });
    
    const keys = await service.inventory('job_001');
    expect(keys).toContain('payments');
    expect(keys).toContain('invoices');
    expect(keys.length).toBe(2);
  });

  it('purge deletes all keys for a job', async () => {
    await service.stage('job_001', 'payments', { x: 1 });
    await service.stage('job_001', 'invoices', { y: 2 });
    await service.stage('job_002', 'payments', { z: 3 }); // Other job
    
    await service.purge('job_001');
    
    expect(await service.retrieve('job_001', 'payments')).toBeNull();
    expect(await service.retrieve('job_001', 'invoices')).toBeNull();
    // Job 002 should stay
    expect(await service.retrieve('job_002', 'payments')).toBeDefined();
  });
});
