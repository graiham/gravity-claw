import { bot } from './bot.js';
import { startHeartbeat } from './heartbeat.js';
import { startScheduler } from './scheduler.js';
import { WebChannel } from './plugins/web-channel.js';
import { WebhookChannel } from './plugins/webhook.js';
import { mcpBridge } from './plugins/mcp-bridge.js';
import { processMessage } from './agent.js';
import path from 'path';

console.log('Starting Gravity Claw...');

// Load MCP Servers
const mcpConfigPath = path.resolve(process.cwd(), 'mcp-config.json');
mcpBridge.loadServers(mcpConfigPath).then(() => {
    console.log('[MCP] Bridge ready.');
});

startHeartbeat();
startScheduler();

const webPort = process.env.WEBCHAT_PORT ? parseInt(process.env.WEBCHAT_PORT) : 8765;
const webChannel = new WebChannel(webPort);
webChannel.onMessage(async (msg) => {
    console.log(`[WebChat] Incoming message for ${msg.chat.id}: ${msg.text}`);

    let isProcessing = true;
    const keepAlive = setInterval(() => {
        if (isProcessing) {
            webChannel.sendStatus(msg.chat.id, "Gravity Claw is still working on your request... ⚙️");
        }
    }, 20000);

    try {
        const reply = await processMessage(msg.chat.id, msg.text, (status) => {
            webChannel.sendStatus(msg.chat.id, status);
        });

        isProcessing = false;
        clearInterval(keepAlive);

        // Broadcast stats update
        const { getUsageStats } = await import('./memory.js');
        const stats = getUsageStats();
        webChannel.sendUsage(msg.chat.id, stats.total_cost_gbp);

        console.log(`[WebChat] Replying to ${msg.chat.id}`);
        await webChannel.sendMessage(msg.chat.id, reply);
    } catch (err: any) {
        isProcessing = false;
        clearInterval(keepAlive);
        console.error("WebChat Error:", err);
        await webChannel.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
});

const webhookPort = process.env.WEBHOOK_PORT ? parseInt(process.env.WEBHOOK_PORT) : 8766;
const webhookChannel = new WebhookChannel(webhookPort);
webhookChannel.onMessage(async (msg) => {
    try {
        const reply = await processMessage(msg.chat.id, msg.text);
        await webhookChannel.sendMessage(msg.chat.id, reply);
    } catch (err: any) {
        console.error("Webhook Error:", err);
    }
});

bot.start({
    onStart: (botInfo) => {
        console.log(`Bot initialized as @${botInfo.username}`);
        console.log(`Listening for messages from user ID: ${process.env.ALLOWED_USER_ID}`);
    }
});
