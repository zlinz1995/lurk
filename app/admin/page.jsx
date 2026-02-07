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

const DIRECTORY_ACTIONS = [
  { value: "", label: "Select action", requires: null },
  { value: "suspend", label: "Suspend user", requires: "user_suspend" },
  { value: "unsuspend", label: "Unsuspend user", requires: "user_suspend" },
  { value: "ban", label: "Ban user", requires: "user_permanent_bans" },
  { value: "unban", label: "Unban user", requires: "user_permanent_bans" },
  { value: "force-logout", label: "Force logout", requires: "user_force_logout" },
  { value: "shadow-restrict", label: "Shadow restrict", requires: "user_shadow_restrict" },
  { value: "shadow-unrestrict", label: "Shadow unrestrict", requires: "user_shadow_restrict" },
  { value: "verify", label: "Verify", requires: "user_verify_accounts" },
  { value: "unverify", label: "Unverify", requires: "user_verify_accounts" },
];

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

const formatDetail = (detail) => {
  if (!detail) return "";
  if (typeof detail !== "string") {
    return JSON.stringify(detail);
  }
  const trimmed = detail.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      return detail;
    }
  }
  return detail;
};

const normalizeDatetime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
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
  const actionTimerRef = useRef(null);

  const [actionStatus, setActionStatus] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [userLookupId, setUserLookupId] = useState("");
  const [userSnapshot, setUserSnapshot] = useState(null);
  const [userActionLog, setUserActionLog] = useState([]);
  const [userRiskFlags, setUserRiskFlags] = useState([]);
  const [userDirectory, setUserDirectory] = useState([]);
  const [userDirectoryTotal, setUserDirectoryTotal] = useState(0);
  const [userDirectoryLoading, setUserDirectoryLoading] = useState(false);
  const [directoryActions, setDirectoryActions] = useState({});
  const [riskFlagForm, setRiskFlagForm] = useState({ flag: "", level: "", note: "" });
  const [riskResolveId, setRiskResolveId] = useState("");
  const [trustOverride, setTrustOverride] = useState("");
  const [suspendUntil, setSuspendUntil] = useState("");
  const [resetDisplayName, setResetDisplayName] = useState("");
  const [threadId, setThreadId] = useState("");
  const [postId, setPostId] = useState("");

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

  useEffect(() => {
    setUserSnapshot(null);
    setUserActionLog([]);
    setUserRiskFlags([]);
  }, [userLookupId]);

  useEffect(() => {
    if (userDirectory.length === 0) return;
    setDirectoryActions((prev) => {
      const next = { ...prev };
      let changed = false;
      userDirectory.forEach((user) => {
        if (!next[user.id]) {
          next[user.id] = "";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [userDirectory]);

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

  const scheduleActionStatus = useCallback((message) => {
    if (!message) return;
    if (actionTimerRef.current) {
      clearTimeout(actionTimerRef.current);
    }
    setActionStatus(message);
    actionTimerRef.current = setTimeout(() => {
      setActionStatus("");
    }, 2000);
  }, []);

  const buildReasonPayload = useCallback(
    (extra = {}) => {
      const payload = { ...extra };
      const reason = reasonCode.trim();
      if (reason) payload.reason = reason;
      return payload;
    },
    [reasonCode]
  );

  const performAdminAction = useCallback(
    async (path, options = {}) => {
      setActionBusy(true);
      setActionStatus("");
      try {
        const res = await apiFetch(path, options);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.error === "reason_required") {
            scheduleActionStatus("Reason code required.");
          } else {
            scheduleActionStatus(data?.error || "Unable to complete action.");
          }
          return { ok: false, data };
        }
        return { ok: true, data };
      } catch {
        scheduleActionStatus("Network error.");
        return { ok: false };
      } finally {
        setActionBusy(false);
      }
    },
    [apiFetch, scheduleActionStatus]
  );

  const fetchUserSnapshot = useCallback(
    async (id) => {
      if (!id) {
        scheduleActionStatus("Enter a user id.");
        return null;
      }
      const res = await performAdminAction(`/admin/users/${id}`);
      if (!res.ok) return null;
      setUserSnapshot(res.data?.user || null);
      return res.data?.user || null;
    },
    [performAdminAction, scheduleActionStatus]
  );

  const fetchUserActions = useCallback(
    async (id) => {
      if (!id) return;
      const res = await performAdminAction(`/admin/users/${id}/actions?limit=50`);
      if (!res.ok) return;
      setUserActionLog(Array.isArray(res.data?.actions) ? res.data.actions : []);
    },
    [performAdminAction]
  );

  const fetchRiskFlags = useCallback(
    async (id) => {
      if (!id) return;
      const res = await performAdminAction(
        `/admin/users/${id}/risk-flags?includeResolved=1`
      );
      if (!res.ok) return;
      setUserRiskFlags(Array.isArray(res.data?.flags) ? res.data.flags : []);
    },
    [performAdminAction]
  );

  const loadUserDirectory = useCallback(async () => {
    if (!settingsReady || !settings.user_view_private_metadata) return;
    setUserDirectoryLoading(true);
    const res = await performAdminAction("/admin/users?limit=200&offset=0");
    if (res.ok) {
      setUserDirectory(Array.isArray(res.data?.users) ? res.data.users : []);
      setUserDirectoryTotal(Number(res.data?.total) || 0);
    }
    setUserDirectoryLoading(false);
  }, [performAdminAction, settingsReady, settings.user_view_private_metadata]);

  useEffect(() => {
    if (!isAdmin || !settingsReady) return;
    if (!settings.user_view_private_metadata) return;
    loadUserDirectory();
  }, [isAdmin, loadUserDirectory, settings.user_view_private_metadata, settingsReady]);

  const runUserAction = useCallback(
    async (id, path, payload = null) => {
      if (!id) {
        scheduleActionStatus("Enter a user id.");
        return;
      }
      const options = { method: "POST" };
      if (payload && Object.keys(payload).length > 0) {
        options.body = JSON.stringify(payload);
      }
      const res = await performAdminAction(`/admin/users/${id}/${path}`, options);
      if (!res.ok) return;
      scheduleActionStatus("Action applied.");
      await fetchUserSnapshot(id);
      await fetchUserActions(id);
      await fetchRiskFlags(id);
    },
    [fetchRiskFlags, fetchUserActions, fetchUserSnapshot, performAdminAction, scheduleActionStatus]
  );

  const runContentAction = useCallback(
    async (path, payload = null) => {
      const options = { method: "POST" };
      if (payload && Object.keys(payload).length > 0) {
        options.body = JSON.stringify(payload);
      }
      const res = await performAdminAction(path, options);
      if (!res.ok) return;
      scheduleActionStatus("Content action applied.");
    },
    [performAdminAction, scheduleActionStatus]
  );

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

  const formattedUserActions = useMemo(() => {
    return userActionLog.map((entry) => {
      const date = new Date(entry.created_at || entry.timestamp || "");
      const ts = Number.isNaN(date.getTime())
        ? entry.created_at || entry.timestamp || ""
        : date.toLocaleString();
      return { ...entry, ts };
    });
  }, [userActionLog]);

  const formattedRiskFlags = useMemo(() => {
    return userRiskFlags.map((entry) => {
      const date = new Date(entry.created_at || "");
      const ts = Number.isNaN(date.getTime()) ? entry.created_at || "" : date.toLocaleString();
      return { ...entry, ts };
    });
  }, [userRiskFlags]);

  const formattedDirectory = useMemo(() => {
    return userDirectory.map((entry) => {
      const date = new Date(entry.createdAt || "");
      const ts = Number.isNaN(date.getTime()) ? entry.createdAt || "" : date.toLocaleString();
      return { ...entry, ts };
    });
  }, [userDirectory]);

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
        {actionStatus ? <div className="admin-status-banner">{actionStatus}</div> : null}

        <div className="admin-grid">
          <section className="admin-card">
            <h2>Registered accounts</h2>
            <p>Snapshot of recently created accounts and usernames.</p>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={loadUserDirectory}
                disabled={
                  actionBusy ||
                  userDirectoryLoading ||
                  !settingsReady ||
                  !settings.user_view_private_metadata
                }
              >
                {userDirectoryLoading ? "Loading..." : "Refresh list"}
              </button>
              <span className="admin-status">
                {userDirectoryTotal
                  ? `Total accounts: ${userDirectoryTotal}`
                  : "Total accounts: —"}
              </span>
            </div>
            {formattedDirectory.length === 0 ? (
              <div className="admin-status">No accounts loaded.</div>
            ) : (
              <div className="admin-user-list">
                <div className="admin-user-row admin-user-header">
                  <span className="admin-user-cell">ID</span>
                  <span className="admin-user-cell">Username</span>
                  <span className="admin-user-cell">Email</span>
                  <span className="admin-user-cell">Created</span>
                  <span className="admin-user-cell">Admin</span>
                  <span className="admin-user-cell">Quick action</span>
                </div>
                {formattedDirectory.map((user) => (
                  <div key={user.id} className="admin-user-row">
                    <span className="admin-user-cell">{user.id}</span>
                    <span className="admin-user-cell">
                      {user.displayName || "—"}
                    </span>
                    <span className="admin-user-cell">{user.email || "—"}</span>
                    <span className="admin-user-cell">{user.ts || "—"}</span>
                    <span className="admin-user-cell">
                      {user.isAdmin ? "Yes" : "No"}
                    </span>
                    <span className="admin-user-cell admin-user-action-cell">
                      <select
                        className="admin-user-select"
                        value={directoryActions[user.id] || ""}
                        onChange={(event) =>
                          setDirectoryActions((prev) => ({
                            ...prev,
                            [user.id]: event.target.value,
                          }))
                        }
                        disabled={actionBusy || !settingsReady}
                      >
                        {DIRECTORY_ACTIONS.map((option) => (
                          <option
                            key={option.value || "none"}
                            value={option.value}
                            disabled={
                              option.requires
                                ? !settings[option.requires]
                                : false
                            }
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="admin-button admin-user-action-button"
                        onClick={() => {
                          const action = directoryActions[user.id];
                          if (!action) {
                            scheduleActionStatus("Select an action.");
                            return;
                          }
                          const meta = DIRECTORY_ACTIONS.find(
                            (entry) => entry.value === action
                          );
                          if (meta?.requires && !settings[meta.requires]) {
                            scheduleActionStatus("Permission disabled.");
                            return;
                          }
                          runUserAction(user.id, action, buildReasonPayload());
                        }}
                        disabled={
                          actionBusy ||
                          !settingsReady ||
                          !directoryActions[user.id]
                        }
                      >
                        Apply
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="admin-card">
            <h2>Administrator actions</h2>
            <p>Lookup users and apply enforcement actions.</p>
            <label className="admin-field">
              User ID
              <input
                type="number"
                min="1"
                value={userLookupId}
                onChange={(event) => setUserLookupId(event.target.value)}
                placeholder="Enter user id"
                disabled={actionBusy}
              />
            </label>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={async () => {
                  const id = userLookupId.trim();
                  if (!id) return scheduleActionStatus("Enter a user id.");
                  const user = await fetchUserSnapshot(id);
                  if (!user) return;
                  await fetchUserActions(id);
                  await fetchRiskFlags(id);
                  scheduleActionStatus("User loaded.");
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_view_private_metadata
                }
              >
                Load user
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  if (!id) return scheduleActionStatus("Enter a user id.");
                  fetchUserActions(id);
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_view_moderation_history
                }
              >
                Load user actions
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  if (!id) return scheduleActionStatus("Enter a user id.");
                  fetchRiskFlags(id);
                }}
                disabled={actionBusy || !settingsReady || !settings.user_risk_flags}
              >
                Load risk flags
              </button>
            </div>

            {userSnapshot ? (
              <div className="admin-log">
                <div className="admin-log-title">User snapshot</div>
                <div className="admin-log-entry">
                  <div className="admin-log-label">
                    {userSnapshot.displayName || "User"} (#{userSnapshot.id})
                  </div>
                  <div className="admin-log-meta">
                    {userSnapshot.email || "no-email"} · Verified:
                    {userSnapshot.emailVerified ? " yes" : " no"} · Admin:
                    {userSnapshot.isAdmin ? " yes" : " no"}
                  </div>
                  <div className="admin-log-meta">
                    Suspended:
                    {userSnapshot.isSuspended ? " yes" : " no"}
                    {userSnapshot.suspendedUntil
                      ? ` · Until: ${userSnapshot.suspendedUntil}`
                      : ""}
                    {userSnapshot.suspendedReason
                      ? ` · Reason: ${userSnapshot.suspendedReason}`
                      : ""}
                  </div>
                  <div className="admin-log-meta">
                    Banned:
                    {userSnapshot.isBanned ? " yes" : " no"}
                    {userSnapshot.bannedReason
                      ? ` · Reason: ${userSnapshot.bannedReason}`
                      : ""}
                  </div>
                  <div className="admin-log-meta">
                    Shadow restricted:
                    {userSnapshot.shadowRestricted ? " yes" : " no"} · Trust override:
                    {userSnapshot.trustOverride || " none"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="admin-status">No user loaded.</div>
            )}

            <label className="admin-field">
              Suspend until (optional)
              <input
                type="datetime-local"
                value={suspendUntil}
                onChange={(event) => setSuspendUntil(event.target.value)}
                disabled={actionBusy}
              />
            </label>
            <label className="admin-field">
              Reset display name (optional)
              <input
                type="text"
                value={resetDisplayName}
                onChange={(event) => setResetDisplayName(event.target.value)}
                disabled={actionBusy}
              />
            </label>
            <label className="admin-field">
              Trust override
              <select
                value={trustOverride}
                onChange={(event) => setTrustOverride(event.target.value)}
                disabled={actionBusy}
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="neutral">Neutral</option>
                <option value="high">High</option>
              </select>
            </label>

            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  const untilIso = normalizeDatetime(suspendUntil);
                  const payload = buildReasonPayload(
                    untilIso ? { until: untilIso } : {}
                  );
                  runUserAction(id, "suspend", payload);
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_suspend
                }
              >
                Suspend
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "unsuspend", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_suspend
                }
              >
                Unsuspend
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "ban", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_permanent_bans
                }
              >
                Ban
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "unban", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_permanent_bans
                }
              >
                Unban
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "shadow-restrict", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_shadow_restrict
                }
              >
                Shadow restrict
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "shadow-unrestrict", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_shadow_restrict
                }
              >
                Shadow unrestrict
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "force-logout", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_force_logout
                }
              >
                Force logout
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  const payload = buildReasonPayload(
                    resetDisplayName.trim()
                      ? { displayName: resetDisplayName.trim() }
                      : {}
                  );
                  runUserAction(id, "reset-profile", payload);
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_reset_profile
                }
              >
                Reset profile
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "verify", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_verify_accounts
                }
              >
                Verify
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  runUserAction(id, "unverify", buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_verify_accounts
                }
              >
                Unverify
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  const payload = buildReasonPayload({
                    level: trustOverride || "",
                  });
                  runUserAction(id, "trust-override", payload);
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_risk_flags
                }
              >
                Apply trust override
              </button>
            </div>

            {formattedUserActions.length > 0 ? (
              <div className="admin-log">
                <div className="admin-log-title">Recent user actions</div>
                {formattedUserActions.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="admin-log-entry">
                    <div className="admin-log-label">{entry.action}</div>
                    <div className="admin-log-meta">
                      {formatDetail(entry.detail)}
                      {entry.reason ? ` · Reason: ${entry.reason}` : ""}
                    </div>
                    <div className="admin-log-time">{entry.ts}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="admin-card">
            <h2>Risk flags</h2>
            <p>Track and resolve elevated trust risks.</p>
            <label className="admin-field">
              Flag code
              <input
                type="text"
                value={riskFlagForm.flag}
                onChange={(event) =>
                  setRiskFlagForm((prev) => ({ ...prev, flag: event.target.value }))
                }
                disabled={actionBusy}
              />
            </label>
            <label className="admin-field">
              Flag level
              <input
                type="text"
                value={riskFlagForm.level}
                onChange={(event) =>
                  setRiskFlagForm((prev) => ({ ...prev, level: event.target.value }))
                }
                disabled={actionBusy}
              />
            </label>
            <label className="admin-field">
              Notes
              <textarea
                rows={2}
                value={riskFlagForm.note}
                onChange={(event) =>
                  setRiskFlagForm((prev) => ({ ...prev, note: event.target.value }))
                }
                disabled={actionBusy}
              />
            </label>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  const payload = buildReasonPayload({
                    flag: riskFlagForm.flag,
                    level: riskFlagForm.level,
                    note: riskFlagForm.note,
                  });
                  runUserAction(id, "risk-flags", payload);
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_risk_flags
                }
              >
                Add flag
              </button>
            </div>
            <label className="admin-field">
              Resolve flag ID
              <input
                type="number"
                min="1"
                value={riskResolveId}
                onChange={(event) => setRiskResolveId(event.target.value)}
                disabled={actionBusy}
              />
            </label>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  const id = userLookupId.trim();
                  if (!riskResolveId.trim()) {
                    scheduleActionStatus("Enter a flag id.");
                    return;
                  }
                  runUserAction(id, `risk-flags/${riskResolveId.trim()}/resolve`, buildReasonPayload());
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.user_risk_flags
                }
              >
                Resolve flag
              </button>
            </div>

            {formattedRiskFlags.length > 0 ? (
              <div className="admin-log">
                <div className="admin-log-title">Risk flags</div>
                {formattedRiskFlags.slice(0, 6).map((flag) => (
                  <div key={flag.id} className="admin-log-entry">
                    <div className="admin-log-label">
                      {flag.flag}
                      {flag.level ? ` · ${flag.level}` : ""}
                    </div>
                    <div className="admin-log-meta">
                      {flag.note || ""}
                      {flag.resolved_at ? " · Resolved" : " · Active"}
                    </div>
                    <div className="admin-log-time">{flag.ts}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-status">No risk flags loaded.</div>
            )}
          </section>

          <section className="admin-card">
            <h2>Content moderation</h2>
            <p>Remove, restore, or freeze threads and comments.</p>
            <label className="admin-field">
              Thread ID
              <input
                type="number"
                min="1"
                value={threadId}
                onChange={(event) => setThreadId(event.target.value)}
                disabled={actionBusy}
              />
            </label>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  if (!threadId.trim()) {
                    scheduleActionStatus("Enter a thread id.");
                    return;
                  }
                  runContentAction(
                    `/admin/threads/${threadId.trim()}/delete`,
                    buildReasonPayload()
                  );
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.content_remove
                }
              >
                Delete thread
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  if (!threadId.trim()) {
                    scheduleActionStatus("Enter a thread id.");
                    return;
                  }
                  runContentAction(
                    `/admin/threads/${threadId.trim()}/restore`,
                    buildReasonPayload()
                  );
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.content_restore
                }
              >
                Restore thread
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  if (!threadId.trim()) {
                    scheduleActionStatus("Enter a thread id.");
                    return;
                  }
                  runContentAction(
                    `/admin/threads/${threadId.trim()}/freeze`,
                    buildReasonPayload()
                  );
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.content_freeze_threads
                }
              >
                Freeze thread
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  if (!threadId.trim()) {
                    scheduleActionStatus("Enter a thread id.");
                    return;
                  }
                  runContentAction(
                    `/admin/threads/${threadId.trim()}/unfreeze`,
                    buildReasonPayload()
                  );
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.content_freeze_threads
                }
              >
                Unfreeze thread
              </button>
            </div>

            <label className="admin-field">
              Comment ID
              <input
                type="number"
                min="1"
                value={postId}
                onChange={(event) => setPostId(event.target.value)}
                disabled={actionBusy}
              />
            </label>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  if (!postId.trim()) {
                    scheduleActionStatus("Enter a comment id.");
                    return;
                  }
                  runContentAction(
                    `/admin/posts/${postId.trim()}/delete`,
                    buildReasonPayload()
                  );
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.content_remove
                }
              >
                Delete comment
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  if (!postId.trim()) {
                    scheduleActionStatus("Enter a comment id.");
                    return;
                  }
                  runContentAction(
                    `/admin/posts/${postId.trim()}/restore`,
                    buildReasonPayload()
                  );
                }}
                disabled={
                  actionBusy || !settingsReady || !settings.content_restore
                }
              >
                Restore comment
              </button>
            </div>
          </section>
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
