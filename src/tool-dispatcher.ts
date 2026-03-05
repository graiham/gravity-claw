import { storeMemory, searchMemory, storeFact, searchFacts, setPreference, storeTriple, queryGraph, cleanOldMemories, storeAsset, searchAssets } from './memory.js';
import { syncToMarkdown } from './markdown-memory.js';
import * as trello from './trello.js';
import * as notion from './notion.js';
import * as github from './github.js';
import * as openrouter from './openrouter.js';

export async function executeTool(name: string, args: any): Promise<any> {
    try {
        switch (name) {
            case 'get_current_time':
                return { time: new Date().toISOString() };
            case 'store_memory':
                return { result: storeMemory(args.category, args.content) };
            case 'search_memory':
                return { results: searchMemory(args.query) };
            case 'store_fact': {
                const result = storeFact(args.entity, args.fact);
                syncToMarkdown(args.entity, args.fact, 'fact');
                return { result };
            }
            case 'search_facts':
                return { results: searchFacts(args.query) };
            case 'set_preference': {
                const result = setPreference(args.key, args.value);
                syncToMarkdown(args.key, args.value, 'preference');
                return { result };
            }
            case 'store_triple':
                return { result: storeTriple(args.subject, args.predicate, args.object) };
            case 'query_graph':
                return { results: queryGraph(args.query) };
            case 'forget_memory':
                return { result: cleanOldMemories(args.days) };
            case 'search_assets':
                return { results: searchAssets(args.query) };
            case 'semantic_search':
                // Note: vector.ts would be imported here if needed, or we can handle it in agent.ts
                // For now, let's keep it simple.
                return { error: "Semantic search integration pending in dispatcher" };
            case 'trello_get_boards':
                return { results: await trello.getBoards() };
            case 'trello_get_lists':
                return { results: await trello.getListsOnBoard(args.boardId) };
            case 'trello_get_cards':
                return { results: await trello.getCardsInList(args.listId) };
            case 'trello_create_card':
                return { results: await trello.createCard(args.listId, args.name, args.desc) };
            case 'trello_add_comment':
                return { results: await trello.addCommentToCard(args.cardId, args.text) };
            case 'trello_move_card':
                return { results: await trello.moveCard(args.cardId, args.newListId) };
            case 'trello_create_board':
                return { results: await trello.createBoard(args.name) };
            case 'trello_create_list':
                return { results: await trello.createList(args.boardId, args.name) };
            case 'trello_update_card':
                return { results: await trello.updateCard(args.cardId, { name: args.name, desc: args.desc }) };
            case 'trello_add_label':
                return { results: await trello.addLabelToCard(args.cardId, args.labelId) };
            case 'trello_create_label':
                return { results: await trello.createLabelOnBoard(args.boardId, args.name, args.color) };
            case 'trello_get_labels':
                return { results: await trello.getBoardLabels(args.boardId) };
            case 'trello_create_checklist':
                return { results: await trello.createChecklist(args.cardId, args.name) };
            case 'trello_create_checkitem':
                return { results: await trello.createCheckItem(args.checklistId, args.name) };
            case 'trello_update_list':
                return { results: await trello.updateList(args.listId, args.name) };
            case 'trello_move_list':
                return { results: await trello.moveList(args.listId, args.boardId, args.pos) };
            case 'trello_update_board':
                return { results: await trello.updateBoard(args.boardId, args.name) };
            case 'trello_move_card_to_board':
                return { results: await trello.moveCardToBoard(args.cardId, args.boardId, args.listId) };
            case 'trello_reorder_list':
                return { results: await trello.reorderList(args.listId, args.pos) };
            case 'trello_reorder_card':
                return { results: await trello.reorderCard(args.cardId, args.pos) };
            case 'trello_move_board_to_workspace':
                return { results: await trello.moveBoardToWorkspace(args.boardId, args.workspaceId) };
            case 'github_list_repos':
                return { results: await github.listRepos() };
            case 'github_create_repo':
                return { results: await github.createRepo(args.name, args.description) };
            case 'github_create_branch':
                return { results: await github.createBranch(args.ownerRepo, args.branchName) };
            case 'github_create_pr':
                return { results: await github.createPullRequest(args.ownerRepo, args.title, args.head, args.base, args.body) };
            case 'notion_search':
                return { results: await notion.searchNotion(args.query) };
            case 'notion_read_page':
                return { results: await notion.readPage(args.pageId) };
            case 'notion_create_page':
                return { results: await notion.createPage(args.databaseId, args.title, args.content) };
            case 'notion_create_page_on_page':
                return { results: await notion.createPageOnPage(args.pageId, args.title, args.content) };
            case 'notion_create_database':
                return { results: await notion.createDatabase(args.pageId, args.title) };
            case 'notion_query_database':
                return { results: await notion.queryDatabase(args.databaseId) };
            case 'openrouter_completion': {
                const orResult = await openrouter.generateOpenRouterCompletion(args.prompt, args.model);
                return { results: orResult.content, usage: orResult.usage };
            }
            case 'google_cloud_check_billing': {
                const { googleCloudGetBilling } = await import('./billing.js');
                return await googleCloudGetBilling();
            }
            case 'check_capabilities': {
                const { checkConnections } = await import('./health.js');
                return await checkConnections();
            }
            case 'ag_read_latest': {
                const { agReadLatest } = await import('./plugins/ag-bridge.js');
                return await agReadLatest();
            }
            case 'ag_send_message': {
                const { agSendMessage } = await import('./plugins/ag-bridge.js');
                return await agSendMessage(args.message);
            }
            case 'ag_listen': {
                const { agListen } = await import('./plugins/ag-bridge.js');
                return await agListen(args.timeout_seconds);
            }
            case 'ag_get_project_structure': {
                const { agGetProjectStructure } = await import('./plugins/ag-bridge.js');
                return await agGetProjectStructure(args.path);
            }
            case 'ag_read_file': {
                const { agReadFile } = await import('./plugins/ag-bridge.js');
                return await agReadFile(args.filePath);
            }
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (err: any) {
        return { error: err.message };
    }
}
