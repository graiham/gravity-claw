import { Bot, webhookCallback } from 'grammy';

export interface Env {
    TELEGRAM_BOT_TOKEN: string;
    DB: any;
    MEMORY: any;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

        // Note: For Workers, we'd need to adapt memory.ts to use env.DB
        // and voice.ts to use R2/KV instead of local fs.
        // This is a placeholder for the Worker entry point.

        return webhookCallback(bot, 'cloudflare')(request);
    }
};
