export async function getServerSideProps({ res, req }) {
  const host = req?.headers?.host || 'localhost:8080';
  const proto = (req?.headers['x-forwarded-proto'] || '').toString().includes('https') ? 'https' : (req?.connection?.encrypted ? 'https' : 'http');
  const baseUrl = `${proto}://${host}`;

  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ];

  res.setHeader('Content-Type', 'text/plain');
  res.write(lines.join('\n'));
  res.end();
  return { props: {} };
}

export default function RobotsTxt() {
  return null;
}

