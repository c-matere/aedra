import { routeWorkflowRequest } from './workflow.router';

describe('routeWorkflowRequest', () => {
  const userId = 'user-1';

  const makeEngine = (overrides: Partial<any> = {}) => {
    return {
      getActiveInstance: jest.fn(),
      resume: jest.fn(),
      clearActiveInstance: jest.fn(),
      create: jest.fn(),
      ...overrides,
    };
  };

  it('resumes a waiting workflow when intent maps to the same workflow', async () => {
    const engine = makeEngine();
    engine.getActiveInstance.mockResolvedValue({
      instanceId: 'inst-1',
      workflowId: 'maintenance_resolution',
      status: 'WAITING',
    });
    engine.resume.mockResolvedValue({ instanceId: 'inst-1' });

    const res = await routeWorkflowRequest(engine as any, {
      userId,
      message: 'The tap is leaking again',
      intent: 'report_maintenance',
      context: { allowWorkflows: true },
      agentFallback: jest.fn(),
    });

    expect(engine.clearActiveInstance).not.toHaveBeenCalled();
    expect(engine.resume).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ instanceId: 'inst-1' });
  });

  it('clears a waiting workflow when new intent does not map to that workflow', async () => {
    const engine = makeEngine();
    engine.getActiveInstance.mockResolvedValue({
      instanceId: 'inst-1',
      workflowId: 'maintenance_resolution',
      status: 'WAITING',
    });
    engine.create.mockResolvedValue({ instanceId: 'inst-2' });

    const agentFallback = jest.fn().mockResolvedValue({ response: 'ok' });
    const res = await routeWorkflowRequest(engine as any, {
      userId,
      message: 'Did John Mwangi pay rent?',
      intent: 'check_rent_status',
      context: { allowWorkflows: true },
      agentFallback,
    });

    expect(engine.clearActiveInstance).toHaveBeenCalledTimes(1);
    expect(engine.resume).not.toHaveBeenCalled();
    expect(engine.create).not.toHaveBeenCalled();
    expect(agentFallback).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ response: 'ok' });
  });

  it('still resumes a waiting workflow for short confirmation messages', async () => {
    const engine = makeEngine();
    engine.getActiveInstance.mockResolvedValue({
      instanceId: 'inst-1',
      workflowId: 'maintenance_resolution',
      status: 'WAITING',
    });
    engine.resume.mockResolvedValue({ instanceId: 'inst-1' });

    await routeWorkflowRequest(engine as any, {
      userId,
      message: 'ok',
      intent: 'general_query',
      context: { allowWorkflows: true },
      agentFallback: jest.fn(),
    });

    expect(engine.resume).toHaveBeenCalledTimes(1);
    expect(engine.clearActiveInstance).not.toHaveBeenCalled();
  });
});
