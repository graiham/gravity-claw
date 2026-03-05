import puppeteer from 'puppeteer';

async function runHealthCheck() {
    console.log('🚀 Starting Gravity Claw E2E Health Check...');

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log('--- Step 1: Connecting to WebChat ---');
        await page.goto('http://localhost:8765');
        await page.waitForSelector('input[type="text"]');
        console.log('✅ WebChat UI Loaded');

        console.log('--- Step 2: Testing Greeting & Persona ---');
        await page.type('input[type="text"]', 'Hi diagnostics');
        await page.keyboard.press('Enter');

        // Wait for a message with usage stats footer
        await page.waitForFunction(() => {
            const messages = document.querySelectorAll('.message-bubble');
            return Array.from(messages).some(m => m.textContent?.includes('[Model:'));
        }, { timeout: 15000 });

        const messages = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.message-bubble')).map(m => m.textContent);
        });

        console.log('🤖 Bot Reply:', messages[messages.length - 1]);
        console.log('✅ Basic Chat Working');

        console.log('--- Step 3: Persistence Check ---');
        const testSecret = `QA-TEST-${Date.now()}`;
        await page.type('input[type="text"]', `Remember this code: ${testSecret}`);
        await page.keyboard.press('Enter');
        await new Promise(res => setTimeout(res, 3000));

        console.log('♻️ Refreshing page to test DB persistence...');
        await page.reload();
        await page.waitForSelector('input[type="text"]');

        await page.type('input[type="text"]', 'What was my test code?');
        await page.keyboard.press('Enter');

        await page.waitForFunction((secret) => {
            const messages = document.querySelectorAll('.message-bubble');
            return Array.from(messages).some(m => m.textContent?.includes(secret));
        }, { timeout: 15000 }, testSecret);

        console.log('✅ Persistence Verified');
        console.log('🌟 Health Check PASSED');

    } catch (error: any) {
        console.error('❌ Health Check FAILED:', error.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runHealthCheck();
