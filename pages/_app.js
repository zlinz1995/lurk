import Head from 'next/head';
import Script from 'next/script';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
        <title>Lurk</title>
        <link rel="stylesheet" href="/styles.css" />
      </Head>
      <Component {...pageProps} />
      <Script src="/socket.io/socket.io.js" strategy="afterInteractive" />
      <Script src="/main.js" strategy="afterInteractive" />
    </>
  );
}

