// Static endpoint: serve the macros' Custom Elements Manifest at
// /api/custom-elements.json (same file the npm package ships).
import { readFile } from 'node:fs/promises';

export async function GET() {
  const json = await readFile(
    new URL('../../../../../packages/core/custom-elements.json', import.meta.url),
    'utf8',
  );
  return new Response(json, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
