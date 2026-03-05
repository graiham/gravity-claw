import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

// Allowed commands blocklist/allowlist logic
const BLOCKED_COMMANDS = ['rm -rf /', 'mkfs', 'shutdown', 'reboot'];

// Allowed working directories
const ALLOWED_CWD = [
    '/Users/grahambrooks/.gemini/antigravity',
    '/Users/grahambrooks/Downloads',
    '/Users/grahambrooks/code'
];

function isAllowedCwd(targetPath: string): boolean {
    const absolutePath = path.resolve(targetPath);
    return ALLOWED_CWD.some(allowed => absolutePath.startsWith(allowed));
}

export async function runShellCommand(command: string, cwd: string = '/Users/grahambrooks/.gemini/antigravity/scratch/gravity-claw'): Promise<{ stdout: string, stderr: string }> {
    // Security Checks
    for (const blocked of BLOCKED_COMMANDS) {
        if (command.includes(blocked)) {
            throw new Error(`Security Violation: Command contains blocked keywords (${blocked}).`);
        }
    }

    if (!isAllowedCwd(cwd)) {
        throw new Error(`Access Denied: CWD ${cwd} is not in the allowed directories whitelist.`);
    }

    console.log(`[Shell] Executing: ${command} in ${cwd}`);

    try {
        // Enforce a strict timeout of 30 seconds
        const { stdout, stderr } = await execAsync(command, {
            cwd,
            timeout: 30000
        });

        return {
            stdout: stdout.substring(0, 4000),
            stderr: stderr.substring(0, 4000)
        };
    } catch (err: any) {
        return {
            stdout: err.stdout ? err.stdout.substring(0, 4000) : "",
            stderr: err.stderr ? err.stderr.substring(0, 4000) : err.message
        };
    }
}
