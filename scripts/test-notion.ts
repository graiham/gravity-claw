import { config } from '../src/config.js';
import * as notion from '../src/notion.js';

async function testNotion() {
    console.log('Testing Notion Token:', config.NOTION_API_TOKEN.substring(0, 8) + '...');
    try {
        console.log('--- Searching for "CRM" or "Château" ---');
        const results = await notion.searchNotion('');
        console.log('✅ Visible Pages:', JSON.stringify(results, null, 2));
    } catch (err: any) {
        console.error('❌ Notion Error:', err.message);
    }
}

testNotion();
