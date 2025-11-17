export const metadata = {
  title: "FAQ – Lurk",
};

export default function FAQPage() {
  return (
    <>
      <header className="header">
        <img src="/favicon.png" className="logo" />
        <h1>Frequently Asked Questions</h1>
        <p className="tagline">Answers to common questions.</p>
      </header>

      <main>
        <section className="glass-card">
          <h2>What is Lurk?</h2>
          <p>Lurk is a lightweight, fast platform…</p>
        </section>

        <section className="glass-card">
          <h2>Why is Lurk different?</h2>
          <p>…</p>
        </section>
      </main>


    </>
  );
}

