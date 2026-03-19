import {
  coreReadTools,
  coreWriteTools,
  reportTools,
  workflowTools,
  allToolDeclarations,
} from '../../../api/src/ai/ai.tools';

type ToolDecl = {
  name: string;
  description: string;
  parameters: {
    type: any;
    properties?: Record<string, any>;
    required?: string[];
  };
};

describe('Tool Registry', () => {
  it('exports exactly 56 tools with no duplicates', () => {
    const names = allToolDeclarations.map(t => t.name);
    expect(allToolDeclarations).toHaveLength(60);
    expect(new Set(names).size).toBe(names.length);
  });

  it('each tool has name, description, and parameters object', () => {
    for (const tool of allToolDeclarations as ToolDecl[]) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(5);
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBeDefined();
      expect(tool.parameters.type).not.toBeNull();
      if (tool.parameters.properties) {
        expect(typeof tool.parameters.properties).toBe('object');
      }
    }
  });

  it('required fields (if any) exist in properties', () => {
    for (const tool of allToolDeclarations as ToolDecl[]) {
      const { required, properties } = tool.parameters;
      if (required && required.length) {
        expect(properties).toBeDefined();
        required.forEach((field: string) => {
          expect(properties).toHaveProperty(field);
        });
      }
    }
  });
});
