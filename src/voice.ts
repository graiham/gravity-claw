import OpenAI from 'openai';
import { config } from './config.js';
import axios from 'axios';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY || 'no-key',
});

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export async function transcribeAudio(filePath: string): Promise<{ text: string, costGbp: number }> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const audioBuffer = fs.readFileSync(filePath);
        const base64Audio = audioBuffer.toString('base64');

        const result = await model.generateContent([
            { text: "Transcribe this audio exactly as spoken. Output ONLY the transcript. NO preamble." },
            {
                inlineData: {
                    mimeType: "audio/ogg",
                    data: base64Audio
                }
            }
        ]);

        return { text: result.response.text().trim(), costGbp: 0.0001 };
    } catch (err: any) {
        console.error("[STT Error] Google transcription failed:", err.message);
        throw err;
    }
}

export async function synthesizeSpeech(text: string): Promise<{ buffer: Buffer, costGbp: number }> {
    if (config.VOICE_PROVIDER === 'google') {
        try {
            const apiKey = config.GOOGLE_TTS_API_KEY;
            const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

            const payload = {
                input: { text },
                voice: { languageCode: 'en-GB', name: 'en-GB-Studio-B' },
                audioConfig: { audioEncoding: 'OGG_OPUS' }
            };

            const response = await axios.post(url, payload);
            if (response.data.audioContent) {
                const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
                const cost = (text.length / 1000) * 0.012;
                return { buffer: audioBuffer, costGbp: cost };
            } else {
                throw new Error("No audio content returned from Google TTS");
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error?.message || err.message;

            if (err.response?.status === 403 || err.response?.status === 404) {
                console.warn("[TTS Fallback] Google TTS is disabled or key is invalid. Attempting ElevenLabs fallback...");
                if (config.ELEVENLABS_API_KEY && config.ELEVENLABS_VOICE_ID) {
                    return await synthesizeWithElevenLabs(text);
                }
                throw new Error("Google Cloud TTS API is not enabled. Please enable 'Cloud Text-to-Speech API' in your GCP Console: https://console.developers.google.com/apis/api/texttospeech.googleapis.com/");
            }
            console.error("[TTS Error] Google synthesis failed:", errorMsg);
            throw new Error(`Google TTS failed: ${errorMsg}`);
        }
    }

    return await synthesizeWithElevenLabs(text);
}

// Internal helper for ElevenLabs logic
async function synthesizeWithElevenLabs(text: string): Promise<{ buffer: Buffer, costGbp: number }> {
    if (!config.ELEVENLABS_API_KEY || !config.ELEVENLABS_VOICE_ID) {
        throw new Error('ElevenLabs configuration is missing for fallback.');
    }

    const response = await axios({
        method: 'POST',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVENLABS_VOICE_ID}`,
        data: {
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.5 },
        },
        headers: {
            'xi-api-key': config.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
    });

    const costGbp = (text.length / 1000) * 0.15;
    return { buffer: Buffer.from(response.data), costGbp };
}
