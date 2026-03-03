import OpenAI from 'openai';
import { config } from './config.js';
import axios from 'axios';
import fs from 'fs';

const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});

export async function transcribeAudio(filePath: string): Promise<string> {
    if (!config.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing.');
    }

    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
    });

    return transcription.text;
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
    if (!config.ELEVENLABS_API_KEY || !config.ELEVENLABS_VOICE_ID) {
        throw new Error('ElevenLabs configuration is missing.');
    }

    const response = await axios({
        method: 'POST',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVENLABS_VOICE_ID}`,
        data: {
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5,
            },
        },
        headers: {
            'xi-api-key': config.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
}
