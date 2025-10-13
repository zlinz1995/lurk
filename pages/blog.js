import Layout from '../components/Layout';

export default function Blog() {
  return (
    <Layout title="Lurk Blog" subtitle="Thoughts, tips, and experiments.">
      <section className="card" aria-labelledby="blog-title">
        <h2 id="blog-title">Latest Posts</h2>
        <p className="muted">Nothing here yet — check back soon.</p>
        <div className="blog-suggest" style={{marginTop:22, textAlign:'left'}}>
          <h3 style={{margin:'0 0 6px'}}>Share a Thought</h3>
          <p className="muted" style={{margin:'0 0 12px'}}>Suggestions, tips, questions — drop them below.</p>
          <div id="blog-chat" className="blog-chat">
            <div id="blog-chat-messages" className="chat-messages" aria-live="polite" aria-relevant="additions"></div>
            <form id="blog-chat-form" className="chat-form" autoComplete="off">
              <input id="blog-chat-input" name="text" maxLength={500} placeholder="Write a suggestion, tip, or question..." />
              <button type="submit">Send</button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );}
