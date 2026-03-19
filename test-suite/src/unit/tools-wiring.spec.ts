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
const toolServicePaths = [
  join(projectRoot, 'api/src/ai/ai-read-tool.service.ts'),
  join(projectRoot, 'api/src/ai/ai-write-tool.service.ts'),
  join(projectRoot, 'api/src/ai/ai-report-tool.service.ts'),
];

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
  const switchNames = toolServicePaths.flatMap(path => {
    try {
      const source = readFileSync(path, 'utf8');
      return extractCaseNames(source);
    } catch (e) {
      return [];
    }
  });

  it('every declared tool has a dispatcher case', () => {
    const missing = toolNames.filter(n => !switchNames.includes(n));
    // workflow_initiate is handled by WorkflowEngine, not the switch
    const expectedMissing = ['workflow_initiate'];
    const actualMissing = missing.filter(n => !expectedMissing.includes(n));
    expect(actualMissing).toEqual([]);
  });

  it('dispatcher cases that are not tools are explicitly allowed', () => {
    const extras = switchNames.filter(n => !toolNames.includes(n));
    // Filter out duplicates (like 'lease' from multiple files/methods)
    const uniqueExtras = Array.from(new Set(extras));
    // These are helper cases or aliases that are not exposed to the model manifest.
    const allowedExtras = [
      'get_landlord_details',
      'get_maintenance_request_details',
      'get_staff_details',
      'property',
      'tenant',
      'unit',
      'search_maintenance_requests',
      'check_rent_status', // Alias in ReadTool
      'import_tenants',    // Helper in ReadTool
      'retry_reminders',   // Helper in WriteTool
      'dismiss',           // Helper in WriteTool
      'send_report_landlord', // Mocked in ReportTool
      'download_report',     // Mocked in ReportTool
      'schedule_report',    // Mocked in ReportTool
      'lease',             // Internal case in resolveCompanyId
    ];
    const unexpected = uniqueExtras.filter(n => !allowedExtras.includes(n));
    expect(unexpected).toEqual([]);
  });
});
