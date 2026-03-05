import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../src/config.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

async function checkModels() {
    try {
        console.log("Checking available Gemini models...");
        // List models is not directly on the SDK but on the API. 
        // We can just try a few known ones or fetch them.
        const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-1.5-pro-latest", "gemini-2.0-flash-exp", "gemini-2.0-flash-lite-preview-02-05"];
        for (const m of models) {
            try {
                console.log(`\nTesting ${m}...`);
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("test");
                console.log(` ✅ Model ${m} is available and responsive.`);

                // Test multimodal too
                try {
                    console.log(`  🔍 Testing Multimodal/Audio capability for ${m}...`);
                    const multiResult = await model.generateContent([
                        { text: "Say 'Hello'" },
                        { inlineData: { mimeType: "audio/ogg", data: "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh" } }
                    ]);
                    console.log(`  ✅ Multimodal SUCCESS for ${m}`);
                } catch (multiErr: any) {
                    console.log(`  ❌ Multimodal FAIL for ${m}: ${multiErr.message}`);
                }
            } catch (err: any) {
                console.log(` ❌ Model ${m} general fail: ${err.message}`);
            }
        }
    } catch (err: any) {
        console.error("Critical error check:", err.message);
    }
}

checkModels();
