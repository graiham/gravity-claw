import { config } from './config.js';

const GITHUB_API_URL = 'https://api.github.com';

function getHeaders() {
    return {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${config.GITHUB_API_TOKEN}`,
        'User-Agent': 'GravityClaw-StudioAgent'
    };
}

export async function createRepo(name: string, description: string) {
    const response = await fetch(`${GITHUB_API_URL}/user/repos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, description, auto_init: true })
    });
    if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
    return response.json();
}

export async function listRepos() {
    const response = await fetch(`${GITHUB_API_URL}/user/repos?sort=updated&per_page=10`, {
        method: 'GET',
        headers: getHeaders()
    });
    if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
    return response.json();
}

export async function createBranch(ownerRepo: string, newBranchName: string) {
    let refResponse = await fetch(`${GITHUB_API_URL}/repos/${ownerRepo}/git/refs/heads/main`, { headers: getHeaders() });
    if (!refResponse.ok) {
        refResponse = await fetch(`${GITHUB_API_URL}/repos/${ownerRepo}/git/refs/heads/master`, { headers: getHeaders() });
    }
    const refData = await refResponse.json();
    const sha = refData.object.sha;

    const postResponse = await fetch(`${GITHUB_API_URL}/repos/${ownerRepo}/git/refs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            ref: `refs/heads/${newBranchName}`,
            sha: sha
        })
    });

    if (!postResponse.ok) throw new Error(`GitHub API Error: ${postResponse.statusText}`);
    return postResponse.json();
}

export async function createPullRequest(ownerRepo: string, title: string, head: string, base: string, body: string) {
    const response = await fetch(`${GITHUB_API_URL}/repos/${ownerRepo}/pulls`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ title, head, base, body })
    });
    if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
    return response.json();
}
