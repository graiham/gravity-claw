import { generateMorningBriefing, generateEveningRecap } from './briefing.js';
import { bot } from './bot.js';
import { config } from './config.js';

export function startScheduler() {
    console.log("[SCHEDULER] Starting proactive task scheduler...");

    // Simple check every 15 minutes
    setInterval(async () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // Morning Briefing at 08:30
        if (hours === 8 && minutes >= 30 && minutes < 45) {
            console.log("[SCHEDULER] Triggering Morning Briefing...");
            const briefing = await generateMorningBriefing();
            await bot.api.sendMessage(config.ALLOWED_USER_ID, `☀️ *Morning Briefing*\n\n${briefing}`, { parse_mode: 'Markdown' });
        }

        // Evening Recap at 20:00
        if (hours === 20 && minutes >= 0 && minutes < 15) {
            console.log("[SCHEDULER] Triggering Evening Recap...");
            const recap = await generateEveningRecap();
            await bot.api.sendMessage(config.ALLOWED_USER_ID, `🌙 *Evening Recap*\n\n${recap}`, { parse_mode: 'Markdown' });
        }
    }, 15 * 60 * 1000);
}
