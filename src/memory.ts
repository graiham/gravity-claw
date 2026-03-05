import Database from 'better-sqlite3';

const db = new Database('gravity-claw.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT,
    fact TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    category,
    content,
    content='memories',
    content_rowid='id'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
    entity,
    fact,
    content='facts',
    content_rowid='id'
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, category, content) VALUES (new.id, new.category, new.content);
  END;

  CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
    INSERT INTO facts_fts(rowid, entity, fact) VALUES (new.id, new.entity, new.fact);
  END;

  -- Knowledge Graph
  CREATE TABLE IF NOT EXISTS triples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT,
    predicate TEXT,
    object TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS triples_fts USING fts5(
    subject,
    predicate,
    object,
    content='triples',
    content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS triples_ai AFTER INSERT ON triples BEGIN
    INSERT INTO triples_fts(rowid, subject, predicate, object) VALUES (new.id, new.subject, new.predicate, new.object);
  END;

  CREATE TABLE IF NOT EXISTS conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5(
    content,
    content='conversation_history',
    content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS conversation_ai AFTER INSERT ON conversation_history BEGIN
    INSERT INTO conversation_fts(rowid, content) VALUES (new.id, new.content);
  END;

  -- Multimodal Assets
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'image', 'audio', 'video', 'document'
    path TEXT,
    description TEXT,
    original_name TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    type,
    description,
    original_name,
    content='assets',
    content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, type, description, original_name) VALUES (new.id, new.type, new.description, new.original_name);
  END;

  -- Stats tracking
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_tokens INTEGER DEFAULT 0,
    total_cost_gbp REAL DEFAULT 0.0
  );
  INSERT OR IGNORE INTO stats (id, total_tokens, total_cost_gbp) VALUES (1, 0, 0.0);
  -- Agent-to-Agent Comms
  CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES agent_sessions(id)
  );

  -- Mesh Workflows
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    goal TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT,
    description TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, FAILED
    result TEXT,
    order_index INTEGER,
    FOREIGN KEY(workflow_id) REFERENCES workflows(id)
  );
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
export function storeFact(entity: string, fact: string) {
  const stmt = db.prepare('INSERT INTO facts (entity, fact) VALUES (?, ?)');
  const info = stmt.run(entity, fact);
  return { id: info.lastInsertRowid };
}

export function searchFacts(query: string) {
  const stmt = db.prepare(`
        SELECT f.entity, f.fact 
        FROM facts f
        JOIN facts_fts ft ON f.id = ft.rowid
        WHERE facts_fts MATCH ?
        ORDER BY rank
        LIMIT 5
    `);
  return stmt.all(query);
}

export function setPreference(key: string, value: string) {
  const stmt = db.prepare('INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  stmt.run(key, value);
  return { success: true };
}

export function getPreferences() {
  const stmt = db.prepare('SELECT key, value FROM preferences');
  return stmt.all();
}
export function markAccess(table: 'memories' | 'facts' | 'triples', id: number) {
  const stmt = db.prepare(`UPDATE ${table} SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1 WHERE id = ?`);
  stmt.run(id);
}

export function cleanOldMemories(days: number = 30) {
  // Logic to archive or delete memories not accessed in X days and with low access count
  const stmt = db.prepare(`DELETE FROM memories WHERE last_accessed < datetime('now', '-${days} days') AND access_count < 2`);
  const info = stmt.run();
  return { deletedCount: info.changes };
}

export function storeTriple(subject: string, predicate: string, object: string) {
  const stmt = db.prepare('INSERT INTO triples (subject, predicate, object) VALUES (?, ?, ?)');
  const info = stmt.run(subject, predicate, object);
  return { id: info.lastInsertRowid };
}

export function queryGraph(query: string) {
  const stmt = db.prepare(`
        SELECT t.subject, t.predicate, t.object 
        FROM triples t
        JOIN triples_fts tf ON t.id = tf.rowid
        WHERE triples_fts MATCH ?
        ORDER BY timestamp DESC
        LIMIT 10
    `);
  return stmt.all(query);
}

export function storeAsset(type: string, path: string, description: string, originalName?: string) {
  const stmt = db.prepare('INSERT INTO assets (type, path, description, original_name) VALUES (?, ?, ?, ?)');
  const info = stmt.run(type, path, description, originalName || '');
  return { id: info.lastInsertRowid };
}

export function searchAssets(query: string) {
  const stmt = db.prepare(`
        SELECT a.type, a.path, a.description, a.original_name 
        FROM assets a
        JOIN assets_fts af ON a.id = af.rowid
        WHERE assets_fts MATCH ?
        ORDER BY timestamp DESC
        LIMIT 5
    `);
  return stmt.all(query);
}

// Agent Comms Functions
export function createAgentSession(id: string, name: string) {
  const stmt = db.prepare('INSERT INTO agent_sessions (id, name) VALUES (?, ?)');
  return stmt.run(id, name);
}

export function listAgentSessions() {
  const stmt = db.prepare('SELECT * FROM agent_sessions');
  return stmt.all();
}

export function storeAgentMessage(sessionId: string, role: string, content: string) {
  const stmt = db.prepare('INSERT INTO agent_messages (session_id, role, content) VALUES (?, ?, ?)');
  return stmt.run(sessionId, role, content);
}

export function getAgentSessionHistory(sessionId: string) {
  const stmt = db.prepare('SELECT role, content, timestamp FROM agent_messages WHERE session_id = ? ORDER BY timestamp ASC');
  return stmt.all(sessionId);
}

// Workflow Functions
export function createWorkflow(id: string, goal: string) {
  const stmt = db.prepare('INSERT INTO workflows (id, goal) VALUES (?, ?)');
  return stmt.run(id, goal);
}

export function updateWorkflowStatus(id: string, status: string) {
  const stmt = db.prepare('UPDATE workflows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  return stmt.run(status, id);
}

export function addSubtask(workflowId: string, description: string, orderIndex: number) {
  const stmt = db.prepare('INSERT INTO subtasks (workflow_id, description, order_index) VALUES (?, ?, ?)');
  return stmt.run(workflowId, description, orderIndex);
}
export function storeConversationTurn(chatId: string, role: string, parts: any[]) {
  const content = JSON.stringify(parts);
  const stmt = db.prepare('INSERT INTO conversation_history (chat_id, role, content) VALUES (?, ?, ?)');
  return stmt.run(chatId, role, content);
}

export function getConversationHistory(chatId: string, limit: number = 30) {
  const stmt = db.prepare('SELECT role, content FROM conversation_history WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ?');
  const rows = stmt.all(chatId, limit) as any[];
  // Reverse to get chronological order, and parse parts
  return rows.reverse().map(r => ({ role: r.role, parts: JSON.parse(r.content) }));
}

export function searchConversation(query: string) {
  const stmt = db.prepare(`
        SELECT c.chat_id, c.role, c.content, c.timestamp 
        FROM conversation_history c
        JOIN conversation_fts f ON c.id = f.rowid
        WHERE conversation_fts MATCH ?
        ORDER BY rank
        LIMIT 10
    `);
  return stmt.all(query);
}

export function updateSubtask(id: number, status: string, result?: string) {
  const stmt = db.prepare('UPDATE subtasks SET status = ?, result = ? WHERE id = ?');
  return stmt.run(status, result || null, id);
}

export function getWorkflow(id: string) {
  const workflowStmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
  const subtasksStmt = db.prepare('SELECT * FROM subtasks WHERE workflow_id = ? ORDER BY order_index ASC');
  return {
    ...workflowStmt.get(id) as any,
    subtasks: subtasksStmt.all(id)
  };
}

export function listWorkflows() {
  return db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all();
}
