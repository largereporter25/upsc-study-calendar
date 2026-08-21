import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set');
}

// `cache: 'no-store'` is essential: Next.js patches global fetch and would
// otherwise cache the driver's HTTP queries, freezing stale results.
export const sql = neon(url, { fetchOptions: { cache: 'no-store' } });
