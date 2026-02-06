"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AUTH_TOKEN_KEY = "lurkAuthToken";

const DEFAULT_SETTINGS = {
  user_suspend: true,
  user_permanent_bans: true,
  user_shadow_restrict: true,
  user_force_logout: true,
  user_reset_profile: true,
  user_verify_accounts: true,
  user_view_private_metadata: true,
  user_view_moderation_history: true,
  user_merge_split: true,
  user_risk_flags: true,
  content_remove: true,
  content_restore: true,
  content_soft_hard_delete: true,
  content_disable_comments: true,
  content_freeze_threads: true,
  content_view_edit_history: true,
  content_apply_strikes: true,
  content_rate_limit_posting: true,
  content_media_type_bans: true,
  policy_edit_guidelines: true,
  policy_violation_categories: true,
  policy_penalty_ladders: true,
  policy_reportable_types: true,
  policy_platform_filters: true,
  policy_global_feature_controls: true,
  policy_appeal_eligibility: true,
  report_view_all: true,
  report_prioritize: true,
  report_handle_appeals: true,
  report_reverse_actions: true,
  report_escalate_cases: true,
  report_annotate_required: true,
  roles_manage: true,
  roles_assign_admin: true,
  roles_time_limit: true,
  roles_emergency_elevation: true,
  health_spam_bot_dash: true,
  health_coordinated_abuse: true,
  health_mass_report_monitor: true,
  health_trending_alerts: true,
  health_rate_limit_metrics: true,
  health_shadowban_analytics: true,
  system_feature_toggle: true,
  system_reco_algorithms: true,
  system_ab_testing: true,
  system_feature_rollbacks: true,
  system_traffic_throttling: false,
  system_incident_response: false,
  privacy_legal_requests: true,
  privacy_dmca: true,
  privacy_data_export: true,
  privacy_retention: true,
  privacy_gdpr_tools: true,
  privacy_immutable_audit_logs: true,
  monetization_enable: true,
  monetization_freeze_payouts: false,
  monetization_reverse_tx: true,
  monetization_handle_fraud: true,
  monetization_tipping_subs: true,
  emergency_posting_freeze: false,
  emergency_upload_shutdown: false,
  emergency_comment_lockdown: false,
  emergency_feature_killswitch: false,
  emergency_region_shutdowns: false,
  admin_view_actions: true,
  admin_per_admin_audit_logs: true,
  admin_mandatory_reason_codes: false,
};

const ADMIN_SECTIONS = [
  {
    id: "user",
    title: "User and account management",
    description: "Manage account states, suspensions, and identity verification.",
    items: [
      { key: "user_suspend", label: "Suspend / unsuspend users" },
      { key: "user_permanent_bans", label: "Permanent bans" },
      { key: "user_shadow_restrict", label: "Shadow restrict / visibility suppression" },
      { key: "user_force_logout", label: "Force logout all sessions" },
      { key: "user_reset_profile", label: "Reset usernames & profile data" },
      { key: "user_verify_accounts", label: "Verify / unverify accounts" },
      { key: "user_view_private_metadata", label: "View private account metadata" },
      { key: "user_view_moderation_history", label: "View moderation & enforcement history" },
      { key: "user_merge_split", label: "Merge / split accounts" },
      { key: "user_risk_flags", label: "Apply risk flags & trust overrides" },
    ],
  },
  {
    id: "content",
    title: "Content moderation and enforcement",
    description: "Review flagged content and apply enforcement actions.",
    items: [
      { key: "content_remove", label: "Remove posts, comments, messages" },
      { key: "content_restore", label: "Restore removed content" },
      { key: "content_soft_hard_delete", label: "Soft-delete & hard-delete" },
      { key: "content_disable_comments", label: "Disable comments on posts" },
      { key: "content_freeze_threads", label: "Freeze threads" },
      { key: "content_view_edit_history", label: "View edit history & deleted content" },
      { key: "content_apply_strikes", label: "Apply strikes & penalties" },
      { key: "content_rate_limit_posting", label: "Rate-limit posting" },
      { key: "content_media_type_bans", label: "Media-type bans (e.g. \"no video uploads\")" },
    ],
  },
  {
    id: "policy",
    title: "Community and policy controls",
    description: "Update rules, policy exceptions, and community health thresholds.",
    items: [
      { key: "policy_edit_guidelines", label: "Create / edit community guidelines" },
      { key: "policy_violation_categories", label: "Define violation categories" },
      { key: "policy_penalty_ladders", label: "Configure penalty ladders" },
      { key: "policy_reportable_types", label: "Define reportable content types" },
      { key: "policy_platform_filters", label: "Configure platform-wide filters" },
      { key: "policy_global_feature_controls", label: "Enable / disable features globally" },
      { key: "policy_appeal_eligibility", label: "Control appeal eligibility" },
    ],
  },
  {
    id: "reports",
    title: "Reporting, appeals, and disputes",
    description: "Handle user reports, appeals, and dispute resolutions.",
    items: [
      { key: "report_view_all", label: "View all reports" },
      { key: "report_prioritize", label: "Prioritize reports" },
      { key: "report_handle_appeals", label: "Handle appeals" },
      { key: "report_reverse_actions", label: "Reverse moderator actions" },
      { key: "report_escalate_cases", label: "Escalate cases" },
      { key: "report_annotate_required", label: "Annotate decisions (required)" },
    ],
  },
  {
    id: "roles",
    title: "Role-based access control",
    description: "Assign roles, permissions, and admin scopes.",
    items: [
      { key: "roles_manage", label: "Create / edit / remove roles" },
      { key: "roles_assign_admin", label: "Assign admin & moderator roles" },
      { key: "roles_time_limit", label: "Time-limit privileges" },
      { key: "roles_emergency_elevation", label: "Emergency privilege elevation" },
    ],
  },
  {
    id: "health",
    title: "Platform health and abuse detection",
    description: "Monitor abuse signals, spam surges, and safety alerts.",
    items: [
      { key: "health_spam_bot_dash", label: "Spam & bot dashboards" },
      { key: "health_coordinated_abuse", label: "Coordinated abuse detection" },
      { key: "health_mass_report_monitor", label: "Mass-report monitoring" },
      { key: "health_trending_alerts", label: "Trending content alerts" },
      { key: "health_rate_limit_metrics", label: "Rate-limit metrics" },
      { key: "health_shadowban_analytics", label: "Shadow-ban effectiveness analytics" },
    ],
  },
  {
    id: "system",
    title: "System and feature controls",
    description: "Toggle platform features and release gates.",
    items: [
      { key: "system_feature_toggle", label: "Enable / disable platform features" },
      { key: "system_reco_algorithms", label: "Control recommendation algorithms" },
      { key: "system_ab_testing", label: "A/B testing" },
      { key: "system_feature_rollbacks", label: "Feature rollbacks" },
      { key: "system_traffic_throttling", label: "Traffic throttling" },
      { key: "system_incident_response", label: "Incident response mode" },
    ],
  },
  {
    id: "privacy",
    title: "Data privacy and compliance",
    description: "Respond to data requests and compliance workflows.",
    items: [
      { key: "privacy_legal_requests", label: "Access user data for legal requests" },
      { key: "privacy_dmca", label: "Handle DMCA / takedown workflows" },
      { key: "privacy_data_export", label: "Data export & deletion" },
      { key: "privacy_retention", label: "Retention policy enforcement" },
      { key: "privacy_gdpr_tools", label: "GDPR-style compliance tools" },
      { key: "privacy_immutable_audit_logs", label: "Immutable audit logs" },
    ],
  },
  {
    id: "monetization",
    title: "Monetization and economic controls",
    description: "Manage payouts, subscriptions, and revenue safeguards.",
    items: [
      { key: "monetization_enable", label: "Enable / disable monetization" },
      { key: "monetization_freeze_payouts", label: "Freeze payouts" },
      { key: "monetization_reverse_tx", label: "Reverse transactions" },
      { key: "monetization_handle_fraud", label: "Handle fraud" },
      { key: "monetization_tipping_subs", label: "Configure tipping & subscriptions" },
    ],
  },
  {
    id: "emergency",
    title: "Emergency controls",
    description: "Global freeze and safety kill-switches.",
    items: [
      { key: "emergency_posting_freeze", label: "Global posting freeze" },
      { key: "emergency_upload_shutdown", label: "Upload shutdown" },
      { key: "emergency_comment_lockdown", label: "Comment lockdown" },
      { key: "emergency_feature_killswitch", label: "Feature kill-switch" },
      { key: "emergency_region_shutdowns", label: "Region-specific shutdowns" },
    ],
  },
  {
    id: "transparency",
    title: "Admin transparency and accountability",
    description: "Audit logs, change history, and accountability reviews.",
    items: [
      { key: "admin_view_actions", label: "View all admin actions" },
      { key: "admin_per_admin_audit_logs", label: "Immutable per-admin audit logs" },
      { key: "admin_mandatory_reason_codes", label: "Mandatory reason codes" },
    ],
  },
];

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


export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [actionLog, setActionLog] = useState([]);
  const [savingKey, setSavingKey] = useState("");
  const saveTimerRef = useRef(null);

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
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setStatus("");
      try {
        const res = await apiFetch("/auth/me");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setIsAdmin(false);
            setStatus("Admin access only.");
          }
          return;
        }
        if (!cancelled) {
          setIsAdmin(Boolean(data?.user?.isAdmin));
          if (!data?.user?.isAdmin) setStatus("Admin access only.");
        }
      } catch {
        if (!cancelled) setStatus("Unable to verify admin access.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const loadAdminSettings = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/settings");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error || "Unable to load admin settings.");
        return false;
      }
      setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings || {}) });
      setSettingsReady(true);
      return true;
    } catch {
      setStatus("Unable to load admin settings.");
      return false;
    }
  }, [apiFetch]);

  const loadAdminActions = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/actions?limit=50");
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.actions)) {
        setActionLog(data.actions);
      }
    } catch {
      // Ignore action load failures.
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!isAdmin) {
      setSettingsReady(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setSettingsReady(false);
      const ok = await loadAdminSettings();
      if (!ok || cancelled) return;
      await loadAdminActions();
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadAdminActions, loadAdminSettings]);

  const requireReason = settings.admin_mandatory_reason_codes;

  const scheduleStatusClear = useCallback((message) => {
    if (!message) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setStatus(message);
    saveTimerRef.current = setTimeout(() => {
      setStatus("");
    }, 1600);
  }, []);

  const handleToggle = useCallback(
    async (item) => {
      if (!settingsReady || savingKey) return;
      if (requireReason && !reasonCode.trim() && item.key !== "admin_mandatory_reason_codes") {
        scheduleStatusClear("Reason code required.");
        return;
      }
      const nextValue = !settings[item.key];
      const previous = settings;
      setSettings((prev) => ({ ...prev, [item.key]: nextValue }));
      setSavingKey(item.key);
      try {
        const res = await apiFetch("/admin/settings", {
          method: "PATCH",
          body: JSON.stringify({
            settings: { [item.key]: nextValue },
            reason: reasonCode.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSettings(previous);
          if (data?.error === "reason_required") {
            scheduleStatusClear("Reason code required.");
          } else {
            scheduleStatusClear("Unable to save changes.");
          }
          return;
        }
        setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings || {}) });
        if (Array.isArray(data?.actions)) {
          setActionLog(data.actions);
        } else {
          loadAdminActions();
        }
        scheduleStatusClear("Changes saved.");
      } catch {
        setSettings(previous);
        scheduleStatusClear("Unable to save changes.");
      } finally {
        setSavingKey("");
      }
    },
    [
      apiFetch,
      loadAdminActions,
      reasonCode,
      requireReason,
      savingKey,
      scheduleStatusClear,
      settings,
      settingsReady,
    ]
  );

  const handleResetDefaults = useCallback(async () => {
    if (!settingsReady || savingKey) return;
    if (requireReason && !reasonCode.trim()) {
      scheduleStatusClear("Reason code required.");
      return;
    }
    setSavingKey("reset");
    try {
      const res = await apiFetch("/admin/settings/reset", {
        method: "POST",
        body: JSON.stringify({ reason: reasonCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "reason_required") {
          scheduleStatusClear("Reason code required.");
        } else {
          scheduleStatusClear("Unable to reset defaults.");
        }
        return;
      }
      setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings || {}) });
      if (Array.isArray(data?.actions)) {
        setActionLog(data.actions);
      } else {
        loadAdminActions();
      }
      scheduleStatusClear("Defaults restored.");
    } catch {
      scheduleStatusClear("Unable to reset defaults.");
    } finally {
      setSavingKey("");
    }
  }, [
    apiFetch,
    loadAdminActions,
    reasonCode,
    requireReason,
    savingKey,
    scheduleStatusClear,
    settingsReady,
  ]);

  const formattedLog = useMemo(() => {
    return actionLog.map((entry) => {
      const date = new Date(entry.created_at || entry.timestamp || "");
      const ts = Number.isNaN(date.getTime())
        ? entry.created_at || entry.timestamp || ""
        : date.toLocaleString();
      return { ...entry, ts };
    });
  }, [actionLog]);

  if (loading) {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <div className="admin-status">Loading admin console...</div>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <div className="admin-status">{status || "Admin access only."}</div>
          <a className="admin-back" href="/account">
            Back to profile
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <header className="admin-header">
          <div>
            <h1 className="admin-title">Administrator Console</h1>
            <p className="admin-subtitle">
              High-impact controls for platform safety, governance, and operations.
            </p>
          </div>
          <a className="admin-back" href="/account">
            Back to profile
          </a>
        </header>

        <div className="admin-toolbar">
          <label className="admin-field">
            Reason code
            <input
              type="text"
              placeholder={
                requireReason
                  ? "Required when changing admin settings"
                  : "Optional reason for this change"
              }
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              disabled={Boolean(savingKey)}
            />
          </label>
          <button
            type="button"
            className="admin-button"
            onClick={handleResetDefaults}
            disabled={Boolean(savingKey)}
          >
            Reset defaults
          </button>
          {status ? <div className="admin-status-banner">{status}</div> : null}
        </div>

        <div className="admin-grid">
          {ADMIN_SECTIONS.map((section) => (
            <section key={section.id} className="admin-card">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              <div className="admin-control-list">
                {section.items.map((item) => (
                  <label key={item.key} className="admin-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(settings[item.key])}
                      disabled={!settingsReady || Boolean(savingKey)}
                      onChange={() => handleToggle(item)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              {section.id === "transparency" ? (
                <div className="admin-log">
                  <div className="admin-log-title">Recent admin actions</div>
                  {!settings.admin_view_actions ? (
                    <div className="admin-log-entry">Admin action log is disabled.</div>
                  ) : formattedLog.length === 0 ? (
                    <div className="admin-log-entry">No actions recorded.</div>
                  ) : (
                    formattedLog.slice(0, 8).map((entry) => (
                      <div key={entry.id} className="admin-log-entry">
                        <div className="admin-log-label">{entry.action}</div>
                        <div className="admin-log-meta">
                          {entry.detail}
                          {entry.reason ? ` - Reason: ${entry.reason}` : ""}
                          {entry.admin_name || entry.admin_email
                            ? ` - By: ${entry.admin_name || entry.admin_email}`
                            : ""}
                        </div>
                        <div className="admin-log-time">{entry.ts}</div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
