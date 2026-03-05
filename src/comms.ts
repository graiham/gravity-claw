import * as memory from './memory.js';
import { delegateToSwarm, AgentRole } from './swarm.js';

export async function createSession(name: string): Promise<string> {
    const id = `session_${Date.now()}`;
    memory.createAgentSession(id, name);
    return id;
}

export function listSessions() {
    return memory.listAgentSessions();
}

export function getSessionHistory(sessionId: string) {
    return memory.getAgentSessionHistory(sessionId);
}

export async function sendToAgent(sessionId: string, role: AgentRole, message: string): Promise<string> {
    // 1. Get History
    const history = memory.getAgentSessionHistory(sessionId);
    const context = history.map(h => `${(h as any).role}: ${(h as any).content}`).join('\n');

    // 2. Store User (Main Agent) Message
    memory.storeAgentMessage(sessionId, 'MAIN', message);

    // 3. Delegate to Swarm with context
    const response = await delegateToSwarm(role, message, context);

    // 4. Store Agent Response
    memory.storeAgentMessage(sessionId, role, response);

    return response;
}
