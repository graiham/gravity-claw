import { ITool } from './types.js';
import * as memory from '../memory.js';
import * as workflow from '../workflow.js';
import * as comms from '../comms.js';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

export const CoreTools: ITool[] = [
    {
        id: 'get_current_time',
        name: 'Get Current Time',
        version: '1.0.0',
        definition: { name: 'get_current_time', description: 'Get the current ISO timestamp.' },
        execute: async () => ({ time: new Date().toISOString() })
    },
    {
        id: 'mesh_workflow',
        name: 'Mesh Workflow',
        version: '1.0.0',
        definition: {
            name: 'mesh_workflow',
            description: 'Decompose a complex goal into subtasks.',
            parameters: { type: 'object', properties: { goal: { type: 'string' } }, required: ['goal'] }
        },
        execute: async (args) => await workflow.decomposeGoal(args.goal)
    },
    {
        id: 'browse_web',
        name: 'Browser Automation',
        version: '1.0.0',
        definition: {
            name: 'browse_web',
            description: 'Navigate to a URL and extract text content using a headless browser.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The fully qualified URL to visit.' },
                    action: { type: 'string', enum: ['extract_text', 'screenshot'], description: 'The action to perform.' }
                },
                required: ['url']
            }
        },
        execute: async (args) => {
            const { browseWeb } = await import('./browser.js');
            return { content: await browseWeb(args.url, args.action) };
        }
    },
    {
        id: 'send_notification',
        name: 'Send Notification',
        version: '1.0.0',
        definition: {
            name: 'send_notification',
            description: 'Send a native macOS system notification.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'The notification title' },
                    message: { type: 'string', description: 'The notification body' }
                },
                required: ['title', 'message']
            }
        },
        execute: async (args) => {
            const { exec } = await import('child_process');
            const cmd = `osascript -e 'display notification "${args.message.replace(/"/g, '\\"')}" with title "${args.title.replace(/"/g, '\\"')}"'`;
            exec(cmd);
            return { content: 'Notification sent.' };
        }
    },
    {
        id: 'web_search',
        name: 'Web Search',
        version: '1.0.0',
        definition: {
            name: 'web_search',
            description: 'Search the web for information using a search engine.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query.' }
                },
                required: ['query']
            }
        },
        execute: async (args) => {
            const { searchWeb } = await import('./search.js');
            return { results: await searchWeb(args.query) };
        }
    },
    {
        id: 'file_read',
        name: 'File Read',
        version: '1.0.0',
        definition: {
            name: 'file_read',
            description: 'Read the contents of a local file.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Absolute path to the file' }
                },
                required: ['filePath']
            }
        },
        execute: async (args) => {
            const { readFileTool } = await import('./fs.js');
            return { content: await readFileTool(args.filePath) };
        }
    },
    {
        id: 'file_write',
        name: 'File Write',
        version: '1.0.0',
        definition: {
            name: 'file_write',
            description: 'Write content to a local file. Useful for fixing code.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Absolute path to the file' },
                    content: { type: 'string', description: 'Complete file content to write' }
                },
                required: ['filePath', 'content']
            }
        },
        execute: async (args) => {
            const { writeFileTool } = await import('./fs.js');
            return { result: await writeFileTool(args.filePath, args.content) };
        }
    },
    {
        id: 'file_list',
        name: 'List Directory',
        version: '1.0.0',
        definition: {
            name: 'file_list',
            description: 'List the contents of a directory.',
            parameters: {
                type: 'object',
                properties: {
                    dirPath: { type: 'string', description: 'Absolute path to the directory' }
                },
                required: ['dirPath']
            }
        },
        execute: async (args) => {
            const { listFilesTool } = await import('./fs.js');
            return { files: await listFilesTool(args.dirPath) };
        }
    },
    {
        id: 'shell_exec',
        name: 'Shell Exec',
        version: '1.0.0',
        definition: {
            name: 'shell_exec',
            description: 'Execute a shell command (e.g., npm run build, grep, ls). Returns stdout and stderr.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The shell command to run' },
                    cwd: { type: 'string', description: 'Absolute path to the working directory' }
                },
                required: ['command', 'cwd']
            }
        },
        execute: async (args) => {
            const { runShellCommand } = await import('./shell.js');
            return { out: await runShellCommand(args.command, args.cwd) };
        }
    }
];
