# Engineering Vade Mecum: Adding AI Capabilities

This guide is for Aedra engineers who need to expose new features to the **Brain Reasoning Engine**.

---

## 1. Defining a New Tool

All "Thinking" capabilities must be registered in the **Tool Discovery Manifest**.

### Step A: Define the Schema
Add your tool definition to `aedra/api/src/ai/ai-tool-definitions.ts`. Use the `SchemaType` from `@google/generative-ai`.

```typescript
// Example: Adding a tool to check property occupancy
{
  name: 'get_occupancy_stats',
  description: 'Returns occupancy percentages and trends for a specific property.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      propertyId: { type: SchemaType.STRING, description: 'The UUID of the property' },
    },
    required: ['propertyId'],
  },
}
```

### Step B: Register the Route
Add your tool to the `ROLE_TOOL_ALLOWLIST` in `aedra/api/src/ai/ai-tool-registry.service.ts` to define who can use it.

---

## 2. Implementing the Logic

Tools are split into **Read** operations (Safe) and **Write** operations (Mutative/High-Stakes).

### For Read Operations (`AiReadToolService`)
1. Implement your method.
2. **CRITICAL**: Always use the `context.companyId` to filter your queries.

```typescript
async getOccupancyStats(args: { propertyId: string }, context: any) {
  return await this.prisma.unit.groupBy({
    by: ['status'],
    where: { 
      propertyId: args.propertyId,
      property: { companyId: context.companyId } // <--- Mandatory Multi-tenancy check
    },
    _count: true,
  });
}
```

### For Write Operations (`AiWriteToolService`)
Write operations are often staged or require approval. Ensure you leverage the `QuorumBridgeService` if the action is considered "High-Stakes" (e.g., recording a $100k payment).

---

## 3. The 3 Golden Rules of AI Tools

### I. Never Leak Data
The Brain is an external service. Never trust the `args` provided by the Brain for tenant-level isolation. Always verify against the `context` provided by Aedra.

### II. Description is Code
The `description` field in the schema is what the AI uses to decide when to call your tool. Be precise.
- **Bad**: `Get property info.`
- **Good**: `Returns a list of units, their rent amounts, and current occupancy status for a managed property.`

### III. Return Structured Data
The Brain prefers JSON. Avoid returning raw strings unless it's a simple confirmation message. Structured data allows the Brain to continue reasoning (e.g., "The occupancy is 80%, suggest a rental discount").

---

## 4. Troubleshooting Discovery

If your tool isn't showing up in the AI's "thoughts":
1. **Check the Manifest**: Visit `GET /ai/manifest` (or check the **Integrations Hub** "Brain Connectivity" card) to see if your tool appears in the list.
2. **Check Permissions**: Ensure the `role` you are testing with has the tool in its allowlist.
3. **Restart the Brain**: The Brain caches the manifest. Trigger a re-sync via the Integrations Hub.
