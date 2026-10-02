import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSeoState, ROUTE_SEO, getRouteSeo } from '../src/seo/seoPolicy.js';

const routerSrc = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8');
const routeNames = [...routerSrc.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);

describe('SEO route policy', () => {
    it('covers every router route name', () => {
        for (const name of routeNames) assert.ok(ROUTE_SEO[name], `missing SEO policy for ${name}`);
    });

    it('indexes only landing and terms', () => {
        const indexable = Object.keys(ROUTE_SEO).filter(n => ROUTE_SEO[n].robots === 'index,follow');
        assert.deepEqual(indexable.sort(), ['landing', 'terms']);
    });

    it('canonical is fixed, query-free, and only for indexable routes', () => {
        assert.equal(buildSeoState('landing').canonical, 'https://www.poputki.online/');
        assert.equal(buildSeoState('terms').canonical, 'https://www.poputki.online/terms');
        for (const n of Object.keys(ROUTE_SEO).filter(n => n !== 'landing' && n !== 'terms')) {
            assert.equal(buildSeoState(n).canonical, null, n);
        }
    });

    it('search is noindex,follow; private/token routes are noindex,nofollow', () => {
        assert.equal(getRouteSeo('search').robots, 'noindex,follow');
        for (const n of ['ticket-verification', 'ticket-verify-alias', 'claim-landing', 'ticket-subscribe', 'auth', 'profile', 'bus-admin', 'admin', 'payment-result', 'bus-booking', 'not-found']) {
            assert.equal(getRouteSeo(n).robots, 'noindex,nofollow', n);
        }
    });

    it('unknown route names fail safe to noindex,nofollow', () => {
        assert.equal(getRouteSeo('some-future-route').robots, 'noindex,nofollow');
    });

    it('JSON-LD only on landing, without invented fields', () => {
        for (const n of Object.keys(ROUTE_SEO)) if (n !== 'landing') assert.equal(buildSeoState(n).jsonLd, null, n);
        const ld = buildSeoState('landing').jsonLd;
        assert.deepEqual(ld.map(x => x['@type']), ['Organization', 'WebSite']);
        const txt = JSON.stringify(ld);
        for (const bad of ['aggregateRating', 'telephone', 'address', 'sameAs', 'offers']) assert.ok(!txt.includes(bad));
    });
});

describe('Static SEO assets', () => {
    const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

    it('index.html has no static canonical/og:url (SPA fallback serves it for every URL)', () => {
        const html = read('../index.html');
        assert.ok(!/rel="canonical"/.test(html));
        assert.ok(!/og:url/.test(html));
    });

    it('robots.txt does not Disallow pages that rely on noindex', () => {
        const dis = read('../public/robots.txt').split('\n').filter(l => l.startsWith('Disallow:')).map(l => l.slice(9).trim());
        assert.deepEqual(dis, ['/l/', '/r/']);
        assert.ok(/Sitemap: https:\/\/www\.poputki\.online\/sitemap\.xml/.test(read('../public/robots.txt')));
    });

    it('sitemap lists exactly / and /terms, no lastmod or query', () => {
        const xml = read('../public/sitemap.xml');
        assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]), ['https://www.poputki.online/', 'https://www.poputki.online/terms']);
        assert.ok(!/lastmod/.test(xml) && !/<loc>[^<]*\?/.test(xml));
    });

    it('vercel.json sends X-Robots-Tag noindex for token routes', () => {
        const v = JSON.parse(read('../vercel.json'));
        for (const src of ['/t/:token', '/ticket/:token', '/ticket-verify/:token', '/ticket-subscribe/:verificationToken']) {
            const h = v.headers.find(x => x.source === src);
            assert.ok(h && h.headers.some(x => x.key === 'X-Robots-Tag' && /noindex/.test(x.value)), src);
        }
    });
});
