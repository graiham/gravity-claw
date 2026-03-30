import { bot } from './bot.js';
import { startHeartbeat, startClawWatcher, startAGQueueWatcher } from './heartbeat.js';
import { startScheduler } from './scheduler.js';
import { WebChannel } from './plugins/web-channel.js';
import { WebhookChannel } from './plugins/webhook.js';
import { mcpBridge } from './plugins/mcp-bridge.js';
import { processMessage } from './agent.js';
import { config } from './config.js';
import { runAirbnbWorkflow } from './plugins/airbnbWorkflow.js';
import path from 'path';

console.log('Starting Gravity Claw...');

// Load MCP Servers
const mcpConfigPath = path.resolve(process.cwd(), 'mcp-config.json');
mcpBridge.loadServers(mcpConfigPath).then(() => {
    console.log('[MCP] Bridge ready.');
});

// Deprecated Trello mechanisms (disabled per user request)
// startHeartbeat();
// startClawWatcher();
// startAGQueueWatcher();
// startScheduler();

const webPort = process.env.WEBCHAT_PORT ? parseInt(process.env.WEBCHAT_PORT) : 8765;
const webChannel = new WebChannel(webPort);

async function broadcastStatus(chatId: string | number, status: string) {
    const idStr = String(chatId);
    
    // 1. Send to WebChat
    webChannel.sendStatus(idStr, status);

    // 2. Send to Slack (If we have a valid channel ID from the system to broadcast to)
    try {
        if (config.SLACK_DIRECTOR_CHANNEL_ID) {
            // Uncomment to spam status updates into Slack, but it might get noisy
            // await bot.client.chat.postMessage({ channel: config.SLACK_DIRECTOR_CHANNEL_ID, text: `[Status]: ${status}` });
        }
    } catch (err) {
        console.error("[BROADCAST] Slack status update failed:", err);
    }

    // 3. Send to Antigravity Overseer (via ag_response.log)
    const fs = await import('fs');
    const logPath = path.join(process.cwd(), 'ag_response.log');
    fs.appendFileSync(logPath, `[CLAW_STATUS]: ${status}\n`);
}

webChannel.onMessage(async (msg) => {
    console.log(`[WebChat] Incoming message for ${msg.chat.id}: ${msg.text}`);

    let isProcessing = true;
    const keepAlive = setInterval(() => {
        if (isProcessing) {
            broadcastStatus(msg.chat.id, "Gravity Claw is still working on your request... ⚙️");
        }
    }, 30000);

    try {
        const reply = await processMessage(msg.chat.id, msg.text, (status) => {
            broadcastStatus(msg.chat.id, status);
        });

        isProcessing = false;
        clearInterval(keepAlive);

        // Broadcast stats update
        const { getUsageStats } = await import('./memory.js');
        const stats = getUsageStats();
        webChannel.sendUsage(msg.chat.id, stats.daily_cost_gbp, stats.monthly_cost_gbp);

        console.log(`[WebChat] Replying to ${msg.chat.id}`);
        await webChannel.sendMessage(msg.chat.id, reply);
        
    } catch (err: any) {
        isProcessing = false;
        clearInterval(keepAlive);
        console.error("WebChat Error:", err);
        await webChannel.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
});

webChannel.onCommand(async (cmd) => {
    if (cmd.command === 'START_AIRBNB_WORKFLOW') {
        const url = cmd.url;
        const tier = cmd.tier || 'pro'; // Default to pro if not specified
        console.log(`[PROCESS] DIRECT COMMAND: Starting Airbnb Workflow (${tier} tier) for ${url}`);
        
        // 1. Alex Ingesting
        webChannel.broadcast(JSON.stringify({
            type: 'agent_update', agentId: 'sm', status: 'working',
            log: [`${tier.toUpperCase()} tier approved ✓`, 'Ingesting client brief and listing URL...']
        }));

        setTimeout(() => {
            // 2. Alex Refinement & Output Generation
            webChannel.broadcast(JSON.stringify({
                type: 'agent_update',
                agentId: 'sm',
                status: 'working',
                log: ['Refining requirements for Airbnb specialists…', `Generating ${tier}-tier brief for team…`],
                outputs: [
                    { 
                        type: 'doc', 
                        label: 'specialist-brief.md', 
                        preview: `# Studio Manager Directive: Airbnb Pilot\n\n**To**: Zara (Data Analyst), Priya (SIO), Jin (Retoucher)\n**From**: Alex Okafor (Studio Manager)\n**Tier**: ${tier.toUpperCase()}\n\nZara, grab 1 photo from this listing as a pilot. Jin will retouch it via Vertex AI to ${tier}-tier standard. Priya will score it before and after — the retouched version must hit ${tier === 'basic' ? '70' : tier === 'pro' ? '80' : tier === 'elite' ? '90' : '95'}+ SIO score. If it doesn't pass, Priya sends feedback to Jin for another round (max 3).\n\nOnce passed, package the before/after + scorecard back to Lucy.\n\n**Link**: ${url}` 
                    }
                ]
            }));

            setTimeout(() => {
                // 3. Pulse brief to Zara
                webChannel.broadcast(JSON.stringify({
                    type: 'agent_update',
                    agentId: 'sm',
                    targetAgentId: 'data-analyst',
                    status: 'working',
                    log: [`Zara, scrape 1 pilot photo from ${url}. Jin retouches to ${tier}-tier, Priya scores before/after. Loop until SIO threshold met, then package for Lucy.`]
                }));

                runAirbnbWorkflow(url, tier as any, (update) => {
                    webChannel.broadcast(JSON.stringify({
                        type: 'agent_update',
                        ...update
                    }));
                }).catch(err => {
                    console.error('[PROCESS] Workflow Direct Error:', err);
                    webChannel.broadcast(JSON.stringify({
                        type: 'agent_update',
                        agentId: 'sm',
                        status: 'error',
                        log: [`Workflow failed: ${err.message}`]
                    }));
                });
            }, 2000);
        }, 1500);
    }
});

const webhookPort = process.env.WEBHOOK_PORT ? parseInt(process.env.WEBHOOK_PORT) : 8766;
const webhookChannel = new WebhookChannel(webhookPort);
webhookChannel.onMessage(async (msg) => {
    try {
        const reply = await processMessage(msg.chat.id, msg.text, (status) => {
            broadcastStatus(msg.chat.id, status);
        });
        await webhookChannel.sendMessage(msg.chat.id, reply);
    } catch (err: any) {
        console.error("Webhook Error:", err);
    }
});

(async () => {
    try {
        await bot.start();
        console.log('⚡️ Slack Bolt App is running!');
    } catch (error) {
        console.error('Failed to start Slack App', error);
    }
})();
