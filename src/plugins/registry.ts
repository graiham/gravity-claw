import { ILLMProvider, ITool, IChannel, IMemoryProvider } from './types.js';

class PluginRegistry {
    private providers: Map<string, ILLMProvider> = new Map();
    private tools: Map<string, ITool> = new Map();
    private channels: Map<string, IChannel> = new Map();
    private memoryProviders: Map<string, IMemoryProvider> = new Map();

    registerProvider(p: ILLMProvider) { this.providers.set(p.id, p); }
    registerTool(t: ITool) { this.tools.set(t.id, t); }
    registerChannel(c: IChannel) { this.channels.set(c.id, c); }
    registerMemoryProvider(m: IMemoryProvider) { this.memoryProviders.set(m.id, m); }

    getProvider(id: string) { return this.providers.get(id); }
    getTool(id: string) { return this.tools.get(id); }
    getChannel(id: string) { return this.channels.get(id); }
    getMemoryProvider(id: string) { return this.memoryProviders.get(id); }

    getAllTools() { return Array.from(this.tools.values()); }
}

export const registry = new PluginRegistry();
