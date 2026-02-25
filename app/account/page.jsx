
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AUTH_TOKEN_KEY = "lurkAuthToken";

const resolveClientApiBase = () => {
  if (typeof document === "undefined") return "";
  const docEl = document.documentElement;
  return (
    docEl?.dataset?.apiBase ||
    docEl?.dataset?.nativeApiBase ||
    document.body?.dataset?.apiBase ||
    document.body?.dataset?.nativeApiBase ||
    ""
  );
};

const getApiContext = () => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { base: "", sameOrigin: true };
  }
  const base = resolveClientApiBase();
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

const resolveMediaUrl = (base, value) => {
  if (!value) return "";
  if (/^(blob:|data:)/i.test(value)) return value;
  return buildApiUrl(base, value);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInitials = (value = "") => {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const MEMBER_PERKS = [
  {
    title: "Invite-only room controls",
    detail: "Create private room codes and copy invite links in one click.",
  },
  {
    title: "Founders Circle access",
    detail: "Unlock the curated member room for regulars and early adopters.",
  },
  {
    title: "Founding member identity",
    detail: "Get a visible member marker on your profile for trusted access.",
  },
];

export default function AccountPage() {
  const [mode, setMode] = useState("login");
  const [status, setStatus] = useState("");
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(false);
  const [apiReady, setApiReady] = useState(true);

  const [profileId, setProfileId] = useState("");
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ displayName: "", bio: "" });
  const [profilePending, setProfilePending] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarPending, setAvatarPending] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const displayNameInputRef = useRef(null);

  const apiFetch = useCallback(
    async (path, options = {}) => {
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
    },
    []
  );

  const apiBase = useMemo(() => getApiContext().base, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await apiFetch("/auth/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setUser(data?.user || null);
    } catch {
      setUser(null);
    }
  }, [apiFetch]);

  useEffect(() => {
    document.body.dataset.page = "account";

    const params = new URLSearchParams(window.location.search);
    let shouldReplace = false;
    const token = params.get("auth_session");
    if (token) {
      writeAuthToken(token);
      params.delete("auth_session");
      shouldReplace = true;
    }
    const error = params.get("error");
    if (error) {
      setStatus(error.replace(/_/g, " "));
      params.delete("error");
      shouldReplace = true;
    }
    const verified = params.get("verified");
    if (verified) {
      setStatus("Email verified.");
      params.delete("verified");
      shouldReplace = true;
    }
    const resetTokenParam = params.get("reset_token");
    if (resetTokenParam) {
      setResetToken(resetTokenParam);
      params.delete("reset_token");
      shouldReplace = true;
    }
    if (shouldReplace) {
      const next =
        params.toString().length > 0
          ? `${window.location.pathname}?${params}`
          : window.location.pathname;
      window.history.replaceState({}, "", next);
    }

    const checkApi = async () => {
      try {
        const apiContext = getApiContext();
        if (!apiContext.base) {
          setApiReady(true);
          return;
        }
        const res = await fetch(buildApiUrl(apiContext.base, "/ready"));
        if (!res.ok) throw new Error("not_ready");
        setApiReady(true);
      } catch {
        setApiReady(false);
        setStatus(
          "Auth server is offline. Start the API server or update NEXT_PUBLIC_API_URL."
        );
      }
    };

    checkApi().then(() => loadCurrentUser());

    return () => {
      delete document.body.dataset.page;
    };
  }, [loadCurrentUser]);

  useEffect(() => {
    if (!user) {
      setProfileId("");
      setProfile(null);
      setProfileForm({ displayName: "", bio: "" });
      setLoadingProfile(false);
      return;
    }
    setProfileId(String(user.id));
    setResetEmail(user.email || "");
    setStatus("");
  }, [user]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    const loadProfile = async () => {
      setLoadingProfile(true);
      setProfileStatus("");
      try {
        const res = await apiFetch(`/users/${profileId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setProfileStatus(data?.error || "Profile unavailable.");
            setProfile(null);
          }
          return;
        }
        if (!cancelled) {
          setProfile(data?.user || null);
          setProfileForm({
            displayName: data?.user?.displayName || "",
            bio: data?.user?.bio || "",
          });
        }
      } catch {
        if (!cancelled) {
          setProfileStatus("Unable to load profile.");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, profileId]);

  useEffect(() => {
    if (!avatarPreview) return;
    previewUrlRef.current = avatarPreview;
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
    };
  }, [avatarPreview]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    const payload = {
      email: form.get("email"),
      password: form.get("password"),
    };
    if (mode === "register") {
      payload.displayName = form.get("displayName");
      payload.profileName = form.get("profileName");
      payload.profileAge = form.get("profileAge");
      payload.profileGender = form.get("profileGender");
      payload.profileInterests = form.get("profileInterests");
      payload.redirect = `${window.location.origin}/account`;
    }
    try {
      const res = await apiFetch(
        mode === "register" ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to sign in.");
        return;
      }
      if (data?.sessionToken) {
        writeAuthToken(data.sessionToken);
      }
      setUser(data?.user || null);
      if (mode === "register") {
        if (data?.verificationLink && window.location.hostname === "localhost") {
          setStatus(`Account created. Verification link (dev): ${data.verificationLink}`);
        } else {
          setStatus("Account created. Check your email to verify.");
        }
      } else {
        setStatus("Signed in successfully.");
      }
      event.currentTarget.reset();
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    if (!profile?.isSelf || profilePending) return;
    setProfilePending(true);
    setProfileStatus("");
    try {
      const payload = {
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        avatarUrl: profile?.avatarUrl || user?.avatarUrl || "",
      };
      const res = await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileStatus(data?.error || "Unable to update profile.");
        return;
      }
      setProfile((prev) => ({ ...(prev || {}), ...(data?.user || {}) }));
      setUser((prev) => (prev ? { ...prev, ...(data?.user || {}) } : prev));
      setProfileStatus("Profile updated.");
    } catch {
      setProfileStatus("Unable to update profile.");
    } finally {
      setProfilePending(false);
    }
  };

  const handleAvatarFile = async (file) => {
    if (!file || !profile?.isSelf) return;
    if (!file.type?.startsWith("image/")) {
      setProfileStatus("Please upload an image file.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setAvatarPending(true);
    setProfileStatus("");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await apiFetch("/auth/profile/avatar", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileStatus(data?.error || "Avatar upload failed.");
        return;
      }
      setProfile((prev) => ({ ...(prev || {}), ...(data?.user || {}) }));
      setUser((prev) => (prev ? { ...prev, ...(data?.user || {}) } : prev));
      setAvatarPreview("");
      setProfileStatus("Avatar updated.");
    } catch {
      setProfileStatus("Avatar upload failed.");
    } finally {
      setAvatarPending(false);
    }
  };

  const handleFileInput = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleAvatarFile(file);
    }
    event.target.value = "";
  };

  const handleDragOver = (event) => {
    if (!profile?.isSelf) return;
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    if (!profile?.isSelf) return;
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event) => {
    if (!profile?.isSelf) return;
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleAvatarFile(file);
  };

  const focusDisplayNameInput = useCallback(() => {
    const input = displayNameInputRef.current;
    if (!input) return;
    input.focus();
    const length = input.value?.length || 0;
    input.setSelectionRange?.(length, length);
  }, []);

  const handleResetRequest = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("");
    try {
      const res = await apiFetch("/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({
          email: resetEmail,
          redirect: `${window.location.origin}/account`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to send reset link.");
        return;
      }
      if (data?.resetLink && window.location.hostname === "localhost") {
        setStatus(`Reset link (dev): ${data.resetLink}`);
      } else {
        setStatus("Reset email sent. Check your inbox.");
      }
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleResetConfirm = async (event) => {
    event.preventDefault();
    if (pending) return;
    if (resetPassword.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (resetPassword !== resetConfirm) {
      setStatus("Passwords do not match.");
      return;
    }
    setPending(true);
    setStatus("");
    try {
      const res = await apiFetch("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({
          token: resetToken,
          password: resetPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to reset password.");
        return;
      }
      setResetToken("");
      setResetPassword("");
      setResetConfirm("");
      setStatus("Password updated. You can sign in now.");
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = () => {
    if (!apiReady) {
      setStatus(
        "Auth server is offline. Start the API server or update NEXT_PUBLIC_API_URL."
      );
      return;
    }
    const apiContext = getApiContext();
    const redirect = `${window.location.origin}/account`;
    const url = buildApiUrl(
      apiContext.base,
      `/auth/google?redirect=${encodeURIComponent(redirect)}`
    );
    window.location.href = url;
  };

  const displayAvatar = resolveMediaUrl(
    apiBase,
    avatarPreview || profile?.avatarUrl || user?.avatarUrl || ""
  );
  const isAdmin = Boolean(profile?.isAdmin || user?.isAdmin);

  if (!user) {
    return (
      <>
        <main className="auth-page">
          <section className="glass-card auth-card">
            <h2>Account</h2>
            <p className="auth-subtitle">
              Create an account to personalize your Lurk experience, or sign in with
              Google.
            </p>
            <section className="auth-member-perks" aria-label="Member benefits">
              <p className="auth-member-perks-kicker">Founding member unlocks</p>
              <ul>
                {MEMBER_PERKS.map((perk) => (
                  <li key={perk.title}>
                    <strong>{perk.title}.</strong> {perk.detail}
                  </li>
                ))}
              </ul>
            </section>
            <div className="auth-toggle">
              <button
                type="button"
                className={`auth-toggle-btn ${mode === "login" ? "is-active" : ""}`}
                onClick={() => setMode("login")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-toggle-btn ${mode === "register" ? "is-active" : ""}`}
                onClick={() => setMode("register")}
              >
                Create account
              </button>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <>
                  <label className="auth-field">
                    Display name
                    <input name="displayName" type="text" autoComplete="name" />
                  </label>
                  <label className="auth-field">
                    Name (optional)
                    <input name="profileName" type="text" autoComplete="name" />
                  </label>
                  <label className="auth-field">
                    Age (optional)
                    <input name="profileAge" type="number" min={1} max={120} />
                  </label>
                  <label className="auth-field">
                    Gender (optional)
                    <input name="profileGender" type="text" maxLength={40} />
                  </label>
                  <label className="auth-field">
                    Interests (optional)
                    <textarea name="profileInterests" rows={2} maxLength={320} />
                  </label>
                </>
              ) : null}
              <label className="auth-field">
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label className="auth-field">
                Password
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                />
              </label>
              <button type="submit" className="auth-button" disabled={pending}>
                {pending
                  ? "Working..."
                  : mode === "register"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogle}
              disabled={!apiReady}
            >
              Continue with Google
            </button>
            <div className="auth-section">
              <h3 className="auth-section-title">Forgot password</h3>
              {resetToken ? (
                <form className="auth-form" onSubmit={handleResetConfirm}>
                  <label className="auth-field">
                    New password
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      minLength={8}
                      required
                    />
                  </label>
                  <label className="auth-field">
                    Confirm password
                    <input
                      type="password"
                      value={resetConfirm}
                      onChange={(event) => setResetConfirm(event.target.value)}
                      minLength={8}
                      required
                    />
                  </label>
                  <button type="submit" className="auth-button" disabled={pending}>
                    {pending ? "Updating..." : "Update password"}
                  </button>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleResetRequest}>
                  <label className="auth-field">
                    Email
                    <input
                      name="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="auth-button auth-secondary"
                    disabled={pending}
                  >
                    {pending ? "Sending..." : "Send reset link"}
                  </button>
                </form>
              )}
            </div>
            {status ? <div className="auth-status">{status}</div> : null}
          </section>
        </main>
      </>
    );
  }

  return (
    <main className="profile-page">
      <section className="profile-shell">
        {profile ? (
          <>
            <section className="profile-hero">
              {profile.isSelf ? (
                <div className="profile-hero-actions">
                  {isAdmin ? (
                    <a
                      href="/admin"
                      className="profile-admin-link"
                      aria-label="Administrator controls"
                      title="Administrator controls"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M12 2l7 3v6c0 4.6-3 8.8-7 11-4-2.2-7-6.4-7-11V5l7-3z"></path>
                        <path d="M9 12l2 2 4-4"></path>
                      </svg>
                    </a>
                  ) : null}
                  <a
                    href="/settings"
                    className="profile-settings-link"
                    aria-label="Account controls"
                    title="Account controls"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M12 8.7a3.3 3.3 0 1 0 0 6.6a3.3 3.3 0 0 0 0-6.6z"></path>
                      <path d="M4.6 13.6l-1.7-1 1-1.7 2-0.2a6.8 6.8 0 0 1 1-1.7l-0.8-1.8 1.7-1 1.5 1.3a7 7 0 0 1 2-0.6l0.7-2h2l0.7 2a7 7 0 0 1 2 0.6l1.5-1.3 1.7 1-0.8 1.8a6.8 6.8 0 0 1 1 1.7l2 0.2 1 1.7-1.7 1-0.2 2a6.8 6.8 0 0 1-1 1.7l0.8 1.8-1.7 1-1.5-1.3a7 7 0 0 1-2 0.6l-0.7 2h-2l-0.7-2a7 7 0 0 1-2-0.6l-1.5 1.3-1.7-1 0.8-1.8a6.8 6.8 0 0 1-1-1.7l-2-0.2z"></path>
                    </svg>
                  </a>
                </div>
              ) : null}
              <div className="profile-avatar-block">
                <div className="profile-avatar-shell">
                  <div
                    className={`profile-avatar ${profile.isSelf ? "is-droppable" : ""} ${
                      dragActive ? "is-dragging" : ""
                    }`}
                    onClick={() => profile.isSelf && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    role={profile.isSelf ? "button" : undefined}
                    tabIndex={profile.isSelf ? 0 : -1}
                  >
                    {displayAvatar ? (
                      <img src={displayAvatar} alt={profile.displayName || "Profile"} />
                    ) : (
                      <span className="profile-avatar-fallback">
                        {getInitials(profile.displayName)}
                      </span>
                    )}
                    {profile.isSelf ? (
                      <div className="profile-avatar-overlay">
                        Drag & drop or click to update
                      </div>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <span
                      className="profile-admin-badge"
                      title="Administrator"
                      aria-label="Administrator"
                      role="img"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M7 11h10l-1.2 9H8.2L7 11z"></path>
                        <path d="M9.5 11V8.8a2.5 2.5 0 1 1 5 0V11"></path>
                      </svg>
                    </span>
                  ) : null}
                </div>
                {profile.isSelf ? (
                  <div className="profile-avatar-actions">
                    <button
                      type="button"
                      className="profile-action"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarPending}
                    >
                      Upload photo
                    </button>
                  </div>
                ) : null}
                {avatarPending ? (
                  <div className="profile-avatar-status">Uploading...</div>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  hidden
                />
              </div>
              <div className="profile-info">
                <h1 className="profile-title">
                  {profile.displayName || "Profile"}
                  {profile.isSelf ? (
                    <button
                      type="button"
                      className="profile-title-edit"
                      onClick={focusDisplayNameInput}
                      aria-label="Edit display name"
                      title="Edit display name"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M4 20h4l10.6-10.6a1.4 1.4 0 0 0 0-2L16.6 5.4a1.4 1.4 0 0 0-2 0L4 16v4z"></path>
                        <path d="M13.4 6.6l4 4"></path>
                      </svg>
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <span
                      className="profile-admin-key"
                      title="Administrator"
                      aria-label="Administrator"
                      role="img"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M7.5 14a4.5 4.5 0 1 1 4.1-6.4l5.4 5.4-1.8 1.8-1.2-1.2-1.4 1.4-1.2-1.2-1.4 1.4-2.1-2.1a4.5 4.5 0 0 1-0.8 0.1z"></path>
                        <circle cx="7.5" cy="14" r="1.7"></circle>
                      </svg>
                    </span>
                  ) : null}
                </h1>
                <p className="profile-bio">{profile.bio || "No bio yet."}</p>
                <div className="profile-meta">
                  {profile.createdAt ? (
                    <span>Joined {formatDate(profile.createdAt)}</span>
                  ) : null}
                  <span className="profile-member-chip">Founding member</span>
                  {profile.isSelf ? <span>Private view</span> : null}
                </div>
                {profileStatus ? (
                  <div className="profile-status">{profileStatus}</div>
                ) : null}
                {profile.isSelf ? (
                  <form className="auth-form profile-edit" onSubmit={handleProfileSave}>
                    <label className="auth-field">
                      Display name
                      <input
                        id="profile-display-name"
                        ref={displayNameInputRef}
                        type="text"
                        value={profileForm.displayName}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            displayName: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="auth-field">
                      Bio
                      <textarea
                        rows={3}
                        value={profileForm.bio}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            bio: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="submit"
                      className="auth-button"
                      disabled={profilePending}
                    >
                      {profilePending ? "Saving..." : "Save profile"}
                    </button>
                  </form>
                ) : null}
              </div>
            </section>

          </>
        ) : (
          <section className="profile-section">
            <div className="profile-empty">
              {loadingProfile
                ? "Loading profile..."
                : profileStatus || "Profile unavailable."}
            </div>
          </section>
        )}

        {status ? <div className="auth-status">{status}</div> : null}
      </section>
    </main>
  );
}
