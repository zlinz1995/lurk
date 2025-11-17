import Layout from '../components/Layout';

export default function Home() {
  return (
    <Layout title="Lurk" subtitle="Posts that vanish every 24 hours — nothing lasts forever." hideHeader>
      {/* Combined hero + new thread, slightly smaller */}
      <section className="hero-form-section">
        <div className="hero-card">
          <div className="hero-head">
            <img src="/favicon.png" alt="Lurk logo" className="logo" />
            <div className="hero-text">
              <h1 className="hero-title">Lurk</h1>
              <p className="hero-sub">Posts that vanish every 24 hours — nothing lasts forever.</p>
            </div>
            <button id="hero-collapse" className="hero-collapse" aria-label="Collapse form" aria-expanded="true" title="Collapse">−</button>
          </div>
          <form id="thread-form" encType="multipart/form-data" onSubmit={(e)=>e.preventDefault()}>
            <h2 className="form-title">New Thread</h2>
            <label htmlFor="title">Title *</label>
            <input type="text" id="title" name="title" placeholder="What's the topic?" required />

            <label htmlFor="body">Body</label>
            <textarea id="body" name="body" placeholder="Add some context (optional)"></textarea>

            <label htmlFor="image">Media</label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*,video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/ogg"
            />
            <div className="nsfw-row">
              <button type="button" id="nsfw-toggle" className="nsfw-toggle" aria-pressed="false" title="Mark as NSFW (blur media)">NSFW</button>
              <input type="hidden" id="sensitive" name="sensitive" value="" />
            </div>

            <div id="media-preview" className="image-preview media-preview" aria-live="polite">
              <img id="media-preview-img" alt="Media preview" className="thread-image thread-media" style={{display:'none'}} />
              <video
                id="media-preview-video"
                className="thread-video thread-media"
                style={{display:'none'}}
                playsInline
                controls
                preload="metadata"
                muted
              />
              <audio
                id="media-preview-audio"
                className="thread-audio thread-media"
                style={{display:'none'}}
                controls
                preload="metadata"
              />
            </div>

            <button type="button" id="thread-submit">Post Thread</button>
            <small>Images up to 5 MB — video/audio up to 100 MB (jpg/png/webp/gif/mp4/webm/mp3/wav)</small>
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
