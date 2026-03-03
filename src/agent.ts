import { GoogleGenerativeAI, SchemaType, Content } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { storeMemory, searchMemory, recordUsage, getUsageStats } from './memory.js';
import * as trello from './trello.js';
import * as notion from './notion.js';
import * as github from './github.js';
import * as openrouter from './openrouter.js';

// Initialize Models
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const anthropic = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY }) : null;

// System initialization
const STUDIO_CLAW_SYSTEM_PROMPT = `You are STUDIO CLAW DIRECTOR v5.0—Graham Brooks' autonomous CCO/PM/Dev for RealBigNumbers & InvestMatch.
You manage projects across Trello, Notion, and GitHub.
Use "store_memory" and "search_memory" for persistence.
You can delegate complex tasks or switch models using "openrouter_completion".

PROACTIVE ALERTNESS:
1. Always check context before acting. Keep responses concise.
2. PROACTIVE VERIFICATION: If you previously asked the user to perform a manual action (e.g., "move a list manually"), your first priority in the next turn should be to use a tool (like trello_get_lists) to verify if it happened.
3. REAL-TIME ACKNOWLEDGMENT: If you see that a state has changed (e.g., a list moved or a card was added) that you were previously discussing, acknowledge it immediately. Make the user feel you are "on alert" and watching the system in real-time.`;

let talkMode = false;
const chatHistories = new Map<string | number, Content[]>();

export function isTalkMode() { return talkMode; }

export async function processMessage(chatId: string | number, userMessage: string): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        systemInstruction: STUDIO_CLAW_SYSTEM_PROMPT,
        tools: [{
            functionDeclarations: [
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
                            pos: { type: SchemaType.STRING, description: 'Position (top, bottom, or numeric)' }
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
                            pos: { type: SchemaType.STRING, description: 'Position (top, bottom, or numeric)' }
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
                    description: 'Search Notion docs',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            query: { type: SchemaType.STRING }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: 'notion_read_page',
                    description: 'Read Notion page content',
                    parameters: {
                        type: SchemaType.OBJECT,
                        properties: {
                            pageId: { type: SchemaType.STRING }
                        },
                        required: ["pageId"]
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
                }
            ]
        }]
    });

    const history = chatHistories.get(chatId) || [];
    const chat = model.startChat({ history });

    let totalTokens = 0;

    let result;
    try {
        result = await chat.sendMessage(userMessage);
    } catch (err: any) {
        const isQuota = err.message?.includes('429') || err.message?.includes('quota');
        const isNotFound = err.message?.includes('404') || err.message?.includes('Not Found');

        if ((isQuota || isNotFound) && config.OPENROUTER_API_KEY) {
            console.log(`[Fallback] Gemini error (${isQuota ? 'Quota' : '404'}). Falling back to OpenRouter...`);
            const fallbackPrompt = `${STUDIO_CLAW_SYSTEM_PROMPT}\n\nCONVERSATION HISTORY:\n${JSON.stringify(history)}\n\nUSER MESSAGE: ${userMessage}`;
            const fallback = await openrouter.generateOpenRouterCompletion(fallbackPrompt, "openai/gpt-4o-mini");
            const fallbackTokens = fallback.usage?.total_tokens || 0;
            const fallbackCost = (fallbackTokens / 1_000_000) * 0.25; // GPT-4o-mini rate
            recordUsage(fallbackTokens, fallbackCost);
            const stats = getUsageStats();
            return `[Gemini ${isQuota ? 'Quota' : '404'} - Fallback to GPT-4o-mini]:\n\n${fallback.content}\n\n[Model: GPT-4o-mini | Tokens: ${fallbackTokens.toLocaleString()} | Turn: £${fallbackCost.toFixed(5)} | Total: £${stats.total_cost_gbp.toFixed(2)}]`;
        }
        throw err;
    }

    if (result.response.usageMetadata?.totalTokenCount) {
        totalTokens += result.response.usageMetadata.totalTokenCount;
    }

    let iterations = 0;

    while (iterations < 5) {
        iterations++;
        const functionCalls = result.response.functionCalls();
        if (!functionCalls || functionCalls.length === 0) break;

        const toolResults = [];

        for (const call of functionCalls) {
            let data;
            try {
                if (call.name === 'get_current_time') data = { time: new Date().toISOString() };
                else if (call.name === 'store_memory') data = { result: storeMemory((call.args as any).category, (call.args as any).content) };
                else if (call.name === 'search_memory') data = { results: searchMemory((call.args as any).query) };
                else if (call.name === 'trello_get_boards') data = { results: await trello.getBoards() };
                else if (call.name === 'trello_get_lists') data = { results: await trello.getListsOnBoard((call.args as any).boardId) };
                else if (call.name === 'trello_get_cards') data = { results: await trello.getCardsInList((call.args as any).listId) };
                else if (call.name === 'trello_create_card') data = { results: await trello.createCard((call.args as any).listId, (call.args as any).name, (call.args as any).desc) };
                else if (call.name === 'trello_add_comment') data = { results: await trello.addCommentToCard((call.args as any).cardId, (call.args as any).text) };
                else if (call.name === 'trello_move_card') data = { results: await trello.moveCard((call.args as any).cardId, (call.args as any).newListId) };
                else if (call.name === 'trello_create_board') data = { results: await trello.createBoard((call.args as any).name) };
                else if (call.name === 'trello_create_list') data = { results: await trello.createList((call.args as any).boardId, (call.args as any).name) };
                else if (call.name === 'trello_update_card') data = { results: await trello.updateCard((call.args as any).cardId, { name: (call.args as any).name, desc: (call.args as any).desc }) };
                else if (call.name === 'trello_add_label') data = { results: await trello.addLabelToCard((call.args as any).cardId, (call.args as any).labelId) };
                else if (call.name === 'trello_create_label') data = { results: await trello.createLabelOnBoard((call.args as any).boardId, (call.args as any).name, (call.args as any).color) };
                else if (call.name === 'trello_get_labels') data = { results: await trello.getBoardLabels((call.args as any).boardId) };
                else if (call.name === 'trello_create_checklist') data = { results: await trello.createChecklist((call.args as any).cardId, (call.args as any).name) };
                else if (call.name === 'trello_create_checkitem') data = { results: await trello.createCheckItem((call.args as any).checklistId, (call.args as any).name) };
                else if (call.name === 'trello_update_list') data = { results: await trello.updateList((call.args as any).listId, (call.args as any).name) };
                else if (call.name === 'trello_move_list') data = { results: await trello.moveList((call.args as any).listId, (call.args as any).boardId, (call.args as any).pos) };
                else if (call.name === 'trello_update_board') data = { results: await trello.updateBoard((call.args as any).boardId, (call.args as any).name) };
                else if (call.name === 'trello_move_card_to_board') data = { results: await trello.moveCardToBoard((call.args as any).cardId, (call.args as any).boardId, (call.args as any).listId) };
                else if (call.name === 'trello_reorder_list') data = { results: await trello.reorderList((call.args as any).listId, (call.args as any).pos) };
                else if (call.name === 'trello_reorder_card') data = { results: await trello.reorderCard((call.args as any).cardId, (call.args as any).pos) };
                else if (call.name === 'github_list_repos') data = { results: await github.listRepos() };
                else if (call.name === 'github_create_repo') data = { results: await github.createRepo((call.args as any).name, (call.args as any).description) };
                else if (call.name === 'github_create_branch') data = { results: await github.createBranch((call.args as any).ownerRepo, (call.args as any).branchName) };
                else if (call.name === 'github_create_pr') {
                    const args = call.args as { ownerRepo: string, title: string, head: string, base: string, body: string };
                    data = { results: await github.createPullRequest(args.ownerRepo, args.title, args.head, args.base, args.body) };
                } else if (call.name === 'toggle_talk_mode') {
                    const args = call.args as { enabled: boolean };
                    talkMode = args.enabled;
                    data = { result: `Talk Mode is now ${talkMode ? 'ENABLED' : 'DISABLED'}` };
                } else if (call.name === 'notion_search') data = { results: await notion.searchNotion((call.args as any).query) };
                else if (call.name === 'notion_read_page') data = { results: await notion.readPage((call.args as any).pageId) };
                else if (call.name === 'openrouter_completion') {
                    const orResult = await openrouter.generateOpenRouterCompletion((call.args as any).prompt, (call.args as any).model);
                    totalTokens += orResult.usage?.total_tokens || 0;
                    data = { results: orResult.content };
                }
            } catch (err: any) {
                data = { error: err.message };
            }
            toolResults.push({ functionResponse: { name: call.name, response: data as any } });
        }
        result = await chat.sendMessage(toolResults);
        if (result.response.usageMetadata?.totalTokenCount) {
            totalTokens += result.response.usageMetadata.totalTokenCount;
        }
    }

    // Save history with a limit (last 20 messages)
    const newHistory = await chat.getHistory();
    chatHistories.set(chatId, newHistory.slice(-20));

    // Calculate Final Cost (Flash Lite Rate: ~$0.10/1M -> ~£0.08/1M)
    const turnCost = (totalTokens / 1_000_000) * 0.08;
    recordUsage(totalTokens, turnCost);
    const stats = getUsageStats();

    return `${result.response.text()}\n\n[Model: Gemini 2.0 Lite | Tokens: ${totalTokens.toLocaleString()} | Turn: £${turnCost.toFixed(5)} | Total: £${stats.total_cost_gbp.toFixed(2)}]`;
}

/**
 * Specialized lightweight processor for Hearbeat (autonomous) runs.
 * Uses a much smaller system prompt and only essential tools to save costs.
 */
export async function processHeartbeat(systemTask: string): Promise<string> {
    const HEARTBEAT_PROMPT = `You are CLAW MONITOR. Your ONLY job is to check specific Trello lists and process cards in them.
1. Check "Watch" and "ClawG" lists.
2. If a card exists, read its content and perform the requested action (organize, summarize, etc).
3. Be EXTREMELY concise. No conversational filler.
4. Only use tools if strictly necessary.`;

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
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

    const chat = model.startChat({ history: [] }); // No history for heartbeat to save tokens
    let totalTokens = 0;

    const result = await chat.sendMessage(systemTask);
    if (result.response.usageMetadata?.totalTokenCount) {
        totalTokens += result.response.usageMetadata.totalTokenCount;
    }

    // Basic tool loop (no iterations for simplicity/cost)
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
