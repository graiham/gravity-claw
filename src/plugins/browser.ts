import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

// Ensure puppeteer finds the downloaded Chromium
process.env.PUPPETEER_CACHE_DIR = '/tmp/puppeteer';

export async function browseWeb(url: string, action: 'extract_text' | 'screenshot' = 'extract_text'): Promise<string> {
    const timeout = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Browser automation timed out (30s)')), 30000);
    });

    const execution = (async (): Promise<string> => {
        console.log(`[Browser] Launching browser for: ${url} (Action: ${action})`);
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

            if (action === 'extract_text') {
                const text = await page.evaluate(() => {
                    document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
                    return document.body.innerText;
                });
                return text.substring(0, 4000);
            }

            if (action === 'screenshot') {
                const fileName = `screenshot_${Date.now()}.png`;
                const filePath = path.join(process.cwd(), 'screenshots', fileName);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await page.screenshot({ path: filePath, fullPage: true });
                return `Screenshot saved to ${filePath}. Use this for visual comparison.`;
            }
            return "Action completed.";
        } finally {
            if (browser) await browser.close();
        }
    })();

    try {
        return await Promise.race([execution, timeout]);
    } catch (err: any) {
        console.error(`[Browser] Error: ${err.message}`);
        return `Failed to browse ${url}: ${err.message}`;
    }
}
