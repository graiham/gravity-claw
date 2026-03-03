import { bot } from './bot.js';
import { startHeartbeat } from './heartbeat.js';

console.log('Starting Gravity Claw...');

startHeartbeat();

bot.start({
    onStart: (botInfo) => {
        console.log(`Bot initialized as @${botInfo.username}`);
        console.log(`Listening for messages from user ID: ${process.env.ALLOWED_USER_ID}`);
    }
});
