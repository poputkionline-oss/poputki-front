/**
 * tests/helpers/viteEnvShim.mjs
 *
 * Plain `node --test` has no `import.meta.env` (that's a Vite build-time
 * injection), so any source file that reads it — e.g. src/api.js's
 * `import.meta.env.VITE_API_URL` — throws under a bare Node import. This is
 * why every existing frontend test in this repo only fs.readFileSync's
 * source as text instead of actually importing/executing it.
 *
 * Registering viteEnvShimLoader.mjs (a source-level, test-only shim) lets
 * real modules under src/ (acquisitionService.js, api.js, etc.) be imported
 * and executed for real behavioral testing instead of only static string
 * matching. Usage: `node --import ./tests/helpers/viteEnvShim.mjs --test ...`
 */

import { register } from 'node:module';

register('./viteEnvShimLoader.mjs', import.meta.url);
