import { AiClassifierService, type ClassificationResult } from './ai-classifier.service';

describe('AiClassifierService guardrails', () => {
  it('treats property interest as read intent (not add_tenant)', () => {
    const svc = new AiClassifierService(null as any, null as any);
    const raw: ClassificationResult = {
      intent: 'add_tenant',
      complexity: 2,
      executionMode: 'ORCHESTRATED',
      language: 'en',
      reason: 'LLM guessed',
      priority: 'NORMAL',
    };

    const guarded = (svc as any).applyIntentGuardrails(
      raw,
      'im intrested in house 32',
    ) as ClassificationResult;

    expect(guarded.intent).toBe('get_property_details');
    expect(guarded.executionMode).toBe('DIRECT_LOOKUP');
  });

  it('blocks maintenance intent for tenant complaints (noise/neighbor)', () => {
    const svc = new AiClassifierService(null as any, null as any);
    const raw: ClassificationResult = {
      intent: 'maintenance_request',
      complexity: 2,
      executionMode: 'ORCHESTRATED',
      language: 'en',
      reason: 'LLM guessed',
      priority: 'NORMAL',
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

  it('upgrades multi-action onboarding to ORCHESTRATED with subIntents', () => {
    const svc = new AiClassifierService(null as any, null as any);
    const raw: ClassificationResult = {
      intent: 'general_query',
      complexity: 1,
      executionMode: 'DIRECT_LOOKUP',
      language: 'en',
      reason: 'LLM guessed',
      priority: 'NORMAL',
    };

    const upgraded = (svc as any).applyCompoundRequestHeuristics(
      raw,
      'Create property Links Road Nyali, add 10 units, set rent to 30000 per month for all units',
    ) as ClassificationResult;

    expect(upgraded.executionMode).toBe('ORCHESTRATED');
    expect(upgraded.isCompoundRequest).toBe(true);
    expect(Array.isArray(upgraded.subIntents)).toBe(true);
    expect((upgraded.subIntents || []).length).toBeGreaterThanOrEqual(2);
  });

  it('does not mark single-action requests as compound', () => {
    const svc = new AiClassifierService(null as any, null as any);
    const raw: ClassificationResult = {
      intent: 'onboard_property',
      complexity: 2,
      executionMode: 'ORCHESTRATED',
      language: 'en',
      reason: 'LLM guessed',
      priority: 'NORMAL',
    };

    const upgraded = (svc as any).applyCompoundRequestHeuristics(
      raw,
      'Create a new property called Palm Grove',
    ) as ClassificationResult;

    expect(upgraded.isCompoundRequest).toBeUndefined();
    expect(upgraded.subIntents).toBeUndefined();
  });
});
