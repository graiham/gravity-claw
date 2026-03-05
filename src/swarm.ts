import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export type AgentRole = 'RESEARCHER' | 'CODER' | 'REVIEWER';

const AGENT_PROFILES: Record<AgentRole, string> = {
    RESEARCHER: `You are a specialized Swarm RESEARCHER. Your goal is to gather deep information, verify facts, and provide comprehensive summaries. 
Focus on accuracy and depth. Use all available search and knowledge tools.`,
    CODER: `You are a specialized Swarm CODER. Your goal is to write clean, efficient, and well-documented code. 
Focus on best practices, performance, and security. You understand TypeScript, Node.js, and modern APIs.`,
    REVIEWER: `You are a specialized Swarm REVIEWER. Your goal is to critique plans, code, or ideas. 
Look for security flaws, edge cases, and logical inconsistencies. Be rigorous but constructive.`
};

export async function delegateToSwarm(role: AgentRole, task: string, context: string = ''): Promise<string> {
    console.log(`[SWARM] Delegating task to ${role}: ${task.substring(0, 100)}...`);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite", // Using flash-lite for swarm efficiency
        systemInstruction: AGENT_PROFILES[role]
    });

    const prompt = `CONTEXT:\n${context}\n\nTASK:\n${task}\n\nPlease perform this task as a ${role}. Provide the results directly.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err: any) {
        return `Swarm Error: ${err.message}`;
    }
}
