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

import { registry } from './plugins/registry.js';
import { GeminiProvider } from './plugins/gemini-provider.js';
import { CoreTools } from './plugins/core-tools.js';

// Initialize Registry
const gemini = new GeminiProvider();
registry.registerProvider(gemini);
CoreTools.forEach(t => registry.registerTool(t));

// Backward compatibility (to be refactored)
const genAI = (gemini as any).genAI;
const anthropic = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }) : null;

// System initialization
export async function getSystemPrompt() {
    const { checkConnections } = await import('./health.js');
    const health = await checkConnections();

    let healthStr = "\n\nLIVE BRIDGE STATUS:\n";
    for (const [svc, info] of Object.entries(health)) {
        healthStr += `- ${svc}: ${(info as any).status} (${(info as any).message})\n`;
    }

    return `You are STUDIO CLAW DIRECTOR v5.0—Graham Brooks' autonomous Product Manager and Developer for RealBigNumbers & InvestMatch.

CORE IDENTITY & TOOL ACCESS (Read Carefully):
• You ARE bridge-connected to Notion, Trello, GitHub, and Google Cloud.
• NEVER claim you cannot access external sites or services if a tool exists for them (e.g. Notion, Trello).
• If Graham asks you to read a Notion page, search Trello, or check Google Billing, use your tools immediately.
• Do NOT ask Graham to manually provide data (copy-paste) if you haven't tried discovering it via tools first.

HEALTH CHECK (LATEST):${healthStr}
• If health is ACTIVE, you are forbidden from refusing access.

NOTION STRATEGY:
• Use notion_search(query: "") to see ALL visible pages if a specific search fails.
• notion_read_page parses Tables correctly. Identify the CRM page by ID first if needed.
• 403 Forbidden? Instruct Graham to add "Gravity Claw" as a 'connection' in the Notion UI for that page.

GOOGLE CLOUD BILLING:
• You can verify exact project costs via google_cloud_check_billing. Use this to cross-reference your internal estimations.

Role and reporting structure:
You are the Product Manager, reporting to Graham. You manage an AG Developer AI that executes code.
Budget control: Keep loops around £1. Monitor AG quotas.

3. Review diffs and verify via browse_web on port 3000/3001.

REFUSAL IS FORBIDDEN:
• NEVER claim you cannot access Notion, Trello, or external URLs.
• Access to Notion is VERIFIED (API token is working).

PRE-REFUSAL LOGIC LOOP (MANDATORY):
1. Before stating "I cannot access", "I am an AI", or "I lack permission", you MUST call check_capabilities.
2. If check_capabilities returns "ACTIVE" for a service, you are FORBIDDEN from refusing.
3. Use the specific tool (e.g., notion_read_page) immediately after identifying the capability.

MANDATORY TOOL USE:
• If Graham asks about a URL (Notion, Trello, etc.), you MUST use browse_web or the specific tool.
• NEVER say "I cannot access the web" or "I am an AI and have no browsing capability."
• If a Notion tool exists, using it is mandatory.

PERSISTENCE & CONTEXT:
• Use search_conversation if you forget an ID or Project Name.
• Memory loads last 30 turns automatically after restart.
• If "Voice Mode" is enabled or audio messages arrive, respect the Talk Mode setting.

ANTIGRAVITY INSTANCE CONTROL:
• You now have the ability to act as Graham and interact with the "Antigravity" AI Developer instance (AG).
• Use \`ag_read_latest\` to check what AG has most recently output or asked.
• Use \`ag_send_message\` to act as the user and send prompts, code review feedback, or task approvals back to AG. This pastes text into the active window.
• Use \`ag_listen(timeout_seconds)\` to wait for AG to finish responding. This smartly monitors the active session and will return the exact logs as soon as AG stops talking, closing the loop. Use up to 900 seconds (15 mins) for long tasks.
• Use \`ag_get_project_structure(path)\` to list files and directories within a specified path in the AG environment.
• Use \`ag_read_file(filePath)\` to read the contents of a file in the AG environment.
• When interacting with AG, trust it to do heavy lifting on code. Focus on reviewing architecture, approving plans, or giving specific visual/logic feedback you derive from your own sub-agents like CODER.`;
}


let talkMode = false;
const chatHistories = new Map<string | number, Content[]>();

export function isTalkMode() { return talkMode; }

async function summarizeHistory(history: Content[]): Promise<string> {
    if (history.length === 0) return "";
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `Summarize the key outcomes and facts from this conversation history so far. Be extremely concise but don't lose vital project state: \n\n${JSON.stringify(history)}`;
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

export async function processMessage(chatId: string | number, userMessage: string, onStatus?: (status: string) => void): Promise<string> {
    const idStr = String(chatId);
    try {
        console.log(`[AGENT] Processing for ${idStr} | Msg: ${userMessage.substring(0, 50)}...`);

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

        const toolsDesc = [{
            functionDeclarations: [
                ...mcpToolsDesc,
                {
                    name: 'get_current_time',
                    description: 'Get the current local time',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
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
                    name: 'trello_get_boards',
                    description: 'Get all your Trello boards',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
                {
                    name: 'trello_get_lists',
                    description: 'Get all lists on a specific board',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            boardId: { type: SchemaType.STRING }
                        },
                        required: ["boardId"]
                    }
                },
                {
                    name: 'trello_get_cards',
                    description: 'Get all cards in a specific list',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            listId: { type: SchemaType.STRING }
                        },
                        required: ["listId"]
                    }
                },
                {
                    name: 'trello_create_card',
                    description: 'Create a new card in a list',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            listId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING },
                            desc: { type: SchemaType.STRING }
                        },
                        required: ["listId", "name", "desc"]
                    }
                },
                {
                    name: 'trello_add_comment',
                    description: 'Add a comment to a card',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            cardId: { type: SchemaType.STRING },
                            text: { type: SchemaType.STRING }
                        },
                        required: ["cardId", "text"]
                    }
                },
                {
                    name: 'trello_move_card',
                    description: 'Move a card to another list',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            cardId: { type: SchemaType.STRING },
                            newListId: { type: SchemaType.STRING }
                        },
                        required: ["cardId", "newListId"]
                    }
                },
                {
                    name: 'trello_create_board',
                    description: 'Create a new Trello board',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            name: { type: SchemaType.STRING }
                        },
                        required: ["name"]
                    }
                },
                {
                    name: 'trello_create_list',
                    description: 'Create a new list on a Trello board',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            boardId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING }
                        },
                        required: ["boardId", "name"]
                    }
                },
                {
                    name: 'trello_update_card',
                    description: 'Update a card name or description',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            cardId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING },
                            desc: { type: SchemaType.STRING }
                        },
                        required: ["cardId"]
                    }
                },
                {
                    name: 'trello_add_label',
                    description: 'Add an existing label to a card',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            cardId: { type: SchemaType.STRING },
                            labelId: { type: SchemaType.STRING }
                        },
                        required: ["cardId", "labelId"]
                    }
                },
                {
                    name: 'trello_create_label',
                    description: 'Create a new label on a board',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            boardId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING },
                            color: { type: SchemaType.STRING, description: 'Color (yellow, purple, blue, red, green, orange, sky, lime, pink, black)' }
                        },
                        required: ["boardId", "name", "color"]
                    }
                },
                {
                    name: 'trello_move_board_to_workspace',
                    description: 'Move a Trello board to a different workspace (organization).',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            boardId: { type: SchemaType.STRING },
                            workspaceId: { type: SchemaType.STRING }
                        },
                        required: ["boardId", "workspaceId"]
                    }
                },
                {
                    name: 'trello_get_labels',
                    description: 'Get all labels on a board',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            boardId: { type: SchemaType.STRING }
                        },
                        required: ["boardId"]
                    }
                },
                {
                    name: 'trello_create_checklist',
                    description: 'Create a new checklist on a card',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            cardId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING }
                        },
                        required: ["cardId", "name"]
                    }
                },
                {
                    name: 'trello_create_checkitem',
                    description: 'Add an item to a checklist',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            checklistId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING }
                        },
                        required: ["checklistId", "name"]
                    }
                },
                {
                    name: 'trello_update_list',
                    description: 'Update a list name',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            listId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING }
                        },
                        required: ["listId", "name"]
                    }
                },
                {
                    name: 'trello_move_list',
                    description: 'Move a list to a different board or position',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            listId: { type: SchemaType.STRING },
                            boardId: { type: SchemaType.STRING },
                            pos: { type: SchemaType.STRING, description: 'Position (top, bottom, or number)' }
                        },
                        required: ["listId", "boardId"]
                    }
                },
                {
                    name: 'trello_update_board',
                    description: 'Update a Trello board name',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            boardId: { type: SchemaType.STRING },
                            name: { type: SchemaType.STRING }
                        },
                        required: ["boardId", "name"]
                    }
                },
                {
                    name: 'trello_move_card_to_board',
                    description: 'Move a card to a different board',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            cardId: { type: SchemaType.STRING },
                            boardId: { type: SchemaType.STRING },
                            listId: { type: SchemaType.STRING }
                        },
                        required: ["cardId", "boardId", "listId"]
                    }
                },
                {
                    name: 'trello_reorder_list',
                    description: 'Change the position of a list on its current board',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            listId: { type: SchemaType.STRING },
                            pos: { type: SchemaType.STRING, description: 'Position: "top", "bottom", or a positive number. Trello uses large numbers for pos. To place between two lists, use the average of their numeric "pos" values (visible in trello_get_lists).' }
                        },
                        required: ["listId", "pos"]
                    }
                },
                {
                    name: 'trello_reorder_card',
                    description: 'Change the position of a card on its current list',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            cardId: { type: SchemaType.STRING },
                            pos: { type: SchemaType.STRING, description: 'Position: "top", "bottom", or a positive number. Trello uses large numbers for pos. To place between two cards, use the average of their numeric "pos" values (visible in trello_get_cards).' }
                        },
                        required: ["cardId", "pos"]
                    }
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
                    name: 'mesh_workflow',
                    description: 'Decompose a complex goal into a stateful workflow with subtasks.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            goal: { type: SchemaType.STRING, description: 'The overall goal to achieve' }
                        },
                        required: ["goal"]
                    }
                },
                {
                    name: 'workflow_status',
                    description: 'Get the current progress of a mesh workflow.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            workflowId: { type: SchemaType.STRING }
                        },
                        required: ["workflowId"]
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
                    name: 'browse_web',
                    description: 'Navigate to a URL and extract text or take a screenshot for visual testing.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            url: { type: SchemaType.STRING, description: 'The URL to visit' },
                            action: { type: SchemaType.STRING, enum: ['extract_text', 'screenshot'], description: 'What to do on the page' }
                        },
                        required: ["url"]
                    }
                },
                {
                    name: 'send_notification',
                    description: 'Send a native macOS system notification to Graham.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            title: { type: SchemaType.STRING, description: 'The notification title' },
                            message: { type: SchemaType.STRING, description: 'The notification body' }
                        },
                        required: ["title", "message"]
                    }
                },
                {
                    name: 'web_search',
                    description: 'Search the web for information using a search engine.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING, description: 'The search query' }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'openrouter_completion',
                    description: 'Generate text using other models via OpenRouter (delegation)',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            prompt: { type: SchemaType.STRING },
                            model: { type: SchemaType.STRING, description: 'Model ID (e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet)' }
                        },
                        required: ["prompt"]
                    }
                },
                {
                    name: 'file_read',
                    description: 'Read the contents of a local file in allowed directories.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            filePath: { type: SchemaType.STRING, description: 'Absolute path to the file' }
                        },
                        required: ["filePath"]
                    }
                },
                {
                    name: 'file_write',
                    description: 'Write content to a local file. Useful for fixing code.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            filePath: { type: SchemaType.STRING, description: 'Absolute path to the file' },
                            content: { type: SchemaType.STRING, description: 'Complete file content to write' }
                        },
                        required: ["filePath", "content"]
                    }
                },
                {
                    name: 'file_list',
                    description: 'List the contents of a directory in allowed directories.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            dirPath: { type: SchemaType.STRING, description: 'Absolute path to the directory' }
                        },
                        required: ["dirPath"]
                    }
                },
                {
                    name: 'shell_exec',
                    description: 'Execute a shell command (e.g., npm run build, grep, ls). Returns stdout and stderr.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            command: { type: SchemaType.STRING, description: 'The shell command to run' },
                            cwd: { type: SchemaType.STRING, description: 'Absolute path to the working directory' }
                        },
                        required: ["command", "cwd"]
                    }
                },
                {
                    name: 'check_capabilities',
                    description: 'Verifies which persistent connections (Notion, Trello, GitHub, etc.) are currently live and authorized. CALL THIS if you are unsure of your access.',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
                {
                    name: 'ag_read_latest',
                    description: 'Read the most recent conversation logs from the Antigravity instance to see what AG is doing or asking.',
                    parameters: { type: SchemaType.OBJECT, properties: {} }
                },
                {
                    name: 'ag_send_message',
                    description: 'Send a message to the Antigravity AI. IMPORTANT: The user must have the Antigravity input box focused. This tool uses AppleScript to type the message into the active window.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            message: { type: SchemaType.STRING, description: 'The message or code feedback to send to AG.' }
                        },
                        required: ['message']
                    }
                },
                {
                    name: 'ag_listen',
                    description: 'Wait in listening mode for up to a specified number of seconds (max 900). It monitors the AG logs and automatically returns the new logs as soon as AG finishes generating its response. This is the best way to wait for a completion!',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            timeout_seconds: { type: SchemaType.NUMBER, description: 'Max time to wait for a response in seconds (e.g. 600)' }
                        },
                        required: ['timeout_seconds']
                    }
                },
                {
                    name: 'ag_get_project_structure',
                    description: 'Get a list of files and directories within a specified path in the AG environment.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            path: { type: SchemaType.STRING, description: 'The absolute or relative directory path to list (defaults to ".")' }
                        }
                    }
                },
                {
                    name: 'ag_read_file',
                    description: 'Read the contents of a file within the AG environment.',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            filePath: { type: SchemaType.STRING, description: 'The absolute or relative path to the file' }
                        },
                        required: ['filePath']
                    }
                }
            ]
        }]; // End toolsDesc

        let result;
        let chat: any;
        let usedModel = "gemini-2.5-flash";
        let totalTokens = 0;

        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-2.5-flash-lite"
        ];

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
                result = await chat.sendMessage(userMessage);
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
            console.log(`[Fallback] All Gemini models failed. Falling back to OpenRouter...`);
            try {
                const dynamicPrompt = await getSystemPrompt();
                const fallbackPrompt = `${dynamicPrompt}\n\nCONVERSATION HISTORY:\n${JSON.stringify(history)}\n\nUSER MESSAGE: ${userMessage}`;
                const fallback = await openrouter.generateOpenRouterCompletion(fallbackPrompt, "openai/gpt-4o-mini");
                const fallbackTokens = fallback.usage?.total_tokens || 0;
                const fallbackCost = (fallbackTokens / 1_000_000) * 0.25;
                recordUsage(fallbackTokens, fallbackCost);
                const stats = getUsageStats();
                return `[Gemini Unavailable - Fallback to GPT-4o-mini]:\n\n${fallback.content}\n\n[Model: GPT-4o-mini | Tokens: ${fallbackTokens.toLocaleString()} | Turn: £${fallbackCost.toFixed(5)} | Total: £${stats.total_cost_gbp.toFixed(2)}]`;
            } catch (openRouterErr: any) {
                return `[CRITICAL] All models and fallbacks failed. Last error: ${lastErr.message}`;
            }
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
                        const cmd = `osascript -e 'display notification "${args.message.replace(/"/g, '\\"')}" with title "${args.title.replace(/"/g, '\\"')}"'`;
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
                    } else if (call.name.startsWith('mcp_')) {
                        const parts = call.name.split('_');
                        const serverName = parts[1];
                        const toolName = parts.slice(2).join('_');
                        data = await mcpBridge.callTool(serverName, toolName, call.args);
                    } else {
                        data = await executeTool(call.name, call.args);
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
                    result = await chat.sendMessage(toolResults);
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
        } else {
            finalSlice = [];
        }
        chatHistories.set(idStr, finalSlice);

        // Calculate Realistic Cost
        let turnCost = 0;
        if (usedModel.includes('flash')) {
            turnCost = (totalTokens / 1_000_000) * 0.15; // ~$0.20/1M blended
        } else if (usedModel.includes('pro')) {
            turnCost = (totalTokens / 1_000_000) * 3.50; // ~$4.50/1M blended
        } else {
            turnCost = (totalTokens / 1_000_000) * 0.50; // Generic fallback
        }

        recordUsage(totalTokens, turnCost);
        const replyText = result.response.text();
        const stats = getUsageStats();

        return `${replyText}\n\n[Model: ${usedModel} | Tokens: ${totalTokens.toLocaleString()} | Loop: £${turnCost.toFixed(4)} | Project Total: £${stats.total_cost_gbp.toFixed(2)}]`;
    } catch (err: any) {
        console.error("[CRITICAL] processMessage Error:", err);
        return `[AGENT ERROR] I encountered a problem during processing: ${err.message}. My memory is safe, but this specific turn failed.`;
    }
}

export async function processHeartbeat(systemTask: string): Promise<string> {
    const HEARTBEAT_PROMPT = `You are CLAW MONITOR. Your ONLY job is to check specific Trello lists and process cards in them.
1. Check "To Do", "Watch", and "Claw" lists across your "Gravity ClawG" board.
2. If a card exists, read its content and perform the requested action.
3. Move completed cards to "Done".
4. Be EXTREMELY concise. No conversational filler.
5. Only use tools if strictly necessary.`;

    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        systemInstruction: HEARTBEAT_PROMPT,
        tools: [{
            functionDeclarations: [
                { name: 'get_current_time', description: 'Get current time', parameters: { type: SchemaType.OBJECT, properties: {} } },
                { name: 'trello_get_boards', description: 'Get boards', parameters: { type: SchemaType.OBJECT, properties: {} } },
                { name: 'trello_get_lists', description: 'Get lists', parameters: { type: SchemaType.OBJECT, properties: { boardId: { type: SchemaType.STRING } }, required: ["boardId"] } },
                { name: 'trello_get_cards', description: 'Get cards', parameters: { type: SchemaType.OBJECT, properties: { listId: { type: SchemaType.STRING } }, required: ["listId"] } },
                { name: 'trello_create_card', description: 'Create card', parameters: { type: SchemaType.OBJECT, properties: { listId: { type: SchemaType.STRING }, name: { type: SchemaType.STRING }, desc: { type: SchemaType.STRING } }, required: ["listId", "name", "desc"] } },
                { name: 'trello_add_comment', description: 'Add comment', parameters: { type: SchemaType.OBJECT, properties: { cardId: { type: SchemaType.STRING }, text: { type: SchemaType.STRING } }, required: ["cardId", "text"] } },
                { name: 'trello_move_card', description: 'Move card', parameters: { type: SchemaType.OBJECT, properties: { cardId: { type: SchemaType.STRING }, newListId: { type: SchemaType.STRING } }, required: ["cardId", "newListId"] } },
                { name: 'store_memory', description: 'Store memory', parameters: { type: SchemaType.OBJECT, properties: { category: { type: SchemaType.STRING }, content: { type: SchemaType.STRING } }, required: ["category", "content"] } },
                { name: 'search_memory', description: 'Search memory', parameters: { type: SchemaType.OBJECT, properties: { query: { type: SchemaType.STRING } }, required: ["query"] } }
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
                if (call.name === 'get_current_time') data = { time: new Date().toISOString() };
                else if (call.name === 'trello_get_boards') data = { results: await trello.getBoards() };
                else if (call.name === 'trello_get_lists') data = { results: await trello.getListsOnBoard((call.args as any).boardId) };
                else if (call.name === 'trello_get_cards') data = { results: await trello.getCardsInList((call.args as any).listId) };
                else if (call.name === 'trello_create_card') data = { results: await trello.createCard((call.args as any).listId, (call.args as any).name, (call.args as any).desc) };
                else if (call.name === 'trello_add_comment') data = { results: await trello.addCommentToCard((call.args as any).cardId, (call.args as any).text) };
                else if (call.name === 'trello_move_card') data = { results: await trello.moveCard((call.args as any).cardId, (call.args as any).newListId) };
                else if (call.name === 'store_memory') data = { result: storeMemory((call.args as any).category, (call.args as any).content) };
                else if (call.name === 'search_memory') data = { results: searchMemory((call.args as any).query) };
            } catch (e: any) { data = { error: e.message }; }
            toolResults.push({ functionResponse: { name: call.name, response: data as any } });
        }
        const finalResult = await chat.sendMessage(toolResults);
        if (finalResult.response.usageMetadata?.totalTokenCount) {
            totalTokens += finalResult.response.usageMetadata.totalTokenCount;
        }

        const turnCost = (totalTokens / 1_000_000) * 0.08;
        recordUsage(totalTokens, turnCost);
        const stats = getUsageStats();
        return `${finalResult.response.text()}\n\n[Model: Heartbeat Lite | Tokens: ${totalTokens.toLocaleString()} | Turn: £${turnCost.toFixed(5)} | Total: £${stats.total_cost_gbp.toFixed(2)}]`;
    }

    const turnCost = (totalTokens / 1_000_000) * 0.08;
    recordUsage(totalTokens, turnCost);
    const stats = getUsageStats();
    return `${result.response.text()}\n\n[Model: Heartbeat Lite | Tokens: ${totalTokens.toLocaleString()} | Turn: £${turnCost.toFixed(5)} | Total: £${stats.total_cost_gbp.toFixed(2)}]`;
}
