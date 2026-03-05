import { IChannel } from './types.js';
import express from 'express';

export class WebhookChannel implements IChannel {
    id = 'webhook-channel';
    name = 'Webhook Integration';
    version = '1.0.0';

    private app: express.Application;
    private messageCallback?: (msg: any) => Promise<void>;

    constructor(port: number = 3002) {
        this.app = express();
        this.app.use(express.json());

        this.app.post('/webhook', async (req, res) => {
            console.log('[Webhook] Received payload:', req.body);
            if (this.messageCallback) {
                // Route to agent
                const text = `Webhook Triggered:\n${JSON.stringify(req.body, null, 2)}`;
                await this.messageCallback({
                    text,
                    chat: { id: 'webhook-user' }
                });
            }
            res.status(200).send({ status: 'ok' });
        });

        this.app.listen(port, () => {
            console.log(`[Webhook] Server is running on http://localhost:${port}/webhook`);
        });
    }

    async sendMessage(chatId: string, text: string): Promise<void> {
        // Webhooks don't typically receive synchronous replies this way,
        // but we could log it or send to a configured URL if needed.
        console.log(`[Webhook Response to ${chatId}]: ${text}`);
    }

    onMessage(callback: (msg: any) => Promise<void>): void {
        this.messageCallback = callback;
    }
}
