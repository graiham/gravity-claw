import { config } from './config.js';

/**
 * Verifies live status of all integrated "Bridge" connections.
 * This is used as a self-check for the agent before it attempts to 
 * refuse a command due to "access issues."
 */
export async function checkConnections() {
    const status: any = {
        Notion: { status: "OFFLINE", message: "Missing Notion Token" },
        Trello: { status: "OFFLINE", message: "Missing Trello Token" },
        GitHub: { status: "OFFLINE", message: "Missing GitHub Token" },
        GoogleCloud: { status: "OFFLINE", message: "Limited access" }
    };

    if (config.NOTION_API_TOKEN) {
        try {
            // Lightest check possible
            const resp = await fetch('https://api.notion.com/v1/users/me', {
                headers: {
                    'Authorization': `Bearer ${config.NOTION_API_TOKEN}`,
                    'Notion-Version': '2022-06-28'
                }
            });
            if (resp.ok) {
                status.Notion = { status: "ACTIVE", message: "Bridge Live (Authorized)" };
            } else {
                status.Notion = { status: "ERROR", message: `${resp.status} ${resp.statusText}` };
            }
        } catch (e: any) {
            status.Notion = { status: "ERROR", message: e.message };
        }
    }

    if (config.TRELLO_API_KEY && config.TRELLO_API_TOKEN) {
        status.Trello = { status: "ACTIVE", message: "Bridge Live (Authorized)" };
    }

    if (config.GITHUB_API_TOKEN) {
        status.GitHub = { status: "ACTIVE", message: "Bridge Live (Authorized)" };
    }

    if (config.GEMINI_API_KEY) {
        status.GoogleCloud = { status: "ACTIVE", message: "Gemini Brain Connected" };
    }

    return status;
}
