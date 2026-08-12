import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });

await import('./server.js');
