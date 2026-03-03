import { config } from './config.js';

const NOTION_API_URL = 'https://api.notion.com/v1';

function getHeaders() {
    return {
        'Authorization': `Bearer ${config.NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    };
}

export async function queryDatabase(databaseId: string) {
    const response = await fetch(`${NOTION_API_URL}/databases/${databaseId}/query`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({})
    });
    if (!response.ok) throw new Error(`Notion API Error: ${response.statusText}`);
    return response.json();
}

export async function searchNotion(query: string) {
    const response = await fetch(`${NOTION_API_URL}/search`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ query, sort: { direction: 'descending', timestamp: 'last_edited_time' } })
    });
    if (!response.ok) throw new Error(`Notion API Error: ${response.statusText}`);
    return response.json();
}

export async function readPage(pageId: string) {
    const response = await fetch(`${NOTION_API_URL}/blocks/${pageId}/children`, {
        method: 'GET',
        headers: getHeaders()
    });
    if (!response.ok) throw new Error(`Notion API Error: ${response.statusText}`);
    return response.json();
}

export async function createPage(databaseId: string, title: string, content: string) {
    const payload = {
        parent: { database_id: databaseId },
        properties: {
            title: {
                title: [{ text: { content: title } }]
            }
        },
        children: [
            {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content } }]
                }
            }
        ]
    };

    const response = await fetch(`${NOTION_API_URL}/pages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Notion API Error: ${response.statusText}`);
    return response.json();
}
