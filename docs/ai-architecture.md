# Aedra AI Architecture

Aedra is a sophisticated AI co-worker designed for property management. It follows a modular, resilient, and multi-layered architecture optimized for high-reliability interactions via WhatsApp and Web.

## 1. High-Level Design
Aedra is designed as a **Strategic Co-worker** rather than a simple chatbot. It utilizes natural, Nairobi-style code-switching (mix of English and Swahili) to build rapport and ensure clarity in its operating environment.

## 2. The Orchestration Layer
Interaction flows are managed by specialized orchestrators:

- **WhatsApp Orchestrator (`AiWhatsappOrchestratorService`)**:
  - Handles session locking and user identification.
  - Manages audio transcription (via Groq/Whisper) with proactive feedback.
  - Implements **Interactive Flows**: Button-based approvals, multi-select lists, and correction loops.
  - Supports **Actionable Echo**: Confirming user intent before committing mutative actions.

## 3. The Brain (Classification & Guardrails)
Intent detection is handled by the `AiClassifierService` using a two-tier strategy:

- **Tier 1 (Primary)**: Llama 3.1 8B (via Groq) for low-latency, high-accuracy classification.
- **Tier 2 (Fallback)**: Gemini 2.0 Flash for robustness.
- **Guardrails**: Deterministic regex and lexical checks override the LLM for high-risk intents (Emergencies, Financials, Security breaches) to ensure 100% reliability for critical paths.

## 4. The Execution Spine
Strategic or multi-step requests are handled by a **Structural Planner**:

1. **Planning**: `AiService.generateActionPlan` creates a structured `ActionPlan` (JSON) containing sequential tool calls.
2. **Execution**: `executeActionPlan` runs the steps, handling dependencies and context merging.
3. **Summary**: A final synthesis turn translates technical tool results into natural conversation.

## 5. Tool Registry & Specialized Services
Tools are categorized and executed by specialized services for better maintainability and security:

- **Read Tools (`AiReadToolService`)**: Data retrieval (tenants, properties, vacancies).
- **Write Tools (`AiWriteToolService`)**: Mutative operations with strict validation.
- **Report Tools (`AiReportToolService`)**: Complex aggregations (McKinsey-style reports, CSV/PDF exports).
- **History Tools (`AiHistoryToolService`)**: Versioning, audit logs, and one-click rollbacks.

## 6. Autonomous Agents
For long-running goals (e.g., "Onboard 500 tenants from this PDF"), the `AutonomousAgentService` manages:
- **Goal Decomposition**: Breaking large tasks into manageable "chunks".
- **Heartbeat Mechanism**: Background execution with periodic status updates to the user.
- **Human-in-the-loop**: Seeking approval for plans and feedback on progress.

## 7. Reliability & Resiliency
- **Error Recovery**: `ErrorRecoveryService` handles tool failures with intelligent retry logic.
- **System Degradation**: `SystemDegradationService` monitors API health and shifts models or disables complex features during outages.
- **Auditability**: Every AI action is logged in `ChatHistory` and `AuditLog`, enabling transparency and rollback capabilities.

## 8. Integration & State
- **Workflow Engine**: Connects AI intents to stateful business processes (e.g., maintenance tickets).
- **Context Management**: `TemporalContextService` and `ContextMemoryService` maintain short-term and long-term awareness of the user's specific context (Property, Unit, Tenant).
