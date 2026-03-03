import { processHeartbeat } from './agent.js';
import { bot } from './bot.js';
import { config } from './config.js';
import * as trello from './trello.js';

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function startHeartbeat() {
    console.log(`Starting StudioClaw Heartbeat (Runs every ${HEARTBEAT_INTERVAL_MS / 1000 / 60} minutes)`);

    setInterval(async () => {
        console.log(`[Heartbeat] Running scheduled pre-check...`);
        try {
            // 1. PRE-CHECK: Look for cards in 'Watch' or 'ClawG' lists across the main board
            const boardId = '69a61ca29ff0e7463b19be0f'; // Real Big News Board
            const lists = await trello.getListsOnBoard(boardId);
            const targetLists = lists.filter((l: any) =>
                l.name.toLowerCase().includes('watch') ||
                l.name.toLowerCase().includes('clawg')
            );

            let hasWork = false;
            for (const list of targetLists) {
                const cards = await trello.getCardsInList(list.id);
                if (cards.length > 0) {
                    hasWork = true;
                    break;
                }
            }

            if (!hasWork) {
                console.log(`[Heartbeat] No cards in Watch/ClawG lists. Skipping LLM run to save costs.`);
                return;
            }

            console.log(`[Heartbeat] Work found! Triggering specialized autonomous scan...`);
            const systemPromptForHeartbeat = "HEARTBEAT TICK: Cards found in Watch/ClawG. Please process them, organize, and summarize.";

            const response = await processHeartbeat(systemPromptForHeartbeat);

            const chunkSize = 4000;
            for (let i = 0; i < response.length; i += chunkSize) {
                const chunk = response.substring(i, i + chunkSize);
                const isFirst = i === 0;
                const prefix = isFirst ? `🤖 *Heartbeat Roundup (Active):*\n\n` : '';
                await bot.api.sendMessage(config.ALLOWED_USER_ID, `${prefix}${chunk}`, { parse_mode: 'Markdown' });
            }

        } catch (error: any) {
            console.error('[Heartbeat] Error during scheduled run:', error);
            const isQuota = error.message?.includes('429') || error.message?.includes('quota');
            const errorMsg = isQuota
                ? `⚠️ *Heartbeat Quota Limit:* Gemini API is restricted (429).`
                : `⚠️ *Heartbeat Error:* Failed to complete scheduled run (${error.message || 'Unknown error'}).`;

            await bot.api.sendMessage(config.ALLOWED_USER_ID, errorMsg, { parse_mode: 'Markdown' });
        }
    }, HEARTBEAT_INTERVAL_MS);
}
