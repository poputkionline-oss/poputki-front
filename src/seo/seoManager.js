import { buildSeoState, SITE_NAME } from './seoPolicy.js';

const JSONLD_ID = 'seo-jsonld';

// Each managed tag is addressed by a selector and reused (never appended
// twice), so navigation updates in place and duplicates cannot appear.
function upsertMeta(doc, selector, attrs, content) {
    const head = doc.head;
    // Collapse any accidental duplicates down to one element.
    const found = head.querySelectorAll(selector);
    for (let i = 1; i < found.length; i++) found[i].remove();
    let el = found[0];
    if (content == null || content === '') {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = doc.createElement('meta');
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function upsertCanonical(doc, href) {
    const found = doc.head.querySelectorAll('link[rel="canonical"]');
    for (let i = 1; i < found.length; i++) found[i].remove();
    let el = found[0];
    if (!href) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = doc.createElement('link');
        el.setAttribute('rel', 'canonical');
        doc.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function upsertJsonLd(doc, data) {
    const existing = doc.getElementById(JSONLD_ID);
    if (!data) {
        if (existing) existing.remove();
        return;
    }
    const el = existing || doc.createElement('script');
    el.id = JSONLD_ID;
    el.type = 'application/ld+json';
    // "<" escaped so content can never close the script element.
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    if (!existing) doc.head.appendChild(el);
}

export function applySeo(routeName, doc = document) {
    const s = buildSeoState(routeName);
    doc.title = s.title;
    upsertMeta(doc, 'meta[name="description"]', { name: 'description' }, s.description);
    upsertMeta(doc, 'meta[name="robots"]', { name: 'robots' }, s.robots);
    upsertCanonical(doc, s.canonical);

    upsertMeta(doc, 'meta[property="og:type"]', { property: 'og:type' }, s.ogType);
    upsertMeta(doc, 'meta[property="og:site_name"]', { property: 'og:site_name' }, SITE_NAME);
    upsertMeta(doc, 'meta[property="og:title"]', { property: 'og:title' }, s.title);
    upsertMeta(doc, 'meta[property="og:description"]', { property: 'og:description' }, s.description);
    upsertMeta(doc, 'meta[property="og:url"]', { property: 'og:url' }, s.ogUrl);
    upsertMeta(doc, 'meta[property="og:image"]', { property: 'og:image' }, s.ogImage);

    upsertMeta(doc, 'meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary');
    upsertMeta(doc, 'meta[name="twitter:title"]', { name: 'twitter:title' }, s.title);
    upsertMeta(doc, 'meta[name="twitter:description"]', { name: 'twitter:description' }, s.description);
    upsertMeta(doc, 'meta[name="twitter:image"]', { name: 'twitter:image' }, s.ogImage);

    upsertJsonLd(doc, s.jsonLd);
    return s;
}

// Single integration point: called once from main.js.
export function installSeo(router) {
    router.afterEach((to) => {
        if (typeof document === 'undefined') return;
        applySeo(to.name, document);
    });
}
