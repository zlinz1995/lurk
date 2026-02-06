"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUTH_TOKEN_KEY = "lurkAuthToken";

const DEFAULT_SETTINGS = {
  discovery_show_profile: true,
  discovery_allow_recommendations: true,
  discovery_hide_activity_non_followers: false,
  connections_require_approval: true,
  connections_contacts_only: false,
  connections_requests_visibility: "followers",
  posting_auto_archive: true,
  posting_review_required: false,
  posting_default_audience: "followers",
  interaction_allow_reactions: true,
  interaction_allow_comments_followers: true,
  interaction_allow_tagging: false,
  messaging_dm_policy: "followers",
  messaging_requests: "filtered",
  safety_filter_sensitive: true,
  safety_block_known_abusive: true,
  safety_hide_reported: false,
  visibility_show_mutuals: true,
  visibility_hide_spoilers: false,
  visibility_boost_verified: true,
  identity_show_join_date: true,
  identity_hide_follower_count: false,
  identity_display_name_visibility: "public",
  notifications_mentions: true,
  notifications_direct_messages: true,
  notifications_product_updates: false,
  security_two_step: true,
  security_login_alerts: false,
  advanced_experimental: false,
  advanced_low_bandwidth: true,
  advanced_refresh_rate: "normal",
};

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
  } catch {
    // Ignore storage failures.
  }
};

export default function SettingsPage() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const saveCounterRef = useRef({});
  const statusTimerRef = useRef(null);

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

  const scheduleStatus = useCallback((message, { clear = true, timeout = 1600 } = {}) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    setStatus(message);
    if (clear) {
      statusTimerRef.current = setTimeout(() => {
        setStatus("");
      }, timeout);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const res = await apiFetch("/auth/settings");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to load settings.");
        return;
      }
      setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings || {}) });
    } catch {
      setStatus("Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = useCallback(
    async (key, value) => {
      const requestId = (saveCounterRef.current[key] || 0) + 1;
      saveCounterRef.current[key] = requestId;
      const previous = settings[key];

      setSettings((prev) => ({ ...prev, [key]: value }));

      try {
        const res = await apiFetch("/auth/settings", {
          method: "PATCH",
          body: JSON.stringify({ settings: { [key]: value } }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "save_failed");
        }
        if (saveCounterRef.current[key] !== requestId) return;
        if (data?.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        scheduleStatus("Settings saved.");
      } catch {
        if (saveCounterRef.current[key] !== requestId) return;
        setSettings((prev) => ({ ...prev, [key]: previous }));
        setStatus("Unable to save settings.");
      }
    },
    [apiFetch, scheduleStatus, settings]
  );

  const handleSignOut = async () => {
    if (pending) return;
    setPending(true);
    setStatus("");
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout failures.
    } finally {
      writeAuthToken("");
      setPending(false);
      setStatus("Signed out.");
      window.location.href = "/account";
    }
  };

  const banner = loading ? "Loading settings..." : status;
  const inputsDisabled = loading || pending;

  return (
    <main className="settings-page">
      <section className="settings-shell">
        <header className="settings-header">
          <div>
            <h1 className="settings-title">Account Controls</h1>
            <p className="settings-subtitle">
              Manage how you show up across Lurk, who can reach you, and how content
              is handled.
            </p>
          </div>
          <a className="settings-back" href="/account">
            Back to profile
          </a>
        </header>

        <div className="settings-grid">
          <section className="settings-card">
            <h2>Account visibility and discovery</h2>
            <p>Decide how your profile appears across the platform.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.discovery_show_profile}
                  onChange={(event) =>
                    updateSetting("discovery_show_profile", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Show profile in search results</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.discovery_allow_recommendations}
                  onChange={(event) =>
                    updateSetting(
                      "discovery_allow_recommendations",
                      event.target.checked
                    )
                  }
                  disabled={inputsDisabled}
                />
                <span>Allow profile recommendations</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.discovery_hide_activity_non_followers}
                  onChange={(event) =>
                    updateSetting(
                      "discovery_hide_activity_non_followers",
                      event.target.checked
                    )
                  }
                  disabled={inputsDisabled}
                />
                <span>Hide activity status from non-followers</span>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2>Connection and relationship controls</h2>
            <p>Shape how people can follow or connect with you.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.connections_require_approval}
                  onChange={(event) =>
                    updateSetting("connections_require_approval", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Require approval for new followers</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.connections_contacts_only}
                  onChange={(event) =>
                    updateSetting("connections_contacts_only", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Allow connections from contacts only</span>
              </label>
            </div>
            <label className="settings-field">
              Connection requests visibility
              <select
                value={settings.connections_requests_visibility}
                onChange={(event) =>
                  updateSetting("connections_requests_visibility", event.target.value)
                }
                disabled={inputsDisabled}
              >
                <option value="everyone">Everyone</option>
                <option value="followers">Followers only</option>
                <option value="nobody">Nobody</option>
              </select>
            </label>
          </section>

          <section className="settings-card">
            <h2>Posting and content controls</h2>
            <p>Control who sees your posts and when they appear.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.posting_auto_archive}
                  onChange={(event) =>
                    updateSetting("posting_auto_archive", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Auto-archive posts after 30 days</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.posting_review_required}
                  onChange={(event) =>
                    updateSetting("posting_review_required", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Require review before public posting</span>
              </label>
            </div>
            <label className="settings-field">
              Default audience
              <select
                value={settings.posting_default_audience}
                onChange={(event) =>
                  updateSetting("posting_default_audience", event.target.value)
                }
                disabled={inputsDisabled}
              >
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="private">Only me</option>
              </select>
            </label>
          </section>

          <section className="settings-card">
            <h2>Interaction permissions</h2>
            <p>Set who can react, comment, or tag you.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.interaction_allow_reactions}
                  onChange={(event) =>
                    updateSetting("interaction_allow_reactions", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Allow reactions on your posts</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.interaction_allow_comments_followers}
                  onChange={(event) =>
                    updateSetting(
                      "interaction_allow_comments_followers",
                      event.target.checked
                    )
                  }
                  disabled={inputsDisabled}
                />
                <span>Allow comments from followers</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.interaction_allow_tagging}
                  onChange={(event) =>
                    updateSetting("interaction_allow_tagging", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Allow tagging in posts</span>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2>Messaging and communication rules</h2>
            <p>Manage who can send DMs and message requests.</p>
            <div className="settings-control">
              <label className="settings-field">
                Who can send you DMs
                <select
                  value={settings.messaging_dm_policy}
                  onChange={(event) =>
                    updateSetting("messaging_dm_policy", event.target.value)
                  }
                  disabled={inputsDisabled}
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
              <label className="settings-field">
                Message requests
                <select
                  value={settings.messaging_requests}
                  onChange={(event) =>
                    updateSetting("messaging_requests", event.target.value)
                  }
                  disabled={inputsDisabled}
                >
                  <option value="filtered">Filtered</option>
                  <option value="all">All requests</option>
                  <option value="none">Off</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2>Safety and abuse controls</h2>
            <p>Reduce unwanted content and manage safety filters.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.safety_filter_sensitive}
                  onChange={(event) =>
                    updateSetting("safety_filter_sensitive", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Filter sensitive content</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.safety_block_known_abusive}
                  onChange={(event) =>
                    updateSetting("safety_block_known_abusive", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Block known abusive accounts</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.safety_hide_reported}
                  onChange={(event) =>
                    updateSetting("safety_hide_reported", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Hide content reported by others</span>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2>Content visibility preferences</h2>
            <p>Fine-tune what content appears in your feeds.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.visibility_show_mutuals}
                  onChange={(event) =>
                    updateSetting("visibility_show_mutuals", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Show content from mutuals</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.visibility_hide_spoilers}
                  onChange={(event) =>
                    updateSetting("visibility_hide_spoilers", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Hide content with spoilers</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.visibility_boost_verified}
                  onChange={(event) =>
                    updateSetting("visibility_boost_verified", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Boost content from verified creators</span>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2>Identity and profile controls</h2>
            <p>Decide what profile data is visible.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.identity_show_join_date}
                  onChange={(event) =>
                    updateSetting("identity_show_join_date", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Show join date on profile</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.identity_hide_follower_count}
                  onChange={(event) =>
                    updateSetting("identity_hide_follower_count", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Hide follower count</span>
              </label>
            </div>
            <label className="settings-field">
              Display name visibility
              <select
                value={settings.identity_display_name_visibility}
                onChange={(event) =>
                  updateSetting("identity_display_name_visibility", event.target.value)
                }
                disabled={inputsDisabled}
              >
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="private">Only me</option>
              </select>
            </label>
          </section>

          <section className="settings-card">
            <h2>Notifications and alerts</h2>
            <p>Pick what notifications are important to you.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.notifications_mentions}
                  onChange={(event) =>
                    updateSetting("notifications_mentions", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Mentions and replies</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.notifications_direct_messages}
                  onChange={(event) =>
                    updateSetting("notifications_direct_messages", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Direct messages</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.notifications_product_updates}
                  onChange={(event) =>
                    updateSetting("notifications_product_updates", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Product updates</span>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <h2>Data security and account control</h2>
            <p>Control account security, sessions, and access.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.security_two_step}
                  onChange={(event) =>
                    updateSetting("security_two_step", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Require 2-step verification</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.security_login_alerts}
                  onChange={(event) =>
                    updateSetting("security_login_alerts", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Notify me about new logins</span>
              </label>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-button"
                onClick={handleSignOut}
                disabled={pending}
              >
                {pending ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </section>

          <section className="settings-card">
            <h2>Advanced and platform specific controls</h2>
            <p>Additional controls for power users and platform features.</p>
            <div className="settings-control">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.advanced_experimental}
                  onChange={(event) =>
                    updateSetting("advanced_experimental", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Enable experimental features</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.advanced_low_bandwidth}
                  onChange={(event) =>
                    updateSetting("advanced_low_bandwidth", event.target.checked)
                  }
                  disabled={inputsDisabled}
                />
                <span>Use low-bandwidth mode</span>
              </label>
            </div>
            <label className="settings-field">
              Content refresh rate
              <select
                value={settings.advanced_refresh_rate}
                onChange={(event) =>
                  updateSetting("advanced_refresh_rate", event.target.value)
                }
                disabled={inputsDisabled}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          </section>
        </div>

        {banner ? <div className="settings-status">{banner}</div> : null}
      </section>
    </main>
  );
}
