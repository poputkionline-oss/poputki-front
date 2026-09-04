/**
 * tests/helpers/viteEnvShimLoader.mjs
 *
 * Node custom loader hook (node:module `register()` API), test-only. Two
 * shims so real Vite-flavored source modules under src/ can be imported and
 * executed under plain `node --test` for real behavioral testing (instead
 * of only fs.readFileSync string matching, which is why every pre-existing
 * frontend test in this repo was shallow):
 *
 * 1. resolve(): src/ uses bundler-style extensionless relative imports
 *    (`import api from '../api'`), which Vite/webpack resolve but Node's
 *    default ESM resolver does not. On a resolution failure for a relative
 *    specifier, retry with a `.js` extension appended.
 * 2. load(): rewrites `import.meta.env` -> `({})` in any file under src/
 *    before Node parses it — `import.meta.env` is a Vite build-time
 *    injection that doesn't exist under plain Node and would otherwise
 *    throw (e.g. src/api.js's `import.meta.env.VITE_API_URL`).
 *
 * Never touches any file on disk.
 */

export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier, context);
    } catch (err) {
        if (
            (specifier.startsWith('./') || specifier.startsWith('../')) &&
            !specifier.endsWith('.js') &&
            !specifier.endsWith('.vue') &&
            err.code === 'ERR_MODULE_NOT_FOUND'
        ) {
            return nextResolve(`${specifier}.js`, context);
        }
        throw err;
    }
}

export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (!url.includes('/src/') || result.source == null) {
        return result;
    }

    const text = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
    if (!text.includes('import.meta.env')) {
        return result;
    }

    const patched = text.replaceAll('import.meta.env', '({})');
    return { ...result, source: patched };
}
