import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

// schema.sql sits next to src/ and dist/, so this path works for both.
const sql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('Migration complete');
await pool.end();
