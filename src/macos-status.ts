import * as memory from './memory.js';
import { config } from './config.js';

export async function getMacOSStatus(): Promise<string> {
    const stats = memory.getUsageStats();
    const prefs = memory.getPreferences();
    const recentFacts = memory.searchFacts(""); // Sample recent facts

    let status = "🤖 Gravity Claw Active\n";
    status += `💰 Spend: £${stats.total_cost_gbp.toFixed(4)}\n`;
    status += `🧠 Tokens: ${stats.total_tokens.toLocaleString()}\n`;
    status += `📍 User: ${config.ALLOWED_USER_ID}\n`;

    if (recentFacts.length > 0) {
        status += `\nLatest Fact: ${(recentFacts[0] as any).fact}`;
    }

    return status;
}

// If run directly, output to console for SwiftBar/xbar
if (import.meta.url.endsWith(process.argv[1])) {
    getMacOSStatus().then(console.log);
}
