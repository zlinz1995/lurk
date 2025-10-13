import Layout from '../components/Layout';

export default function Rules() {
  return (
    <Layout title="Rules" subtitle="Keep it civil">
      <section className="card">
        <h2>Rules</h2>
        <ul style={{textAlign:'left'}}>
          <li>Be respectful. No harassment.</li>
          <li>Mark sensitive images NSFW.</li>
          <li>No illegal content.</li>
        </ul>
      </section>
    </Layout>
  );
}
