// Static endpoint: serve the core build's manifest.json at
// /api/manifest.json. `docs:build` chains the core build first, so the
// artifact always exists and matches the sources this site documents.
import { readFile } from 'node:fs/promises';

export async function GET() {
  const json = await readFile(
    new URL('../../../../../packages/core/dist/manifest.json', import.meta.url),
    'utf8',
  );
  return new Response(json, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
