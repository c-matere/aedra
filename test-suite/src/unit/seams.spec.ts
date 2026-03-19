import { selectTools, INTENT_TOOL_MAP } from '../../../api/src/ai/ai-tool-selector.util';
import { MASTER_PERSONAS, UserPersona } from '../../../api/src/ai/persona.registry';
import { allToolDeclarations } from '../../../api/src/ai/ai.tools';
import { tryDirectTool } from '../../../api/src/ai/ai.direct';
import { withRetry } from '../../../api/src/common/utils/retry';
import { formatUnitList } from '../../../api/src/ai/ai.formatters';

describe('Seam coverage', () => {
  describe('Tool manifest completeness', () => {
    const staffPersona = MASTER_PERSONAS[UserPersona.SUPER_ADMIN];
    const intents = Object.keys(INTENT_TOOL_MAP);

    it('every known intent yields at least one allowed tool for SUPER_ADMIN', () => {
      intents.forEach((intent) => {
        const tools = selectTools(intent, staffPersona, allToolDeclarations);
        expect(tools.length).toBeGreaterThan(0);
      });
    });

    it('unknown intents fall back to a safe default set', () => {
      const tools = selectTools('totally_unknown_intent', staffPersona, allToolDeclarations);
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('Pre-router guardrails', () => {
    const prismaMock: any = { payment: { findFirst: jest.fn().mockResolvedValue(null) } };

    it('greeting bypasses executeTool and returns a menu', async () => {
      const exec = jest.fn();
      const res = await tryDirectTool('Hello', { role: 'SUPER_ADMIN' }, prismaMock, exec, 'en');
      expect(exec).not.toHaveBeenCalled();
      expect(typeof res).toBe('string');
      expect((res as string).length).toBeGreaterThan(0);
    });

    it('single digit routes directly via quick action', async () => {
      const exec = jest.fn().mockResolvedValue('routed');
      const res = await tryDirectTool('1', { role: 'SUPER_ADMIN' }, prismaMock, exec, 'en');
      expect(exec).toHaveBeenCalledWith('list_companies', {}, { role: 'SUPER_ADMIN' });
      expect(res).toBe('routed');
    });
  });

  describe('Retry utility', () => {
    it('retries once on network-like error then succeeds', async () => {
      jest.useFakeTimers();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValue('ok');
      const promise = withRetry(fn, { initialDelay: 10, maxDelay: 10 });
      await jest.runAllTimersAsync();
      const result = await promise;
      expect(fn).toHaveBeenCalledTimes(2);
      expect(result).toBe('ok');
      jest.useRealTimers();
    });
  });

  describe('Response formatting (lists)', () => {
    it('unit list output is numbered and hides internal IDs/count markers', () => {
      const out = formatUnitList([
        { unitNumber: '3A', status: 'VACANT', property: { name: 'Bahari' }, rentAmount: 18000, id: 'uuid-1' },
        { unitNumber: '4B', status: 'OCCUPIED', property: { name: 'Bahari' }, rentAmount: 20000, id: 'uuid-2' },
      ]);
      expect(out).toMatch(/Unit 3A/);
      expect(out).not.toMatch(/ID:/i);
      expect(out).not.toMatch(/Returned:/i);
    });
  });
});
