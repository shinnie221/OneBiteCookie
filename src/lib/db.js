import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'onebite.db');
let _db = null;

export async function getDb() {
  if (_db) return _db;

  const SQL = await initSqlJs();

  // Ensure directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  // Create tables
  _db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 1,
      image TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      customer_id INTEGER DEFAULT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      order_type TEXT NOT NULL DEFAULT 'pickup',
      address TEXT DEFAULT '',
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      voucher_code TEXT DEFAULT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_screenshot TEXT DEFAULT NULL,
      order_status TEXT NOT NULL DEFAULT 'pending_verification',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL DEFAULT 0,
      min_order REAL NOT NULL DEFAULT 0,
      expiry_date TEXT DEFAULT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create staff table for legacy reasons, or just directly create users
  _db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Check if users table exists, if not create and migrate
  const hasUsers = queryOne(_db, "SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (!hasUsers) {
    _db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    // Migrate staff to users
    const staffRows = queryAll(_db, "SELECT * FROM staff");
    if (staffRows.length > 0) {
      const stmt = _db.prepare("INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)");
      for (const row of staffRows) {
        stmt.bind([row.name, row.email, row.password, row.role, row.created_at]);
        stmt.step();
        stmt.reset();
      }
      stmt.free();
    }
  }

  // Check if orders table has customer_id, if not add it
  try {
    _db.run("ALTER TABLE orders ADD COLUMN customer_id INTEGER DEFAULT NULL");
  } catch (e) {
    // Column might already exist
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  saveDb();
  return _db;
}

export function saveDb() {
  if (!_db) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = _db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: run a query that returns results
export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run a query that returns a single row
export function queryOne(db, sql, params = []) {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper: run a statement (INSERT, UPDATE, DELETE) and return changes info
export function runStmt(db, sql, params = []) {
  db.run(sql, params);
  saveDb();
  return {
    changes: db.getRowsModified(),
    lastInsertRowid: queryOne(db, 'SELECT last_insert_rowid() as id')?.id
  };
}
