import Layout from '../components/Layout';

export default function News() {
  return (
    <Layout title="News" subtitle="Updates and announcements" description="Announcements and product updates from Lurk.">
      <section className="card">
        <h2>News</h2>
        <p className="muted">No news yet.</p>
      </section>
    </Layout>
  );
}
