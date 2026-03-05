import { config } from '../src/config.js';

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json() as any;
        console.log("Available Models:");
        if (data.models) {
            data.models.forEach((m: any) => console.log(` - ${m.name}`));
        } else {
            console.log("No models returned. Error:", JSON.stringify(data, null, 2));
        }
    } catch (err: any) {
        console.error("Fetch fail:", err.message);
    }
}

listModels();
