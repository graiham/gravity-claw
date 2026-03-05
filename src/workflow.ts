import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import * as memory from './memory.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export async function decomposeGoal(goal: string): Promise<string> {
    const workflowId = `wf_${Date.now()}`;
    memory.createWorkflow(workflowId, goal);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: "You are a Workflow Architect. Decompose goals into a clear, sequential list of actionable subtasks."
    });

    const prompt = `GOAL: ${goal}\n\nPlease decompose this goal into a numbered list of subtasks. Return ONLY the JSON array of strings. Example: ["Step 1", "Step 2"]`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const subtasksMatch = text.match(/\[.*\]/s);
        if (subtasksMatch) {
            const subtasks: string[] = JSON.parse(subtasksMatch[0]);
            subtasks.forEach((desc, index) => {
                memory.addSubtask(workflowId, desc, index);
            });
            return `Workflow created with ${subtasks.length} subtasks. ID: ${workflowId}`;
        }
        return `Failed to parse subtasks from: ${text}`;
    } catch (err: any) {
        return `Workflow Error: ${err.message}`;
    }
}

export function getWorkflowStatus(workflowId: string) {
    const wf = memory.getWorkflow(workflowId);
    if (!wf.id) return "Workflow not found.";

    let report = `Workflow: ${wf.goal}\nStatus: ${wf.status}\n\n`;
    wf.subtasks.forEach((s: any) => {
        const icon = s.status === 'COMPLETED' ? '✅' : (s.status === 'IN_PROGRESS' ? '⏳' : '⬜');
        report += `${icon} ${s.description}\n`;
    });
    return report;
}
