import { WorkflowType } from '@prisma/client';
import { formatPropertyList, formatTenantList } from './ai.formatters';

const normalizeText = (message: string) =>
    (message || '').toLowerCase().replace(/\s+/g, ' ').trim();

export const tryDirectTool = async (
    message: string,
    context: any,
    prisma: any,
    executeTool: (name: string, args: any, ctx: any) => Promise<any>
) => {
    /* 
    The "lexical layer" is disabled as per user request to move towards a more natural AI-driven intent identification.
    */
    return null;
};
