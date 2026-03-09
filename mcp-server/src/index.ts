import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "aedra-mcp-server",
  version: "0.1.0",
});

server.tool(
  "echo",
  "Echoes back the provided text.",
  {
    text: z.string().describe("Text to echo"),
  },
  async ({ text }) => {
    return {
      content: [{ type: "text", text: `Echo: ${text}` }],
    };
  }
);

server.tool(
  "add",
  "Adds two numbers.",
  {
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  },
  async ({ a, b }) => {
    return {
      content: [{ type: "text", text: `${a + b}` }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
