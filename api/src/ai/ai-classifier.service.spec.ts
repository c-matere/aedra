import { AiClassifierService, type ClassificationResult } from './ai-classifier.service';

describe('AiClassifierService guardrails', () => {
  it('treats property interest as read intent (not add_tenant)', () => {
    const svc = new AiClassifierService();
    const raw: ClassificationResult = {
      intent: 'add_tenant',
      complexity: 2,
      executionMode: 'ORCHESTRATED',
      language: 'en',
      reason: 'LLM guessed',
    };

    const guarded = (svc as any).applyIntentGuardrails(
      raw,
      'im intrested in house 32',
    ) as ClassificationResult;

    expect(guarded.intent).toBe('get_property_details');
    expect(guarded.executionMode).toBe('DIRECT_LOOKUP');
  });

  it('blocks maintenance intent for tenant complaints (noise/neighbor)', () => {
    const svc = new AiClassifierService();
    const raw: ClassificationResult = {
      intent: 'maintenance_request',
      complexity: 2,
      executionMode: 'ORCHESTRATED',
      language: 'en',
      reason: 'LLM guessed',
      entities: { unit: 'B4', issue_details: 'making noise' },
    };

    const guarded = (svc as any).applyIntentGuardrails(
      raw,
      'Neighbor in B4 is making noise',
    ) as ClassificationResult;

    expect(guarded.intent).toBe('tenant_complaint');
    expect(guarded.executionMode).toBe('DIRECT_LOOKUP');
    expect(guarded.entities?.subject_unit).toBe('B4');
  });
});
