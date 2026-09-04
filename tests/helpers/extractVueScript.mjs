/**
 * tests/helpers/extractVueScript.mjs
 *
 * Test-only helper: extracts the plain Options-API <script> block of a .vue
 * SFC (no <script setup>, no @vue/compiler-sfc dependency needed - this repo
 * has no @vue/test-utils) into a real temporary .mjs sibling file and
 * imports it, so real component option logic (data(), methods, etc.) can be
 * exercised directly instead of only fs.readFileSync string matching.
 * Writing the temp file next to the real .vue source (rather than e.g. under
 * tests/) is what makes the component's own relative imports (`../api`,
 * `../services/...`) resolve correctly, exactly as they do at build time.
 * The temp file is always deleted, even on failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * @param {string} vueRelativePathFromRepoRoot e.g. 'src/views/SearchResultsView.vue'
 * @returns {Promise<{ default: object }>} the component options module
 */
export async function importVueScript(vueRelativePathFromRepoRoot) {
    const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
    const vuePath = path.join(repoRoot, vueRelativePathFromRepoRoot);
    const src = fs.readFileSync(vuePath, 'utf8');

    const match = src.match(/<script>([\s\S]*?)<\/script>/);
    if (!match) {
        throw new Error(`No plain <script> block found in ${vuePath} (this helper does not support <script setup>)`);
    }

    const tempPath = vuePath.replace(/\.vue$/, `.__extracted_test_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}.mjs`);
    fs.writeFileSync(tempPath, match[1], 'utf8');

    try {
        return await import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
    } finally {
        fs.unlinkSync(tempPath);
    }
}
