import { Bot, InputFile } from 'grammy';
import { config } from './config.js';
import { processMessage, isTalkMode } from './agent.js';
import { transcribeAudio, synthesizeSpeech } from './voice.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Whitelist filter
bot.use(async (ctx, next) => {
    if (ctx.from?.id !== config.ALLOWED_USER_ID) return;
    await next();
});

bot.command('start', (ctx) => ctx.reply('Gravity Claw v5.0 Active. I can now hear you and speak back!'));

// Handle Voice Messages
bot.on('message:voice', async (ctx) => {
    try {
        await ctx.replyWithChatAction('typing');
        const file = await ctx.getFile();
        const tempPath = path.join(os.tmpdir(), `voice_${Date.now()}.ogg`);
        const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', (err) => reject(err));
        });

        const transcription = await transcribeAudio(tempPath);
        // Clean up temp file
        fs.unlinkSync(tempPath);

        await ctx.reply(`🎙 *Transcribed:* _${transcription}_`, { parse_mode: 'Markdown' });

        const reply = await processMessage(ctx.chat.id, transcription);
        await handleReply(ctx, reply);
    } catch (error) {
        console.error('Voice Error:', error);
        await ctx.reply('Error processing voice message.');
    }
});

bot.on('message:text', async (ctx) => {
    try {
        await ctx.replyWithChatAction('typing');
        const reply = await processMessage(ctx.chat.id, ctx.message.text);
        await handleReply(ctx, reply);
    } catch (error) {
        console.error('Error:', error);
        await ctx.reply('Error processing request.');
    }
});

async function handleReply(ctx: any, reply: string) {
    if (isTalkMode()) {
        try {
            await ctx.replyWithChatAction('record_voice');
            const audioBuffer = await synthesizeSpeech(reply);
            await ctx.replyWithVoice(new InputFile(audioBuffer));
        } catch (vErr) {
            console.error('Speech Synth Error:', vErr);
            await ctx.reply(reply + '\n\n(Voice synth failed, falling back to text)');
        }
    } else {
        const chunkSize = 4000;
        for (let i = 0; i < reply.length; i += chunkSize) {
            await ctx.reply(reply.substring(i, i + chunkSize));
        }
    }
}
