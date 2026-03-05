import { getBoards } from './dist/trello.js';

async function main() {
    try {
        const boards = await getBoards();
        console.log('Available Trello Boards:');
        console.log(JSON.stringify(boards, null, 2));
    } catch (err) {
        console.error('Error fetching Trello boards:', err.message);
    }
}

main();
