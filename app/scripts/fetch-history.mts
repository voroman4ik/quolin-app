// Writes the offline snapshot of real price history (lib/history.json). Run: `npm run history`.
// The app fetches the same data live from /api/history and falls back to this file offline.
import { writeFile } from 'node:fs/promises';
import { buildHistory } from '../lib/data/yahoo.ts';

const h = await buildHistory();
await writeFile(new URL('../lib/history.json', import.meta.url), JSON.stringify(h) + '\n');
for (const [id, w] of Object.entries(h.worst)) console.log(id.padEnd(6), `from ${h.starts[id]}`, `worst ${w.pct}% (${w.peak} → ${w.trough})`);
console.log(`wrote ${Object.keys(h.series).length} series × ${h.dates.length} weeks, ${h.dates[0]} → ${h.dates.at(-1)}`);
