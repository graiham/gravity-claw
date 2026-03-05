import { GoogleGenerativeAI } from '@google/generative-ai';
import { ILLMProvider } from './types.js';
import { config } from '../config.js';

export class GeminiProvider implements ILLMProvider {
    id = 'gemini-provider';
    name = 'Google Gemini Provider';
    version = '1.0.0';

    private genAI: GoogleGenerativeAI;

    constructor() {
        this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    }

    async generateResponse(prompt: string, history: any[]): Promise<{ content: string; usage?: any }> {
        const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(prompt);
        return {
            content: result.response.text(),
            usage: (result.response as any).usageMetadata
        };
    }

    async generateCompletion(prompt: string, modelName: string = "gemini-2.5-flash-lite"): Promise<{ content: string; usage?: any }> {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return {
            content: result.response.text(),
            usage: (result.response as any).usageMetadata
        };
    }
}
