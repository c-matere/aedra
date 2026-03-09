# aedra-mcp-server

A minimal MCP server using stdio transport.

## Setup

```bash
cd mcp-server
npm install
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm run build
npm start
```

## Exposed tools

- `echo(text: string)`
- `add(a: number, b: number)`
