import { SchemaType } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const AGTools = [
    {
        name: 'ag_read_latest',
        description: 'Read the most recent conversation logs from the Antigravity instance to see what AG is doing or asking.',
        parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
        name: 'ag_send_message',
        description: 'Send a message to the Antigravity AI. IMPORTANT: The user must have the Antigravity input box focused. This tool uses AppleScript to type the message into the active window.',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                message: { type: SchemaType.STRING, description: 'The message or code feedback to send to AG.' }
            },
            required: ['message']
        }
    },
    {
        name: 'ag_wait',
        description: 'Wait for a specified number of seconds before proceeding. Useful when you have asked AG to do something and need to wait for it to finish generating code.',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                seconds: { type: SchemaType.NUMBER, description: 'Number of seconds to wait (max 600)' }
            },
            required: ['seconds']
        }
    },
    {
        name: 'ag_listen',
        description: 'Wait in listening mode for up to a specified number of seconds. It monitors the AG logs and automatically returns the new logs as soon as AG finishes its response.',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                timeout_seconds: { type: SchemaType.NUMBER, description: 'Max time to wait for a response (e.g. 600)' }
            },
            required: ['timeout_seconds']
        }
    },
    {
        name: 'ag_get_project_structure',
        description: 'Get a list of files and directories within a specified path in the AG environment.',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                path: { type: SchemaType.STRING, description: 'The absolute or relative directory path to list (defaults to ".")' }
            }
        }
    },
    {
        name: 'ag_read_file',
        description: 'Read the contents of a file within the AG environment.',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                filePath: { type: SchemaType.STRING, description: 'The absolute or relative path to the file' }
            },
            required: ['filePath']
        }
    }
];

export async function agReadLatest() {
    const logPath = path.join(process.cwd(), 'ag_response.log');

    if (!fs.existsSync(logPath)) {
        return { error: `No recent messages from AG found in buffer.` };
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const tail = content.slice(-3000);

    return {
        session: 'active-buffer',
        recent_logs: tail
    };
}

export async function agSendMessage(message: string) {
    // Escape quotes and backslashes for AppleScript
    const escapedMessage = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const script = `
        set theClipboard to "${escapedMessage}"
        set the clipboard to theClipboard
        tell application "System Events"
            keystroke "v" using command down
            delay 0.5
            keystroke return
        end tell
    `;

    try {
        await execAsync(`osascript -e '${script}'`);
        return { success: true, message: 'Successfully pasted and sent message to active window.' };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function agWait(seconds: number) {
    const waitTime = Math.min(seconds, 600) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return { success: true, message: `Waited for ${seconds} seconds.` };
}

export async function agListen(timeoutSeconds: number) {
    const logPath = path.join(process.cwd(), 'ag_response.log');

    // Create it if it doesn't exist so we can monitor it
    if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, 'AG listener initialized...\n');
    }

    let lastSize = fs.statSync(logPath).size;
    let timeWithoutChange = 0;
    let hasChanged = false;

    const startTime = Date.now();
    const timeout = Math.min(timeoutSeconds, 900) * 1000;

    while (Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 2000)); // check every 2 seconds

        try {
            const currentSize = fs.statSync(logPath).size;
            if (currentSize !== lastSize) {
                // File has changed, read it to see if it has the DONE signal
                const content = fs.readFileSync(logPath, 'utf8');
                if (content.includes('[AG_DONE]')) {
                    hasChanged = true;
                    break;
                }

                // Fallback: If it changes but doesn't have DONE, use a 10s wait
                hasChanged = true;
                timeWithoutChange = 0;
                lastSize = currentSize;
            } else if (hasChanged) {
                timeWithoutChange += 2000;
                if (timeWithoutChange >= 10000) { // Stabilized for 10 seconds as a fallback
                    break;
                }
            }
        } catch (err) {
            // file might be temporarily unreadable
        }
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const tail = content.slice(-4000);

    return {
        event: hasChanged ? "AG finished responding" : "Timeout reached without detecting new complete response",
        recent_logs: tail
    };
}

export async function agGetProjectStructure(dirPath: string = ".") {
    try {
        const fullPath = path.resolve(process.cwd(), dirPath);
        if (!fs.existsSync(fullPath)) {
            return { error: `Path not found: ${fullPath}` };
        }

        const stats = fs.statSync(fullPath);
        if (!stats.isDirectory()) {
            return { error: `Path is not a directory: ${fullPath}` };
        }

        const items = fs.readdirSync(fullPath).map(file => {
            const absolutePath = path.join(fullPath, file);
            try {
                const stat = fs.statSync(absolutePath);
                return {
                    name: file,
                    type: stat.isDirectory() ? 'directory' : 'file',
                    size: stat.size
                };
            } catch (e) {
                return { name: file, type: 'unknown' };
            }
        });

        return {
            path: fullPath,
            contents: items
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

export async function agReadFile(filePath: string) {
    try {
        const fullPath = path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(fullPath)) {
            return { error: `File not found: ${fullPath}` };
        }

        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            return { error: `Path is a directory, not a file: ${fullPath}` };
        }

        // read the file as text
        const content = fs.readFileSync(fullPath, 'utf8');
        return {
            path: fullPath,
            content: content
        };
    } catch (err: any) {
        return { error: err.message };
    }
}
