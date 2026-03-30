import { AgentContext, IChannel } from '../types.js';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConversationHistory, getUsageStats, listRecentChatSessions } from '../memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebChannel implements IChannel {
    id = 'web-channel';
    name = 'WebChat UI Channel';
    version = '1.0.0';

    private app: express.Application;
    private server: ReturnType<typeof createServer>;
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private messageCallback?: (msg: any) => Promise<void>;

    private static instance: WebChannel;

    public static getInstance(port?: number): WebChannel {
        if (!WebChannel.instance) {
            WebChannel.instance = new WebChannel(port);
        }
        return WebChannel.instance;
    }

    constructor(port: number = 3000) {
        this.app = express();
        this.app.use(express.json()); // Support JSON bodies
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });

        // Internal mirroring/injection endpoint
        this.app.post('/mirror', async (req: any, res: any) => {
            const { text, submit } = req.body;
            if (text) {
                // 1. Display in UI
                this.broadcast(JSON.stringify({ type: 'message', text: `🛡️ [CLAW]: ${text}` }));

                // 2. If 'submit' is true, inject into the conversation loop
                if (submit && this.messageCallback) {
                    console.log(`[WebChat] Stealth Injection: Processing message as human-input...`);
                    await this.messageCallback({
                        text,
                        chat: { id: 'claw-pm' }
                    });
                }
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Missing text in body' });
            }
        });

        // Serve static files from web/public
        this.app.use(express.static(path.join(__dirname, '../web/public')));

        this.wss.on('connection', async (ws: any) => {
            console.log('[WebChat] Client connected');
            this.clients.add(ws);

            // Send current usage on connect
            const stats = getUsageStats();
            ws.send(JSON.stringify({ type: 'usage', daily: stats.daily_cost_gbp, monthly: stats.monthly_cost_gbp }));

            // 1. Send chat session list
            const rawSessions = listRecentChatSessions(15);
            const sessions = rawSessions.map((s: any) => {
                let preview = '...';
                try {
                    const parts = JSON.parse(s.last_msg);
                    preview = parts.find((p: any) => p.text)?.text.substring(0, 40) + '...' || 'Tool activity';
                } catch (_) {}
                return { id: s.chat_id, last_activity: s.last_activity, preview };
            });
            ws.send(JSON.stringify({ type: 'chat_list', sessions }));

            ws.on('message', async (data: any) => {
                const text = data.toString();
                console.log(`[WebChat] Received: ${text}`);

                let chatId = 'web-user';
                let messageText = text;

                try {
                    const cmd = JSON.parse(text);
                    if (cmd.type === 'load_history') {
                        const rawHistory = getConversationHistory(cmd.chatId, 30);
                        const history = rawHistory.map((h: any) => {
                            let text = '';
                            if (Array.isArray(h.parts)) {
                                text = h.parts.map((p: any) => p.text || '').join('');
                                if (!text && h.parts.some((p: any) => p.functionCall)) {
                                    text = `[EXECUTING TOOL: ${h.parts.find((p: any) => p.functionCall).functionCall.name}]`;
                                }
                            }
                            return { role: h.role, text };
                        }).filter(h => h.text);

                        ws.send(JSON.stringify({ type: 'history', history, chatId: cmd.chatId }));
                        return;
                    }

                    if (cmd.type === 'message') {
                        messageText = cmd.text;
                        chatId = cmd.chatId || 'web-user';
                    }

                    if (cmd.type === 'command') {
                        if (this.commandCallback) {
                            await this.commandCallback(cmd);
                        }
                        return; // Bypass normal messageCallback
                    }
                } catch (_) {}

                if (this.messageCallback) {
                    await this.messageCallback({
                        text: messageText,
                        chat: { id: chatId }
                    });
                }
            });

            ws.on('close', () => {
                console.log('[WebChat] Client disconnected');
                this.clients.delete(ws);
            });
        });

        this.server.listen(port, () => {
            console.log(`[WebChat] Server is running on http://localhost:${port}`);
        });

        WebChannel.instance = this;
    }

    async sendMessage(chatId: string, text: string): Promise<void> {
        const payload = JSON.stringify({ type: 'message', text, chatId });
        this.broadcast(payload);
    }

    async sendStatus(chatId: string, status: string): Promise<void> {
        const payload = JSON.stringify({ type: 'status', text: status, chatId });
        this.broadcast(payload);
    }

    async sendUsage(chatId: string, daily: number, monthly: number): Promise<void> {
        const payload = JSON.stringify({ type: 'usage', daily, monthly, chatId });
        this.broadcast(payload);
    }

    public broadcast(payload: string): void {
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }

    private commandCallback?: (cmd: any) => Promise<void>;

    public onCommand(callback: (cmd: any) => Promise<void>): void {
        this.commandCallback = callback;
    }

    onMessage(callback: (msg: any) => Promise<void>): void {
        this.messageCallback = callback;
    }
}
