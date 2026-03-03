import dotenv from 'dotenv';
dotenv.config();

function getEnv(name: string, required: boolean = true): string {
    const value = process.env[name];
    if (required && !value) {
        throw new Error(`Environment variable ${name} is required.`);
    }
    return value || '';
}

export const config = {
    TELEGRAM_BOT_TOKEN: getEnv('TELEGRAM_BOT_TOKEN'),
    ALLOWED_USER_ID: parseInt(getEnv('ALLOWED_USER_ID')),
    ANTHROPIC_API_KEY: getEnv('ANTHROPIC_API_KEY', false),
    GEMINI_API_KEY: getEnv('GEMINI_API_KEY'),
    TRELLO_API_KEY: getEnv('TRELLO_API_KEY', false), // Optional
    TRELLO_API_TOKEN: getEnv('TRELLO_API_TOKEN', false), // Optional
    NOTION_API_TOKEN: getEnv('NOTION_API_TOKEN', false),
    GITHUB_API_TOKEN: getEnv('GITHUB_API_TOKEN', false),
    OPENROUTER_API_KEY: getEnv('OPENROUTER_API_KEY', false),
    OPENAI_API_KEY: getEnv('OPENAI_API_KEY', false),
    ELEVENLABS_API_KEY: getEnv('ELEVENLABS_API_KEY', false),
    ELEVENLABS_VOICE_ID: getEnv('ELEVENLABS_VOICE_ID', false),
};

if (isNaN(config.ALLOWED_USER_ID)) {
    throw new Error('ALLOWED_USER_ID must be a number.');
}
