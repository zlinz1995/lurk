export async function getServerSideProps({ res, req }) {
  const host = req?.headers?.host || 'localhost:8080';
  const proto = (req?.headers['x-forwarded-proto'] || '').toString().includes('https') ? 'https' : (req?.connection?.encrypted ? 'https' : 'http');
  const baseUrl = `${proto}://${host}`;

  const urls = [
    '/',
    '/news',
    '/blog',
    '/faq',
    '/rules',
    '/report',
  ];
  const lastmod = new Date().toISOString().split('T')[0];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.map((p) => `\n  <url><loc>${baseUrl}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>${p === '/' ? '1.0' : '0.6'}</priority></url>`).join('') +
    `\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.write(body);
  res.end();
  return { props: {} };
}

export default function SiteMap() {
  return null;
}

