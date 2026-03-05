import fs from 'fs/promises';
import path from 'path';

// Allowed directories for the bot to interact with.
// SECURITY: Do not allow the bot to read/write outside these boundaries.
const ALLOWED_DIRS = [
    '/Users/grahambrooks/.gemini/antigravity',
    '/Users/grahambrooks/Downloads',
    '/Users/grahambrooks/code'
];

function isAllowedPath(targetPath: string): boolean {
    const absolutePath = path.resolve(targetPath);
    return ALLOWED_DIRS.some(allowed => absolutePath.startsWith(allowed));
}

export async function readFileTool(filePath: string): Promise<string> {
    if (!isAllowedPath(filePath)) {
        throw new Error(`Access Denied: Path ${filePath} is not in the allowed directories.`);
    }

    // Check file size limit (e.g., 5MB)
    try {
        const stats = await fs.stat(filePath);
        if (stats.size > 5 * 1024 * 1024) {
            return `File too large context window (${(stats.size / 1024 / 1024).toFixed(2)}MB).`;
        }
        const data = await fs.readFile(filePath, 'utf-8');
        return data;
    } catch (err: any) {
        return `Failed to read file: ${err.message}`;
    }
}

export async function writeFileTool(filePath: string, content: string): Promise<string> {
    if (!isAllowedPath(filePath)) {
        throw new Error(`Access Denied: Path ${filePath} is not in the allowed directories.`);
    }

    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return `Successfully wrote to ${filePath}`;
    } catch (err: any) {
        return `Failed to write file: ${err.message}`;
    }
}

export async function listFilesTool(dirPath: string): Promise<string[]> {
    if (!isAllowedPath(dirPath)) {
        throw new Error(`Access Denied: Path ${dirPath} is not in the allowed directories.`);
    }

    try {
        const files = await fs.readdir(dirPath);
        return files;
    } catch (err: any) {
        throw new Error(`Failed to list directory: ${err.message}`);
    }
}
