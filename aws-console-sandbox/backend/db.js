// Thin persistence layer on top of SQLite (better-sqlite3, synchronous).
// Each resource type gets its own real SQL table with an indexed id column,
// plus a JSON "data" column for the resource body. This keeps the schema
// simple while still giving you a real, inspectable, on-disk database
// (see /app/data/sandbox.db) that survives container restarts.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const dbPath = path.join(DATA_DIR, 'sandbox.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const TABLES = [
  'vpcs', 'subnets', 'route_tables', 'igws', 'nat_gateways', 'eips',
  'security_groups', 'instances', 'volumes', 'keypairs', 'buckets',
  'load_balancers', 'target_groups', 'launch_templates', 'asgs', 'meta'
];

for (const t of TABLES) {
  db.prepare(`CREATE TABLE IF NOT EXISTS ${t} (
    id TEXT PRIMARY KEY,
    region TEXT,
    created_at TEXT NOT NULL,
    data TEXT NOT NULL
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_${t}_region ON ${t}(region)`).run();
}

function genId(prefix, len = 8) {
  const hex = require('crypto').randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
  return `${prefix}-${hex}`;
}

function table(name) {
  const insertStmt = db.prepare(`INSERT INTO ${name} (id, region, created_at, data) VALUES (?, ?, ?, ?)`);
  const updateStmt = db.prepare(`UPDATE ${name} SET data = ? WHERE id = ?`);
  const deleteStmt = db.prepare(`DELETE FROM ${name} WHERE id = ?`);
  const getStmt = db.prepare(`SELECT * FROM ${name} WHERE id = ?`);
  const allStmt = db.prepare(`SELECT * FROM ${name} ORDER BY created_at ASC`);
  const allByRegionStmt = db.prepare(`SELECT * FROM ${name} WHERE region = ? ORDER BY created_at ASC`);

  const parse = (row) => row ? { ...JSON.parse(row.data), id: row.id, region: row.region, createdAt: row.created_at } : null;

  return {
    all(region) {
      const rows = region ? allByRegionStmt.all(region) : allStmt.all();
      return rows.map(parse);
    },
    get(id) {
      return parse(getStmt.get(id));
    },
    insert(obj, { prefix, idLen, id } = {}) {
      const finalId = id || genId(prefix || name.slice(0, 3), idLen);
      const createdAt = new Date().toISOString();
      const body = { ...obj };
      delete body.id; delete body.region; delete body.createdAt;
      insertStmt.run(finalId, obj.region || null, createdAt, JSON.stringify(body));
      return this.get(finalId);
    },
    update(id, patchFn) {
      const current = this.get(id);
      if (!current) return null;
      const region = current.region, createdAt = current.createdAt;
      const next = patchFn({ ...current });
      const body = { ...next };
      delete body.id; delete body.region; delete body.createdAt;
      updateStmt.run(JSON.stringify(body), id);
      return this.get(id);
    },
    remove(id) {
      deleteStmt.run(id);
    }
  };
}

module.exports = { db, table, genId };
