export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <img src="/lurk-favicon.png" alt="" aria-hidden="true" />
          <div><strong>Lurk</strong><span>Social spaces and communication tools built around deliberate connection.</span></div>
        </div>
        <nav aria-label="Footer navigation">
          <div><strong>Explore</strong><a href="/discussions">Discussions</a><a href="/playables">Playables</a><button type="button" data-live-chat-trigger>Live rooms</button></div>
          <div><strong>Products</strong><a href="/lurkguard">LurkGuard</a><a href="/developer">Developers</a></div>
          <div><strong>Trust</strong><a href="/report">Safety Center</a><a href="/about">Terms &amp; privacy</a></div>
        </nav>
      </div>
      <div className="site-footer-bottom"><span>© 2026 Lurk</span><span>Move quietly. Connect deliberately.</span></div>
    </footer>
  );
}
