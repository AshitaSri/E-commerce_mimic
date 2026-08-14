const Database = require('better-sqlite3');
const path = require('path');

function openDb(filename, schemaSql) {
  const dbPath = path.join(process.cwd(), filename);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  if (schemaSql) db.exec(schemaSql);
  return db;
}

module.exports = { openDb };
