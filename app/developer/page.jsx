"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const AUTH_TOKEN_KEY = "lurkAuthToken";

const getApiContext = () => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { base: "", sameOrigin: true };
  }
  const base = document.documentElement?.dataset?.apiBase || "";
  if (!base) {
    return { base: "", sameOrigin: true };
  }
  try {
    const origin = new URL(base).origin;
    return { base, sameOrigin: origin === window.location.origin };
  } catch {
    return { base: "", sameOrigin: true };
  }
};

const buildApiUrl = (base, path) => {
  if (!path) return base || "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};

const readAuthToken = () => {
  try {
    return window.localStorage?.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

const writeAuthToken = (token) => {
  try {
    if (!token) {
      window.localStorage?.removeItem(AUTH_TOKEN_KEY);
    } else {
      window.localStorage?.setItem(AUTH_TOKEN_KEY, token);
    }
    window.dispatchEvent(new Event("lurk-auth-change"));
  } catch {
    // Ignore storage failures.
  }
};

const defaultRegister = {
  email: "",
  displayName: "",
  password: "",
  confirm: "",
  agreeSolo: false,
  agreeRights: false,
};

const defaultSubmission = {
  title: "",
  description: "",
  tags: "",
  authorName: "",
  buildUrl: "",
  sourceUrl: "",
  thumbnailUrl: "",
  orientation: "landscape",
  minPlayers: "1",
  maxPlayers: "1",
};

export default function DeveloperPage() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [registerForm, setRegisterForm] = useState(defaultRegister);
  const [registerStatus, setRegisterStatus] = useState("");
  const [registerPending, setRegisterPending] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState("");
  const [upgradePending, setUpgradePending] = useState(false);
  const [submissionForm, setSubmissionForm] = useState(defaultSubmission);
  const [submissionList, setSubmissionList] = useState([]);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [submissionPending, setSubmissionPending] = useState(false);
  const [submissionLoading, setSubmissionLoading] = useState(false);

  const apiFetch = useCallback(async (path, options = {}) => {
    const apiContext = getApiContext();
    const headers = new Headers(options.headers || {});
    const token = readAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (options.body && !headers.has("Content-Type")) {
      if (!(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }
    }
    const url = buildApiUrl(apiContext.base, path);
    return fetch(url, {
      ...options,
      headers,
      credentials: apiContext.sameOrigin ? "include" : "omit",
    });
  }, []);

  useEffect(() => {
    document.body.dataset.page = "developer";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadUser = async () => {
      try {
        const res = await apiFetch("/auth/me");
        if (!res.ok) {
          if (!cancelled) {
            setUser(null);
            setReady(true);
          }
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setUser(data?.user || null);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setReady(true);
        }
      }
    };

    loadUser();

    const refresh = () => loadUser();
    window.addEventListener("lurk-auth-change", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("lurk-auth-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [apiFetch]);

  useEffect(() => {
    if (!user?.isDeveloper || !user?.emailVerified) {
      setSubmissionList([]);
      return;
    }
    let cancelled = false;
    const loadSubmissions = async () => {
      setSubmissionLoading(true);
      try {
        const res = await apiFetch("/playables/submissions");
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setSubmissionList(Array.isArray(data?.submissions) ? data.submissions : []);
        }
      } catch {
        if (!cancelled) {
          setSubmissionList([]);
        }
      } finally {
        if (!cancelled) setSubmissionLoading(false);
      }
    };
    loadSubmissions();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, user]);

  const isDeveloper = Boolean(user?.isDeveloper);
  const emailVerified = Boolean(user?.emailVerified);
  const canSubmit = isDeveloper && emailVerified;

  const updateRegisterField = (key) => (event) => {
    const value = event?.target?.type === "checkbox" ? event.target.checked : event.target.value;
    setRegisterForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateSubmissionField = (key) => (event) => {
    const value = event?.target?.value ?? "";
    setSubmissionForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setRegisterStatus("");
    if (!registerForm.agreeSolo || !registerForm.agreeRights) {
      setRegisterStatus("Please confirm the developer terms.");
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      setRegisterStatus("Passwords do not match.");
      return;
    }
    setRegisterPending(true);
    try {
      const res = await apiFetch("/auth/register-developer", {
        method: "POST",
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
          displayName: registerForm.displayName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegisterStatus(data?.error || "Unable to create developer account.");
        return;
      }
      if (data?.sessionToken) {
        writeAuthToken(data.sessionToken);
      }
      setRegisterForm(defaultRegister);
      setRegisterStatus("Developer account created. Check your email to verify.");
      setUser(data?.user || null);
    } catch {
      setRegisterStatus("Unable to create developer account.");
    } finally {
      setRegisterPending(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeStatus("");
    setUpgradePending(true);
    try {
      const res = await apiFetch("/developers/upgrade", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUpgradeStatus(data?.error || "Unable to enable developer access.");
        return;
      }
      setUpgradeStatus("Developer access enabled.");
      setUser((prev) => (prev ? { ...prev, isDeveloper: true } : prev));
    } catch {
      setUpgradeStatus("Unable to enable developer access.");
    } finally {
      setUpgradePending(false);
    }
  };

  const handleSubmission = async (event) => {
    event.preventDefault();
    if (!isDeveloper) {
      setSubmissionStatus("Developer access is required before submitting.");
      return;
    }
    if (!emailVerified) {
      setSubmissionStatus("Verify your email to submit a playable.");
      return;
    }
    setSubmissionPending(true);
    setSubmissionStatus("");
    try {
      const payload = {
        title: submissionForm.title,
        description: submissionForm.description,
        tags: submissionForm.tags,
        authorName: submissionForm.authorName,
        buildUrl: submissionForm.buildUrl,
        sourceUrl: submissionForm.sourceUrl,
        thumbnailUrl: submissionForm.thumbnailUrl,
        orientation: submissionForm.orientation,
        minPlayers: Number.parseInt(submissionForm.minPlayers, 10) || 1,
        maxPlayers: Number.parseInt(submissionForm.maxPlayers, 10) || 1,
      };
      const res = await apiFetch("/playables/submissions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmissionStatus(data?.error || "Unable to submit playable.");
        return;
      }
      setSubmissionForm(defaultSubmission);
      setSubmissionStatus("Submission received. We will review it shortly.");
      if (data?.submission) {
        setSubmissionList((prev) => [data.submission, ...prev]);
      }
    } catch {
      setSubmissionStatus("Unable to submit playable.");
    } finally {
      setSubmissionPending(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (!ready) return "Checking access...";
    if (!user) return "Sign in to activate your developer tools.";
    if (!isDeveloper) return "Developer access is not enabled yet.";
    if (!emailVerified) return "Verify your email to unlock submissions.";
    return "Developer access active.";
  }, [emailVerified, isDeveloper, ready, user]);

  return (
    <main className="developer-page">
      <section className="developer-shell">
        <header className="developer-hero">
          <div>
            <h1>Developer Access</h1>
            <p>
              Create a secure developer account, submit your playable build, and track review
              status in one place.
            </p>
            <a className="developer-link" href="/account">
              Sign in or manage your account
            </a>
          </div>
          <div className="developer-status-chip">{statusLabel}</div>
        </header>

        <section className="developer-grid">
          <div className="developer-card">
            <h2>Register a developer account</h2>
            <p>
              Solo developers only. Your email will be verified before submissions are accepted.
            </p>
            <form className="developer-form" onSubmit={handleRegister}>
              <label>
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={updateRegisterField("email")}
                  placeholder="you@studio.dev"
                  required
                />
              </label>
              <label>
                Display name
                <input
                  type="text"
                  value={registerForm.displayName}
                  onChange={updateRegisterField("displayName")}
                  placeholder="Studio or handle"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={updateRegisterField("password")}
                  minLength="8"
                  required
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={registerForm.confirm}
                  onChange={updateRegisterField("confirm")}
                  minLength="8"
                  required
                />
              </label>
              <label className="developer-checkbox">
                <input
                  type="checkbox"
                  checked={registerForm.agreeSolo}
                  onChange={updateRegisterField("agreeSolo")}
                />
                I am a solo developer or single-owner studio.
              </label>
              <label className="developer-checkbox">
                <input
                  type="checkbox"
                  checked={registerForm.agreeRights}
                  onChange={updateRegisterField("agreeRights")}
                />
                I confirm I own the rights to the game I submit.
              </label>
              <button type="submit" disabled={registerPending} className="developer-action">
                {registerPending ? "Creating..." : "Create developer account"}
              </button>
              {registerStatus ? <div className="developer-status">{registerStatus}</div> : null}
            </form>
          </div>

          <div className="developer-card">
            <h2>Upgrade an existing account</h2>
            <p>
              If you already have a Lurk account, enable developer access here. We will
              verify your email before submissions go through.
            </p>
            <button
              type="button"
              className="developer-action"
              onClick={handleUpgrade}
              disabled={!user || isDeveloper || upgradePending}
            >
              {upgradePending ? "Enabling..." : "Enable developer access"}
            </button>
            {upgradeStatus ? <div className="developer-status">{upgradeStatus}</div> : null}
          </div>
        </section>

        <section className="developer-card">
          <h2>Submit a playable</h2>
          <p>
            Provide a hosted build URL for review. Once approved, an admin will publish your
            game on the Lurk Playables page.
          </p>
          <form className="developer-form" onSubmit={handleSubmission}>
            <label>
              Title
              <input
                type="text"
                value={submissionForm.title}
                onChange={updateSubmissionField("title")}
                placeholder="Your game title"
                required
                disabled={!canSubmit}
              />
            </label>
            <label>
              Description
              <textarea
                rows="3"
                value={submissionForm.description}
                onChange={updateSubmissionField("description")}
                placeholder="Short summary of the game"
                disabled={!canSubmit}
              />
            </label>
            <label>
              Tags
              <input
                type="text"
                value={submissionForm.tags}
                onChange={updateSubmissionField("tags")}
                placeholder="arcade, puzzle, rhythm"
                disabled={!canSubmit}
              />
            </label>
            <label>
              Author / Studio
              <input
                type="text"
                value={submissionForm.authorName}
                onChange={updateSubmissionField("authorName")}
                placeholder="Optional studio name"
                disabled={!canSubmit}
              />
            </label>
            <label>
              Review build URL
              <input
                type="url"
                value={submissionForm.buildUrl}
                onChange={updateSubmissionField("buildUrl")}
                placeholder="https://yourgame.dev/build"
                required
                disabled={!canSubmit}
              />
            </label>
            <label>
              Source / press link
              <input
                type="url"
                value={submissionForm.sourceUrl}
                onChange={updateSubmissionField("sourceUrl")}
                placeholder="https://github.com/you/game"
                disabled={!canSubmit}
              />
            </label>
            <label>
              Thumbnail URL
              <input
                type="url"
                value={submissionForm.thumbnailUrl}
                onChange={updateSubmissionField("thumbnailUrl")}
                placeholder="https://yourcdn.dev/thumb.jpg"
                disabled={!canSubmit}
              />
            </label>
            <div className="developer-row">
              <label>
                Orientation
                <select
                  value={submissionForm.orientation}
                  onChange={updateSubmissionField("orientation")}
                  disabled={!canSubmit}
                >
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </label>
              <label>
                Min players
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={submissionForm.minPlayers}
                  onChange={updateSubmissionField("minPlayers")}
                  disabled={!canSubmit}
                />
              </label>
              <label>
                Max players
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={submissionForm.maxPlayers}
                  onChange={updateSubmissionField("maxPlayers")}
                  disabled={!canSubmit}
                />
              </label>
            </div>
            <button
              type="submit"
              className="developer-action"
              disabled={submissionPending || !canSubmit}
            >
              {submissionPending ? "Submitting..." : "Submit for review"}
            </button>
            {submissionStatus ? <div className="developer-status">{submissionStatus}</div> : null}
          </form>
        </section>

        <section className="developer-card">
          <div className="developer-submissions-header">
            <h2>Your submissions</h2>
            {submissionLoading ? <span>Refreshing...</span> : null}
          </div>
          {submissionList.length ? (
            <div className="developer-submission-list">
              {submissionList.map((submission) => (
                <div key={submission.id} className="developer-submission">
                  <div>
                    <strong>{submission.title}</strong>
                    <p>{submission.description || "No description provided."}</p>
                    <div className="developer-meta">
                      <span>Status: {submission.status}</span>
                      {submission.reviewedAt ? (
                        <span>Reviewed: {new Date(submission.reviewedAt).toLocaleDateString()}</span>
                      ) : null}
                    </div>
                  </div>
                  {submission.adminNotes ? (
                    <div className="developer-notes">Admin notes: {submission.adminNotes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="developer-empty">
              {submissionLoading ? "Loading submissions..." : "No submissions yet."}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
