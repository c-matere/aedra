import { Injectable, Logger, Inject } from '@nestjs/common';
import { GoogleGenerativeAI, Tool } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { tenantContext } from '../common/tenant-context';
import { UserRole, WorkflowType, WorkflowStatus } from '@prisma/client';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private genAI: GoogleGenerativeAI;
    private model: any;

    prisma: PrismaService;

    constructor(@Inject(PrismaService) prisma: PrismaService) {
        this.prisma = prisma;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found in environment');
        }
        this.genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');

        // Define the tools for Gemini
        const tools: Tool[] = [
            {
                functionDeclarations: [
                    {
                        name: 'list_properties',
                        description: 'List all properties managed by the current company.',
                    },
                    {
                        name: 'get_property_details',
                        description: 'Get detailed information about a specific property including units.',
                        parameters: {
                            type: 'object',
                            properties: {
                                propertyId: { type: 'string', description: 'The UUID of the property' },
                            },
                            required: ['propertyId'],
                        },
                    },
                    {
                        name: 'workflow_initiate',
                        description: 'Start a new stateful property management workflow.',
                        parameters: {
                            type: 'object',
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: Object.values(WorkflowType),
                                    description: 'The type of workflow to start'
                                },
                                targetId: { type: 'string', description: 'ID of the related entity (e.g. LeaseID)' },
                            },
                            required: ['type'],
                        },
                    },
                    // ... more tools will be added here
                ],
            },
        ];

        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: tools as any,
        });
    }

    async chat(history: any[], message: string) {
        const context = tenantContext.getStore();
        if (!context) throw new Error('No tenant context found');

        const chat = this.model.startChat({
            history: history.map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
            })),
        });

        let result = await chat.sendMessage(message);
        let response = result.response;

        // Handle tool calling loop
        const maxCalls = 5;
        let calls = 0;

        while (response.candidates[0].content.parts.some(p => p.functionCall) && calls < maxCalls) {
            calls++;
            const toolCalls = response.candidates[0].content.parts.filter(p => p.functionCall);
            const toolResponses = [];

            for (const call of toolCalls) {
                const { name, args } = call.functionCall;
                this.logger.log(`AI invoking tool: ${name} with args: ${JSON.stringify(args)}`);

                const toolResult = await this.executeTool(name, args, context);
                toolResponses.push({
                    functionResponse: {
                        name,
                        response: { content: toolResult },
                    },
                });
            }

            result = await chat.sendMessage(toolResponses);
            response = result.response;
        }

        return response.text();
    }

    async listActiveWorkflows() {
        const context = tenantContext.getStore();
        if (!context) throw new Error('No tenant context found');

        return await this.prisma.workflowInstance.findMany({
            where: {
                companyId: context.companyId,
                status: {
                    notIn: [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED],
                },
                deletedAt: null,
            },
            orderBy: { updatedAt: 'desc' },
            take: 10,
        });
    }

    private async executeTool(name: string, args: any, context: any) {
        try {
            switch (name) {
                case 'list_properties':
                    return await this.prisma.property.findMany();

                case 'get_property_details':
                    return await this.prisma.property.findUnique({
                        where: { id: args.propertyId },
                        include: { units: true },
                    });

                case 'workflow_initiate':
                    return await this.prisma.workflowInstance.create({
                        data: {
                            type: args.type,
                            companyId: context.companyId,
                            targetId: args.targetId,
                            status: WorkflowStatus.PENDING,
                        },
                    });

                default:
                    return { error: `Tool ${name} not implemented` };
            }
        } catch (error) {
            this.logger.error(`Error executing tool ${name}: ${error.message}`);
            return { error: error.message };
        }
    }
}
