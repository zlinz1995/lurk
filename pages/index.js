import Layout from '../components/Layout';

export default function Home() {
  return (
    <Layout title="Lurk" subtitle="Posts that vanish each hour — nothing lasts forever.">
      <section className="thread-form-section">
        <div className="form-container">
          <h2>New Thread</h2>
          <form id="thread-form" encType="multipart/form-data">
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

            <button type="submit">Post Thread</button>
            <small>Max 5 MB — jpg/png/webp/gif</small>
          </form>
        </div>
      </section>

      <section className="threads-section">
        <h2>Threads</h2>
        <div id="threads"></div>
        <button id="load-more" className="load-more">No more</button>
      </section>

      {/* Live Chat widget is created by main.js if not present */}
    </Layout>
  );
}
