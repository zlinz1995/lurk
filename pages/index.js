import Layout from '../components/Layout';

export default function Home() {
  return (
    <Layout title="Lurk" subtitle="Posts that vanish each hour — nothing lasts forever." hideHeader>
      {/* Combined hero + new thread, slightly smaller */}
      <section className="hero-form-section">
        <div className="hero-card">
          <div className="hero-head">
            <img src="/favicon.png" alt="Lurk logo" className="logo" />
            <div>
              <h1 className="hero-title">Lurk</h1>
              <p className="hero-sub">Posts that vanish each hour — nothing lasts forever.</p>
            </div>
          </div>
          <form id="thread-form" encType="multipart/form-data" onSubmit={(e)=>e.preventDefault()}>
            <h2 className="form-title">New Thread</h2>
            <label htmlFor="title">Title *</label>
            <input type="text" id="title" name="title" placeholder="What's the topic?" required />

            <label htmlFor="body">Body</label>
            <textarea id="body" name="body" placeholder="Add some context (optional)"></textarea>

            <label htmlFor="image">Image</label>
            <input type="file" id="image" name="image" accept="image/*" />
            <div className="nsfw-row">
              <button type="button" id="nsfw-toggle" className="nsfw-toggle" aria-pressed="false" title="Mark as NSFW (blur image)">NSFW</button>
              <input type="hidden" id="sensitive" name="sensitive" value="" />
            </div>

            <div id="image-preview" className="image-preview" aria-live="polite">
              <img id="image-preview-img" alt="Image preview" className="thread-image" style={{display:'none'}} />
            </div>

            <button type="button" id="thread-submit">Post Thread</button>
            <small>Max 5 MB — jpg/png/webp/gif</small>
          </form>
        </div>
      </section>

      {/* Most viewed (4) */}
      <section className="most-viewed-section">
        <h2>Most Viewed</h2>
        <div id="most-viewed" className="most-viewed-grid"></div>
      </section>

      {/* Threads feed */}
      <section className="threads-section" id="threads-section">
        <h2>Threads</h2>
        <div id="threads"></div>
        <button id="load-more" className="load-more">No more</button>
      </section>

      {/* Live Chat widget is created by main.js if not present */}
    </Layout>
  );
}
