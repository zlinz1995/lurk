import Head from 'next/head';
import { useRouter } from 'next/router';

const SITE_NAME = 'Lurk';
const DEFAULT_DESCRIPTION = 'Lurk is an ephemeral image board with threads, replies, and anonymous live chat. Posts vanish every hour.';
const DEFAULT_IMAGE = '/background.jpg'; // Consider replacing with /social.jpg (1200x630)

export default function SEO({
  title = SITE_NAME,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
}) {
  const router = useRouter();
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const path = (router?.asPath || '/').split('#')[0];
  const pathname = path.split('?')[0] || '/';
  const canonical = baseUrl ? `${baseUrl}${pathname}` : undefined;

  const fullTitle = title && title !== SITE_NAME ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const ogImage = image?.startsWith('http') ? image : (baseUrl ? `${baseUrl}${image}` : image);

  return (
    <Head>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />} 
      <meta property="og:type" content={type} />
      {canonical && <meta property="og:url" content={canonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* Structured Data: WebSite with SearchAction */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: baseUrl || undefined,
            potentialAction: {
              '@type': 'SearchAction',
              target: (baseUrl ? `${baseUrl}/?q={search_term_string}` : '/?q={search_term_string}'),
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />

      {/* PWA Meta */}
      <meta name="application-name" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    </Head>
  );
}
