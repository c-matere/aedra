export interface CapabilityNode {
  tool: string;
  consumes: string[];
  produces: string[];
  requires_state: string[];
  tags: string[];
  complexity: 1 | 2 | 3;
}

export const CAPABILITY_GRAPH: CapabilityNode[] = [
  {
    tool: 'create_tenant',
    consumes: ['tenant_data', 'unit_id'],
    produces: ['tenant_id'],
    requires_state: ['unit_exists'],
    tags: ['tenant', 'creation', 'onboarding'],
    complexity: 1,
  },
  {
    tool: 'assign_unit',
    consumes: ['tenant_id', 'unit_id'],
    produces: ['assignment_record'],
    requires_state: ['tenant_exists', 'unit_exists', 'unit_vacant'],
    tags: ['tenant', 'unit', 'assignment'],
    complexity: 1,
  },
  {
    tool: 'generate_receipt',
    consumes: ['payment_record', 'tenant_id'],
    produces: ['receipt_text', 'receipt_pdf_url'],
    requires_state: ['payment_verified'],
    tags: ['financial', 'receipt', 'communication'],
    complexity: 1,
  },
  {
    tool: 'list_vacant_units',
    consumes: ['location_hint?'],
    produces: ['unit_list'],
    requires_state: [],
    tags: ['vacancy', 'inventory', 'search'],
    complexity: 1,
  },
];

export const toolsThatConsume = (
  shape: string,
  graph: CapabilityNode[] = CAPABILITY_GRAPH,
): CapabilityNode[] => graph.filter((node) => node.consumes.includes(shape));

export const toolsThatProduce = (
  shape: string,
  graph: CapabilityNode[] = CAPABILITY_GRAPH,
): CapabilityNode[] => graph.filter((node) => node.produces.includes(shape));

export const shortlistTools = (
  params: {
    consumes?: string[];
    produces?: string[];
    requires_state?: string[];
    tags?: string[];
    max?: number;
  },
  graph: CapabilityNode[] = CAPABILITY_GRAPH,
): CapabilityNode[] => {
  const {
    consumes = [],
    produces = [],
    requires_state = [],
    tags = [],
    max = 5,
  } = params;

  const matches = graph.filter((node) => {
    const consumesOk =
      consumes.length === 0 || consumes.every((c) => node.consumes.includes(c));
    const producesOk =
      produces.length === 0 || produces.every((p) => node.produces.includes(p));
    const stateOk =
      requires_state.length === 0 ||
      requires_state.every((s) => node.requires_state.includes(s));
    const tagsOk =
      tags.length === 0 || tags.some((tag) => node.tags.includes(tag));
    return consumesOk && producesOk && stateOk && tagsOk;
  });

  return matches.slice(0, max);
};
