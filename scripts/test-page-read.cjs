const notion = require('../dist/notion.js');
const { config } = require('../dist/config.js');

async function testNotion() {
    const pageId = '318a1278-f9d8-8077-adf8-ffd561efb3be';
    console.log('--- Reading Page Content:', pageId, '---');
    try {
        const results = await notion.readPage(pageId);
        console.log('✅ Content Blocks Found:', results.length);
        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('❌ Notion Error:', err.message);
    }
}

testNotion();
