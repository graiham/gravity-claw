import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    try {
        // There isn't a direct listModels in the high-level GenAI class easily accessible
        // But we can try to hit the endpoint or just try the common stable ones.
        console.log('Testing model names...');
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-lite-preview-02-05'];
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                await model.generateContent('Hi');
                console.log(`✅ ${m} is available`);
            } catch (e: any) {
                console.log(`❌ ${m} failed: ${e.message}`);
            }
        }
    } catch (err) {
        console.error(err);
    }
}
listModels();
