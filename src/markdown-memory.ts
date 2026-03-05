import fs from 'fs';
import path from 'path';

const MEMORIES_DIR = path.resolve(process.cwd(), 'memories');

if (!fs.existsSync(MEMORIES_DIR)) {
    fs.mkdirSync(MEMORIES_DIR, { recursive: true });
}

export function syncToMarkdown(key: string, value: string, category: 'preference' | 'fact') {
    const fileName = category === 'preference' ? 'preferences.md' : `${key.toLowerCase().replace(/\s+/g, '_')}.md`;
    const filePath = path.join(MEMORIES_DIR, fileName);

    let content = '';
    if (category === 'preference') {
        // For preferences, we maintain a single file
        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
        }

        const lines = content.split('\n');
        const newLines = lines.filter(line => !line.startsWith(`- **${key}**:`));
        newLines.push(`- **${key}**: ${value}`);
        content = newLines.join('\n').trim() + '\n';
    } else {
        // For facts, we create/update individual files or an entity file
        content = `# ${key}\n\n- ${value}\n\n*Last Updated: ${new Date().toISOString()}*\n`;
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

export function initializeMarkdownMirror(prefs: { key: string, value: string }[]) {
    const filePath = path.join(MEMORIES_DIR, 'preferences.md');
    let content = '# User Preferences\n\n';
    prefs.forEach(p => {
        content += `- **${p.key}**: ${p.value}\n`;
    });
    fs.writeFileSync(filePath, content, 'utf8');
}
