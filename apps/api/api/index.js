// Vercel function entry. It serves the compiled Hono app (built by `npm run build` into dist/).
import { handle } from '@hono/node-server/vercel';
import { app } from '../dist/app.js';

export default handle(app);
