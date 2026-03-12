# Aedra AI Agent Architecture

This agent follows a modular, production-oriented design with explicit routing, tool bundling, strict validation, and deterministic guardrails for high-frequency intents.

## Core Components

1. **Router**
   - `api/src/ai/ai.router.ts`
   - Selects a tool bundle based on explicit prefixes (`/read`, `/write`, `/report`) and intent hints.
   - Keeps the model tool context small and focused.

2. **Tool Bundles**
   - `api/src/ai/ai.tools.ts`
   - `read`: listing and lookup operations.
   - `write`: create/update operations with confirmation gating.
   - `report`: reporting tools and aggregations.

3. **Validation**
   - `api/src/ai/ai.validation.ts`
   - Strict enum normalization/validation for statuses and types.
   - Invalid values return structured errors.

4. **Direct Intent Handler**
   - `api/src/ai/ai.direct.ts`
   - Deterministic answers for common user requests (e.g., property list, counts, tenant search).
   - Prevents the model from skipping tools on high-frequency intents.

5. **Formatting**
   - `api/src/ai/ai.formatters.ts`
   - Consistent formatting for list responses.

6. **Execution + Observability**
   - `api/src/ai/ai.service.ts`
   - Tool execution, confirmation gates, routing selection, and logging.
   - Logs route selection and request context for traceability.

## Safety & Governance

- Write actions require explicit `confirm=true`.
- All data access is scoped to `companyId`.
- Soft deletes are respected.
- Report outputs can include `explain=true` for derivation transparency.

## Testing

- `api/src/ai/ai.router.spec.ts`
- `api/src/ai/ai.validation.spec.ts`

## Extensibility

- Add new tools in `ai.tools.ts` and wire execution in `ai.service.ts`.
- Extend routing hints in `ai.router.ts`.
- Expand direct intents in `ai.direct.ts`.
