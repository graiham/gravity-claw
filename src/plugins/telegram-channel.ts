import { IChannel } from './types.js';
import { Bot } from 'grammy';
import { config } from '../config.js';

export class TelegramChannel implements IChannel {
    id = 'telegram-channel';
    name = 'Telegram Bot Channel';
    version = '1.0.0';

    private bot: Bot;

    constructor() {
        this.bot = new Bot(config.TELEGRAM_BOT_TOKEN);
    }

    async sendMessage(chatId: string, text: string): Promise<void> {
        await this.bot.api.sendMessage(chatId, text);
    }

    onMessage(callback: (msg: any) => Promise<void>): void {
        this.bot.on('message', async (ctx: any) => {
            if (ctx.from?.id.toString() !== config.ALLOWED_USER_ID) return;
            await callback(ctx.message);
        });
        this.bot.start();
    }
}
