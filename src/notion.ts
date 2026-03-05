import { config } from './config.js';
import * as fs from 'fs';
import * as path from 'path';

function logNotion(msg: string) {
    const logPath = path.join(process.cwd(), 'logs', 'notion.log');
    const time = new Date().toISOString();
    if (!fs.existsSync(path.dirname(logPath))) fs.mkdirSync(path.dirname(logPath));
    fs.appendFileSync(logPath, `[${time}] ${msg}\n`);
}

const NOTION_API_URL = 'https://api.notion.com/v1';

function getHeaders() {
    return {
        'Authorization': `Bearer ${config.NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    };
}

export async function queryDatabase(databaseId: string) {
    logNotion(`Querying Database: ${databaseId}`);
    const response = await fetch(`${NOTION_API_URL}/databases/${databaseId}/query`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({})
    });
    if (!response.ok) {
        logNotion(`EROR Database ${databaseId}: ${response.status} ${response.statusText}`);
        if (response.status === 403) {
            throw new Error(`Notion API Error: Forbidden (403). Please make sure the integration is added as a 'connection' to the database in Notion.`);
        }
        throw new Error(`Notion API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as any;
    const rows = (data.results || []).map((row: any) => {
        const sanitized: any = { id: row.id };
        for (const [key, value] of Object.entries(row.properties || {})) {
            const val = value as any;
            sanitized[key] = val.title?.[0]?.plain_text ||
                val.rich_text?.[0]?.plain_text ||
                val.select?.name ||
                val.status?.name ||
                val.number ||
                val.date?.start ||
                "";
        }
        return sanitized;
    });
    logNotion(`SUCCESS Database ${databaseId} - Rows: ${rows.length}`);
    return rows;
}

export async function searchNotion(query: string) {
    logNotion(`Searching Notion for: "${query}"`);
    const response = await fetch(`${NOTION_API_URL}/search`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ query, sort: { direction: 'descending', timestamp: 'last_edited_time' } })
    });
    if (!response.ok) {
        logNotion(`ERROR Search "${query}": ${response.status} ${response.statusText}`);
        if (response.status === 403) {
            throw new Error(`Notion API Error: Forbidden (403). Ensure the integration has workspace search permissions.`);
        }
        throw new Error(`Notion API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as any;
    logNotion(`SUCCESS Search Found: ${data.results?.length} items`);
    return data.results.map((r: any) => ({
        id: r.id,
        object: r.object,
        title: r.properties?.title?.title?.[0]?.plain_text || r.properties?.Name?.title?.[0]?.plain_text || "Untitled"
    }));
}

export async function readPage(pageId: string) {
    logNotion(`Reading Page Blocks: ${pageId}`);
    const response = await fetch(`${NOTION_API_URL}/blocks/${pageId}/children`, {
        method: 'GET',
        headers: getHeaders()
    });
    if (!response.ok) {
        logNotion(`ERROR Reading Page ${pageId}: ${response.status} ${response.statusText}`);
        if (response.status === 403) {
            throw new Error(`Notion API Error: Forbidden (403). Please add the 'Gravity Claw' integration as a connection to this specific page or its parent.`);
        }
        throw new Error(`Notion API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as any;

    // Process blocks recursively or at least handle tables
    const results: any[] = [];
    for (const b of data.results) {
        const type = b.type;
        let content = '';

        if (type === 'table') {
            // Fetch rows for the table
            const rowResponse = await fetch(`${NOTION_API_URL}/blocks/${b.id}/children`, {
                method: 'GET',
                headers: getHeaders()
            });
            if (rowResponse.ok) {
                const rowData = await rowResponse.json() as any;
                const rows = rowData.results.map((r: any) =>
                    r.table_row?.cells?.map((c: any) => c?.[0]?.plain_text || '').join(' | ')
                ).join('\n');
                content = rows;
            }
        } else {
            content = b[type]?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        }
        results.push({ type, content });
    }

    logNotion(`SUCCESS Read Page ${pageId} - Blocks: ${results.length}`);
    return results;
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

export async function createPageOnPage(pageId: string, title: string, content: string) {
    const payload = {
        parent: { page_id: pageId },
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

export async function createDatabase(pageId: string, title: string) {
    const payload = {
        parent: {
            type: "page_id",
            page_id: pageId
        },
        title: [
            {
                type: "text",
                text: {
                    content: title
                }
            }
        ],
        properties: {
            "Name": {
                title: {}
            }
        }
    };

    const response = await fetch(`${NOTION_API_URL}/databases`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Notion API Error: ${response.statusText}`);
    return response.json();
}
