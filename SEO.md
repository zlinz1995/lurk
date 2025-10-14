SEO and Metadata for Lurk

What’s included

- Default SEO tags via `components/SEO.js` (title, description, canonical, Open Graph, Twitter Card, PWA meta, JSON‑LD WebSite).
- Page‑specific descriptions wired through `components/Layout.js` props.
- Dynamic `robots.txt` and `sitemap.xml` rendered by Next.js at runtime using the current host.
- PWA manifest moved to `public/manifest.json` and linked in `_app.js`.

How canonical URLs are built

- `components/SEO.js` uses `NEXT_PUBLIC_SITE_URL` to generate `<link rel="canonical">` and `og:url`.
- Set this to your public origin (e.g., `https://lurk.example`) in your environment so canonical links are absolute and stable.
- Without it, pages still render SEO tags, but canonical/og:url are omitted.

Dynamic sitemap and robots

- `GET /sitemap.xml` is generated on each request using the incoming Host, covering: `/`, `/news`, `/blog`, `/faq`, `/rules`, `/report`.
- `GET /robots.txt` is generated with an absolute `Sitemap:` line pointing to the sitemap URL.

Deployment notes

- Add an env var `NEXT_PUBLIC_SITE_URL` in your hosting environment.
- Example (Render):
  - Key: `NEXT_PUBLIC_SITE_URL`
  - Value: `https://your-domain.tld`

Content recommendations

- Provide a social preview image at `public/social.jpg` (1200×630). Update `DEFAULT_IMAGE` in `components/SEO.js` to `/social.jpg` for richer link previews.
- Keep per‑page descriptions concise (50–160 chars) and unique.
- Submit the sitemap URL to Google Search Console and Bing Webmaster Tools.

Files touched

- `components/SEO.js` — centralized SEO component.
- `components/Layout.js` — injects SEO for every page via props.
- `pages/_app.js` — adds manifest, theme‑color, and icons.
- `pages/sitemap.xml.js` — dynamic sitemap.
- `pages/robots.txt.js` — dynamic robots.
- `public/manifest.json` — moved from repo root.

