import { allToolDeclarations } from '../../../api/src/ai/ai.tools';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * This test guards the seam between the tool manifest (ai.tools.ts)
 * and the dispatcher (AiService.executeTool switch). If a tool is
 * missing from the switch, it will never execute; if the manifest
 * drops a tool name, the model will never call it. We parse both
 * lists and ensure perfect overlap.
 */

const projectRoot = join(__dirname, '../../..');
const aiServicePath = join(projectRoot, 'api/src/ai/ai.service.ts');

const extractCaseNames = (source: string): string[] => {
  const regex = /case\s+'([^']+)'/g;
  const names: string[] = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
};

describe('Tool wiring between manifest and dispatcher', () => {
  const toolNames = allToolDeclarations.map(t => t.name);
  const aiServiceSource = readFileSync(aiServicePath, 'utf8');
  const switchNames = extractCaseNames(aiServiceSource);

  it('every declared tool has a dispatcher case', () => {
    const missing = toolNames.filter(n => !switchNames.includes(n));
    expect(missing).toEqual([]);
  });

  it('dispatcher cases that are not tools are explicitly allowed', () => {
    const extras = switchNames.filter(n => !toolNames.includes(n));
    // These are helper cases that are not exposed to the model manifest.
    const allowedExtras = [
      'get_landlord_details',
      'get_maintenance_request_details',
      'get_staff_details',
      'property',
      'tenant',
      'unit',
      'search_maintenance_requests',
    ];
    const unexpected = extras.filter(n => !allowedExtras.includes(n));
    expect(unexpected).toEqual([]);
  });
});
