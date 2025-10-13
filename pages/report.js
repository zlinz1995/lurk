import Layout from '../components/Layout';
import { useEffect } from 'react';

export default function ReportPage() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const threadId = params.get('thread');
      if (threadId) {
        const sel = document.getElementById('report-thread-id');
        if (sel) sel.value = threadId;
      }
    } catch {}
  }, []);

  return (
    <Layout title="Report" subtitle="Flag abuse or misconduct anonymously">
      <section className="card" style={{textAlign:'left', maxWidth: 700}}>
        <h2>Send Report</h2>
        <p className="muted">We review reports periodically. Do not include personal information.</p>
        <form id="global-report-form" className="report-form" autoComplete="off" onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const payload = {
            reason: data.get('reason') || 'other',
            details: data.get('details') || '',
            threadId: data.get('threadId') || '',
          };
          try {
            const res = await fetch('/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error('Failed');
            form.reset();
            alert('Report submitted. Thank you.');
          } catch {
            alert('Could not submit report right now.');
          }
        }}>
          <label htmlFor="report-reason">Reason</label>
          <select id="report-reason" name="reason" defaultValue="abuse">
            <option value="abuse">Abuse</option>
            <option value="harassment">Harassment</option>
            <option value="spam">Spam</option>
            <option value="nsfw">NSFW / mislabeled</option>
            <option value="illegal">Illegal content</option>
            <option value="other">Other</option>
          </select>
          <label htmlFor="report-details">Details (optional)</label>
          <textarea id="report-details" name="details" rows={3} maxLength={2000} placeholder="Describe the issue"></textarea>
          <label htmlFor="report-thread-id">Thread ID (optional)</label>
          <input id="report-thread-id" name="threadId" placeholder="e.g., 1697136000000" />
          <button type="submit">Submit Report</button>
        </form>
      </section>
    </Layout>
  );
}

