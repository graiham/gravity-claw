export interface IPlugin {
    id: string;
    name: string;
    version: string;
}

export interface ILLMProvider extends IPlugin {
    generateResponse(prompt: string, history: any[]): Promise<{ content: string; usage?: any }>;
    generateCompletion(prompt: string, model?: string): Promise<{ content: string; usage?: any }>;
}

export interface ITool extends IPlugin {
    definition: any;
    execute(args: any): Promise<any>;
}

export interface IChannel extends IPlugin {
    sendMessage(chatId: string, text: string): Promise<void>;
    onMessage(callback: (msg: any) => Promise<void>): void;
}

export interface IMemoryProvider extends IPlugin {
    store(key: string, value: any): Promise<void>;
    retrieve(query: string): Promise<any>;
}
