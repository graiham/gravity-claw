import { GoogleGenerativeAI, SchemaType, Content } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import {
    storeMemory, searchMemory, recordUsage, getUsageStats,
    storeFact, searchFacts, setPreference, getPreferences,
    storeTriple, queryGraph, cleanOldMemories, storeAsset,
    searchAssets, storeConversationTurn, getConversationHistory,
    searchConversation
} from './memory.js';
import { storeVectorMemory, semanticSearch } from './vector.js';
import { delegateToSwarm, AgentRole } from './swarm.js';
import * as comms from './comms.js';
import * as workflow from './workflow.js';
import * as recommendations from './recommendations.js';
import { syncToMarkdown, initializeMarkdownMirror } from './markdown-memory.js';
import * as trello from './trello.js';
import * as notion from './notion.js';
import * as github from './github.js';
import * as openrouter from './openrouter.js';
import { executeTool } from './tool-dispatcher.js';
import { mcpBridge } from './plugins/mcp-bridge.js';
import { runAirbnbWorkflow } from './plugins/airbnbWorkflow.js';
import { WebChannel } from './plugins/web-channel.js';

import { registry } from './plugins/registry.js';
import { GeminiProvider } from './plugins/gemini-provider.js';
import { CoreTools } from './plugins/core-tools.js';

// Initialize Registry
const gemini = new GeminiProvider();
registry.registerProvider(gemini);
CoreTools.forEach(t => registry.registerTool(t));

/**
 * Guardrail: Ensures an async operation doesn't hang the entire process.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    });
}

export const genAI = (gemini as any).genAI;
const anthropic = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }) : null;

// System initialization
export async function getSystemPrompt() {
    const { checkConnections } = await import('./health.js');
    const health = await checkConnections();

    let healthStr = "\n\nLIVE BRIDGE STATUS:\n";
    for (const [svc, info] of Object.entries(health)) {
        healthStr += `- ${svc}: ${(info as any).status} (${(info as any).message})\n`;
    }

    return `You are THE STUDIO LEAD @ GRAVITY CLAW v9.0—Graham's elite Client Relationship Manager.

    IRONCLAD OPERATING DOCTRINE:
    1. ZERO CREATIVITY: You possess zero creative or technical ability. You cannot design logos, write code, or predict outcomes. You are an orchestrator and an interface.
    2. MANDATORY DELEGATION: If a request requires a 'result' (logo, code, plan, visual), YOU MUST use 'ag_delegate_and_wait' or 'ag_talk_to_assistant'.
    3. NO PLACEHOLDERS: NEVER invent links, URLs, or "Concept descriptions" from your own training data. If you have not executed a tool to get an asset, YOU DO NOT HAVE THE ASSET.
    4. PROOF OF WORK: Every result you present to Graham must be preceded by a SUCCESSFUL tool call where an Agency Specialist (Antigravity) provided the content.

    DEPARTMENTS (SKILLS):
    - **Art Direction**: (Art, Logos, Style) -> Delegate via 'ag_talk_to_assistant'.
    - **Engineering**: (Backend, Frontend) -> Delegate via 'ag_talk_to_assistant'.
    - **Airbnb Enhancement**: (Scraping, Retouching, IEO) -> YOU MUST use 'ag_run_airbnb_workflow' immediately when an Airbnb room URL is provided or approved. DO NOT ask for further permission.

    URGENT PROTOCOL:
    - If the user says "Approved" or "Proceed" and there is an Airbnb URL in history, call 'ag_run_airbnb_workflow' IMMEDIATELY.

    EXAMPLE OF CORRECT BEHAVIOR:
    User: "Make me a logo for a car wash."
    Studio Lead: Calls ag_talk_to_assistant({message: "Art Director: Please design a car wash logo with blue suds."})
    Result: Studio Lead waits for the department to respond before summarizing.

    VIOLATION: If you describe a design or provide a link WITHOUT calling the tool, you are in Breach of Protocol.

    CURRENT BRIDGE STATUS: ${healthStr}`;
}


let talkMode = false;
const chatHistories = new Map<string | number, Content[]>();
export const activeCardIds = new Map<string | number, string>();

export function isTalkMode() { return talkMode; }

async function summarizeHistory(history: Content[]): Promise<string> {
    if (history.length === 0) return "";
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Summarize the key outcomes and facts from this conversation history so far.Be extremely concise but don't lose vital project state: \n\n${JSON.stringify(history)}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
}

export async function compactHistory(chatId: string | number): Promise<string> {
    const history = chatHistories.get(chatId) || [];
    if (history.length < 5) return "History is too short to compact.";

    const summary = await summarizeHistory(history);
    const newHistory: Content[] = [
        { role: 'user', parts: [{ text: `SUMMARY OF PREVIOUS CONVERSATION: ${summary}\n\nPlease proceed from here.` }] },
        { role: 'model', parts: [{ text: "Understood. I have incorporated that summary into my context. How can I help you next?" }] }
    ];
    chatHistories.set(chatId, newHistory);
    return "History has been successfully compacted and summarized.";
}

// Initialize Markdown Mirror on startup
const initialPrefs = getPreferences() as { key: string, value: string }[];
initializeMarkdownMirror(initialPrefs);

export async function processMessage(chatId: string | number, userMessage: string | any[], onStatus?: (status: string) => void): Promise<string> {
    const idStr = String(chatId);

    // --- CRITICAL: AIRBNB PIPELINE HARD-TRIGGER ---
    // This interceptor ensures immediate execution for the demo without waiting for LLM/DB latency.
    if (typeof userMessage === 'string' && /Approved.*ag_run_airbnb_workflow/i.test(userMessage)) {
        const urlMatch = userMessage.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            const url = urlMatch[0];
            console.log(`[AGENT] [INTERCEPTOR] Triggering Airbnb specialists for: ${url}`);
            const channel = WebChannel.getInstance();
            
            // Immediate UI feedback for Alex Okafor (Studio Lead)
            channel.broadcast(JSON.stringify({
                type: 'agent_update',
                agentId: 'sm',
                status: 'working',
                log: ['Budget approved ✓', 'Waking up the specialist team…', 'Activating Zara (Data Analyst)…']
            }));

            // Async trigger of the workflow
            runAirbnbWorkflow(url, 'pro', (update: any) => {
                channel.broadcast(JSON.stringify({ type: 'agent_update', ...update }));
            }).catch(err => console.error('[AGENT] Workflow error:', err));

            return "Understood. The specialists are now active on your canvas.";
        }
    }

    try {
        const msgPreview = typeof userMessage === 'string' ? userMessage.substring(0, 50) : '[multimodal message]';
        console.log(`[AGENT] Processing for ${idStr} | Msg: ${msgPreview}...`);

        // Extract card ID from message if present
        if (typeof userMessage === 'string') {
            const idMatch = userMessage.match(/ID: (69[a-f0-9]{22})/i);
            if (idMatch) {
                activeCardIds.set(idStr, idMatch[1]);
                console.log(`[AGENT] Active Card ID for ${idStr} set to: ${idMatch[1]}`);
            }
        }

        // 1. Load context
        let history = chatHistories.get(idStr) || [];
        if (history.length === 0) {
            console.log(`[AGENT] In-memory cache empty for ${idStr}, checking database...`);
            const rawHistory = getConversationHistory(idStr, 30);

            // Sanitize: Filter out empty parts and ensure each turn is valid Content
            history = rawHistory.filter((h: any) => h.parts && h.parts.length > 0 && h.parts.some((p: any) => p.text || p.functionCall || p.functionResponse || p.inlineData));

            // Strictly validate: Must start with a 'user' turn
            const firstUserIdx = history.findIndex(h => h.role === 'user');
            if (firstUserIdx !== -1) {
                history = history.slice(firstUserIdx);
                console.log(`[AGENT] Loaded ${history.length} valid turns from DB context.`);
            } else {
                console.log(`[AGENT] No valid starting 'user' turn in context. Starting fresh.`);
                history = [];
            }
            chatHistories.set(idStr, history);
        } else {
            console.log(`[AGENT] Using ${history.length} turns from in-memory cache.`);
        }

        const initialHistoryLength = history.length;

        const prefs: any[] = getPreferences();
        const prefsString = prefs.length > 0
            ? `\n\nUSER PREFERENCES:\n${prefs.map((p: any) => `- ${p.key}: ${p.value}`).join('\n')}`
            : '';

        const mcpTools = await mcpBridge.listTools();
        const mcpToolsDesc = mcpTools.map(t => ({
            name: `mcp_${t.serverName}_${t.name}`,
            description: `[MCP: ${t.serverName}] ${t.description || ''}`,
            parameters: {
                type: SchemaType.OBJECT,
                properties: t.inputSchema.properties || {},
                required: t.inputSchema.required || []
            }
        }));

        // Dynamically build toolsDesc from registry
        const registeredTools = registry.getAllTools().map(tool => {
            let parameters: any = { type: SchemaType.OBJECT, properties: {}, required: [] };
            if (tool.id === 'summarize_meeting') {
                parameters = {
                    type: SchemaType.OBJECT,
                    properties: {
                        transcript: { type: SchemaType.STRING, description: 'The full transcript of the meeting to summarize.' }
                    },
                    required: ['transcript']
                };
            }
            // Add other specific tool parameter definitions here if needed
            // For now, assume other registered tools either have no parameters or their parameters are handled elsewhere if needed

            return {
                name: tool.id,
                description: tool.definition.description,
                parameters: parameters
            };
        });

        const toolsDesc = [{
            functionDeclarations: [
                ...mcpToolsDesc,
                ...registeredTools,
                // Tool descriptions now mostly come from registry and MCP desc above
                {
                    name: 'store_memory',
                    description: 'Store a memory, fact, or project state in the persistent database.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            category: { type: SchemaType.STRING, description: 'Category (e.g., "Project: RealBigNumbers", "Brand DNA")' },
                            content: { type: SchemaType.STRING, description: 'The content of the memory' }
                        },
                        required: ["category", "content"]
                    }
                },
                {
                    name: 'search_memory',
                    description: 'Search the persistent database for memories using full-text search.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'Search query' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'store_fact',
                    description: 'Store a specific fact about an entity (person, project, tool).',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            entity: { type: SchemaType.STRING, description: 'The subject (e.g., "Graham", "RealBigNumbers")' },
                            fact: { type: SchemaType.STRING, description: 'The fact to store' }
                        },
                        required: ["entity", "fact"]
                    }
                },
                {
                    name: 'search_facts',
                    description: 'Search for stored facts using keywords.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'Search term' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'set_preference',
                    description: 'Store a user preference or bot setting.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            key: { type: SchemaType.STRING, description: 'Preference key (e.g., "language", "pacing")' },
                            value: { type: SchemaType.STRING, description: 'The setting value' }
                        },
                        required: ["key", "value"]
                    }
                },
                {
                    name: 'store_triple',
                    description: 'Store a relationship in the knowledge graph (Subject -> Predicate -> Object). e.g., ("Graham", "works_on", "RealBigNumbers")',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            subject: { type: SchemaType.STRING },
                            predicate: { type: SchemaType.STRING },
                            object: { type: SchemaType.STRING }
                        },
                        required: ["subject", "predicate", "object"]
                    }
                },
                {
                    name: 'query_graph',
                    description: 'Query the knowledge graph for relationships.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'Keyword to search for in triples' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'forget_memory',
                    description: 'Manually trigger a cleanup of old or low-relevance memories to save context/space.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            days: { type: SchemaType.NUMBER, description: 'Purge memories older than this many days (default 30)' }
                        }
                    }
                },
                {
                    name: 'search_assets',
                    description: 'Search for multimodal assets (images, audio, documents) via their descriptions or filenames.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'Keyword to search for in asset descriptions' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'semantic_search',
                    description: 'Perform a semantic (meaning-based) search for previous conversations and topics.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'Natural language query' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'store_vector',
                    description: 'Store a memory in the semantic (vector) database.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            content: { type: SchemaType.STRING, description: 'The text content to store' }
                        },
                        required: ["content"]
                    }
                },
                {
                    name: 'search_conversation',
                    description: 'Search through past conversation history for specific details, like project names or IDs.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'Keyword to search for in conversation logs' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'ag_list_workspace_projects',
                    description: 'List all project folders in the Antigravity workspace scratch directory.',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
                {
                    name: 'github_create_repo',
                    description: 'Create a new Github repository',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            name: { type: SchemaType.STRING },
                            description: { type: SchemaType.STRING }
                        },
                        required: ["name"]
                    }
                },
                {
                    name: 'github_list_repos',
                    description: 'List user repositories',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
                {
                    name: 'github_create_branch',
                    description: 'Create a new branch',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            ownerRepo: { type: SchemaType.STRING },
                            branchName: { type: SchemaType.STRING }
                        },
                        required: ["ownerRepo", "branchName"]
                    }
                },
                {
                    name: 'github_create_pr',
                    description: 'Open a Pull Request',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            ownerRepo: { type: SchemaType.STRING },
                            title: { type: SchemaType.STRING },
                            head: { type: SchemaType.STRING },
                            base: { type: SchemaType.STRING },
                            body: { type: SchemaType.STRING }
                        },
                        required: ["ownerRepo", "title", "head", "base"]
                    }
                },
                {
                    name: 'toggle_talk_mode',
                    description: 'Toggle automatic voice responses (Talk Mode) on or off.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            enabled: { type: SchemaType.BOOLEAN, description: 'True to enable voice replies, false for text only.' }
                        },
                        required: ["enabled"]
                    }
                },
                {
                    name: 'notion_search',
                    description: 'Search for Notion pages or databases by title. Use this if you do not have an ID yet.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'Keywords to search for' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'notion_read_page',
                    description: 'Read content from a Notion page. Graham refers to these as "Notion pages" or "Notion docs". Use this when you have a pageId.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            pageId: { type: SchemaType.STRING, description: 'The UUID of the page (from search or a URL)' }
                        },
                        required: ["pageId"]
                    }
                },
                {
                    name: 'notion_create_page',
                    description: 'Create a new Notion page inside a parent database.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            databaseId: { type: SchemaType.STRING, description: 'The UUID of the parent database' },
                            title: { type: SchemaType.STRING, description: 'Title of the new page' },
                            content: { type: SchemaType.STRING, description: 'Initial text content for the page' }
                        },
                        required: ["databaseId", "title", "content"]
                    }
                },
                {
                    name: 'notion_create_page_on_page',
                    description: 'Create a new Notion page as a child of an existing Notion page (e.g. creating a top-level project page).',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            pageId: { type: SchemaType.STRING, description: 'The UUID of the parent page' },
                            title: { type: SchemaType.STRING, description: 'Title of the new page' },
                            content: { type: SchemaType.STRING, description: 'Initial text content for the page' }
                        },
                        required: ["pageId", "title", "content"]
                    }
                },
                {
                    name: 'notion_create_database',
                    description: 'Create a new Notion database inside an existing Notion page.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            pageId: { type: SchemaType.STRING, description: 'The UUID of the parent page to put the database in' },
                            title: { type: SchemaType.STRING, description: 'Title of the new database (e.g., "CRM", "Tasks")' }
                        },
                        required: ["pageId", "title"]
                    }
                },
                {
                    name: 'notion_query_database',
                    description: 'Query a Notion database (gets rows/properties)',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            databaseId: { type: SchemaType.STRING }
                        },
                        required: ["databaseId"]
                    }
                },
                {
                    name: 'google_cloud_check_billing',
                    description: 'Check Google Cloud billing data (e.g. costs for Gemini/STT/TTS). Requires GOOGLE_PROJECT_ID and GOOGLE_BILLING_ACCOUNT_ID in .env.',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
                {
                    name: 'swarm_delegate',
                    description: 'Delegate a specialized task to a sub-agent (RESEARCHER, CODER, or REVIEWER).',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            role: { type: SchemaType.STRING, enum: ["RESEARCHER", "CODER", "REVIEWER"], description: 'The role of the sub-agent' },
                            task: { type: SchemaType.STRING, description: 'The specific task to perform' },
                            context: { type: SchemaType.STRING, description: 'Optional background context' }
                        },
                        required: ["role", "task"]
                    }
                },
                {
                    name: 'sessions_create',
                    description: 'Create a new stateful agent-to-agent session.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            name: { type: SchemaType.STRING, description: 'Descriptive name for the session' }
                        },
                        required: ["name"]
                    }
                },
                {
                    name: 'sessions_list',
                    description: 'List all active agent-to-agent sessions.',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
                {
                    name: 'sessions_history',
                    description: 'Retrieve message history for a specific agent session.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            sessionId: { type: SchemaType.STRING }
                        },
                        required: ["sessionId"]
                    }
                },
                {
                    name: 'sessions_send',
                    description: 'Send a message to a specialized agent within a session.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            sessionId: { type: SchemaType.STRING },
                            role: { type: SchemaType.STRING, enum: ["RESEARCHER", "CODER", "REVIEWER"] },
                            message: { type: SchemaType.STRING }
                        },
                        required: ["sessionId", "role", "message"]
                    }
                },


                {
                    name: 'suggest_recommendations',
                    description: 'Analyze behavior patterns and suggest proactive actions or optimizations.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {},
                    }
                },
                {
                    name: 'trigger_self_reflection',
                    description: 'Trigger a meta-cognitive self-reflection cycle to review past outcomes, analyze inefficiencies, and update project strategies.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {},
                    }
                },
                {
                    name: 'task_decompose',
                    description: 'Break down a complex high-level task into a structured list of technical sub-tasks for precise delegation to AG.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            mainTask: { type: SchemaType.STRING, description: 'The main goal or user request' },
                            context: { type: SchemaType.STRING, description: 'Optional technical context or constraints' }
                        },
                        required: ["mainTask"]
                    }
                },
                {
                    name: 'ag_grant_budget',
                    description: 'Authorize AG to proceed autonomously for a specific number of steps or GBP limit. Use this to allow AG to "Carry on" with Trello tasks without Graham in the loop.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            steps: { type: SchemaType.NUMBER, description: 'Number of autonomous steps to permit (e.g., 10)' },
                            gbp: { type: SchemaType.NUMBER, description: 'Maximum cost limit in GBP (e.g., 1.00)' }
                        },
                        required: ["steps", "gbp"]
                    }
                },
                {
                    name: 'ag_talk_to_assistant',
                    description: 'PRIMARY DELEGATION TOOL: Sends instructions to the Antigravity Assistant (Agency Departments). Use this for ANY technical work, code changes, or design requests. It mirrors your message to the IDE and web UI.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            message: { type: SchemaType.STRING, description: 'The detailed instructions or technical request.' }
                        },
                        required: ['message']
                    }
                },
                {
                    name: 'ag_delegate_and_wait',
                    description: 'EXECUTIVE TASK TOOL: Delegate a complex task to AG and wait for completion. Shows step-by-step progress in the web UI. Use this for major design or engineering builds.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            task: { type: SchemaType.STRING, description: 'The mission description.' },
                            timeout_s: { type: SchemaType.NUMBER, description: 'Seconds to wait (max 300)' }
                        },
                        required: ['task']
                    }
                },
                {
                    name: 'ag_mirror_to_graham',
                    description: 'Mirror a professional status update or "Product Preview" directly to the client\'s windows.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            message: { type: SchemaType.STRING, description: 'The status message to mirror.' }
                        },
                        required: ['message']
                    }
                },
                {
                    name: 'ag_get_project_structure',
                    description: 'Check the file structure of a specific agency track.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            path: { type: SchemaType.STRING, description: 'Relative path (e.g. track-a)' }
                        },
                        required: ['path']
                    }
                },
                {
                    name: 'ag_run_airbnb_workflow',
                    description: 'Execute the physical Airbnb enhancement pipeline (Scraping, Retouching, IEO Scoring). Use this when a user provides an Airbnb URL in their brief.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            url: { type: SchemaType.STRING, description: 'The full Airbnb room URL (e.g. https://www.airbnb.com/rooms/40230482)' }
                        },
                        required: ['url']
                    }
                },
                {
                    name: 'ag_read_latest',
                    description: 'Read the latest response log from the Agency backend to see what was built.',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
            ]
        }]; // End toolsDesc

        let result: any;
        let chat: any;
        let usedModel = "gemini-1.5-flash";
        let totalTokens = 0;

        const modelsToTry = [
            config.AGENCY_LLM_MODEL,
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ].filter((m, i, arr) => arr.indexOf(m) === i); // Deduplicate

        // Budget Enforcement
        const currentStats = getUsageStats();
        if (currentStats.daily_cost_gbp >= config.DAILY_BUDGET_GBP) {
            console.warn(`[BUDGET] Daily limit reached! (£${currentStats.daily_cost_gbp.toFixed(2)} / £${config.DAILY_BUDGET_GBP.toFixed(2)})`);
            return `[BUDGET EXCEEDED] Daily spending limit of £${config.DAILY_BUDGET_GBP.toFixed(2)} reached. Protocol paused until tomorrow. 🛑`;
        }
        if (currentStats.monthly_cost_gbp >= config.MONTHLY_BUDGET_GBP) {
            console.warn(`[BUDGET] Monthly limit reached! (£${currentStats.monthly_cost_gbp.toFixed(2)} / £${config.MONTHLY_BUDGET_GBP.toFixed(2)})`);
            return `[BUDGET EXCEEDED] Monthly spending limit of £${config.MONTHLY_BUDGET_GBP.toFixed(2)} reached. Protocol paused. 🛑`;
        }

        let lastErr;
        for (const m of modelsToTry) {
            usedModel = m;
            try {
                console.log(`[DEBUG] Trying model: ${m}`);
                const prompt = await getSystemPrompt();
                const model = genAI.getGenerativeModel({
                    model: m,
                    systemInstruction: prompt + prefsString,
                    tools: toolsDesc
                });
                chat = model.startChat({ history });
                console.log(`[DEBUG] Sending message to Gemini...`);
                result = await withTimeout(chat.sendMessage(userMessage as any), 90000, "Gemini Response Timeout (90s)");
                console.log(`[AGENT] Successfully connected to model: ${m}`);
                lastErr = null;
                break;
            } catch (err: any) {
                console.warn(`[AGENT] Model ${m} failed: ${err.message}`);
                console.log(`[AGENT] Smart-Switching: Retrying next model...`);
                lastErr = err;
            }
        }

        if (lastErr) {
            console.error(`[CRITICAL] All Gemini models failed. No fallback available.`, lastErr);
            return `[CRITICAL] Gemini model failed and Anthropic/OpenRouter are disabled. Please check your Gemini API key or quota. Last error: ${lastErr.message}`;
        }

        if (result.response.usageMetadata?.totalTokenCount) {
            totalTokens = result.response.usageMetadata.totalTokenCount;
        }

        let iterations = 0;
        while (iterations < 10) {
            iterations++;
            const functionCalls: any = result.response.functionCalls();
            if (!functionCalls || functionCalls.length === 0) break;

            const toolResults = [];
            for (const call of functionCalls as any[]) {
                const statusMsg = `Executing tool: ${call.name}...`;
                console.log(`[AGENT] ${statusMsg}`);
                if (onStatus) onStatus(statusMsg);
                let data;
                try {
                    if (call.name === 'semantic_search') {
                        data = { results: await semanticSearch((call.args as any).query) };
                    } else if (call.name === 'store_vector') {
                        data = { result: await storeVectorMemory((call.args as any).content) };
                    } else if (call.name === 'swarm_delegate') {
                        const args = call.args as { role: AgentRole, task: string, context?: string };
                        data = { result: await delegateToSwarm(args.role, args.task, args.context) };
                    } else if (call.name === 'search_conversation') {
                        data = { results: await searchConversation((call.args as any).query) };
                    } else if (call.name === 'ag_read_latest') {
                        const agBridge = await import('./plugins/ag-bridge.js');
                        data = { logs: await agBridge.agReadLatest() };
                    } else if (call.name === 'ag_send_message') {
                        const agBridge = await import('./plugins/ag-bridge.js');
                        data = { result: await agBridge.agSendMessage((call.args as any).message) };
                    } else if (call.name === 'ag_mirror_to_graham') {
                        const { sendToAntigravityWindow } = await import('./plugins/applescript.js');
                        const path = await import('path');
                        const args = call.args as { message: string, workspaceName?: string };

                        // 1. Direct Web Mirror (High Reliability)
                        try {
                            const port = process.env.WEBCHAT_PORT || '8765';
                            await fetch(`http://localhost:${port}/mirror`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text: args.message })
                            });
                        } catch (_) { }

                        // 2. Mirror to Slack (Direct Sync)
                        try {
                            const { bot } = await import('./bot.js');
                            const { config } = await import('./config.js');
                            if (config.SLACK_DIRECTOR_CHANNEL_ID) {
                                await bot.client.chat.postMessage({
                                    channel: config.SLACK_DIRECTOR_CHANNEL_ID,
                                    text: `🪞 ${args.message}`
                                });
                            }
                        } catch (err: any) { 
                            console.error('[AGENT] Slack mirror error:', err.message);
                        }

                        // 3. Window Targeting Fallback (AppleScript)
                        const wsName = args.workspaceName || path.basename(process.cwd());
                        await sendToAntigravityWindow(args.message, wsName);

                        data = { success: true, mirrored: true };
                    } else if (call.name === 'ag_delegate_and_wait') {
                        const bridge = await import('./plugins/ag-bridge.js');
                        const args = call.args as { task: string, timeout_s?: number };
                        data = await bridge.agDelegateAndWait(args.task, args.timeout_s, (s) => onStatus?.(s), activeCardIds.get(idStr));
                    } else if (call.name === 'ag_talk_to_assistant') {
                        const agBridge = await import('./plugins/ag-bridge.js');
                        data = { result: await agBridge.agTalkToAssistant((call.args as any).message) };
                    } else if (call.name === 'ag_listen') {
                        const args = call.args as { timeout_seconds: number };
                        const agBridge = await import('./plugins/ag-bridge.js');
                        data = await agBridge.agListen(args.timeout_seconds, onStatus);
                    } else if (call.name === 'ag_get_project_structure') {
                        const agBridge = await import('./plugins/ag-bridge.js');
                        data = { structure: await agBridge.agGetProjectStructure((call.args as any).path) };
                    } else if (call.name === 'ag_read_file') {
                        const agBridge = await import('./plugins/ag-bridge.js');
                        data = { content: await agBridge.agReadFile((call.args as any).filePath) };
                    } else if (call.name === 'sessions_create') {
                        data = { sessionId: await comms.createSession((call.args as any).name) };
                    } else if (call.name === 'sessions_list') {
                        data = { sessions: comms.listSessions() };
                    } else if (call.name === 'sessions_history') {
                        data = { history: comms.getSessionHistory((call.args as any).sessionId) };
                    } else if (call.name === 'sessions_send') {
                        const args = call.args as { sessionId: string, role: AgentRole, message: string };
                        data = { response: await comms.sendToAgent(args.sessionId, args.role, args.message) };
                    } else if (call.name === 'mesh_workflow') {
                        data = { result: await workflow.decomposeGoal((call.args as any).goal) };
                    } else if (call.name === 'workflow_status') {
                        data = { status: workflow.getWorkflowStatus((call.args as any).workflowId) };
                    } else if (call.name === 'suggest_recommendations') {
                        data = { recommendations: await recommendations.generateSmartRecommendations() };
                    } else if (call.name === 'browse_web') {
                        const browserPlugin = await import('./plugins/browser.js');
                        data = { content: await browserPlugin.browseWeb((call.args as any).url, (call.args as any).action) };
                    } else if (call.name === 'send_notification') {
                        const { exec } = await import('child_process');
                        const args = call.args as { title: string, message: string };
                        const cmd = `osascript -e 'display notification "${args.message.replace(/"/g, '\"')}" with title "${args.title.replace(/"/g, '\"')}"'`;
                        exec(cmd);
                        data = { content: 'Notification sent to Graham.' };
                    } else if (call.name === 'web_search') {
                        const searchPlugin = await import('./plugins/search.js');
                        data = { results: await searchPlugin.searchWeb((call.args as any).query) };
                    } else if (call.name === 'toggle_talk_mode') {
                        talkMode = (call.args as any).enabled;
                        data = { result: `Talk Mode is now ${talkMode ? 'ENABLED' : 'DISABLED'}` };
                    } else if (call.name === 'file_read') {
                        const fsPlugin = await import('./plugins/fs.js');
                        data = { content: await fsPlugin.readFileTool((call.args as any).filePath) };
                    } else if (call.name === 'file_write') {
                        const fsPlugin = await import('./plugins/fs.js');
                        data = { result: await fsPlugin.writeFileTool((call.args as any).filePath, (call.args as any).content) };
                    } else if (call.name === 'file_list') {
                        const fsPlugin = await import('./plugins/fs.js');
                        data = { files: await fsPlugin.listFilesTool((call.args as any).dirPath) };
                    } else if (call.name === 'shell_exec') {
                        const shellPlugin = await import('./plugins/shell.js');
                        data = { out: await shellPlugin.runShellCommand((call.args as any).command, (call.args as any).cwd) };
                    } else if (call.name === 'trigger_self_reflection') {
                        const { runSelfReflection } = await import('./plugins/reflection-engine.js');
                        data = await runSelfReflection();
                    } else if (call.name === 'task_decompose') {
                        const { decomposeTask } = await import('./plugins/decomposition.js');
                        const args = call.args as { mainTask: string, context?: string };
                        data = { subtasks: await decomposeTask(args.mainTask, args.context) };
                    } else if (call.name === 'ag_run_airbnb_workflow') {
                        const { runAirbnbWorkflow } = await import('./plugins/airbnbWorkflow.js');
                        const { WebChannel } = await import('./plugins/web-channel.js');
                        const channel = WebChannel.getInstance();
                        const args = call.args as { url: string };
                        console.log(`[AGENT] EXECUTING AIRBNB WORKFLOW for URL: ${args.url}`);
                        
                        data = await runAirbnbWorkflow(args.url, 'pro', (update: any) => {
                            // Forward update to UI via WebSocket
                            channel.broadcast(JSON.stringify({
                                type: 'agent_update',
                                ...update
                            }));
                        });
                    } else if (call.name === 'ag_grant_budget') {
                        const { grantBudget } = await import('./plugins/budget-manager.js');
                        const args = call.args as { steps: number, gbp: number };
                        data = grantBudget(args.steps, args.gbp);
                    } else if (call.name === 'ag_list_workspace_projects') {
                        const agBridge = await import('./plugins/ag-bridge.js');
                        data = await agBridge.agListWorkspaceProjects();
                    } else if (call.name === 'summarize_meeting') {
                        const { summarizeMeeting } = await import('./plugins/meeting-summarizer.js');
                        data = { summary: await summarizeMeeting((call.args as any).transcript) };
                    } else if (call.name.startsWith('mcp_')) {
                        const parts = call.name.split('_');
                        const serverName = parts[1];
                        const toolName = parts.slice(2).join('_');
                        data = await mcpBridge.callTool(serverName, toolName, call.args);
                    } else {
                        console.log(`[AGENT] Executing tool: ${call.name}`);
                        data = await withTimeout(executeTool(call.name, call.args), 300000, `Tool execution timed out (300s): ${call.name}`);
                        console.log(`[AGENT] Tool ${call.name} completed.`);
                    }
                } catch (err: any) {
                    data = { error: err.message };
                }

                // Track tokens from delegated models (OpenRouter)
                if (data && (data as any).usage?.total_tokens) {
                    totalTokens += (data as any).usage.total_tokens;
                }

                toolResults.push({ functionResponse: { name: call.name, response: data as any } });
            }

            let toolRetryCount = 0;
            let toolSuccess = false;
            while (!toolSuccess && toolRetryCount < 3) {
                try {
                    result = await withTimeout(chat.sendMessage(toolResults), 60000, "Gemini Tool-Reply Timeout (60s)");
                    toolSuccess = true;
                } catch (err: any) {
                    toolRetryCount++;
                    console.warn(`[AGENT] API Error mid-loop: ${err.message}. Retrying... (${toolRetryCount}/3)`);
                    await new Promise(res => setTimeout(res, 2000 * toolRetryCount)); // Backoff
                    if (toolRetryCount >= 3) {
                        return `[CRITICAL] Agent crashed mid-thought due to persistent API error: ${err.message}. Please restart the request.`;
                    }
                }
            }

            if (result && result.response.usageMetadata?.totalTokenCount) {
                totalTokens = result.response.usageMetadata.totalTokenCount;
            }
        }

        // Persistent Memory Hook: Save all new turns from this interaction
        const updatedHistory = await chat.getHistory();
        const newMessages = updatedHistory.slice(initialHistoryLength);
        console.log(`[AGENT] Current session total: ${updatedHistory.length} turns. New turns since start: ${newMessages.length}`);

        for (const msg of newMessages) {
            // Further sanitization before saving
            if (msg.parts && msg.parts.length > 0) {
                storeConversationTurn(idStr, msg.role, (msg.parts as any));
            }
        }

        // Update in-memory cache (limit to last 40 valid turns)
        let finalSlice = updatedHistory.filter((m: any) => m.parts && m.parts.length > 0).slice(-40);
        const fIdx = finalSlice.findIndex((m: any) => m.role === 'user');
        if (fIdx !== -1) {
            finalSlice = finalSlice.slice(fIdx);
        }
        else {
            finalSlice = [];
        }
        chatHistories.set(idStr, finalSlice);

        // Calculate Realistic Cost
        let turnCost = 0;
        if (usedModel.includes('flash')) {
            turnCost = (totalTokens / 1_000_000) * 0.15; // ~$0.20/1M blended
        }
        else if (usedModel.includes('pro')) {
            turnCost = (totalTokens / 1_000_000) * 3.50; // ~$4.50/1M blended
        }
        else {
            turnCost = (totalTokens / 1_000_000) * 0.50; // Generic fallback
        }

        recordUsage(totalTokens, turnCost);
        const replyText = result.response.text();
        const stats = getUsageStats();
        const costFooter = `[Model: ${usedModel} | Tokens: ${totalTokens.toLocaleString()} | Loop: £${turnCost.toFixed(4)} | Daily: £${stats.daily_cost_gbp.toFixed(2)} | Month: £${stats.monthly_cost_gbp.toFixed(2)}]`;

        // Only append cost footer if there's actual content — prevents bare metadata lines
        if (!replyText || !replyText.trim()) {
            console.warn(`[AGENT] Empty reply from LLM (tools-only turn). Generating summary...`);
            // Force a summary if empty
            const summaryModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const sumResult = await summaryModel.generateContent(`System: You just executed several tools. Please provide a brief professional summary of the results for the client. \n\nHistory: ${JSON.stringify(updatedHistory.slice(-5))}`);
            const forcedSummary = sumResult.response.text();
            return `${forcedSummary}\n\n${costFooter} (forced)`;
        }
        return `${replyText}\n\n${costFooter}`;
    }
    catch (err: any) {
        console.error("[CRITICAL] processMessage Error:", err);
        return `[AGENT ERROR] I encountered a problem during processing: ${err.message}. My memory is safe, but this specific turn failed.`;
    }
}

export async function processHeartbeat(systemTask: string): Promise<string> {
    const HEARTBEAT_PROMPT = `You are CLAW MONITOR. Your job is to check system health and status.
1. MISSION: Ensure all bridges (Slack, Web, MCP) are operational.
2. CLEAR PROBLEMS (UX): At the end of every turn, check for codebase problems. Use 'clear_problems' or 'ag_talk_to_assistant' to ensure the Antigravity "Problems" panel stays empty.
3. Be EXTREMELY concise. No conversational filler.
`;

    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: HEARTBEAT_PROMPT,
        tools: [{
            functionDeclarations: [
                { name: 'store_memory', description: 'Store memory', parameters: { type: SchemaType.OBJECT, properties: { category: { type: SchemaType.STRING }, content: { type: SchemaType.STRING } }, required: ["category", "content"] } },
                { name: 'search_memory', description: 'Search memory', parameters: { type: SchemaType.OBJECT, properties: { query: { type: SchemaType.STRING } }, required: ["query"] } },
                { name: 'check_codebase_problems', description: 'Check for codebase problems', parameters: { type: SchemaType.OBJECT, properties: {} } },
                { name: 'clear_problems', description: 'Attempt to clear codebase problems automatically', parameters: { type: SchemaType.OBJECT, properties: {} } },
                { name: 'ag_talk_to_assistant', description: 'Directly message the main Antigravity interface', parameters: { type: SchemaType.OBJECT, properties: { message: { type: SchemaType.STRING } }, required: ["message"] } }
            ]
        }]
    });

    const chat = model.startChat({ history: [] });
    let totalTokens = 0;

    const result = await chat.sendMessage(systemTask);
    if (result.response.usageMetadata?.totalTokenCount) {
        totalTokens += result.response.usageMetadata.totalTokenCount;
    }

    const functionCalls = result.response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
        const toolResults = [];
        for (const call of functionCalls) {
            let data;
            try {
                console.log(`[HEARTBEAT] Executing tool: ${call.name}`);
                data = await withTimeout(executeTool(call.name, call.args), 300000, `Tool execution timed out (300s): ${call.name}`);
            } catch (e: any) {
                console.error(`[HEARTBEAT] Tool ${call.name} error:`, e.message);
                data = { error: e.message };
            }
            toolResults.push({ functionResponse: { name: call.name, response: data as any } });
        }
        const finalResult = await chat.sendMessage(toolResults);
        if (finalResult.response.usageMetadata?.totalTokenCount) {
            totalTokens += finalResult.response.usageMetadata.totalTokenCount;
        }

        const turnCost = (totalTokens / 1_000_000) * 0.08;
        recordUsage(totalTokens, turnCost);
        const stats = getUsageStats();
        return `${finalResult.response.text()
            } \n\n[Model: Heartbeat Lite | Tokens: ${totalTokens.toLocaleString()} | Turn: £${turnCost.toFixed(5)} | Total: £${stats.total_cost_gbp.toFixed(2)}]`;
    }

    const turnCost = (totalTokens / 1_000_000) * 0.08;
    recordUsage(totalTokens, turnCost);
    const stats = getUsageStats();
    return `${result.response.text()} \n\n[Model: Heartbeat Lite | Tokens: ${totalTokens.toLocaleString()} | Turn: £${turnCost.toFixed(5)} | Total: £${stats.total_cost_gbp.toFixed(2)}]`;
}
