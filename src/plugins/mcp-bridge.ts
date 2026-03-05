import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs/promises";
import path from "path";

interface MCPServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

interface MCPConfig {
    mcpServers: Record<string, MCPServerConfig>;
}

export class MCPBridge {
    private clients: Map<string, Client> = new Map();

    async loadServers(configPath: string) {
        try {
            const data = await fs.readFile(configPath, "utf-8");
            const config: MCPConfig = JSON.parse(data);

            for (const [name, server] of Object.entries(config.mcpServers)) {
                console.log(`[MCP] Connecting to server: ${name}...`);
                try {
                    const transport = new StdioClientTransport({
                        command: server.command,
                        args: server.args || [],
                        env: { ...process.env, ...(server.env || {}) } as Record<string, string>
                    });

                    const client = new Client({
                        name: "GravityClaw-Bridge",
                        version: "1.0.0"
                    }, {
                        capabilities: {}
                    });

                    await client.connect(transport);
                    this.clients.set(name, client);
                    console.log(`[MCP] Connected to ${name} successfully.`);
                } catch (err: any) {
                    console.error(`[MCP] Failed to connect to ${name}: ${err.message}`);
                }
            }
        } catch (err: any) {
            console.warn(`[MCP] No MCP config found or failed to read: ${err.message}`);
        }
    }

    async listTools() {
        const allTools = [];
        for (const [name, client] of this.clients) {
            try {
                // Timeout listing tools after 3 seconds
                const toolsRes = await Promise.race([
                    client.listTools(),
                    new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
                ]);
                for (const tool of toolsRes.tools) {
                    allTools.push({
                        serverName: name,
                        ...tool
                    });
                }
            } catch (err: any) {
                console.error(`[MCP] Failed to list tools for ${name}: ${err.message}`);
            }
        }
        return allTools;
    }

    async callTool(serverName: string, toolName: string, args: any) {
        const client = this.clients.get(serverName);
        if (!client) throw new Error(`MCP Server ${serverName} not connected.`);
        return await client.callTool({
            name: toolName,
            arguments: args
        });
    }
}

export const mcpBridge = new MCPBridge();
