import Link from 'next/link';

export default function Layout({ title = 'Lurk', subtitle, children }) {
  return (
    <>
      <header className="header">
        <img src="/favicon.png" alt="Lurk logo" className="logo" />
        <h1>{title}</h1>
        {subtitle && <p className="tagline">{subtitle}</p>}
      </header>
      <main>{children}</main>
      <nav className="bottom-nav">
        <Link href="/" aria-label="Home" title="Home">
          <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l9-8 9 8"/>
            <path d="M5 10v10h14V10"/>
            <path d="M9 20v-6h6v6"/>
          </svg>
          <span className="sr-only">Home</span>
        </Link>
        <Link href="/news" aria-label="News" title="News">
          <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="15" rx="2"/>
            <path d="M7 8.5h6"/>
            <path d="M7 12h8"/>
            <path d="M7 15.5h8"/>
            <path d="M21 7v9.5a2.5 2.5 0 0 1-2.5 2.5H17"/>
          </svg>
          <span className="sr-only">News</span>
        </Link>
        <Link href="/blog" aria-label="Blog" title="Blog">
          <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16.5 3.5l4 4L10 18H6v-4z"/>
            <path d="M14 5.5l4 4"/>
            <path d="M6 18h4"/>
          </svg>
          <span className="sr-only">Blog</span>
        </Link>
        <Link href="/faq" aria-label="FAQ" title="FAQ">
          <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M9.5 9a3 3 0 1 1 3.5 2.9c-.7.2-1 1-.9 1.6"/>
            <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>
          </svg>
          <span className="sr-only">FAQ</span>
        </Link>
        <Link href="/report" aria-label="Report" title="Report">
          <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 3v18"/>
            <path d="M5 4h10l-2 3 2 3H5z"/>
            <circle cx="18" cy="17" r="2"/>
            <path d="M18 15v-2"/>
          </svg>
          <span className="sr-only">Report</span>
        </Link>
        <Link href="/rules" aria-label="Rules" title="Rules">
          <svg className="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 7l7 7"/>
            <path d="M14 6l4 4"/>
            <rect x="3" y="16" width="8" height="3" rx="1.5"/>
            <path d="M9 11l-6 6"/>
          </svg>
          <span className="sr-only">Rules</span>
        </Link>
        <button className="nav-ellipsis" aria-label="Toggle menu" title="Toggle menu">...</button>
      </nav>
    </>
  );
}
