import { config } from './config.js';

export async function generateOpenRouterCompletion(
    prompt: string,
    modelName: string = 'openai/gpt-4o'
): Promise<{ content: string, usage: any }> {
    if (!config.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://gravityclaw.ai',
            'X-Title': 'Gravity Claw Agent'
        },
        body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API Error: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return {
        content: data.choices[0].message.content,
        usage: data.usage // contains prompt_tokens, completion_tokens, total_tokens
    };
}
