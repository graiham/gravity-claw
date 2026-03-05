const notion = require('../dist/notion.js');
const { config } = require('../dist/config.js');

async function testNotion() {
    console.log('Testing Notion Token:', config.NOTION_API_TOKEN.substring(0, 8) + '...');
    try {
        console.log('--- Searching for visible items ---');
        const results = await notion.searchNotion('');
        console.log('✅ Visible Items Found:', results.length);
        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('❌ Notion Error:', err.message);
    }
}

testNotion();
