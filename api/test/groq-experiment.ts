import "dotenv/config";
import Groq from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: GROQ_API_KEY });

// We'll mock the tools for now to see how the AI handles the chaining and token pressure
const tools: any[] = [
    {
        type: "function",
        function: {
            name: "select_company",
            description: "Select a company to work within.",
            parameters: {
                type: "object",
                properties: {
                    companyId: { type: "string", description: "The UUID of the company" }
                },
                required: ["companyId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_property",
            description: "Create a new property.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    address: { type: "string" },
                    propertyType: { type: "string", enum: ["RESIDENTIAL", "COMMERCIAL"] }
                },
                required: ["name", "address", "propertyType"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_unit",
            description: "Create a new unit for a property.",
            parameters: {
                type: "object",
                properties: {
                    propertyId: { type: "string" },
                    unitNumber: { type: "string" },
                    rentAmount: { type: "number" },
                    status: { type: "string", enum: ["VACANT", "OCCUPIED"] }
                },
                required: ["propertyId", "unitNumber", "rentAmount", "status"]
            }
        }
    }
];

async function runExperiment() {
    console.log("=== Groq Tool Chaining Experiment (GPT-OSS / Llama 3) ===");
    
    let messages: any[] = [
        {
            role: "system",
            content: "You are Aedra, a proactive assistant. When asked to perform bulk tasks, do them all in sequence. Use ID 'prop-123' for any property you create."
        },
        {
            role: "user",
            content: "Select company 'comp-xyz', then create a property 'Antigravity Gardens' in Nairobi and add 12 units numbered T1 to T12 with rent 500 each. Just do it."
        }
    ];

    let loop = 0;
    const maxLoop = 25;

    while (loop < maxLoop) {
        console.log(`\n--- Turn ${loop + 1} ---`);
        const startTime = Date.now();
        
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            tools: tools,
            tool_choice: "auto",
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        const choice = response.choices[0];
        const message = choice.message;
        
        console.log(`Latency: ${duration}ms`);

        if (message.content) {
            console.log(`AI: ${message.content}`);
        }

        if (!message.tool_calls || message.tool_calls.length === 0) {
            console.log("No more tool calls. Done.");
            break;
        }

        messages.push(message);

        for (const toolCall of message.tool_calls) {
            console.log(`Tool Call: ${toolCall.function.name}(${toolCall.function.arguments})`);
            
            // Mock responses
            let toolResult = { success: true };
            if (toolCall.function.name === 'create_property') {
                toolResult = { id: 'prop-123', name: 'Antigravity Gardens' } as any;
            }

            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
            });
        }

        loop++;
    }

    console.log("\n=== Experiment Complete ===");
    console.log(`Total Turns: ${loop}`);
    console.log(`Final History Size: ${messages.length} messages`);
}

runExperiment().catch(console.error);
