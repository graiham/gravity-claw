import { config } from './config.js';

const TRELLO_API_URL = 'https://api.trello.com/1';

function getAuthParams() {
    return `key=${config.TRELLO_API_KEY}&token=${config.TRELLO_API_TOKEN}`;
}

export async function getBoards() {
    const response = await fetch(`${TRELLO_API_URL}/members/me/boards?${getAuthParams()}`);
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function getListsOnBoard(boardId: string) {
    const response = await fetch(`${TRELLO_API_URL}/boards/${boardId}/lists?${getAuthParams()}`);
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function getCardsInList(listId: string) {
    const response = await fetch(`${TRELLO_API_URL}/lists/${listId}/cards?${getAuthParams()}`);
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function createCard(listId: string, name: string, desc: string) {
    const response = await fetch(`${TRELLO_API_URL}/cards?idList=${listId}&name=${encodeURIComponent(name)}&desc=${encodeURIComponent(desc)}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function addCommentToCard(cardId: string, text: string) {
    const response = await fetch(`${TRELLO_API_URL}/cards/${cardId}/actions/comments?text=${encodeURIComponent(text)}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function moveCard(cardId: string, newListId: string) {
    const response = await fetch(`${TRELLO_API_URL}/cards/${cardId}?idList=${newListId}&${getAuthParams()}`, {
        method: 'PUT'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}
export async function createBoard(name: string) {
    const response = await fetch(`${TRELLO_API_URL}/boards/?name=${encodeURIComponent(name)}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function createList(boardId: string, name: string) {
    const response = await fetch(`${TRELLO_API_URL}/lists?name=${encodeURIComponent(name)}&idBoard=${boardId}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function updateCard(cardId: string, data: { name?: string, desc?: string }) {
    let url = `${TRELLO_API_URL}/cards/${cardId}?${getAuthParams()}`;
    if (data.name) url += `&name=${encodeURIComponent(data.name)}`;
    if (data.desc) url += `&desc=${encodeURIComponent(data.desc)}`;

    const response = await fetch(url, { method: 'PUT' });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function addLabelToCard(cardId: string, labelId: string) {
    const response = await fetch(`${TRELLO_API_URL}/cards/${cardId}/idLabels?value=${labelId}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function createLabelOnBoard(boardId: string, name: string, color: string) {
    const response = await fetch(`${TRELLO_API_URL}/boards/${boardId}/labels?name=${encodeURIComponent(name)}&color=${color}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function getBoardLabels(boardId: string) {
    const response = await fetch(`${TRELLO_API_URL}/boards/${boardId}/labels?${getAuthParams()}`);
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function createChecklist(cardId: string, name: string) {
    const response = await fetch(`${TRELLO_API_URL}/cards/${cardId}/checklists?name=${encodeURIComponent(name)}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function createCheckItem(checklistId: string, name: string) {
    const response = await fetch(`${TRELLO_API_URL}/checklists/${checklistId}/checkItems?name=${encodeURIComponent(name)}&${getAuthParams()}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function updateList(listId: string, name: string) {
    const response = await fetch(`${TRELLO_API_URL}/lists/${listId}?name=${encodeURIComponent(name)}&${getAuthParams()}`, {
        method: 'PUT'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function moveList(listId: string, boardId: string, pos?: string | number) {
    let url = `${TRELLO_API_URL}/lists/${listId}/idBoard?value=${boardId}&${getAuthParams()}`;
    if (pos) url += `&pos=${pos}`;
    const response = await fetch(url, { method: 'PUT' });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function updateBoard(boardId: string, name: string) {
    const response = await fetch(`${TRELLO_API_URL}/boards/${boardId}?name=${encodeURIComponent(name)}&${getAuthParams()}`, {
        method: 'PUT'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function moveCardToBoard(cardId: string, boardId: string, listId: string) {
    const response = await fetch(`${TRELLO_API_URL}/cards/${cardId}?idBoard=${boardId}&idList=${listId}&${getAuthParams()}`, {
        method: 'PUT'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function reorderList(listId: string, pos: string | number) {
    const response = await fetch(`${TRELLO_API_URL}/lists/${listId}/pos?value=${pos}&${getAuthParams()}`, {
        method: 'PUT'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}

export async function reorderCard(cardId: string, pos: string | number) {
    const response = await fetch(`${TRELLO_API_URL}/cards/${cardId}/pos?value=${pos}&${getAuthParams()}`, {
        method: 'PUT'
    });
    if (!response.ok) throw new Error(`Trello API Error: ${response.statusText}`);
    return response.json();
}
