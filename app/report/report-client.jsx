"use client";

import CustomSelect from "../../components/CustomSelect.jsx";
import LurkGuardActions from "../../components/LurkGuardActions.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildClientApiContext, resolveClientApiBases, shouldAutoFallbackApiBase } from "../src/resolveApiBase.js";

const AUTH_TOKEN_KEY = "lurkAuthToken";
const SUPPORT_EMAIL = "support@lurk-app.com";
const reportCategories = [
  ["harassment", "Harassment or targeted abuse"], ["spam", "Spam, scams, or malicious links"],
  ["impersonation", "Impersonation or deceptive identity"], ["illegal", "Illegal or dangerous content"],
  ["nsfw-mislabeled", "NSFW content not labeled"], ["other", "Other safety or policy concern"],
];
const impactLevels = [["heads-up", "Heads up"], ["review-soon", "Needs review soon"], ["urgent", "Urgent safety concern"]];
const emptyReportDraft = { category: "", impact: "", link: "", details: "", contact: "" };
const emptySafety = { blockedAccounts: [], mutedItems: [], activeReports: [] };

const readAuthToken = () => { try { return window.localStorage?.getItem(AUTH_TOKEN_KEY) || ""; } catch { return ""; } };
const buildApiUrl = (base, path) => { if (/^https?:\/\//i.test(path)) return path; const normalized = path.startsWith("/") ? path : `/${path}`; return base ? `${base}${normalized}` : normalized; };
const getApiContexts = () => { const bases = resolveClientApiBases(); return bases.length ? bases.map((base) => buildClientApiContext(base)) : [{ base: "", sameOrigin: true }]; };
const formatDate = (value) => { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""; };

export default function ReportClient() {
  const [reportDraft, setReportDraft] = useState(emptyReportDraft);
  const [reportStatus, setReportStatus] = useState({ state: "idle", message: "" });
  const [safety, setSafety] = useState(emptySafety);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardStatus, setDashboardStatus] = useState("");
  const [muteDraft, setMuteDraft] = useState({ kind: "discussion", target: "", label: "" });
  const [installStatus, setInstallStatus] = useState({ state: "unknown", version: "", checkedAt: "" });

  const apiFetch = useCallback(async (path, options = {}) => {
    const contexts = getApiContexts(); let lastError = null;
    for (let index = 0; index < contexts.length; index += 1) {
      const context = contexts[index]; const headers = new Headers(options.headers || {}); const token = readAuthToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      try { return await fetch(buildApiUrl(context.base, path), { ...options, headers, credentials: context.sameOrigin ? "include" : "omit" }); }
      catch (error) { lastError = error; if (!(index === 0 && contexts.length > 1 && shouldAutoFallbackApiBase(context.base))) throw error; }
    }
    throw lastError || new Error("api_unavailable");
  }, []);

  const loadSafety = useCallback(async () => {
    setLoading(true);
    try {
      const [meResponse, safetyResponse] = await Promise.all([apiFetch("/auth/me"), apiFetch("/safety")]);
      if (!meResponse.ok || !safetyResponse.ok) { setSignedIn(false); setSafety(emptySafety); return; }
      const data = await safetyResponse.json().catch(() => emptySafety); setSignedIn(true);
      setSafety({ blockedAccounts: Array.isArray(data?.blockedAccounts) ? data.blockedAccounts : [], mutedItems: Array.isArray(data?.mutedItems) ? data.mutedItems : [], activeReports: Array.isArray(data?.activeReports) ? data.activeReports : [] });
    } catch { setSignedIn(false); setSafety(emptySafety); } finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { loadSafety(); }, [loadSafety]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = Object.fromEntries(["category", "impact", "link", "details", "contact"].map((key) => [key, params.get(key) || ""]));
    if (Object.values(prefill).some(Boolean)) setReportDraft((current) => ({ ...current, ...Object.fromEntries(Object.entries(prefill).filter(([, value]) => value)) }));
    try {
      const saved = JSON.parse(window.localStorage.getItem("lurkguardInstallStatus") || "null"); if (saved?.state) setInstallStatus(saved);
      const result = params.get("lurkguard"); const nonce = params.get("nonce") || ""; const expected = window.sessionStorage.getItem("lurkguardStatusNonce") || "";
      if (result && nonce && expected && nonce === expected) {
        const next = { state: result === "installed" ? "installed" : "not-installed", version: params.get("version") || "", checkedAt: new Date().toISOString() };
        setInstallStatus(next); window.localStorage.setItem("lurkguardInstallStatus", JSON.stringify(next)); window.sessionStorage.removeItem("lurkguardStatusNonce"); window.history.replaceState({}, "", "/report");
      }
    } catch { /* Storage may be unavailable in privacy modes. */ }
  }, []);

  const summary = useMemo(() => [
    ["Blocked accounts", safety.blockedAccounts.length], ["Muted items", safety.mutedItems.length], ["Active reports", safety.activeReports.length],
    ["LurkGuard", installStatus.state === "installed" ? `Installed${installStatus.version ? ` · ${installStatus.version}` : ""}` : installStatus.state === "not-installed" ? "Not detected" : "Not checked"],
  ], [installStatus, safety]);

  const removeBlock = async (id) => { const response = await apiFetch(`/safety/blocks/${id}`, { method: "DELETE" }); if (response.ok) setSafety((current) => ({ ...current, blockedAccounts: current.blockedAccounts.filter((item) => item.id !== id) })); };
  const removeMute = async (id) => { const response = await apiFetch(`/safety/mutes/${id}`, { method: "DELETE" }); if (response.ok) setSafety((current) => ({ ...current, mutedItems: current.mutedItems.filter((item) => item.id !== id) })); };
  const closeReport = async (id) => { const response = await apiFetch(`/safety/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) }); if (response.ok) setSafety((current) => ({ ...current, activeReports: current.activeReports.filter((item) => item.id !== id) })); };
  const addMute = async (event) => {
    event.preventDefault(); setDashboardStatus("");
    const response = await apiFetch("/safety/mutes", { method: "POST", body: JSON.stringify(muteDraft) }); const data = await response.json().catch(() => ({}));
    if (!response.ok) { setDashboardStatus(response.status === 401 ? "Sign in to save muted items." : "Could not save this mute."); return; }
    if (data?.mutedItem) setSafety((current) => ({ ...current, mutedItems: [data.mutedItem, ...current.mutedItems.filter((item) => item.id !== data.mutedItem.id)] }));
    setMuteDraft({ kind: "discussion", target: "", label: "" }); setDashboardStatus("Mute saved.");
  };
  const handleReportSubmit = async (event) => {
    event.preventDefault(); const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; setReportStatus({ state: "loading", message: "Sending report…" });
    try {
      const response = await apiFetch("/reports", { method: "POST", headers: { "X-Report-Request-Id": requestId }, body: JSON.stringify(reportDraft) }); const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "report_submission_failed");
      setReportDraft(emptyReportDraft); setReportStatus({ state: "success", message: "Submitted. You can track this report here while it is active." }); if (signedIn) await loadSafety();
    } catch { setReportStatus({ state: "error", message: `Could not submit this report. Email ${SUPPORT_EMAIL} directly if the issue is urgent.` }); }
  };
  const checkLurkGuard = () => {
    if (!/Android/i.test(window.navigator.userAgent || "")) { setInstallStatus({ state: "android-required", version: "", checkedAt: new Date().toISOString() }); return; }
    const nonce = crypto.randomUUID?.().replaceAll("-", "") || `${Date.now()}${Math.random().toString(16).slice(2)}`; window.sessionStorage.setItem("lurkguardStatusNonce", nonce);
    const fallback = encodeURIComponent(`https://lurk-app.com/report?lurkguard=not-installed&nonce=${nonce}`); window.location.href = `intent://open/status?nonce=${nonce}#Intent;scheme=lurkguard;package=local.commitment;S.browser_fallback_url=${fallback};end`;
  };

  return (
    <main className="safetyPage">
      <section className="hero panel"><div><p className="eyebrow">Lurk Safety Center</p><h1>Your boundaries in one place</h1><p>Review Lurk account controls, reports, LurkGuard handoffs, and recovery readiness.</p></div>{!signedIn && !loading ? <a className="primaryButton" href="/account">Sign in to save safety controls</a> : null}</section>
      <section className="summaryGrid" aria-label="Safety summary">{summary.map(([label, value]) => <article className="summaryCard" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <div className="dashboardGrid">
        <section className="panel sectionCard"><div className="sectionHeading"><div><p className="eyebrow">Accounts</p><h2>Blocked Lurk accounts</h2></div><span className="count">{safety.blockedAccounts.length}</span></div>
          {loading ? <p className="empty">Loading…</p> : safety.blockedAccounts.length ? safety.blockedAccounts.map((account) => <article className="item" key={account.id}><div><strong>{account.displayName}</strong><span>Blocked {formatDate(account.createdAt)}</span></div><button className="quietButton" type="button" onClick={() => removeBlock(account.id)}>Unblock on Lurk</button><LurkGuardActions compact actions={["blacklist", "boundary"]} label={account.displayName} source={`/profile?id=${account.id}`} title="Suggest to LurkGuard" /></article>) : <p className="empty">No blocked Lurk accounts. Account blocks made in Discussions will appear here.</p>}
        </section>
        <section className="panel sectionCard"><div className="sectionHeading"><div><p className="eyebrow">Content</p><h2>Muted discussions and rooms</h2></div><span className="count">{safety.mutedItems.length}</span></div>
          {safety.mutedItems.length ? safety.mutedItems.map((item) => <article className="item itemRow" key={item.id}><div><strong>{item.label}</strong><span>{item.kind} · {formatDate(item.createdAt)}</span></div><button className="quietButton" type="button" onClick={() => removeMute(item.id)}>Unmute</button></article>) : <p className="empty">Nothing is muted. Use a discussion’s action menu, a public room’s Mute button, or add one below.</p>}
          <form className="compactForm" onSubmit={addMute}><CustomSelect name="muteKind" label="Type" value={muteDraft.kind} onChange={(kind) => setMuteDraft((current) => ({ ...current, kind }))} options={[{ value: "discussion", label: "Discussion" }, { value: "room", label: "Public room" }]} /><label>Thread ID or public room name<input required value={muteDraft.target} onChange={(event) => setMuteDraft((current) => ({ ...current, target: event.target.value }))} placeholder="THR000123 or LOBBY" /></label><label>Label<input required value={muteDraft.label} onChange={(event) => setMuteDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Why you will recognize it" /></label><button className="secondaryButton" type="submit">Add mute</button></form>{dashboardStatus ? <p className="status info">{dashboardStatus}</p> : null}
        </section>
        <section className="panel sectionCard reportsCard"><div className="sectionHeading"><div><p className="eyebrow">Reports</p><h2>Active reports</h2></div><span className="count">{safety.activeReports.length}</span></div>
          {safety.activeReports.length ? safety.activeReports.map((report) => <article className="item itemRow" key={report.id}><div><strong>{report.category} · {report.impact}</strong><span>{report.link}</span><span>Submitted {formatDate(report.createdAt)}</span></div><button className="quietButton" type="button" onClick={() => closeReport(report.id)}>Mark resolved</button></article>) : <p className="empty">No active reports linked to this account.</p>}
          <details className="reportComposer" open={!safety.activeReports.length}><summary>Submit a new report</summary><form className="reportForm" onSubmit={handleReportSubmit}><CustomSelect name="category" label="Category" required value={reportDraft.category} placeholder="Select a category" onChange={(category) => setReportDraft((current) => ({ ...current, category }))} options={reportCategories.map(([value, label]) => ({ value, label }))} /><CustomSelect name="impact" label="Impact" required value={reportDraft.impact} placeholder="Choose impact level" onChange={(impact) => setReportDraft((current) => ({ ...current, impact }))} options={impactLevels.map(([value, label]) => ({ value, label }))} /><label className="wide">Links or thread IDs<input required value={reportDraft.link} onChange={(event) => setReportDraft((current) => ({ ...current, link: event.target.value }))} placeholder="URL, thread ID, username, or room" /></label><label className="wide">Details<textarea required rows={5} value={reportDraft.details} onChange={(event) => setReportDraft((current) => ({ ...current, details: event.target.value }))} placeholder="Describe what happened and who was involved." /></label><label className="wide">Contact (optional)<input value={reportDraft.contact} onChange={(event) => setReportDraft((current) => ({ ...current, contact: event.target.value }))} placeholder="Email or @handle" /></label><button className="primaryButton" type="submit" disabled={reportStatus.state === "loading"}>{reportStatus.state === "loading" ? "Sending…" : "Send report"}</button>{reportStatus.message ? <p className={`status ${reportStatus.state}`}>{reportStatus.message}</p> : null}</form></details>
        </section>
        <section className="panel sectionCard"><div className="sectionHeading"><div><p className="eyebrow">Device</p><h2>LurkGuard installation</h2></div><span className={`statusDot ${installStatus.state === "installed" ? "good" : ""}`} /></div><p className="bodyCopy">{installStatus.state === "installed" ? `Confirmed from LurkGuard${installStatus.version ? ` ${installStatus.version}` : ""} on this Android browser.` : installStatus.state === "not-installed" ? "LurkGuard did not answer the installation check on this Android device." : installStatus.state === "android-required" ? "Open this page on your Android device to check the installation." : "Installation has not been checked from this browser."}</p><div className="buttonRow"><button className="primaryButton" type="button" onClick={checkLurkGuard}>Check on Android</button><a className="secondaryButton" href="/lurkguard">Download or update</a></div><p className="finePrint">A successful check is a local app-to-browser handshake. The dashboard does not receive your Blacklist, SMS, calls, PIN, or contacts.</p></section>
        <section className="panel sectionCard guidanceCard"><div className="sectionHeading"><div><p className="eyebrow">Recovery</p><h2>Security and recovery guidance</h2></div></div><ul className="guidanceList"><li><strong>Lurk account:</strong> keep the account email and password-recovery method current.</li><li><strong>Google account:</strong> retain backup codes outside the phone and verify an independent sign-in method.</li><li><strong>Authenticator:</strong> confirm cloud sync before any reset, or export entries to a trusted device.</li><li><strong>LurkGuard:</strong> retain the APK checksum and Controller recovery material on the PC.</li><li><strong>Phone blocks:</strong> Lurk suggestions never block a number automatically; confirm the matching contact locally.</li></ul><div className="buttonRow"><a className="secondaryButton" href="/settings">Account security settings</a><a className="secondaryButton" href="/lurkguard#install">LurkGuard installation guide</a></div></section>
      </div>
      <style jsx>{`
        .safetyPage{min-height:100vh;padding:34px 20px 70px;background:radial-gradient(circle at 12% 0%,rgba(0,197,255,.18),transparent 28%),linear-gradient(180deg,#06111c,#081520 55%,#060e17);color:#e4f6ff}.panel{border:1px solid rgba(73,204,255,.16);border-radius:24px;background:linear-gradient(150deg,rgba(13,34,48,.94),rgba(7,18,29,.96));box-shadow:0 22px 60px rgba(0,0,0,.28)}.hero{max-width:1180px;margin:0 auto 18px;padding:28px;display:flex;align-items:end;justify-content:space-between;gap:24px}h1,h2,p{margin:0}h1{margin-top:6px;font-size:clamp(2rem,5vw,3.6rem);letter-spacing:-.04em}h2{font-size:1.2rem}.hero p:last-child,.bodyCopy{margin-top:10px;color:#9db8c8;line-height:1.6}.eyebrow{color:#4bdcff;font-size:.72rem;font-weight:800;letter-spacing:.15em;text-transform:uppercase}.summaryGrid{max-width:1180px;margin:0 auto 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.summaryCard{padding:17px;border:1px solid rgba(73,204,255,.13);border-radius:18px;background:rgba(8,30,44,.84);display:grid;gap:7px}.summaryCard span{color:#8faebf;font-size:.76rem}.summaryCard strong{font-size:1.15rem}.dashboardGrid{max-width:1180px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.sectionCard{padding:20px;display:grid;gap:14px}.reportsCard,.guidanceCard{grid-column:1/-1}.sectionHeading{display:flex;align-items:center;justify-content:space-between;gap:12px}.sectionHeading h2{margin-top:4px}.count{min-width:34px;padding:8px;border-radius:999px;background:rgba(0,183,235,.16);color:#78e5ff;text-align:center;font-weight:800}.item{padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025)}.itemRow{display:flex;align-items:center;justify-content:space-between;gap:14px}.item>div:first-child{display:grid;gap:5px;min-width:0}.item span{color:#91adbd;font-size:.78rem;overflow-wrap:anywhere}.empty,.finePrint{color:#8fa9b8;line-height:1.55}.finePrint{font-size:.78rem}.quietButton,.primaryButton,.secondaryButton{border:0;border-radius:999px;padding:10px 14px;font:inherit;font-weight:750;cursor:pointer;text-decoration:none;text-align:center}.quietButton{background:rgba(255,255,255,.06);color:#cdefff;white-space:nowrap}.primaryButton{background:linear-gradient(135deg,#09bce8,#35e3ff);color:#03121b}.secondaryButton{border:1px solid rgba(88,216,255,.25);background:rgba(6,77,103,.36);color:#d9f8ff}.buttonRow{display:flex;flex-wrap:wrap;gap:9px}.compactForm,.reportForm{display:grid;gap:11px}.compactForm{padding-top:8px;border-top:1px solid rgba(255,255,255,.06)}.reportForm{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px}.wide{grid-column:1/-1}label{display:grid;gap:6px;color:#cce6f2;font-size:.84rem}input,textarea{box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:rgba(0,0,0,.19);color:#effbff;font:inherit}textarea{resize:vertical}.reportComposer{border-top:1px solid rgba(255,255,255,.07);padding-top:12px}summary{color:#72e0fa;font-weight:750;cursor:pointer}.status{padding:10px 12px;border-radius:12px;color:#b7d7e5}.status.success{background:rgba(55,216,154,.12);color:#baffdf}.status.error{background:rgba(255,100,100,.12);color:#ffc5c5}.status.info{background:rgba(39,178,225,.1)}.statusDot{width:12px;height:12px;border-radius:50%;background:#526774;box-shadow:0 0 0 5px rgba(82,103,116,.12)}.statusDot.good{background:#28e49d;box-shadow:0 0 14px rgba(40,228,157,.7)}.guidanceList{margin:0;padding-left:20px;display:grid;gap:10px;color:#a9c2cf;line-height:1.5}.guidanceList strong{color:#e4f6ff}@media(max-width:800px){.summaryGrid{grid-template-columns:repeat(2,1fr)}.dashboardGrid{grid-template-columns:1fr}.reportsCard,.guidanceCard{grid-column:auto}.hero{align-items:stretch;flex-direction:column}}@media(max-width:560px){.safetyPage{padding-inline:10px}.reportForm{grid-template-columns:1fr}.wide{grid-column:auto}.itemRow{align-items:stretch;flex-direction:column}}
      `}</style>
    </main>
  );
}
