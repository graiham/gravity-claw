import * as cheerio from 'cheerio';
import axios from 'axios';

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
    console.log(`[Search] Querying DuckDuckGo for: ${query}`);
    try {
        const formData = new URLSearchParams();
        formData.append('q', query);

        const response = await axios.post('https://lite.duckduckgo.com/lite/', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const results: SearchResult[] = [];

        $('.result-snippet').each((i, element) => {
            if (i >= 5) return; // Top 5 results

            const tr = $(element).closest('tr');
            const urlRow = tr.prev();

            const titleElement = urlRow.find('a.result-snippet');
            const title = titleElement.text().trim();
            const url = titleElement.attr('href') || '';
            const snippet = $(element).text().trim();

            if (title && url) {
                results.push({ title, url, snippet });
            }
        });

        return results;
    } catch (err: any) {
        console.error(`[Search] Error: ${err.message}`);
        return [];
    }
}
