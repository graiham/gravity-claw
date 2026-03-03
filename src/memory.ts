import Database from 'better-sqlite3';

const db = new Database('gravity-claw.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    category,
    content,
    content='memories',
    content_rowid='id'
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, category, content) VALUES (new.id, new.category, new.content);
  END;

  -- Stats tracking
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_tokens INTEGER DEFAULT 0,
    total_cost_gbp REAL DEFAULT 0.0
  );
  INSERT OR IGNORE INTO stats (id, total_tokens, total_cost_gbp) VALUES (1, 0, 0.0);
`);

export function recordUsage(tokens: number, costGbp: number) {
  const stmt = db.prepare('UPDATE stats SET total_tokens = total_tokens + ?, total_cost_gbp = total_cost_gbp + ? WHERE id = 1');
  stmt.run(tokens, costGbp);
}

export function getUsageStats(): { total_tokens: number, total_cost_gbp: number } {
  const stmt = db.prepare('SELECT total_tokens, total_cost_gbp FROM stats WHERE id = 1');
  const result = stmt.get() as any;
  return result || { total_tokens: 0, total_cost_gbp: 0 };
}

export function storeMemory(category: string, content: string) {
  const stmt = db.prepare('INSERT INTO memories (category, content) VALUES (?, ?)');
  const info = stmt.run(category, content);
  return { id: info.lastInsertRowid };
}

export function searchMemory(query: string) {
  const stmt = db.prepare(`
        SELECT m.category, m.content, m.timestamp 
        FROM memories m
        JOIN memories_fts f ON m.id = f.rowid
        WHERE memories_fts MATCH ?
        ORDER BY rank
    `);

  let results = stmt.all(query);

  // Fallback if no exact FTS match
  if (results.length === 0) {
    const fallbackStmt = db.prepare('SELECT category, content, timestamp FROM memories WHERE content LIKE ? OR category LIKE ? ORDER BY timestamp DESC LIMIT 5');
    results = fallbackStmt.all(`%${query}%`, `%${query}%`);
  }

  return results;
}
