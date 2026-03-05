import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import * as trello from './trello.js';
import * as memory from './memory.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export async function generateMorningBriefing(): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: "You are a specialized Morning Briefing Assistant. Synthesize tasks and context into a concise, motivating start to the day."
    });

    // Gather data
    const boards = await trello.getBoards();
    const tasks = JSON.stringify(boards.slice(0, 3)); // Just 3 boards for brevity
    const preferences = JSON.stringify(memory.getPreferences());

    const prompt = `GATHERED DATA:\nTasks: ${tasks}\nPreferences: ${preferences}\n\nPlease generate a morning briefing for Graham. Include a summary of high-priority tasks and a motivating "Thought for the day".`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err: any) {
        return `Briefing Error: ${err.message}`;
    }
}

export async function generateEveningRecap(): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: "You are an Evening Recap Assistant. Summarize accomplishments and highlight pending items for tomorrow."
    });

    const stats = memory.getUsageStats();
    const prompt = `GATHERED DATA:\nStats: ${JSON.stringify(stats)}\n\nPlease generate an evening recap. Summarize what we did today (based on token usage and general context) and what is waiting for tomorrow.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err: any) {
        return `Recap Error: ${err.message}`;
    }
}
