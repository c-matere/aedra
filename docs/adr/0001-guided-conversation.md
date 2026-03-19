# ADR 0001: Guided Conversation Design for WhatsApp

- **Status:** Accepted (2026-03-16)
- **Context:** Greeting/hello flows were going through the LLM classifier + generator, adding ~2.8s latency, token cost, and hallucination risk. Agents need fast, predictable menus with clear next actions.
- **Decision:** Implement a templated greeting engine plus a numbered quick-action router inside `api/src/ai/ai.direct.ts`:
  - Role-based menus (SUPER_ADMIN, AGENT, TENANT, LANDLORD) with EN/SW variants and contextual counts.
  - Single-digit replies routed directly to intents/tools when safe; falls back to normal pipeline if unmapped.
  - Contextual suggestions handled in-code (no model calls) to keep flows deterministic.
- **Rationale:** Cuts greeting path to ~65ms, eliminates token spend for high-frequency interactions, and reduces user cognitive load by showing available actions upfront.
- **Consequences:** 
  - Need to keep role context fresh for menu rendering.
  - Quick-action map must stay aligned with tool names/permissions.
  - Future LLM prompts should treat greetings as already handled to avoid duplicate replies.
