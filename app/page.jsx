import styles from "./page.module.css";

export const metadata = {
  title: "Lurk | Social spaces with stronger boundaries",
  description: "Explore Lurk discussions, live rooms, playables, and LurkGuard communication safety tools.",
};

const destinations = [
  { number: "01", eyebrow: "Community", title: "Discussions", body: "Focused threads with replies, member controls, reporting, muting, and clear communication boundaries.", href: "/discussions", action: "Browse discussions" },
  { number: "02", eyebrow: "Real time", title: "Live rooms", body: "Drop into public rooms or create private member spaces for lightweight video and chat.", live: true, action: "Open live rooms" },
  { number: "03", eyebrow: "Instant play", title: "Playables", body: "Small games that launch directly in Lurk, with a developer path for submitting new experiences.", href: "/playables", action: "Explore playables" },
  { number: "04", eyebrow: "Android", title: "LurkGuard", body: "A private Phone and SMS client built around deliberate contact blocking and accountable changes.", href: "/lurkguard", action: "View LurkGuard" },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}><i /> Lurk ecosystem</span>
          <h1>The quieter side<br />of social.</h1>
          <p>Focused discussions, spontaneous rooms, instant games, and communication tools designed around stronger personal boundaries.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="/discussions">Explore Lurk</a>
            <button className={styles.secondaryAction} type="button" data-live-chat-trigger>Join a live room</button>
          </div>
          <div className={styles.heroMeta}><span>Open community spaces</span><span>Member-only rooms</span><span>Safety controls</span></div>
        </div>

        <aside className={styles.productPanel} aria-label="Lurk products">
          <div className={styles.panelHeader}><span>Inside Lurk</span><small>Four ways to connect</small></div>
          <a href="/discussions"><b>Discuss</b><span>Structured community threads</span><i>↗</i></a>
          <button type="button" data-live-chat-trigger><b>Meet</b><span>Live video and chat rooms</span><i>↗</i></button>
          <a href="/playables"><b>Play</b><span>Games built for quick sessions</span><i>↗</i></a>
          <a href="/lurkguard"><b>Protect</b><span>Android communication boundaries</span><i>↗</i></a>
          <div className={styles.panelFooter}><span className={styles.pulse} /> Services available</div>
        </aside>
      </section>

      <section className={styles.trustStrip} aria-label="Lurk principles">
        <div><strong>Fast by design</strong><span>Direct paths and compact interfaces</span></div>
        <div><strong>Boundaries built in</strong><span>Block, mute, report, and review</span></div>
        <div><strong>One connected brand</strong><span>Web community and Android tools</span></div>
      </section>

      <section className={styles.destinations}>
        <header className={styles.sectionHeading}>
          <div><span className={styles.kicker}>Start here</span><h2>Choose your space</h2></div>
          <p>Everything is reachable from the navigation above. These are the main ways into Lurk.</p>
        </header>
        <div className={styles.destinationGrid}>
          {destinations.map((item) => (
            <article key={item.title} className={styles.destinationCard}>
              <div className={styles.cardTop}><span>{item.eyebrow}</span><b>{item.number}</b></div>
              <h3>{item.title}</h3><p>{item.body}</p>
              {item.live ? <button type="button" data-live-chat-trigger>{item.action}<i>→</i></button> : <a href={item.href}>{item.action}<i>→</i></a>}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.safetyCallout}>
        <div><span className={styles.kicker}>Safety Center</span><h2>Your controls, clearly organized.</h2><p>Review blocked accounts, muted spaces, active reports, LurkGuard status, and recovery guidance in one compact dashboard.</p></div>
        <a href="/report">Open Safety Center <span>→</span></a>
      </section>
    </main>
  );
}
