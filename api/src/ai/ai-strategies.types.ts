import { Interpretation, ExecutionTrace } from './ai-contracts.types';

export interface AiStrategy {
  readonly role: string;
  resolveIntent(
    message: string,
    history: any[],
    context: any,
  ): Promise<Partial<Interpretation>>;
  projectTruth(rawTruth: any): any;
}

export interface RoleConfig {
  strategies: Record<string, AiStrategy>;
}
