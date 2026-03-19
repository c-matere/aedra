import { ResponsePipelineService } from '../../../api/src/ai/response-pipeline.service';

describe('ResponsePipelineService', () => {
  const service = new ResponsePipelineService();

  it('returns generic error on malformed JSON (no raw error leakage)', async () => {
    const result = await service.processResponse('nonexistent_skill', '{ not-json');
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toBe('Something went wrong. Please try again.');
  });
});
