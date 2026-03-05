import { IChannel } from './types.js';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

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

    constructor(port: number = 3000) {
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });

        // Serve static files from src/web/public (will be mapped to dist/web/public)
        this.app.use(express.static(path.join(__dirname, '../../src/web/public')));

        this.wss.on('connection', (ws) => {
            console.log('[WebChat] Client connected');
            this.clients.add(ws);

            ws.on('message', async (data) => {
                const text = data.toString();
                console.log(`[WebChat] Received: ${text}`);
                if (this.messageCallback) {
                    await this.messageCallback({
                        text,
                        chat: { id: 'web-user' }
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
    }

    async sendMessage(chatId: string, text: string): Promise<void> {
        if (chatId !== 'web-user') return;
        const payload = JSON.stringify({ type: 'message', text });
        this.broadcast(payload);
    }

    async sendStatus(chatId: string, status: string): Promise<void> {
        if (chatId !== 'web-user') return;
        const payload = JSON.stringify({ type: 'status', text: status });
        this.broadcast(payload);
    }

    async sendUsage(chatId: string, totalCost: number): Promise<void> {
        if (chatId !== 'web-user') return;
        const payload = JSON.stringify({ type: 'usage', totalCost });
        this.broadcast(payload);
    }

    private broadcast(payload: string): void {
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }

    onMessage(callback: (msg: any) => Promise<void>): void {
        this.messageCallback = callback;
    }
}
