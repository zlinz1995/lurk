import Layout from '../components/Layout';
import Link from 'next/link';

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
        <div style={{marginTop: 16}}>
          <Link href="/report" aria-label="Report offensive content" title="Report offensive content">
            <button type="button">Report</button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
