import { ensureSchema, pool } from './db.js';

await ensureSchema();
console.log('Migration complete');
await pool.end();
