import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import * as memory from './memory.js';
import * as trello from './trello.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export async function generateSmartRecommendations(): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: "You are a Strategic Advisor and Pattern Analyst. Analyze data to suggest proactive improvements, next steps, or potential risks."
    });

    // Gather context
    const facts = memory.searchFacts(""); // Get recent facts
    const usage = memory.getUsageStats();
    const boards = await trello.getBoards();

    const prompt = `DATA ANALYTICS:
Facts: ${JSON.stringify(facts.slice(0, 10))}
Token Usage: ${usage.total_tokens}
Trello Boards: ${boards.length}

Please identify 3 "Smart Recommendations" for Graham. Look for:
1. Efficiency improvements.
2. Missing connections between tasks.
3. Proactive ideas for RealBigNumbers project.

Return a concise list with justifications.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err: any) {
        return `Recommendation Error: ${err.message}`;
    }
}
