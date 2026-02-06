"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

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

const resolveMediaUrl = (base, value) => {
  if (!value) return "";
  if (/^(blob:|data:)/i.test(value)) return value;
  return buildApiUrl(base, value);
};

const isVideoUrl = (value) => {
  if (!value) return false;
  return /\.(mp4|webm|mov|m4v)$/i.test(value);
};

const getInitials = (value = "") => {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const buildEmptyLibrary = () => ({
  posts: [],
  videos: [],
  shorts: [],
  saved: [],
});

const getProfileId = (raw) => {
  if (!raw) return "";
  if (Array.isArray(raw)) return raw[0] || "";
  return String(raw);
};

function ProfileSection({ title, items, emptyLabel, mediaBase }) {
  return (
    <section className="profile-section">
      <div className="profile-section-header">
        <h2 className="profile-section-title">{title}</h2>
        <span className="profile-section-count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="profile-empty">{emptyLabel}</div>
      ) : (
        <div className="profile-grid">
          {items.map((item) => {
            const previewUrl = resolveMediaUrl(
              mediaBase,
              item.thumbnailUrl || item.mediaUrl
            );
            const showVideo = isVideoUrl(previewUrl);
            return (
              <article key={`${title}-${item.id}`} className="profile-card">
                <div className="profile-media-preview">
                  {previewUrl ? (
                    showVideo ? (
                      <video src={previewUrl} muted playsInline />
                    ) : (
                      <img src={previewUrl} alt={item.title || "Media preview"} />
                    )
                  ) : (
                    <span className="profile-media-placeholder">No preview</span>
                  )}
                </div>
                <div className="profile-card-body">
                  <h3 className="profile-card-title">
                    {item.title || "Untitled"}
                  </h3>
                  {item.description ? (
                    <p className="profile-card-text">{item.description}</p>
                  ) : null}
                  {item.createdAt ? (
                    <span className="profile-card-meta">
                      {formatDate(item.createdAt)}
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const profileId = useMemo(() => getProfileId(params?.id), [params]);

  const [profile, setProfile] = useState(null);
  const [library, setLibrary] = useState(buildEmptyLibrary);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({ displayName: "", bio: "" });
  const [profilePending, setProfilePending] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarPending, setAvatarPending] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const apiBase = getApiContext().base;

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
    document.body.dataset.page = "profile";
    return () => {
      delete document.body.dataset.page;
    };
  }, []);

  useEffect(() => {
    if (!profileId) {
      setStatus("Missing profile id.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      setStatus("");
      try {
        const res = await apiFetch(`/users/${profileId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setStatus(data?.error || "Profile unavailable.");
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
          setStatus("Unable to load profile.");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, profileId]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    const loadLibrary = async () => {
      setLibraryLoading(true);
      try {
        const res = await apiFetch(`/users/${profileId}/library`);
        const data = await res.json().catch(() => buildEmptyLibrary());
        if (!res.ok) {
          if (!cancelled) setLibrary(buildEmptyLibrary());
          return;
        }
        if (!cancelled) {
          setLibrary({
            posts: data?.posts || [],
            videos: data?.videos || [],
            shorts: data?.shorts || [],
            saved: data?.saved || [],
          });
        }
      } catch {
        if (!cancelled) setLibrary(buildEmptyLibrary());
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    };

    loadLibrary();
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

  const handleProfileSave = async (event) => {
    event.preventDefault();
    if (!profile?.isSelf || profilePending) return;
    setProfilePending(true);
    setStatus("");
    try {
      const payload = {
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        avatarUrl: profile?.avatarUrl || "",
      };
      const res = await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to update profile.");
        return;
      }
      setProfile((prev) => ({ ...(prev || {}), ...(data?.user || {}) }));
      setStatus("Profile updated.");
    } catch {
      setStatus("Unable to update profile.");
    } finally {
      setProfilePending(false);
    }
  };

  const handleAvatarFile = async (file) => {
    if (!file || !profile?.isSelf) return;
    if (!file.type?.startsWith("image/")) {
      setStatus("Please upload an image file.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setAvatarPending(true);
    setStatus("");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await apiFetch("/auth/profile/avatar", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Avatar upload failed.");
        return;
      }
      setProfile((prev) => ({ ...(prev || {}), ...(data?.user || {}) }));
      setAvatarPreview("");
      setStatus("Avatar updated.");
    } catch {
      setStatus("Avatar upload failed.");
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

  const stats = useMemo(() => {
    const savedCount = profile?.isSelf ? library.saved.length : 0;
    return [
      { label: "Posts", value: library.posts.length },
      { label: "Videos", value: library.videos.length },
      { label: "Shorts", value: library.shorts.length },
      { label: "Saved", value: savedCount },
    ];
  }, [library, profile?.isSelf]);

  const displayAvatar = resolveMediaUrl(
    apiBase,
    avatarPreview || profile?.avatarUrl || ""
  );

  if (loading) {
    return (
      <main className="profile-page">
        <section className="glass-card profile-section">
          <div className="profile-empty">Loading profile...</div>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="profile-page">
        <section className="glass-card profile-section">
          <div className="profile-empty">{status || "Profile not found."}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <section className="profile-hero">
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
            {profile.isAdmin ? (
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
              <button
                type="button"
                className="profile-action profile-action-secondary"
                onClick={() => cameraInputRef.current?.click()}
                disabled={avatarPending}
              >
                Use camera
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
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFileInput}
            hidden
          />
        </div>
        <div className="profile-info">
          <h1 className="profile-title">
            {profile.displayName || "Profile"}
            {profile.isAdmin ? (
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
          <p className="profile-bio">
            {profile.bio || "No bio yet."}
          </p>
          <div className="profile-meta">
            {profile.createdAt ? (
              <span>Joined {formatDate(profile.createdAt)}</span>
            ) : null}
            {profile.isSelf ? <span>Private view</span> : null}
          </div>
          <div className="profile-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="profile-stat">
                <span className="profile-stat-value">{stat.value}</span>
                <span className="profile-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
          {status ? <div className="profile-status">{status}</div> : null}
          {profile.isSelf ? (
            <form className="auth-form profile-edit" onSubmit={handleProfileSave}>
              <label className="auth-field">
                Display name
                <input
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

        <section className="profile-library">
        <ProfileSection
          title="Posts"
          items={library.posts}
          emptyLabel="No posts yet."
          mediaBase={apiBase}
        />
        <ProfileSection
          title="Videos"
          items={library.videos}
          emptyLabel="No videos yet."
          mediaBase={apiBase}
        />
        <ProfileSection
          title="Shorts"
          items={library.shorts}
          emptyLabel="No shorts yet."
          mediaBase={apiBase}
        />
        {profile.isSelf ? (
          <ProfileSection
            title="Saved videos"
            items={library.saved}
            emptyLabel="No saved videos yet."
            mediaBase={apiBase}
          />
        ) : null}
        {libraryLoading ? (
          <div className="profile-empty">Loading library...</div>
        ) : null}
        </section>
      </section>
    </main>
  );
}
