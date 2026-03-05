import dotenv from 'dotenv';
dotenv.config();

export const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    ALLOWED_USER_ID: Number(process.env.ALLOWED_USER_ID) || 0,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    TRELLO_API_KEY: process.env.TRELLO_API_KEY || '',
    TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN || '',
    NOTION_API_TOKEN: process.env.NOTION_API_TOKEN || '',
    GITHUB_API_TOKEN: process.env.GITHUB_API_TOKEN || '',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',
    ELEVENLABS_API_KEY: process.env.ELEVEN_API_KEY || '',
    ELEVENLABS_VOICE_ID: process.env.ELEVEN_VOICE_ID || '',
    VOICE_PROVIDER: process.env.VOICE_PROVIDER || 'google',
    TRANSCRIPT_PROVIDER: process.env.TRANSCRIPT_PROVIDER || 'google',
    GOOGLE_TTS_API_KEY: process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY || '',
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID || ''
};
