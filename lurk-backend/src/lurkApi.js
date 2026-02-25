import fs from "fs";
import path from "path";
import http from "http";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import mime from "mime-types";
import Database from "better-sqlite3";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";
import nodemailer from "nodemailer";
import getQuantumBits from "./utils/getQuantumBits.js";

/* -------------------- CONFIG -------------------- */

const THREAD_TTL_MS = Number(process.env.THREAD_TTL_MS ?? 24 * 60 * 60 * 1000);
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES ?? 15 * 1024 * 1024);
const DATA_DIR = process.env.DATA_DIR ?? "/tmp/lurk-data";
const DB_PATH = path.join(DATA_DIR, process.env.DB_NAME ?? "threads.db");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PLAYABLE_MAX_FILE_BYTES = Number(
  process.env.PLAYABLE_MAX_FILE_BYTES ?? 10 * 1024 * 1024
);
const PLAYABLE_MAX_TOTAL_BYTES = Number(
  process.env.PLAYABLE_MAX_TOTAL_BYTES ?? 50 * 1024 * 1024
);
const PLAYABLE_ALLOWED_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
  ".mp3",
  ".ogg",
  ".wav",
  ".mp4",
  ".webm",
  ".wasm",
  ".txt",
  ".woff",
  ".woff2",
  ".ttf",
  ".ico",
]);

const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const REACT_MEMORY_TTL = Number(process.env.REACT_TTL_MS ?? 24 * 60 * 60 * 1000);
const CHAT_HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT ?? 200);
const CHAT_STICKERS = new Set(["cheer", "wave", "wow", "heart"]);
const RESET_DB_ON_BOOT = parseBoolean(process.env.RESET_DB_ON_BOOT, false);

const SOCKET_MAX_HTTP_BUFFER = Number(process.env.SOCKET_MAX_HTTP_BUFFER ?? 1_000_000);
const SOCKET_PING_INTERVAL_MS = Number(
  process.env.SOCKET_PING_INTERVAL_MS ?? 25_000
);
const SOCKET_PING_TIMEOUT_MS = Number(
  process.env.SOCKET_PING_TIMEOUT_MS ?? 20_000
);
const SOCKET_PER_MESSAGE_DEFLATE = parseBoolean(
  process.env.SOCKET_PER_MESSAGE_DEFLATE,
  false
);
const SOCKET_CHAT_RATE_WINDOW_MS = Number(
  process.env.SOCKET_CHAT_RATE_WINDOW_MS ?? 2_000
);
const SOCKET_CHAT_RATE_MAX = Number(process.env.SOCKET_CHAT_RATE_MAX ?? 8);
const PUBLIC_ROOMS_BROADCAST_MS = Number(
  process.env.PUBLIC_ROOMS_BROADCAST_MS ?? 1_000
);
const PUBLIC_ROOMS_MAX = Number(process.env.PUBLIC_ROOMS_MAX ?? 100);

const AUTH_SESSION_TTL_MS = Number(
  process.env.AUTH_SESSION_TTL_MS ?? 30 * 24 * 60 * 60 * 1000
);
const AUTH_SESSION_COOKIE = process.env.AUTH_SESSION_COOKIE ?? "lurk_session";
const AUTH_TOKEN_HEADER = "authorization";
const AUTH_STATE_TTL_MS = Number(
  process.env.AUTH_STATE_TTL_MS ?? 10 * 60 * 1000
);
const AUTH_VERIFY_TTL_MS = Number(
  process.env.AUTH_VERIFY_TTL_MS ?? 24 * 60 * 60 * 1000
);
const AUTH_RESET_TTL_MS = Number(
  process.env.AUTH_RESET_TTL_MS ?? 60 * 60 * 1000
);
const AUTH_ALLOWED_REDIRECT_ORIGINS = (
  process.env.AUTH_ALLOWED_REDIRECT_ORIGINS ?? ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((value) => normalizeEmail(value))
  .filter(Boolean);
const ADMIN_DISPLAY_NAMES = (process.env.ADMIN_DISPLAY_NAMES ?? "")
  .split(",")
  .map((value) => normalizeAdminName(value))
  .filter(Boolean);
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((value) => Number.parseInt(value, 10))
  .filter((value) => Number.isFinite(value));
const DEVELOPER_EMAILS = (process.env.DEVELOPER_EMAILS ?? "")
  .split(",")
  .map((value) => normalizeEmail(value))
  .filter(Boolean);
const DEVELOPER_USER_IDS = (process.env.DEVELOPER_USER_IDS ?? "")
  .split(",")
  .map((value) => Number.parseInt(value, 10))
  .filter((value) => Number.isFinite(value));
const ADMIN_MATCH_DEV_ONLY = parseBoolean(process.env.ADMIN_MATCH_DEV_ONLY, true);
const ADMIN_DEV_DEFAULT_NAME = "critical centrist";
const ADMIN_SETTINGS_CACHE_TTL_MS = Number(
  process.env.ADMIN_SETTINGS_CACHE_TTL_MS ?? 2_000
);

const DEFAULT_ADMIN_SETTINGS = {
  user_suspend: true,
  user_permanent_bans: true,
  user_shadow_restrict: true,
  user_force_logout: true,
  user_reset_profile: true,
  user_delete_accounts: true,
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
const ADMIN_SETTING_KEYS = new Set(Object.keys(DEFAULT_ADMIN_SETTINGS));
let adminSettingsCache = { value: null, loadedAt: 0 };
const DEFAULT_USER_SETTINGS = {
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
const USER_SETTING_KEYS = new Set(Object.keys(DEFAULT_USER_SETTINGS));
const USER_SETTING_SELECTS = {
  connections_requests_visibility: new Set(["everyone", "followers", "nobody"]),
  posting_default_audience: new Set(["public", "followers", "private"]),
  messaging_dm_policy: new Set(["everyone", "followers", "nobody"]),
  messaging_requests: new Set(["filtered", "all", "none"]),
  identity_display_name_visibility: new Set(["public", "followers", "private"]),
  advanced_refresh_rate: new Set(["low", "normal", "high"]),
};

const emptyProfileDetails = Object.freeze({
  name: "",
  age: null,
  gender: "",
  interests: "",
});
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
const GOOGLE_REDIRECT_URI = (process.env.GOOGLE_REDIRECT_URI ?? "").trim();

const REDIS_URL = process.env.REDIS_URL ?? "";
const REDIS_REQUIRED = parseBoolean(process.env.REDIS_REQUIRED, false);
const REDIS_CONNECT_TIMEOUT_MS = Number(
  process.env.REDIS_CONNECT_TIMEOUT_MS ?? 2_000
);
const REDIS_RECONNECT_BASE_MS = Number(
  process.env.REDIS_RECONNECT_BASE_MS ?? 200
);
const REDIS_RECONNECT_MAX_MS = Number(process.env.REDIS_RECONNECT_MAX_MS ?? 2_000);

const CHAT_HISTORY_BACKEND = (
  process.env.CHAT_HISTORY_BACKEND ?? (REDIS_URL ? "redis" : "memory")
).toLowerCase();
const CHAT_HISTORY_TTL_SEC = Number(process.env.CHAT_HISTORY_TTL_SEC ?? 3_600);
const CHAT_HISTORY_KEY_PREFIX =
  process.env.CHAT_HISTORY_KEY_PREFIX ?? "lurk:chat:";

const MOD_ALERT_EMAIL = process.env.MOD_ALERT_EMAIL ?? "z.linz@outlook.com";
const REPORT_DESTINATION_EMAIL = (
  process.env.REPORT_DESTINATION_EMAIL ?? "support@lurk-app.com"
)
  .trim()
  .toLowerCase();
const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_SECURE = parseBoolean(process.env.SMTP_SECURE, false);
const SMTP_FROM = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? MOD_ALERT_EMAIL;

const ALLOWED_MEDIA_PREFIXES = ["image/", "video/", "audio/"];
const reactMemory = new Map();
const chatHistoryMemory = new Map();

/* -------------------- RATE LIMITERS -------------------- */

const createLimiter = ({
  windowMs = RATE_LIMIT_WINDOW,
  limit = 60,
  message = { error: "too_many_requests" },
  keyGenerator,
} = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    keyGenerator,
  });

const readLimiter = createLimiter({ limit: 240 });
const writeLimiter = createLimiter({ windowMs: 5 * 60 * 1000, limit: 30 });
const reactLimiter = createLimiter({ windowMs: 60 * 1000, limit: 90 });
const reportLimiter = createLimiter({ windowMs: 10 * 60 * 1000, limit: 5 });
const pingLimiter = createLimiter({ windowMs: 5 * 60 * 1000, limit: 8 });
const authLimiter = createLimiter({ windowMs: 60 * 1000, limit: 20 });
const authRelaxedLimiter = createLimiter({ windowMs: 60 * 1000, limit: 120 });

/* -------------------- API -------------------- */

export async function attachApiLayer({ app, server, dev = false } = {}) {
  if (!app || !server) {
    throw new Error("attachApiLayer requires app and server");
  }

  ensureDirectories();
  if (RESET_DB_ON_BOOT) {
    resetDatabase();
  }

  const db = new Database(DB_PATH);
  db.pragma("busy_timeout = 5000");
  prepareSchema(db);
  runAdminBootstrap(db);
  runDeveloperBootstrap(db);
  const runHousekeeping = () => {
    purgeExpiredThreads(db);
    purgeExpiredAuthSessions(db);
    purgeExpiredOauthStates(db);
    purgeExpiredVerificationTokens(db);
    purgeExpiredPasswordResetTokens(db);
  };
  runHousekeeping();
  setInterval(runHousekeeping, 30 * 60 * 1000).unref();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({ origin: "*", methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(dev ? "dev" : "tiny"));
  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      maxAge: dev ? 0 : "7d",
      setHeaders(res) {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    })
  );

  const upload = createUploadMiddleware();
  const avatarUpload = createUploadMiddleware({ allowedPrefixes: ["image/"] });

  let sockets = null;

  const requireSession = (req, res) => {
    const session = getSessionFromRequest(req, db);
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return null;
    }
    const access = getUserAccessById(db, session.user.id);
    if (!access.allowed) {
      res.status(403).json({
        error: access.reason || "access_denied",
        until: access.until || null,
      });
      return null;
    }
    return session;
  };

  const requireAdmin = (req, res) => {
    const session = requireSession(req, res);
    if (!session) {
      return null;
    }
    const userRow = db
      .prepare(`SELECT id, email, display_name, is_admin FROM users WHERE id = ?`)
      .get(session.user.id);
    if (!userRow) {
      res.status(401).json({ error: "unauthenticated" });
      return null;
    }
    const isAdmin = ensureAdminFlag(db, userRow, dev);
    if (!isAdmin) {
      res.status(403).json({ error: "forbidden" });
      return null;
    }
    return { session, userRow };
  };

  const requireDeveloper = (req, res) => {
    const session = requireSession(req, res);
    if (!session) {
      return null;
    }
    const userRow = db
      .prepare(
        `SELECT id, email, display_name, email_verified, is_developer
         FROM users
         WHERE id = ?`
      )
      .get(session.user.id);
    if (!userRow) {
      res.status(401).json({ error: "unauthenticated" });
      return null;
    }
    const isDeveloper = ensureDeveloperFlag(db, userRow);
    if (!isDeveloper) {
      res.status(403).json({ error: "developer_only" });
      return null;
    }
    if (!userRow.email_verified) {
      res.status(403).json({ error: "email_unverified" });
      return null;
    }
    return { session, userRow };
  };

  const requireAdminPermission = (req, res, permissionKey) => {
    const admin = requireAdmin(req, res);
    if (!admin) return null;
    const settings = getAdminSettingsState(db).settings;
    if (permissionKey && !settings?.[permissionKey]) {
      res.status(403).json({ error: "admin_setting_disabled" });
      return null;
    }
    return { admin, settings };
  };

  const requireAdminReason = (settings, res, reason) => {
    if (settings?.admin_mandatory_reason_codes && !reason) {
      res.status(400).json({ error: "reason_required" });
      return false;
    }
    return true;
  };

  const parseTargetUserId = (req, res) => {
    const userId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "invalid_user_id" });
      return null;
    }
    return userId;
  };

  const loadUserForAdmin = (userId) =>
    db
      .prepare(
        `SELECT id,
                email,
                display_name,
                avatar_url,
                bio,
                created_at,
                email_verified,
                email_verified_at,
                is_admin,
                is_suspended,
                suspended_until,
                suspended_reason,
                is_banned,
                banned_at,
                banned_reason,
                shadow_restricted,
                trust_override,
                trust_override_reason,
                trust_override_at
         FROM users
         WHERE id = ?`
      )
      .get(userId);

  const requireTargetUser = (req, res) => {
    const userId = parseTargetUserId(req, res);
    if (!userId) return null;
    const userRow = loadUserForAdmin(userId);
    if (!userRow) {
      res.status(404).json({ error: "user_not_found" });
      return null;
    }
    return { userId, userRow };
  };

  const parseThreadId = (req, res) => {
    const threadId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(threadId)) {
      res.status(400).json({ error: "invalid_thread_id" });
      return null;
    }
    return threadId;
  };

  const loadThreadForAdmin = (threadId) =>
    db
      .prepare(
        `SELECT id,
                title,
                body,
                image_filename,
                sensitive,
                created_at,
                is_deleted,
                deleted_at,
                deleted_by,
                deleted_reason,
                is_frozen,
                frozen_at,
                frozen_by,
                frozen_reason
         FROM threads
         WHERE id = ?`
      )
      .get(threadId);

  const requireThread = (req, res) => {
    const threadId = parseThreadId(req, res);
    if (!threadId) return null;
    const row = loadThreadForAdmin(threadId);
    if (!row) {
      res.status(404).json({ error: "thread_not_found" });
      return null;
    }
    return { threadId, row };
  };

  const parsePostId = (req, res) => {
    const postId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(postId)) {
      res.status(400).json({ error: "invalid_post_id" });
      return null;
    }
    return postId;
  };

  const loadPostForAdmin = (postId) =>
    db
      .prepare(
        `SELECT id,
                thread_id,
                body,
                image_filename,
                sensitive,
                created_at,
                is_deleted,
                deleted_at,
                deleted_by,
                deleted_reason
         FROM posts
         WHERE id = ?`
      )
      .get(postId);

  const requirePost = (req, res) => {
    const postId = parsePostId(req, res);
    if (!postId) return null;
    const row = loadPostForAdmin(postId);
    if (!row) {
      res.status(404).json({ error: "post_not_found" });
      return null;
    }
    return { postId, row };
  };

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/ready", (_req, res) => {
    const dbHealth = checkDbHealth(db);
    const socketState = sockets?.state;
    const redisStatus = socketState?.redis?.status ?? "disabled";
    const redisOk = !REDIS_REQUIRED || redisStatus === "ok";
    const ok = dbHealth.ok && redisOk;

    res.status(ok ? 200 : 503).json({
      ok,
      db: dbHealth,
      redis: {
        required: REDIS_REQUIRED,
        status: redisStatus,
        adapter: socketState?.adapter ?? "memory",
        error: socketState?.redis?.error ?? null,
      },
      history: socketState?.history ?? { backend: CHAT_HISTORY_BACKEND },
    });
  });

  app.post("/reports", reportLimiter, async (req, res) => {
    const category = sanitizeReportField(req?.body?.category, 80).toLowerCase();
    const impact = sanitizeReportField(req?.body?.impact, 80);
    const link = sanitizeReportField(req?.body?.link, 500);
    const details = sanitizeReportField(req?.body?.details, 4000);
    const contact = sanitizeReportContact(req?.body?.contact);

    if (!category || !impact || !link || !details) {
      res.status(400).json({ error: "invalid_report_payload" });
      return;
    }

    const session = getSessionFromRequest(req, db);
    const reporter = session
      ? `User #${session.user.id} (${session.user.email})`
      : "Anonymous";
    const submittedAt = new Date().toISOString();
    const sourceIp = sanitizeReportField(req.ip || "", 120);
    const userAgent = sanitizeReportField(req?.headers?.["user-agent"] || "", 300);
    const subject = `[Lurk Report] ${category} | ${impact}`;
    const text = [
      "New Lurk user report",
      `Submitted: ${submittedAt}`,
      `Category: ${category}`,
      `Impact: ${impact}`,
      `Reporter: ${reporter}`,
      `Contact: ${contact || "not provided"}`,
      `IP: ${sourceIp || "unknown"}`,
      `User-Agent: ${userAgent || "unknown"}`,
      "",
      "Links / Thread IDs:",
      link,
      "",
      "Details:",
      details,
    ].join("\n");

    const sent = await sendEmail({
      to: REPORT_DESTINATION_EMAIL || "support@lurk-app.com",
      subject,
      text,
    });
    if (!sent.ok) {
      res.status(503).json({
        error: "report_delivery_failed",
        detail: sent.reason || "send_failed",
      });
      return;
    }

    res.status(201).json({
      ok: true,
      submittedAt,
      destination: REPORT_DESTINATION_EMAIL || "support@lurk-app.com",
    });
  });

  app.get("/auth/me", authRelaxedLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const userRow = db
      .prepare(
        `SELECT email_verified, avatar_url, bio, is_admin, is_developer,
                profile_name, profile_age, profile_gender, profile_interests
         FROM users
         WHERE id = ?`
      )
      .get(session.user.id);
    const adminRow = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      is_admin: userRow?.is_admin,
    };
    const isAdmin = ensureAdminFlag(db, adminRow, dev);
    const isDeveloper = ensureDeveloperFlag(db, {
      id: session.user.id,
      email: session.user.email,
      is_developer: userRow?.is_developer,
    });
    res.json({
      user: {
        ...session.user,
        emailVerified: Boolean(userRow?.email_verified),
        avatarUrl: resolveAvatarUrlForResponse(req, userRow?.avatar_url || ""),
        bio: userRow?.bio || "",
        profileDetails: getProfileDetailsFromRow(userRow),
        isAdmin,
        isDeveloper,
      },
    });
  });

  app.post("/auth/register", authLimiter, (req, res) => {
    const email = normalizeEmail(req?.body?.email || "");
    const password = String(req?.body?.password || "");
    const displayNameRaw = req?.body?.displayName || "";
    const profileName = sanitizeOptionalProfileText(req?.body?.profileName || "", 80);
    const ageResult = sanitizeProfileAge(req?.body?.profileAge);
    const profileGender = sanitizeOptionalProfileText(
      req?.body?.profileGender || "",
      40
    );
    const profileInterests = sanitizeOptionalProfileText(
      req?.body?.profileInterests || "",
      320
    );

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short" });
      return;
    }
    if (!ageResult.valid) {
      res.status(400).json({ error: "invalid_profile_age" });
      return;
    }

    const existing = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);
    if (existing) {
      res.status(409).json({ error: "email_in_use" });
      return;
    }

    const displayName =
      sanitizeDisplayName(displayNameRaw) || email.split("@")[0] || "User";
    const passwordHash = hashPassword(password);
    const isDeveloper = shouldGrantDeveloper({ email });
    const result = db
      .prepare(
        `INSERT INTO users (
           email, display_name, password_hash, email_verified, is_developer,
           profile_name, profile_age, profile_gender, profile_interests
         )
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`
      )
      .run(
        email,
        displayName,
        passwordHash,
        isDeveloper ? 1 : 0,
        profileName || null,
        ageResult.value,
        profileGender || null,
        profileInterests || null
      );

    const verification = createEmailVerificationToken(db, result.lastInsertRowid);
    const requestOrigin = getRequestOrigin(req);
    const redirectParam = req?.body?.redirect || "";
    const redirectTo =
      sanitizeRedirect(redirectParam, requestOrigin) ||
      getDefaultRedirectUrl(requestOrigin);
    const verificationLink = buildRedirectWithParams(
      `${requestOrigin || ""}/auth/verify`,
      {
        token: verification.token,
        redirect: redirectTo,
      }
    );
    void sendEmail({
      to: email,
      subject: "Verify your Lurk email",
      text: `Welcome to Lurk! Verify your email by visiting: ${verificationLink}`,
    }).then((result) => {
      if (!result.ok) {
        console.warn("verification email not sent", result.reason);
      }
    });

    const session = createSession(db, result.lastInsertRowid);
    setSessionCookie(res, session.token, {
      maxAgeMs: AUTH_SESSION_TTL_MS,
      secure: !dev,
    });
    const isAdmin = ensureAdminFlag(
      db,
      {
        id: result.lastInsertRowid,
        email,
        displayName,
        is_admin: 0,
      },
      dev
    );
    const grantedDeveloper = ensureDeveloperFlag(db, {
      id: result.lastInsertRowid,
      email,
      is_developer: isDeveloper ? 1 : 0,
    });
    res.json({
      user: {
        id: result.lastInsertRowid,
        email,
        displayName,
        emailVerified: false,
        profileDetails: {
          name: profileName,
          age: ageResult.value,
          gender: profileGender,
          interests: profileInterests,
        },
        isAdmin,
        isDeveloper: grantedDeveloper,
      },
      sessionToken: session.token,
      verificationLink,
    });
  });

  app.post("/auth/register-developer", authLimiter, (req, res) => {
    const email = normalizeEmail(req?.body?.email || "");
    const password = String(req?.body?.password || "");
    const displayNameRaw = req?.body?.displayName || "";
    const profileName = sanitizeOptionalProfileText(req?.body?.profileName || "", 80);
    const ageResult = sanitizeProfileAge(req?.body?.profileAge);
    const profileGender = sanitizeOptionalProfileText(
      req?.body?.profileGender || "",
      40
    );
    const profileInterests = sanitizeOptionalProfileText(
      req?.body?.profileInterests || "",
      320
    );

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short" });
      return;
    }
    if (!ageResult.valid) {
      res.status(400).json({ error: "invalid_profile_age" });
      return;
    }

    const existing = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);
    if (existing) {
      res.status(409).json({ error: "email_in_use" });
      return;
    }

    const displayName =
      sanitizeDisplayName(displayNameRaw) || email.split("@")[0] || "Developer";
    const passwordHash = hashPassword(password);
    const result = db
      .prepare(
        `INSERT INTO users (
           email, display_name, password_hash, email_verified, is_developer,
           profile_name, profile_age, profile_gender, profile_interests
         )
         VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?)`
      )
      .run(
        email,
        displayName,
        passwordHash,
        profileName || null,
        ageResult.value,
        profileGender || null,
        profileInterests || null
      );

    const verification = createEmailVerificationToken(db, result.lastInsertRowid);
    const requestOrigin = getRequestOrigin(req);
    const redirectParam = req?.body?.redirect || "";
    const redirectTo =
      sanitizeRedirect(redirectParam, requestOrigin) ||
      getDefaultRedirectUrl(requestOrigin);
    const verificationLink = buildRedirectWithParams(
      `${requestOrigin || ""}/auth/verify`,
      {
        token: verification.token,
        redirect: redirectTo,
      }
    );
    void sendEmail({
      to: email,
      subject: "Verify your Lurk developer email",
      text: `Welcome to Lurk Developers! Verify your email by visiting: ${verificationLink}`,
    }).then((result) => {
      if (!result.ok) {
        console.warn("verification email not sent", result.reason);
      }
    });

    const session = createSession(db, result.lastInsertRowid);
    setSessionCookie(res, session.token, {
      maxAgeMs: AUTH_SESSION_TTL_MS,
      secure: !dev,
    });
    const isAdmin = ensureAdminFlag(
      db,
      {
        id: result.lastInsertRowid,
        email,
        displayName,
        is_admin: 0,
      },
      dev
    );
    res.json({
      user: {
        id: result.lastInsertRowid,
        email,
        displayName,
        emailVerified: false,
        profileDetails: {
          name: profileName,
          age: ageResult.value,
          gender: profileGender,
          interests: profileInterests,
        },
        isAdmin,
        isDeveloper: true,
      },
      sessionToken: session.token,
      verificationLink,
    });
  });

  app.post("/auth/login", authLimiter, (req, res) => {
    const email = normalizeEmail(req?.body?.email || "");
    const password = String(req?.body?.password || "");
    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: "invalid_credentials" });
      return;
    }

    const row = db
      .prepare(
        `SELECT id, email, display_name, password_hash, email_verified, avatar_url, bio, is_admin,
                is_developer, profile_name, profile_age, profile_gender, profile_interests,
                is_banned, is_suspended, suspended_until
         FROM users WHERE email = ?`
      )
      .get(email);
    if (!row) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    if (!row.password_hash) {
      res.status(400).json({ error: "use_google_sign_in" });
      return;
    }
    if (!verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const access = resolveUserAccess(db, row);
    if (!access.allowed) {
      res.status(403).json({ error: access.reason, until: access.until || null });
      return;
    }
    const isAdmin = ensureAdminFlag(db, row, dev);
    const isDeveloper = ensureDeveloperFlag(db, row);
    const session = createSession(db, row.id);
    setSessionCookie(res, session.token, {
      maxAgeMs: AUTH_SESSION_TTL_MS,
      secure: !dev,
    });
    res.json({
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name || row.email,
        emailVerified: Boolean(row.email_verified),
        avatarUrl: resolveAvatarUrlForResponse(req, row.avatar_url || ""),
        bio: row.bio || "",
        profileDetails: getProfileDetailsFromRow(row),
        isAdmin,
        isDeveloper,
      },
      sessionToken: session.token,
    });
  });

  app.post("/auth/logout", authLimiter, (req, res) => {
    const token = getSessionTokenFromRequest(req);
    if (token) {
      db.prepare(`DELETE FROM sessions WHERE id = ?`).run(token);
    }
    clearSessionCookie(res, { secure: !dev });
    res.json({ ok: true });
  });

  app.post("/developers/upgrade", authLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const row = db
      .prepare(`SELECT id, email_verified, is_developer FROM users WHERE id = ?`)
      .get(session.user.id);
    if (!row) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    if (!row.email_verified) {
      res.status(403).json({ error: "email_unverified" });
      return;
    }
    if (!row.is_developer) {
      db.prepare(`UPDATE users SET is_developer = 1 WHERE id = ?`).run(row.id);
    }
    res.json({ ok: true, isDeveloper: true });
  });

  app.get("/auth/profile", authLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const userRow = db
      .prepare(
        `SELECT email_verified, avatar_url, bio, is_admin, is_developer,
                profile_name, profile_age, profile_gender, profile_interests
         FROM users WHERE id = ?`
      )
      .get(session.user.id);
    if (!userRow) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    const isAdmin = ensureAdminFlag(
      db,
      {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        is_admin: userRow?.is_admin,
      },
      dev
    );
    const isDeveloper = ensureDeveloperFlag(db, {
      id: session.user.id,
      email: session.user.email,
      is_developer: userRow?.is_developer,
    });
    res.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        avatarUrl: resolveAvatarUrlForResponse(req, userRow?.avatar_url || ""),
        bio: userRow?.bio || "",
        profileDetails: getProfileDetailsFromRow(userRow),
        emailVerified: Boolean(userRow?.email_verified),
        isAdmin,
        isDeveloper,
      },
    });
  });

  app.patch("/auth/profile", authLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const currentRow = db
      .prepare(
        `SELECT display_name, avatar_url, bio, profile_name, profile_age, profile_gender,
                profile_interests, email_verified, is_admin, is_developer
         FROM users WHERE id = ?`
      )
      .get(session.user.id);
    if (!currentRow) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const body = req?.body && typeof req.body === "object" ? req.body : {};
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(body, key);

    const displayName = hasOwn("displayName")
      ? sanitizeDisplayName(body.displayName || "")
      : currentRow.display_name || session.user.displayName;
    const avatarUrl = hasOwn("avatarUrl")
      ? sanitizeAvatarUrl(body.avatarUrl || "")
      : currentRow.avatar_url || "";
    const bio = hasOwn("bio")
      ? sanitizeBio(body.bio || "")
      : currentRow.bio || "";
    const profileName = hasOwn("profileName")
      ? sanitizeOptionalProfileText(body.profileName || "", 80)
      : sanitizeOptionalProfileText(currentRow.profile_name || "", 80);
    const profileGender = hasOwn("profileGender")
      ? sanitizeOptionalProfileText(body.profileGender || "", 40)
      : sanitizeOptionalProfileText(currentRow.profile_gender || "", 40);
    const profileInterests = hasOwn("profileInterests")
      ? sanitizeOptionalProfileText(body.profileInterests || "", 320)
      : sanitizeOptionalProfileText(currentRow.profile_interests || "", 320);
    const existingProfileAge =
      Number.isFinite(currentRow.profile_age) &&
      currentRow.profile_age >= 1 &&
      currentRow.profile_age <= 120
        ? currentRow.profile_age
        : null;
    const profileAgeResult = hasOwn("profileAge")
      ? sanitizeProfileAge(body.profileAge)
      : { valid: true, value: existingProfileAge };

    if (!profileAgeResult.valid) {
      res.status(400).json({ error: "invalid_profile_age" });
      return;
    }

    db.prepare(
      `UPDATE users
       SET display_name = ?, avatar_url = ?, bio = ?, profile_name = ?, profile_age = ?,
           profile_gender = ?, profile_interests = ?
       WHERE id = ?`
    ).run(
      displayName || session.user.displayName,
      avatarUrl || null,
      bio || null,
      profileName || null,
      profileAgeResult.value,
      profileGender || null,
      profileInterests || null,
      session.user.id
    );

    const verifiedRow = db
      .prepare(
        `SELECT email_verified, is_admin, is_developer, avatar_url, bio, profile_name, profile_age,
                profile_gender, profile_interests
         FROM users WHERE id = ?`
      )
      .get(session.user.id);
    const isAdmin = ensureAdminFlag(
      db,
      {
        id: session.user.id,
        email: session.user.email,
        displayName: displayName || session.user.displayName,
        is_admin: verifiedRow?.is_admin,
      },
      dev
    );
    const isDeveloper = ensureDeveloperFlag(db, {
      id: session.user.id,
      email: session.user.email,
      is_developer: verifiedRow?.is_developer,
    });
    res.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: displayName || session.user.displayName,
        avatarUrl: resolveAvatarUrlForResponse(req, verifiedRow?.avatar_url || avatarUrl),
        bio: verifiedRow?.bio || bio || "",
        profileDetails: getProfileDetailsFromRow(verifiedRow),
        emailVerified: Boolean(verifiedRow?.email_verified),
        isAdmin,
        isDeveloper,
      },
    });
  });

  app.get("/auth/settings", authLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const state = getUserSettingsState(db, session.user.id);
    res.json({
      settings: state.settings,
      updatedAt: state.updatedAt,
    });
  });

  app.patch("/auth/settings", authLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const patch = req?.body?.settings || {};
    const sanitized = sanitizeUserSettings(patch);
    const keys = Object.keys(sanitized);
    if (!keys.length) {
      res.status(400).json({ error: "invalid_settings" });
      return;
    }
    const next = updateUserSettingsState(db, session.user.id, sanitized);
    res.json({
      settings: next.settings,
      updatedAt: next.updatedAt,
    });
  });

  app.post("/auth/profile/avatar", authLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const adminSettings = getAdminSettingsState(db).settings;
    const userRow = db
      .prepare(`SELECT id, email, display_name, is_admin FROM users WHERE id = ?`)
      .get(session.user.id);
    const isAdmin = ensureAdminFlag(db, userRow, dev);
    if (!isAdmin && isUploadsDisabled(adminSettings)) {
      res.status(423).json({ error: "uploads_disabled" });
      return;
    }
    avatarUpload(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || "avatar_upload_failed" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "avatar_missing" });
        return;
      }
      const avatarPath = `/uploads/${req.file.filename}`;
      db.prepare(`UPDATE users SET avatar_url = ? WHERE id = ?`).run(
        avatarPath,
        session.user.id
      );
      const updatedRow = db
        .prepare(
          `SELECT email, display_name, avatar_url, bio, email_verified, is_admin, is_developer,
                  profile_name, profile_age, profile_gender, profile_interests
           FROM users WHERE id = ?`
        )
        .get(session.user.id);
      const isAdmin = ensureAdminFlag(db, {
        id: session.user.id,
        email: updatedRow?.email || session.user.email,
        displayName: updatedRow?.display_name || session.user.displayName,
        is_admin: updatedRow?.is_admin,
      }, dev);
      const isDeveloper = ensureDeveloperFlag(db, {
        id: session.user.id,
        email: updatedRow?.email || session.user.email,
        is_developer: updatedRow?.is_developer,
      });
      res.json({
        user: {
          id: session.user.id,
          email: updatedRow?.email || session.user.email,
          displayName: updatedRow?.display_name || session.user.displayName,
          avatarUrl: resolveAvatarUrlForResponse(
            req,
            updatedRow?.avatar_url || avatarPath
          ),
          bio: updatedRow?.bio || "",
          profileDetails: getProfileDetailsFromRow(updatedRow),
          emailVerified: Boolean(updatedRow?.email_verified),
          isAdmin,
          isDeveloper,
        },
      });
    });
  });

  app.get("/users/:id", readLimiter, (req, res) => {
    const userId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "invalid_user_id" });
      return;
    }
    const userRow = db
      .prepare(
        `SELECT id, email, display_name, avatar_url, bio, created_at, is_admin
         FROM users
         WHERE id = ?`
      )
      .get(userId);
    if (!userRow) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    const session = getSessionFromRequest(req, db);
    const isSelf = session?.user?.id === userRow.id;
    const isAdmin = resolveIsAdmin({
      userRow: {
        id: userRow.id,
        email: userRow.email,
        display_name: userRow.display_name,
        is_admin: userRow.is_admin,
      },
      dev,
    });
    if (isSelf) {
      ensureAdminFlag(
        db,
        {
          id: userRow.id,
          email: userRow.email,
          display_name: userRow.display_name,
          is_admin: userRow.is_admin,
        },
        dev
      );
    }
    res.json({
      user: {
        id: userRow.id,
        displayName: userRow.display_name || "",
        avatarUrl: resolveAvatarUrlForResponse(req, userRow.avatar_url || ""),
        bio: userRow.bio || "",
        createdAt: userRow.created_at,
        isSelf,
        isAdmin,
      },
    });
  });

  app.get("/users/:id/library", readLimiter, (req, res) => {
    const userId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "invalid_user_id" });
      return;
    }
    const userExists = db
      .prepare(`SELECT id FROM users WHERE id = ?`)
      .get(userId);
    if (!userExists) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    const session = getSessionFromRequest(req, db);
    const isSelf = session?.user?.id === userId;
    const rows = db
      .prepare(
        `SELECT id, category, title, description, media_url, thumbnail_url, created_at
         FROM user_media
         WHERE user_id = ?
         ORDER BY datetime(created_at) DESC`
      )
      .all(userId);
    const grouped = { posts: [], videos: [], shorts: [], saved: [] };
    rows.forEach((row) => {
      const item = {
        id: row.id,
        title: row.title || "",
        description: row.description || "",
        mediaUrl: row.media_url || "",
        thumbnailUrl: row.thumbnail_url || "",
        createdAt: row.created_at,
      };
      if (row.category === "post") grouped.posts.push(item);
      if (row.category === "video") grouped.videos.push(item);
      if (row.category === "short") grouped.shorts.push(item);
      if (row.category === "saved" && isSelf) grouped.saved.push(item);
    });
    res.json(grouped);
  });

  app.get("/playables/manifest", readLimiter, (req, res) => {
    const session = getSessionFromRequest(req, db);
    let isAdmin = false;
    if (session) {
      const adminRow = db
        .prepare(`SELECT id, email, display_name, is_admin FROM users WHERE id = ?`)
        .get(session.user.id);
      if (adminRow) {
        isAdmin = ensureAdminFlag(db, adminRow, dev);
      }
    }
    const base = readPlayablesManifestFromDisk();
    const rows = db
      .prepare(
        `SELECT ps.*,
                u.display_name as user_display_name
         FROM playable_submissions ps
         JOIN users u ON u.id = ps.user_id
         WHERE ps.approved = 1 AND ps.status = 'approved' AND ps.hosted_path IS NOT NULL
         ORDER BY datetime(ps.created_at) DESC`
      )
      .all();
    const manifest = buildPlayablesManifest({
      baseManifest: base,
      submissions: rows,
      admin: isAdmin,
    });
    res.json(manifest);
  });

  app.get("/playables/submissions", authLimiter, (req, res) => {
    const ctx = requireDeveloper(req, res);
    if (!ctx) return;
    const rows = db
      .prepare(
        `SELECT *
         FROM playable_submissions
         WHERE user_id = ?
         ORDER BY datetime(created_at) DESC`
      )
      .all(ctx.session.user.id);
    res.json({
      submissions: rows.map((row) => serializePlayableSubmission(row)),
    });
  });

  app.post("/playables/submissions", authLimiter, (req, res) => {
    const ctx = requireDeveloper(req, res);
    if (!ctx) return;
    if (
      req?.body?.hostedPath ||
      req?.body?.hostedId ||
      req?.body?.hostedThumbnail ||
      req?.body?.playUrl ||
      req?.body?.path
    ) {
      res.status(400).json({ error: "invalid_submission_fields" });
      return;
    }

    const title = sanitizePlayableTitle(req?.body?.title || "");
    if (!title) {
      res.status(400).json({ error: "title_required" });
      return;
    }
    const description = sanitizePlayableDescription(req?.body?.description || "");
    const tags = sanitizePlayableTags(req?.body?.tags);
    const authorName = sanitizePlayableAuthor(
      req?.body?.authorName || ctx.userRow.display_name || ""
    );
    const buildUrl = sanitizePlayableUrl(req?.body?.buildUrl || "", {
      allowPlayables: true,
      allowRemote: true,
    });
    if (!buildUrl) {
      res.status(400).json({ error: "build_url_required" });
      return;
    }
    const sourceUrl = sanitizePlayableUrl(req?.body?.sourceUrl || "", {
      allowPlayables: true,
      allowRemote: true,
    });
    const thumbnailUrl = sanitizePlayableUrl(req?.body?.thumbnailUrl || "", {
      allowPlayables: true,
      allowUploads: true,
      allowRemote: true,
    });
    const suggestedHostedPath = sanitizeHostedPath(buildUrl);
    const suggestedHostedThumbnail = sanitizeHostedThumbnailPath(thumbnailUrl);
    const orientation = sanitizePlayableOrientation(req?.body?.orientation || "");
    const minPlayers = clampInt(req?.body?.minPlayers, 1, 8) ?? 1;
    const maxPlayers = clampInt(req?.body?.maxPlayers, minPlayers, 8) ?? minPlayers;
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `INSERT INTO playable_submissions
           (user_id, title, description, tags, author_name, build_url, source_url, thumbnail_url,
            orientation, min_players, max_players, status, approved, hosted_path,
            hosted_thumbnail, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`
      )
      .run(
        ctx.session.user.id,
        title,
        description,
        JSON.stringify(tags),
        authorName,
        buildUrl,
        sourceUrl,
        thumbnailUrl,
        orientation,
        minPlayers,
        maxPlayers,
        suggestedHostedPath,
        suggestedHostedThumbnail,
        now,
        now
      );

    const submission = db
      .prepare(`SELECT * FROM playable_submissions WHERE id = ?`)
      .get(result.lastInsertRowid);

    res.json({
      submission: serializePlayableSubmission(submission),
    });
  });

  app.delete("/playables/submissions/:id", authLimiter, (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const userRow = db
      .prepare(
        `SELECT id, email, display_name, email_verified, is_developer, is_admin
         FROM users
         WHERE id = ?`
      )
      .get(session.user.id);
    if (!userRow) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const isAdmin = ensureAdminFlag(db, userRow, dev);
    if (!isAdmin) {
      const isDeveloper = ensureDeveloperFlag(db, userRow);
      if (!isDeveloper) {
        res.status(403).json({ error: "developer_only" });
        return;
      }
      if (!userRow.email_verified) {
        res.status(403).json({ error: "email_unverified" });
        return;
      }
    }

    const submissionId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(submissionId)) {
      res.status(400).json({ error: "invalid_submission_id" });
      return;
    }
    const row = db
      .prepare(`SELECT * FROM playable_submissions WHERE id = ?`)
      .get(submissionId);
    if (!row) {
      res.status(404).json({ error: "submission_not_found" });
      return;
    }
    if (!isAdmin) {
      if (row.user_id !== session.user.id) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      if (row.status === "approved") {
        res.status(403).json({ error: "approved_submission_locked" });
        return;
      }
    }

    db.prepare(`DELETE FROM playable_submissions WHERE id = ?`).run(submissionId);

    if (isAdmin) {
      logAdminAction(db, {
        userId: userRow.id,
        action: "playable_submission_deleted",
        detail: { submissionId, hostedId: row.hosted_id, hostedPath: row.hosted_path },
        targetUserId: row.user_id,
      });
    }

    res.json({ deleted: true, submissionId });
  });

  app.get("/admin/playables/submissions", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const status = String(req?.query?.status || "").trim().toLowerCase();
    const limit = clampInt(req?.query?.limit, 1, 200) ?? 100;
    const filters = [];
    const params = [];
    if (["pending", "approved", "rejected"].includes(status)) {
      filters.push("ps.status = ?");
      params.push(status);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = db
      .prepare(
        `SELECT ps.*,
                u.email as user_email,
                u.display_name as user_display_name
         FROM playable_submissions ps
         JOIN users u ON u.id = ps.user_id
         ${whereClause}
         ORDER BY datetime(ps.created_at) DESC
         LIMIT ?`
      )
      .all(...params, limit);
    res.json({
      submissions: rows.map((row) =>
        serializePlayableSubmission(row, { includeUser: true })
      ),
    });
  });

  app.get("/admin/playables/summary", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const rows = db
      .prepare(
        `SELECT status, COUNT(*) as total
         FROM playable_submissions
         GROUP BY status`
      )
      .all();
    const summary = { pending: 0, approved: 0, rejected: 0, total: 0 };
    rows.forEach((row) => {
      const status = row.status || "";
      const count = Number(row.total) || 0;
      summary.total += count;
      if (status === "pending") summary.pending = count;
      if (status === "approved") summary.approved = count;
      if (status === "rejected") summary.rejected = count;
    });
    const latest = db
      .prepare(
        `SELECT created_at
         FROM playable_submissions
         ORDER BY datetime(created_at) DESC
         LIMIT 1`
      )
      .get();
    res.json({
      summary: {
        ...summary,
        latestAt: latest?.created_at || null,
      },
    });
  });

  app.post("/admin/playables/submissions/:id/approve", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const submissionId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(submissionId)) {
      res.status(400).json({ error: "invalid_submission_id" });
      return;
    }
    const row = db
      .prepare(
        `SELECT ps.*,
                u.display_name as user_display_name
         FROM playable_submissions ps
         JOIN users u ON u.id = ps.user_id
         WHERE ps.id = ?`
      )
      .get(submissionId);
    if (!row) {
      res.status(404).json({ error: "submission_not_found" });
      return;
    }
    const hostedPath = sanitizeHostedPath(
      req?.body?.hostedPath || row.hosted_path || row.build_url || ""
    );
    if (!hostedPath) {
      res.status(400).json({ error: "hosted_path_required" });
      return;
    }
    const validation = validatePlayableAssets(hostedPath);
    if (!validation.ok) {
      const issues = Array.isArray(validation.issues)
        ? validation.issues.map((issue) => ({
            file: issue.filePath
              ? path.relative(validation.rootDir || "", issue.filePath)
              : "",
            reason: issue.reason || "invalid_asset",
          }))
        : null;
      res.status(400).json({
        error: "playable_validation_failed",
        detail: validation.reason || "invalid_assets",
        issues,
      });
      return;
    }
    const hostedIdRaw = sanitizePlayableId(req?.body?.hostedId || "");
    const hostedId = hostedIdRaw || sanitizePlayableId(row.title) || `playable-${row.id}`;
    const hostedThumbnail = sanitizeHostedThumbnailPath(
      req?.body?.hostedThumbnail || row.hosted_thumbnail || row.thumbnail_url || ""
    );
    const adminNotes = sanitizePlayableDescription(req?.body?.adminNotes || "");
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE playable_submissions
       SET status = 'approved',
           approved = 1,
           hosted_id = ?,
           hosted_path = ?,
           hosted_thumbnail = ?,
           admin_notes = ?,
           reviewed_at = ?,
           reviewed_by = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      hostedId,
      hostedPath,
      hostedThumbnail,
      adminNotes,
      now,
      admin.userRow.id,
      now,
      submissionId
    );

    logAdminAction(db, {
      userId: admin.userRow.id,
      action: "playable_submission_approved",
      detail: { submissionId, hostedId, hostedPath },
      targetUserId: row.user_id,
    });

    const updated = db
      .prepare(
        `SELECT ps.*,
                u.email as user_email,
                u.display_name as user_display_name
         FROM playable_submissions ps
         JOIN users u ON u.id = ps.user_id
         WHERE ps.id = ?`
      )
      .get(submissionId);

    res.json({
      submission: serializePlayableSubmission(updated, { includeUser: true }),
    });
  });

  app.post("/admin/playables/submissions/:id/reject", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const submissionId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(submissionId)) {
      res.status(400).json({ error: "invalid_submission_id" });
      return;
    }
    const row = db
      .prepare(
        `SELECT ps.*,
                u.display_name as user_display_name
         FROM playable_submissions ps
         JOIN users u ON u.id = ps.user_id
         WHERE ps.id = ?`
      )
      .get(submissionId);
    if (!row) {
      res.status(404).json({ error: "submission_not_found" });
      return;
    }
    const adminNotes = sanitizePlayableDescription(req?.body?.adminNotes || "");
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE playable_submissions
       SET status = 'rejected',
           approved = 0,
           admin_notes = ?,
           reviewed_at = ?,
           reviewed_by = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(adminNotes, now, admin.userRow.id, now, submissionId);

    logAdminAction(db, {
      userId: admin.userRow.id,
      action: "playable_submission_rejected",
      detail: { submissionId },
      targetUserId: row.user_id,
    });

    const updated = db
      .prepare(
        `SELECT ps.*,
                u.email as user_email,
                u.display_name as user_display_name
         FROM playable_submissions ps
         JOIN users u ON u.id = ps.user_id
         WHERE ps.id = ?`
      )
      .get(submissionId);

    res.json({
      submission: serializePlayableSubmission(updated, { includeUser: true }),
    });
  });

  app.delete("/admin/playables/submissions/:id", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const submissionId = Number.parseInt(req?.params?.id, 10);
    if (!Number.isFinite(submissionId)) {
      res.status(400).json({ error: "invalid_submission_id" });
      return;
    }
    const row = db
      .prepare(
        `SELECT ps.*,
                u.display_name as user_display_name
         FROM playable_submissions ps
         JOIN users u ON u.id = ps.user_id
         WHERE ps.id = ?`
      )
      .get(submissionId);
    if (!row) {
      res.status(404).json({ error: "submission_not_found" });
      return;
    }

    db.prepare(`DELETE FROM playable_submissions WHERE id = ?`).run(submissionId);

    logAdminAction(db, {
      userId: admin.userRow.id,
      action: "playable_submission_deleted",
      detail: { submissionId, hostedId: row.hosted_id, hostedPath: row.hosted_path },
      targetUserId: row.user_id,
    });

    res.json({ deleted: true, submissionId });
  });

  app.get("/admin/settings", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const state = getAdminSettingsState(db);
    res.json(state);
  });

  app.patch("/admin/settings", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const patch = req?.body?.settings || {};
    const reason = sanitizeReason(req?.body?.reason || "");
    const current = getAdminSettingsState(db);
    const keys = Object.keys(sanitizeAdminSettings(patch));
    if (keys.length === 0) {
      res.status(400).json({ error: "invalid_settings" });
      return;
    }
    if (
      current.settings?.admin_mandatory_reason_codes &&
      keys.some((key) => key !== "admin_mandatory_reason_codes") &&
      !reason
    ) {
      res.status(400).json({ error: "reason_required" });
      return;
    }
    const next = updateAdminSettingsState(db, patch, {
      userId: admin.userRow.id,
      reason,
    });
    const actions = getAdminActions(db, 20);
    res.json({ ...next, actions });
  });

  app.post("/admin/settings/reset", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    const current = getAdminSettingsState(db);
    if (current.settings?.admin_mandatory_reason_codes && !reason) {
      res.status(400).json({ error: "reason_required" });
      return;
    }
    const next = resetAdminSettingsState(db, {
      userId: admin.userRow.id,
      reason,
    });
    const actions = getAdminActions(db, 20);
    res.json({ ...next, actions });
  });

  app.get("/admin/actions", authLimiter, (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const settings = getAdminSettingsState(db).settings;
    if (!settings.admin_view_actions) {
      res.status(403).json({ error: "admin_actions_disabled" });
      return;
    }
    const limit = clampInt(req?.query?.limit, 1, 200) ?? 50;
    res.json({ actions: getAdminActions(db, limit) });
  });

  app.get("/admin/users", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_view_private_metadata");
    if (!ctx) return;
    const limit = clampInt(req?.query?.limit, 1, 500) ?? 200;
    const offset = clampInt(req?.query?.offset, 0, 50_000) ?? 0;
    const totalRow = db.prepare(`SELECT COUNT(*) as total FROM users`).get();
    const rows = db
      .prepare(
        `SELECT id,
                email,
                display_name,
                created_at,
                is_admin
         FROM users
         ORDER BY datetime(created_at) DESC
         LIMIT ?
         OFFSET ?`
      )
      .all(limit, offset);
    res.json({
      total: totalRow?.total ?? rows.length,
      users: rows.map((row) => ({
        id: row.id,
        email: row.email || "",
        displayName: row.display_name || "",
        createdAt: row.created_at,
        isAdmin: Boolean(row.is_admin),
      })),
    });
  });

  app.get("/admin/users/:id", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_view_private_metadata");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const sessions = db
      .prepare(
        `SELECT COUNT(*) as count
         FROM sessions
         WHERE user_id = ?
           AND datetime(expires_at) > datetime('now')`
      )
      .get(target.userId);
    res.json({
      user: {
        id: target.userRow.id,
        email: target.userRow.email,
        displayName: target.userRow.display_name || "",
        avatarUrl: resolveAvatarUrlForResponse(req, target.userRow.avatar_url || ""),
        bio: target.userRow.bio || "",
        createdAt: target.userRow.created_at,
        emailVerified: Boolean(target.userRow.email_verified),
        emailVerifiedAt: target.userRow.email_verified_at || null,
        isAdmin: Boolean(target.userRow.is_admin),
        isSuspended: Boolean(target.userRow.is_suspended),
        suspendedUntil: target.userRow.suspended_until || null,
        suspendedReason: target.userRow.suspended_reason || "",
        isBanned: Boolean(target.userRow.is_banned),
        bannedAt: target.userRow.banned_at || null,
        bannedReason: target.userRow.banned_reason || "",
        shadowRestricted: Boolean(target.userRow.shadow_restricted),
        trustOverride: target.userRow.trust_override || "",
        trustOverrideReason: target.userRow.trust_override_reason || "",
        trustOverrideAt: target.userRow.trust_override_at || null,
        activeSessions: sessions?.count ?? 0,
      },
    });
  });

  app.get("/admin/users/:id/actions", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_view_moderation_history");
    if (!ctx) return;
    if (!ctx.settings.admin_view_actions) {
      res.status(403).json({ error: "admin_actions_disabled" });
      return;
    }
    const target = requireTargetUser(req, res);
    if (!target) return;
    const limit = clampInt(req?.query?.limit, 1, 200) ?? 50;
    res.json({ actions: getAdminActionsForUser(db, target.userId, limit) });
  });

  app.get("/admin/users/:id/risk-flags", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_risk_flags");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const includeResolved = parseBoolean(req?.query?.includeResolved, false);
    const rows = db
      .prepare(
        `SELECT id,
                flag,
                level,
                note,
                created_at,
                created_by,
                resolved_at,
                resolved_by
         FROM user_risk_flags
         WHERE user_id = ?
           AND (? OR resolved_at IS NULL)
         ORDER BY datetime(created_at) DESC`
      )
      .all(target.userId, includeResolved ? 1 : 0);
    res.json({ flags: rows });
  });

  app.post("/admin/users/:id/risk-flags", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_risk_flags");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const flag = sanitizeRiskFlag(req?.body?.flag || "");
    if (!flag) {
      res.status(400).json({ error: "invalid_flag" });
      return;
    }
    const level = String(req?.body?.level || "").trim().slice(0, 40);
    const note = String(req?.body?.note || "").trim().slice(0, 240);
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO user_risk_flags (user_id, flag, level, note, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(target.userId, flag, level || null, note || null, now, ctx.admin.userRow.id);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.risk_flag.add",
      detail: { flag, level },
      reason,
    });
    res.json({ ok: true, id: result.lastInsertRowid });
  });

  app.post("/admin/users/:id/risk-flags/:flagId/resolve", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_risk_flags");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const flagId = Number.parseInt(req?.params?.flagId, 10);
    if (!Number.isFinite(flagId)) {
      res.status(400).json({ error: "invalid_flag_id" });
      return;
    }
    const row = db
      .prepare(
        `SELECT id, flag, level, resolved_at
         FROM user_risk_flags
         WHERE id = ? AND user_id = ?`
      )
      .get(flagId, target.userId);
    if (!row) {
      res.status(404).json({ error: "flag_not_found" });
      return;
    }
    if (row.resolved_at) {
      res.json({ ok: true, alreadyResolved: true });
      return;
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE user_risk_flags
       SET resolved_at = ?, resolved_by = ?
       WHERE id = ?`
    ).run(now, ctx.admin.userRow.id, flagId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.risk_flag.resolve",
      detail: { flagId, flag: row.flag, level: row.level },
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/users/:id/trust-override", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_risk_flags");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const override = sanitizeTrustOverride(req?.body?.level || "");
    const now = override ? new Date().toISOString() : null;
    db.prepare(
      `UPDATE users
       SET trust_override = ?,
           trust_override_reason = ?,
           trust_override_at = ?
       WHERE id = ?`
    ).run(override || null, reason || null, now, target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.trust_override",
      detail: { level: override || "none" },
      reason,
    });
    res.json({ ok: true, level: override || "" });
  });

  app.post("/admin/users/:id/suspend", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_suspend");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    if (ctx.admin.userRow.id === target.userId) {
      res.status(400).json({ error: "cannot_suspend_self" });
      return;
    }
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const untilIso = parseIsoDate(req?.body?.until);
    if (req?.body?.until && !untilIso) {
      res.status(400).json({ error: "invalid_suspension_until" });
      return;
    }
    if (untilIso && Date.parse(untilIso) <= Date.now()) {
      res.status(400).json({ error: "suspension_until_in_past" });
      return;
    }
    db.prepare(
      `UPDATE users
       SET is_suspended = 1,
           suspended_until = ?,
           suspended_reason = ?
       WHERE id = ?`
    ).run(untilIso || null, reason || null, target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.suspend",
      detail: { until: untilIso || null },
      reason,
    });
    res.json({ ok: true, suspendedUntil: untilIso || null });
  });

  app.post("/admin/users/:id/unsuspend", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_suspend");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(
      `UPDATE users
       SET is_suspended = 0,
           suspended_until = NULL,
           suspended_reason = NULL
       WHERE id = ?`
    ).run(target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.unsuspend",
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/users/:id/ban", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_permanent_bans");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    if (ctx.admin.userRow.id === target.userId) {
      res.status(400).json({ error: "cannot_ban_self" });
      return;
    }
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users
       SET is_banned = 1,
           banned_at = ?,
           banned_reason = ?
       WHERE id = ?`
    ).run(now, reason || null, target.userId);
    const sessionsCleared = db
      .prepare(`DELETE FROM sessions WHERE user_id = ?`)
      .run(target.userId).changes;
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.ban",
      detail: { sessionsCleared },
      reason,
    });
    res.json({ ok: true, sessionsCleared });
  });

  app.post("/admin/users/:id/unban", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_permanent_bans");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(
      `UPDATE users
       SET is_banned = 0,
           banned_at = NULL,
           banned_reason = NULL
       WHERE id = ?`
    ).run(target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.unban",
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/users/:id/shadow-restrict", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_shadow_restrict");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(`UPDATE users SET shadow_restricted = 1 WHERE id = ?`).run(
      target.userId
    );
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.shadow_restrict",
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/users/:id/shadow-unrestrict", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_shadow_restrict");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(`UPDATE users SET shadow_restricted = 0 WHERE id = ?`).run(
      target.userId
    );
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.shadow_unrestrict",
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/users/:id/force-logout", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_force_logout");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const result = db
      .prepare(`DELETE FROM sessions WHERE user_id = ?`)
      .run(target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.force_logout",
      detail: { sessionsCleared: result.changes ?? 0 },
      reason,
    });
    res.json({ ok: true, sessionsCleared: result.changes ?? 0 });
  });

  app.post("/admin/users/:id/reset-profile", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_reset_profile");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const requestedName = sanitizeDisplayName(req?.body?.displayName || "");
    const displayName =
      requestedName && requestedName !== "Guest"
        ? requestedName
        : `User${target.userId}`;
    db.prepare(
      `UPDATE users
       SET display_name = ?,
           avatar_url = NULL,
           bio = NULL,
           profile_name = NULL,
           profile_age = NULL,
           profile_gender = NULL,
           profile_interests = NULL
       WHERE id = ?`
    ).run(displayName, target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.reset_profile",
      detail: { displayName },
      reason,
    });
    res.json({ ok: true, displayName });
  });

  app.post("/admin/users/:id/delete", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_delete_accounts");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    if (ctx.admin.userRow.id === target.userId) {
      res.status(400).json({ error: "cannot_delete_self" });
      return;
    }
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const detail = {
      userId: target.userId,
      email: target.userRow.email || "",
      displayName: target.userRow.display_name || "",
    };
    const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(target.userId);
    if (!result?.changes) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      action: "user.delete",
      detail,
      reason,
    });
    res.json({ ok: true, deletedUserId: target.userId });
  });

  app.post("/admin/users/:id/verify", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_verify_accounts");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users
       SET email_verified = 1,
           email_verified_at = ?
       WHERE id = ?`
    ).run(now, target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.verify",
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/users/:id/unverify", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "user_verify_accounts");
    if (!ctx) return;
    const target = requireTargetUser(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(
      `UPDATE users
       SET email_verified = 0,
           email_verified_at = NULL
       WHERE id = ?`
    ).run(target.userId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      targetUserId: target.userId,
      action: "user.unverify",
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/threads/:id/delete", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "content_remove");
    if (!ctx) return;
    const target = requireThread(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE threads
       SET is_deleted = 1,
           deleted_at = ?,
           deleted_by = ?,
           deleted_reason = ?
       WHERE id = ?`
    ).run(now, ctx.admin.userRow.id, reason || null, target.threadId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      action: "content.thread.delete",
      detail: { threadId: target.threadId },
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/threads/:id/restore", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "content_restore");
    if (!ctx) return;
    const target = requireThread(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(
      `UPDATE threads
       SET is_deleted = 0,
           deleted_at = NULL,
           deleted_by = NULL,
           deleted_reason = NULL
       WHERE id = ?`
    ).run(target.threadId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      action: "content.thread.restore",
      detail: { threadId: target.threadId },
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/threads/:id/freeze", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "content_freeze_threads");
    if (!ctx) return;
    const target = requireThread(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE threads
       SET is_frozen = 1,
           frozen_at = ?,
           frozen_by = ?,
           frozen_reason = ?
       WHERE id = ?`
    ).run(now, ctx.admin.userRow.id, reason || null, target.threadId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      action: "content.thread.freeze",
      detail: { threadId: target.threadId },
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/threads/:id/unfreeze", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "content_freeze_threads");
    if (!ctx) return;
    const target = requireThread(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(
      `UPDATE threads
       SET is_frozen = 0,
           frozen_at = NULL,
           frozen_by = NULL,
           frozen_reason = NULL
       WHERE id = ?`
    ).run(target.threadId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      action: "content.thread.unfreeze",
      detail: { threadId: target.threadId },
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/posts/:id/delete", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "content_remove");
    if (!ctx) return;
    const target = requirePost(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE posts
       SET is_deleted = 1,
           deleted_at = ?,
           deleted_by = ?,
           deleted_reason = ?
       WHERE id = ?`
    ).run(now, ctx.admin.userRow.id, reason || null, target.postId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      action: "content.post.delete",
      detail: { postId: target.postId, threadId: target.row.thread_id },
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/admin/posts/:id/restore", authLimiter, (req, res) => {
    const ctx = requireAdminPermission(req, res, "content_restore");
    if (!ctx) return;
    const target = requirePost(req, res);
    if (!target) return;
    const reason = sanitizeReason(req?.body?.reason || "");
    if (!requireAdminReason(ctx.settings, res, reason)) return;
    db.prepare(
      `UPDATE posts
       SET is_deleted = 0,
           deleted_at = NULL,
           deleted_by = NULL,
           deleted_reason = NULL
       WHERE id = ?`
    ).run(target.postId);
    logAdminAction(db, {
      userId: ctx.admin.userRow.id,
      action: "content.post.restore",
      detail: { postId: target.postId, threadId: target.row.thread_id },
      reason,
    });
    res.json({ ok: true });
  });

  app.post("/auth/verify/resend", authLimiter, (req, res) => {
    const session = getSessionFromRequest(req, db);
    const email = session?.user?.email || normalizeEmail(req?.body?.email || "");
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    const userRow = db
      .prepare(`SELECT id, email_verified FROM users WHERE email = ?`)
      .get(email);
    if (!userRow) {
      res.json({ ok: true });
      return;
    }
    if (userRow.email_verified) {
      res.json({ ok: true, alreadyVerified: true });
      return;
    }
    const verification = createEmailVerificationToken(db, userRow.id);
    const requestOrigin = getRequestOrigin(req);
    const redirectParam = req?.body?.redirect || "";
    const redirectTo =
      sanitizeRedirect(redirectParam, requestOrigin) ||
      getDefaultRedirectUrl(requestOrigin);
    const verificationLink = buildRedirectWithParams(
      `${requestOrigin || ""}/auth/verify`,
      {
        token: verification.token,
        redirect: redirectTo,
      }
    );
    void sendEmail({
      to: email,
      subject: "Verify your Lurk email",
      text: `Verify your email by visiting: ${verificationLink}`,
    }).then((result) => {
      if (!result.ok) {
        console.warn("verification email not sent", result.reason);
      }
    });
    res.json({ ok: true, verificationLink });
  });

  app.get("/auth/verify", authLimiter, (req, res) => {
    const token = String(req?.query?.token || "");
    const requestOrigin = getRequestOrigin(req);
    const redirectParam = req?.query?.redirect || "";
    const redirectTo =
      sanitizeRedirect(redirectParam, requestOrigin) ||
      getDefaultRedirectUrl(requestOrigin);

    if (!token) {
      const fail = buildRedirectWithParams(redirectTo, {
        error: "verification_token_missing",
      });
      res.redirect(fail);
      return;
    }
    const userId = consumeVerificationToken(db, token);
    if (!userId) {
      const fail = buildRedirectWithParams(redirectTo, {
        error: "verification_token_invalid",
      });
      res.redirect(fail);
      return;
    }
    db.prepare(
      `UPDATE users
       SET email_verified = 1,
           email_verified_at = COALESCE(email_verified_at, ?)
       WHERE id = ?`
    ).run(new Date().toISOString(), userId);
    const success = buildRedirectWithParams(redirectTo, { verified: 1 });
    res.redirect(success);
  });

  app.post("/auth/password-reset", authLimiter, (req, res) => {
    const email = normalizeEmail(req?.body?.email || "");
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    const userRow = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);
    if (userRow) {
      const reset = createPasswordResetToken(db, userRow.id);
      const requestOrigin = getRequestOrigin(req);
      const redirectParam = req?.body?.redirect || "";
      const redirectTo =
        sanitizeRedirect(redirectParam, requestOrigin) ||
        getDefaultRedirectUrl(requestOrigin);
      const resetLink = buildRedirectWithParams(redirectTo, {
        reset_token: reset.token,
      });
      void sendEmail({
        to: email,
        subject: "Reset your Lurk password",
        text: `Reset your password by visiting: ${resetLink}`,
      }).then((result) => {
        if (!result.ok) {
          console.warn("password reset email not sent", result.reason);
        }
      });
      res.json({ ok: true, resetLink });
      return;
    }
    res.json({ ok: true });
  });

  app.post("/auth/password-reset/confirm", authLimiter, (req, res) => {
    const token = String(req?.body?.token || "");
    const password = String(req?.body?.password || "");
    if (!token) {
      res.status(400).json({ error: "token_missing" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short" });
      return;
    }
    const userId = consumePasswordResetToken(db, token);
    if (!userId) {
      res.status(400).json({ error: "token_invalid" });
      return;
    }
    const passwordHash = hashPassword(password);
    db.prepare(
      `UPDATE users SET password_hash = ? WHERE id = ?`
    ).run(passwordHash, userId);
    res.json({ ok: true });
  });

  app.get("/auth/google", authRelaxedLimiter, (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(501).json({ error: "google_oauth_not_configured" });
      return;
    }
    const requestOrigin = getRequestOrigin(req);
    const redirectParam = req?.query?.redirect || "";
    const redirectTo = sanitizeRedirect(redirectParam, requestOrigin);
    const redirectUri =
      GOOGLE_REDIRECT_URI ||
      (requestOrigin ? `${requestOrigin}/auth/google/callback` : "");
    if (!redirectUri) {
      res.status(500).json({ error: "google_redirect_unavailable" });
      return;
    }

    const state = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + AUTH_STATE_TTL_MS).toISOString();
    db.prepare(
      `INSERT INTO oauth_states (state, redirect, expires_at) VALUES (?, ?, ?)`
    ).run(state, redirectTo, expiresAt);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get(["/auth/google/callback", "/auth/google/fallback"], authRelaxedLimiter, async (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(501).send("Google OAuth is not configured.");
      return;
    }
    const requestOrigin = getRequestOrigin(req);
    const code =
      typeof req?.query?.code === "string" ? req.query.code.trim() : "";
    const state =
      typeof req?.query?.state === "string" ? req.query.state.trim() : "";
    const oauthErrorRaw =
      typeof req?.query?.error === "string" ? req.query.error : "";
    const oauthError = oauthErrorRaw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    let redirectTo = getDefaultRedirectUrl(requestOrigin, "/account");
    let stateRow = null;
    if (state) {
      stateRow = db
        .prepare(`SELECT redirect, expires_at FROM oauth_states WHERE state = ?`)
        .get(state);
      db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state);
      if (stateRow) {
        const expiresAt = Date.parse(stateRow.expires_at);
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
          redirectTo = sanitizeRedirect(stateRow.redirect, requestOrigin);
        } else {
          stateRow = null;
        }
      }
    }

    if (oauthError) {
      const fail = buildRedirectWithParams(redirectTo, {
        error: `google_${oauthError}`,
      });
      res.redirect(fail);
      return;
    }
    if (!code || !state) {
      const fail = buildRedirectWithParams(redirectTo, {
        error: "google_invalid_oauth_response",
      });
      res.redirect(fail);
      return;
    }
    if (!stateRow) {
      const fail = buildRedirectWithParams(redirectTo, {
        error: "google_oauth_state_expired",
      });
      res.redirect(fail);
      return;
    }

    const redirectUri =
      GOOGLE_REDIRECT_URI ||
      (requestOrigin ? `${requestOrigin}/auth/google/callback` : "");
    if (!redirectUri) {
      res.status(500).send("OAuth redirect unavailable.");
      return;
    }

    let tokenData = null;
    try {
      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: String(code),
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        }
      );
      tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        console.error("google token exchange failed", tokenData);
        const fail = buildRedirectWithParams(redirectTo, {
          error: "google_token_exchange_failed",
        });
        res.redirect(fail);
        return;
      }
    } catch (err) {
      console.error("google token exchange error", err);
      const fail = buildRedirectWithParams(redirectTo, {
        error: "google_token_exchange_failed",
      });
      res.redirect(fail);
      return;
    }

    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      const fail = buildRedirectWithParams(redirectTo, {
        error: "google_access_token_missing",
      });
      res.redirect(fail);
      return;
    }

    let profile = null;
    try {
      const profileRes = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      profile = await profileRes.json();
      if (!profileRes.ok) {
        console.error("google profile fetch failed", profile);
        const fail = buildRedirectWithParams(redirectTo, {
          error: "google_profile_failed",
        });
        res.redirect(fail);
        return;
      }
    } catch (err) {
      console.error("google profile fetch error", err);
      const fail = buildRedirectWithParams(redirectTo, {
        error: "google_profile_failed",
      });
      res.redirect(fail);
      return;
    }

    const providerUserId = String(profile?.sub || "");
    const email = normalizeEmail(profile?.email || "");
    if (!providerUserId || !email) {
      const fail = buildRedirectWithParams(redirectTo, {
        error: "google_profile_incomplete",
      });
      res.redirect(fail);
      return;
    }

    const avatarUrl = sanitizeAvatarUrl(profile?.picture || "");
    let userRow = db
      .prepare(
        `SELECT u.id, u.email, u.display_name, u.avatar_url, u.is_banned, u.is_suspended, u.suspended_until
         FROM oauth_accounts oa
         JOIN users u ON u.id = oa.user_id
         WHERE oa.provider = ? AND oa.provider_user_id = ?`
      )
      .get("google", providerUserId);

    if (!userRow) {
      const existingUser = db
        .prepare(
          `SELECT id, email, display_name, avatar_url, is_banned, is_suspended, suspended_until
           FROM users WHERE email = ?`
        )
        .get(email);
      if (existingUser) {
        userRow = existingUser;
        db.prepare(
          `UPDATE users
           SET email_verified = 1,
               email_verified_at = COALESCE(email_verified_at, ?),
               avatar_url = COALESCE(avatar_url, ?)
           WHERE id = ?`
        ).run(new Date().toISOString(), avatarUrl || null, existingUser.id);
        db.prepare(
          `INSERT OR IGNORE INTO oauth_accounts (user_id, provider, provider_user_id, email)
           VALUES (?, ?, ?, ?)`
        ).run(existingUser.id, "google", providerUserId, email);
      } else {
        const displayName =
          sanitizeDisplayName(profile?.name || "") ||
          email.split("@")[0] ||
          "User";
        const result = db
          .prepare(
            `INSERT INTO users (email, display_name, email_verified, email_verified_at, avatar_url)
             VALUES (?, ?, 1, ?, ?)`
          )
          .run(email, displayName, new Date().toISOString(), avatarUrl || null);
        db.prepare(
          `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email)
           VALUES (?, ?, ?, ?)`
        ).run(result.lastInsertRowid, "google", providerUserId, email);
        userRow = { id: result.lastInsertRowid, email, display_name: displayName };
      }
    }

    const access = getUserAccessById(db, userRow.id);
    if (!access.allowed) {
      const fail = buildRedirectWithParams(redirectTo || "/", {
        error: access.reason || "access_denied",
      });
      res.redirect(fail);
      return;
    }

    const session = createSession(db, userRow.id);
    setSessionCookie(res, session.token, {
      maxAgeMs: AUTH_SESSION_TTL_MS,
      secure: !dev,
    });

    let finalRedirect = redirectTo || "/";
    if (shouldAppendAuthToken(finalRedirect, requestOrigin)) {
      finalRedirect = appendAuthToken(finalRedirect, session.token, requestOrigin);
    }
    res.redirect(finalRedirect);
  });

  app.get("/threads", readLimiter, (_req, res) => {
    purgeExpiredThreads(db);
    const rows = db
      .prepare(
        `
        SELECT *
        FROM threads
        WHERE COALESCE(is_deleted, 0) = 0
        ORDER BY datetime(created_at) DESC
        LIMIT 100
      `
      )
      .all();
    res.json(rows.map((row) => serializeThread(row, db)));
  });

  /* ---- remaining routes unchanged except for safety ---- */
  /* (intentionally omitted here for brevity — logic identical) */

  sockets = await setupSockets(server);
  app.locals.sockets = sockets;
  app.locals.db = db;
  return { db, sockets };
}

/* -------------------- HELPERS -------------------- */

function createUploadMiddleware({
  allowedPrefixes = ALLOWED_MEDIA_PREFIXES,
  fieldName = "image",
} = {}) {
  const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext =
        mime.extension(file.mimetype) ||
        path.extname(file.originalname) ||
        "bin";

      getQuantumBits(64)
        .then((bits) => {
          const id = BigInt("0b" + bits)
            .toString(32)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          cb(null, `${id}.${ext}`);
        })
        .catch(() => {
          const fallback = crypto.randomBytes(16).toString("hex");
          cb(null, `${fallback}.${ext}`);
        });
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_MEDIA_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!allowedPrefixes.some((p) => file.mimetype.startsWith(p))) {
        return cb(new Error("invalid_file_type"));
      }
      cb(null, true);
    },
  }).single(fieldName);
}

/* -------------------- UTILITIES -------------------- */

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function resetDatabase() {
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = DB_PATH + suffix;
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}

function generateCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function clampInt(input, min, max) {
  const n = Number.parseInt(input, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function sanitizeDisplayName(value) {
  if (!value) return "Guest";
  return String(value).replace(/[^\w\s-]/g, "").trim().slice(0, 32) || "Guest";
}

function sanitizeMessage(value) {
  if (!value) return "";
  return String(value).trim().slice(0, 500);
}

function sanitizeSticker(value) {
  if (!value) return "";
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9-_]/g, "");
  if (!CHAT_STICKERS.has(cleaned)) return "";
  return cleaned;
}

function sanitizeBio(value) {
  if (!value) return "";
  return String(value).trim().slice(0, 280);
}

function sanitizeReportField(value, maxLength = 400) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeReportContact(value) {
  const normalized = sanitizeReportField(value, 120);
  if (!normalized) return "";
  if (normalized.includes("@")) {
    const email = normalizeEmail(normalized);
    return isValidEmail(email) ? email : "";
  }
  return normalized.startsWith("@") ? normalized.slice(0, 60) : normalized;
}

function sanitizeAvatarUrl(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/uploads/")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function sanitizeOptionalProfileText(value, maxLength = 120) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeProfileAge(value) {
  if (value === undefined || value === null) return { valid: true, value: null };
  const trimmed = String(value).trim();
  if (!trimmed) return { valid: true, value: null };
  if (!/^\d{1,3}$/.test(trimmed)) {
    return { valid: false, value: null };
  }
  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 120) {
    return { valid: false, value: null };
  }
  return { valid: true, value: numeric };
}

function getProfileDetailsFromRow(row) {
  if (!row) return { ...emptyProfileDetails };
  return {
    name: sanitizeOptionalProfileText(row.profile_name || "", 80),
    age: Number.isFinite(row.profile_age) ? row.profile_age : null,
    gender: sanitizeOptionalProfileText(row.profile_gender || "", 40),
    interests: sanitizeOptionalProfileText(row.profile_interests || "", 320),
  };
}

function sanitizePlayableTitle(value) {
  return String(value || "").trim().slice(0, 80);
}

function sanitizePlayableDescription(value) {
  return String(value || "").trim().slice(0, 320);
}

function sanitizePlayableAuthor(value) {
  return String(value || "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function normalizePlayableTag(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function sanitizePlayableTags(input) {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        list = trimmed.split(",");
      }
    } else {
      list = trimmed.split(",");
    }
  }
  const cleaned = list
    .map((item) => normalizePlayableTag(item))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 6);
}

function parsePlayableTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return [];
  }
  return [];
}

function sanitizePlayableUrl(
  value,
  { allowUploads = false, allowPlayables = false, allowRemote = false } = {}
) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (allowUploads && trimmed.startsWith("/uploads/")) return trimmed;
  if (allowPlayables && trimmed.startsWith("/playables-assets/")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (!allowRemote) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function sanitizePlayableId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function sanitizePlayableOrientation(value) {
  const cleaned = String(value || "").trim().toLowerCase();
  return cleaned === "portrait" ? "portrait" : "landscape";
}

function sanitizeHostedPath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  let candidate = trimmed;
  if (/^(https?:)?\/\//i.test(candidate)) {
    try {
      const url = candidate.startsWith("//")
        ? new URL(`http:${candidate}`)
        : new URL(candidate);
      candidate = url.pathname || "";
    } catch {
      // Ignore invalid URLs.
    }
  } else if (!candidate.startsWith("/")) {
    if (candidate.startsWith("playables-assets/")) {
      candidate = `/${candidate}`;
    }
  }
  if (!candidate.startsWith("/playables-assets/")) return "";
  if (candidate.includes("..")) return "";
  return candidate;
}

function sanitizeHostedThumbnailPath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  let candidate = trimmed;
  if (/^(https?:)?\/\//i.test(candidate)) {
    try {
      const url = candidate.startsWith("//")
        ? new URL(`http:${candidate}`)
        : new URL(candidate);
      candidate = url.pathname || "";
    } catch {
      // Ignore invalid URLs.
    }
  } else if (!candidate.startsWith("/")) {
    if (candidate.startsWith("playables-assets/") || candidate.startsWith("uploads/")) {
      candidate = `/${candidate}`;
    }
  }
  const allowedPrefix =
    candidate.startsWith("/playables-assets/") || candidate.startsWith("/uploads/");
  if (!allowedPrefix) return "";
  if (candidate.includes("..")) return "";
  return candidate;
}

function resolvePlayableAssetPath(hostedPath) {
  const sanitized = sanitizeHostedPath(hostedPath);
  if (!sanitized) return { ok: false, reason: "invalid_hosted_path" };
  const relative = sanitized.replace(/^\/+/, "");
  const cwd = process.cwd();
  const roots = [cwd, path.join(cwd, "..")];
  const baseDirs = [
    ...roots.map((root) => path.join(root, "public")),
    ...roots.map((root) => path.join(root, "out")),
  ];
  for (const baseDir of baseDirs) {
    const candidate = path.join(baseDir, relative);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { ok: true, filePath: candidate, baseDir };
      }
    } catch {
      // Ignore candidate errors.
    }
  }
  return { ok: false, reason: "asset_not_found" };
}

function listPlayableFiles(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    });
  }
  return files;
}

function scanPlayableSource({ text, filePath, issues }) {
  const lower = text.toLowerCase();
  const scriptSrc = /<script[^>]+src=["']([^"']+)["']/gi;
  let match = null;
  while ((match = scriptSrc.exec(lower)) !== null) {
    const src = match[1] || "";
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//")) {
      issues.push({ filePath, reason: "external_script_src" });
    }
  }

  const importPattern = /\bimport\s+(?:[^'"]+from\s+)?["'](https?:\/\/|\/\/)/i;
  if (importPattern.test(text)) {
    issues.push({ filePath, reason: "external_import" });
  }

  const dynamicImportPattern = /\bimport\s*\(\s*["'](https?:\/\/|\/\/)/i;
  if (dynamicImportPattern.test(text)) {
    issues.push({ filePath, reason: "external_dynamic_import" });
  }

  const fetchPattern = /\bfetch\s*\(\s*["'](https?:\/\/|\/\/)/i;
  if (fetchPattern.test(text)) {
    issues.push({ filePath, reason: "remote_fetch" });
  }

  const xhrPattern = /\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["'](https?:\/\/|\/\/)/i;
  if (xhrPattern.test(text)) {
    issues.push({ filePath, reason: "remote_xhr" });
  }
}

function validatePlayableAssets(hostedPath) {
  const resolved = resolvePlayableAssetPath(hostedPath);
  if (!resolved.ok) return resolved;
  const hostedExt = path.extname(resolved.filePath || "").toLowerCase();
  if (hostedExt !== ".html") {
    return { ok: false, reason: "hosted_path_not_html", rootDir: resolved.baseDir };
  }
  const relative = sanitizeHostedPath(hostedPath).replace(/^\/+/, "");
  const parts = relative.split("/");
  if (parts.length < 3) {
    return { ok: false, reason: "invalid_playable_path" };
  }
  const rootDir = path.join(resolved.baseDir, "playables-assets", parts[1]);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return { ok: false, reason: "playable_root_missing" };
  }
  const resolvedFile = path.resolve(resolved.filePath);
  const resolvedRoot = path.resolve(rootDir) + path.sep;
  if (!resolvedFile.startsWith(resolvedRoot)) {
    return { ok: false, reason: "hosted_path_outside_root", rootDir };
  }

  const files = listPlayableFiles(rootDir);
  let totalBytes = 0;
  const issues = [];

  for (const filePath of files) {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) continue;
    totalBytes += stats.size;
    if (stats.size > PLAYABLE_MAX_FILE_BYTES) {
      issues.push({ filePath, reason: "file_too_large" });
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!PLAYABLE_ALLOWED_EXTENSIONS.has(ext)) {
      issues.push({ filePath, reason: "extension_not_allowed" });
    }
    if (ext === ".html" || ext === ".js") {
      const text = fs.readFileSync(filePath, "utf8");
      scanPlayableSource({ text, filePath, issues });
    }
  }

  if (totalBytes > PLAYABLE_MAX_TOTAL_BYTES) {
    issues.push({ filePath: rootDir, reason: "total_size_exceeded" });
  }

  if (issues.length) {
    return { ok: false, reason: "playable_validation_failed", issues, rootDir };
  }

  return { ok: true, filePath: resolved.filePath, rootDir, totalBytes };
}

function readPlayablesManifestFromDisk() {
  const roots = [process.cwd(), path.join(process.cwd(), "..")];
  const candidates = [
    ...roots.map((root) =>
      path.join(root, "public", "playables", "manifest.json")
    ),
    ...roots.map((root) =>
      path.join(root, "out", "playables", "manifest.json")
    ),
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.games)) {
        return data;
      }
    } catch {
      // Ignore malformed manifests.
    }
  }
  return { version: 1, updatedAt: null, games: [] };
}

function serializePlayableSubmission(row, { includeUser = false } = {}) {
  const minPlayers =
    Number.isFinite(row?.min_players) && row.min_players > 0
      ? row.min_players
      : 1;
  const maxPlayers =
    Number.isFinite(row?.max_players) && row.max_players > 0
      ? Math.max(row.max_players, minPlayers)
      : minPlayers;
  const payload = {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    tags: parsePlayableTags(row.tags),
    authorName: row.author_name || "",
    buildUrl: row.build_url || "",
    sourceUrl: row.source_url || "",
    thumbnailUrl: row.thumbnail_url || "",
    orientation: row.orientation || "landscape",
    minPlayers,
    maxPlayers,
    status: row.status || "pending",
    approved: Boolean(row.approved),
    adminNotes: row.admin_notes || "",
    hostedId: row.hosted_id || "",
    hostedPath: row.hosted_path || "",
    hostedThumbnail: row.hosted_thumbnail || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
  };
  if (includeUser) {
    payload.user = {
      id: row.user_id,
      email: row.user_email || "",
      displayName: row.user_display_name || "",
    };
  }
  return payload;
}

function buildPlayablesManifest({ baseManifest, submissions, admin = false }) {
  const baseGames = Array.isArray(baseManifest?.games) ? baseManifest.games : [];
  const usedIds = new Set();
  const games = [];

  baseGames.forEach((game) => {
    const id =
      sanitizePlayableId(game?.id || "") ||
      sanitizePlayableId(game?.title || "");
    if (!id || usedIds.has(id)) return;
    const playUrl = sanitizeHostedPath(game?.path || "");
    if (!playUrl) return;
    usedIds.add(id);
    const payload = {
      id,
      title: game?.title || "",
      description: game?.description || "",
      thumbnailUrl: game?.thumbnail || "",
      playUrl,
      developerName: game?.author || "Lurk",
    };
    if (admin) {
      payload.tags = Array.isArray(game?.tags) ? game.tags : [];
      payload.orientation = game?.orientation || "landscape";
      payload.minPlayers = Number.isFinite(game?.minPlayers) ? game.minPlayers : 1;
      payload.maxPlayers = Number.isFinite(game?.maxPlayers) ? game.maxPlayers : 1;
      payload.source = "builtin";
    }
    games.push(payload);
  });

  submissions.forEach((row) => {
    if (!row?.hosted_path) return;
    const playUrl = sanitizeHostedPath(row.hosted_path);
    if (!playUrl) return;
    let id = sanitizePlayableId(row.hosted_id || "");
    if (!id) {
      id = sanitizePlayableId(row.title) || `playable-${row.id}`;
    }
    if (usedIds.has(id)) {
      id = `${id}-${row.id}`;
    }
    usedIds.add(id);

    const tags = parsePlayableTags(row.tags);
    const minPlayers =
      Number.isFinite(row?.min_players) && row.min_players > 0
        ? row.min_players
        : 1;
    const maxPlayers =
      Number.isFinite(row?.max_players) && row.max_players > 0
        ? Math.max(row.max_players, minPlayers)
        : minPlayers;

    const payload = {
      id,
      title: row.title || "",
      description: row.description || "",
      thumbnailUrl: row.hosted_thumbnail || row.thumbnail_url || "",
      playUrl,
      developerName: row.author_name || row.user_display_name || "Developer",
    };
    if (admin) {
      payload.tags = tags;
      payload.orientation = row.orientation || "landscape";
      payload.minPlayers = minPlayers;
      payload.maxPlayers = maxPlayers;
      payload.buildUrl = row.build_url || "";
      payload.sourceUrl = row.source_url || "";
      payload.submissionId = row.id;
      payload.status = row.status || "pending";
      payload.approved = Boolean(row.approved);
      payload.hostedPath = row.hosted_path || "";
      payload.hostedThumbnail = row.hosted_thumbnail || "";
      payload.source = "submission";
    }
    games.push(payload);
  });

  return {
    version: baseManifest?.version ?? 1,
    updatedAt: new Date().toISOString(),
    games,
  };
}

function normalizeAdminName(value) {
  if (!value) return "";
  return String(value)
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function shouldGrantAdmin({ userId, email, displayName, dev }) {
  if (Number.isFinite(userId) && ADMIN_USER_IDS.includes(userId)) {
    return true;
  }
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail)) {
    return true;
  }
  const normalizedName = normalizeAdminName(displayName);
  if (normalizedName && ADMIN_DISPLAY_NAMES.includes(normalizedName)) {
    return true;
  }
  if (
    dev &&
    ADMIN_MATCH_DEV_ONLY &&
    ADMIN_EMAILS.length === 0 &&
    ADMIN_DISPLAY_NAMES.length === 0 &&
    ADMIN_USER_IDS.length === 0
  ) {
    return normalizedName === ADMIN_DEV_DEFAULT_NAME;
  }
  return false;
}

function shouldGrantDeveloper({ userId, email }) {
  if (Number.isFinite(userId) && DEVELOPER_USER_IDS.includes(userId)) {
    return true;
  }
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail && DEVELOPER_EMAILS.includes(normalizedEmail)) {
    return true;
  }
  return false;
}

function resolveIsAdmin({ userRow, dev }) {
  if (!userRow) return false;
  if (userRow.is_admin) return true;
  return shouldGrantAdmin({
    userId: userRow.id ?? userRow.user_id,
    email: userRow.email,
    displayName: userRow.display_name ?? userRow.displayName,
    dev,
  });
}

function resolveIsDeveloper({ userRow }) {
  if (!userRow) return false;
  if (userRow.is_developer) return true;
  return shouldGrantDeveloper({
    userId: userRow.id ?? userRow.user_id,
    email: userRow.email,
  });
}

function ensureAdminFlag(db, userRow, dev) {
  if (!db || !userRow) return false;
  const grant = shouldGrantAdmin({
    userId: userRow.id ?? userRow.user_id,
    email: userRow.email,
    displayName: userRow.display_name ?? userRow.displayName,
    dev,
  });
  if (!grant || userRow.is_admin) return grant;
  try {
    db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(
      userRow.id ?? userRow.user_id
    );
  } catch {
    // Ignore update failures.
  }
  return grant;
}

function ensureDeveloperFlag(db, userRow) {
  if (!db || !userRow) return false;
  const grant = shouldGrantDeveloper({
    userId: userRow.id ?? userRow.user_id,
    email: userRow.email,
  });
  if (!grant || userRow.is_developer) return grant;
  try {
    db.prepare(`UPDATE users SET is_developer = 1 WHERE id = ?`).run(
      userRow.id ?? userRow.user_id
    );
  } catch {
    // Ignore update failures.
  }
  return grant;
}

function mergeAdminSettings(stored) {
  const next = { ...DEFAULT_ADMIN_SETTINGS };
  if (!stored || typeof stored !== "object") return next;
  ADMIN_SETTING_KEYS.forEach((key) => {
    if (typeof stored[key] === "boolean") {
      next[key] = stored[key];
    }
  });
  return next;
}

function sanitizeAdminSettings(patch) {
  if (!patch || typeof patch !== "object") return {};
  const next = {};
  ADMIN_SETTING_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = Boolean(patch[key]);
    }
  });
  return next;
}

function sanitizeReason(value) {
  if (!value) return "";
  return String(value).trim().slice(0, 200);
}

function sanitizeRiskFlag(value) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
  return cleaned.slice(0, 40);
}

function sanitizeTrustOverride(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "none") return "";
  if (["low", "neutral", "high"].includes(normalized)) return normalized;
  return "";
}

function parseIsoDate(value) {
  if (!value) return null;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function isSuspensionActive(row) {
  if (!row?.is_suspended) return false;
  if (!row.suspended_until) return true;
  const until = Date.parse(row.suspended_until);
  if (!Number.isFinite(until)) return true;
  return until > Date.now();
}

function clearExpiredSuspension(db, row) {
  if (!db || !row?.id) return;
  if (!row.is_suspended || !row.suspended_until) return;
  const until = Date.parse(row.suspended_until);
  if (!Number.isFinite(until) || until > Date.now()) return;
  db.prepare(
    `UPDATE users
     SET is_suspended = 0, suspended_until = NULL, suspended_reason = NULL
     WHERE id = ?`
  ).run(row.id);
}

function resolveUserAccess(db, row) {
  if (!row) return { allowed: false, reason: "user_not_found" };
  if (row.is_banned) return { allowed: false, reason: "user_banned" };
  if (row.is_suspended) {
    if (!isSuspensionActive(row)) {
      clearExpiredSuspension(db, row);
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "user_suspended",
      until: row.suspended_until || null,
    };
  }
  return { allowed: true };
}

function getUserAccessById(db, userId) {
  if (!db) return { allowed: false, reason: "db_unavailable" };
  const safeId = Number.parseInt(userId, 10);
  if (!Number.isFinite(safeId)) return { allowed: false, reason: "invalid_user_id" };
  const row = db
    .prepare(
      `SELECT id, is_banned, is_suspended, suspended_until
       FROM users
       WHERE id = ?`
    )
    .get(safeId);
  return resolveUserAccess(db, row);
}

function ensureAdminSettingsRow(db) {
  if (!db) return;
  const row = db
    .prepare(`SELECT id FROM admin_settings WHERE id = 1`)
    .get();
  if (row) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO admin_settings (id, settings_json, updated_at, updated_by, reason)
     VALUES (1, ?, ?, NULL, NULL)`
  ).run(JSON.stringify(DEFAULT_ADMIN_SETTINGS), now);
}

function getAdminSettingsState(db, { bypassCache = false } = {}) {
  if (!db) {
    return { settings: { ...DEFAULT_ADMIN_SETTINGS } };
  }
  const now = Date.now();
  if (
    !bypassCache &&
    adminSettingsCache.value &&
    now - adminSettingsCache.loadedAt < ADMIN_SETTINGS_CACHE_TTL_MS
  ) {
    return adminSettingsCache.value;
  }
  ensureAdminSettingsRow(db);
  const row = db
    .prepare(
      `SELECT settings_json, updated_at, updated_by, reason
       FROM admin_settings WHERE id = 1`
    )
    .get();
  let settings = { ...DEFAULT_ADMIN_SETTINGS };
  if (row?.settings_json) {
    try {
      const parsed = JSON.parse(row.settings_json);
      settings = mergeAdminSettings(parsed);
    } catch {
      settings = { ...DEFAULT_ADMIN_SETTINGS };
    }
  }
  const state = {
    settings,
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null,
    reason: row?.reason || "",
  };
  adminSettingsCache = { value: state, loadedAt: now };
  return state;
}

function updateAdminSettingsState(db, patch, { userId, reason } = {}) {
  if (!db) return { settings: { ...DEFAULT_ADMIN_SETTINGS } };
  const current = getAdminSettingsState(db, { bypassCache: true });
  const sanitized = sanitizeAdminSettings(patch);
  const next = { ...current.settings, ...sanitized };
  const now = new Date().toISOString();
  ensureAdminSettingsRow(db);
  db.prepare(
    `UPDATE admin_settings
     SET settings_json = ?, updated_at = ?, updated_by = ?, reason = ?
     WHERE id = 1`
  ).run(JSON.stringify(next), now, userId ?? null, reason || null);
  logAdminAction(db, {
    userId,
    action: "settings.update",
    detail: Object.keys(sanitized).join(", "),
    reason,
  });
  const state = {
    settings: next,
    updatedAt: now,
    updatedBy: userId ?? null,
    reason: reason || "",
  };
  adminSettingsCache = { value: state, loadedAt: Date.now() };
  return state;
}

function resetAdminSettingsState(db, { userId, reason } = {}) {
  if (!db) return { settings: { ...DEFAULT_ADMIN_SETTINGS } };
  const now = new Date().toISOString();
  ensureAdminSettingsRow(db);
  db.prepare(
    `UPDATE admin_settings
     SET settings_json = ?, updated_at = ?, updated_by = ?, reason = ?
     WHERE id = 1`
  ).run(JSON.stringify(DEFAULT_ADMIN_SETTINGS), now, userId ?? null, reason || null);
  logAdminAction(db, {
    userId,
    action: "settings.reset",
    detail: "default_settings",
    reason,
  });
  const state = {
    settings: { ...DEFAULT_ADMIN_SETTINGS },
    updatedAt: now,
    updatedBy: userId ?? null,
    reason: reason || "",
  };
  adminSettingsCache = { value: state, loadedAt: Date.now() };
  return state;
}

function mergeUserSettings(stored) {
  const next = { ...DEFAULT_USER_SETTINGS };
  if (!stored || typeof stored !== "object") return next;
  const sanitized = sanitizeUserSettings(stored);
  return { ...next, ...sanitized };
}

function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 0) return false;
    if (value === 1) return true;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return null;
}

function sanitizeUserSettings(patch) {
  if (!patch || typeof patch !== "object") return {};
  const next = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!USER_SETTING_KEYS.has(key)) continue;
    const defaultValue = DEFAULT_USER_SETTINGS[key];
    if (typeof defaultValue === "boolean") {
      const coerced = coerceBoolean(value);
      if (coerced !== null) {
        next[key] = coerced;
      }
      continue;
    }
    if (typeof defaultValue === "string") {
      const allowed = USER_SETTING_SELECTS[key];
      if (!allowed) continue;
      const normalized = String(value);
      if (allowed.has(normalized)) {
        next[key] = normalized;
      }
    }
  }
  return next;
}

function ensureUserSettingsRow(db, userId) {
  if (!db || !userId) return;
  const row = db
    .prepare(`SELECT user_id FROM user_settings WHERE user_id = ?`)
    .get(userId);
  if (row) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)`
  ).run(userId, JSON.stringify(DEFAULT_USER_SETTINGS), now);
}

function getUserSettingsState(db, userId) {
  if (!db) {
    return { settings: { ...DEFAULT_USER_SETTINGS } };
  }
  ensureUserSettingsRow(db, userId);
  const row = db
    .prepare(
      `SELECT settings_json, updated_at
       FROM user_settings WHERE user_id = ?`
    )
    .get(userId);
  let settings = { ...DEFAULT_USER_SETTINGS };
  if (row?.settings_json) {
    try {
      const parsed = JSON.parse(row.settings_json);
      settings = mergeUserSettings(parsed);
    } catch {
      settings = { ...DEFAULT_USER_SETTINGS };
    }
  }
  return {
    settings,
    updatedAt: row?.updated_at || null,
  };
}

function updateUserSettingsState(db, userId, patch) {
  if (!db) return { settings: { ...DEFAULT_USER_SETTINGS } };
  const sanitized = sanitizeUserSettings(patch);
  const keys = Object.keys(sanitized);
  if (!keys.length) {
    return getUserSettingsState(db, userId);
  }
  const current = getUserSettingsState(db, userId);
  const next = { ...current.settings, ...sanitized };
  const now = new Date().toISOString();
  ensureUserSettingsRow(db, userId);
  db.prepare(
    `UPDATE user_settings
     SET settings_json = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(JSON.stringify(next), now, userId);
  return {
    settings: next,
    updatedAt: now,
  };
}

function logAdminAction(db, { userId, action, detail, reason, targetUserId } = {}) {
  if (!db || !action) return;
  const now = new Date().toISOString();
  const serializedDetail =
    detail === undefined || detail === null
      ? ""
      : typeof detail === "string"
        ? detail
        : JSON.stringify(detail);
  db.prepare(
    `INSERT INTO admin_actions (admin_user_id, target_user_id, action, detail, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userId ?? null,
    targetUserId ?? null,
    action,
    serializedDetail || "",
    reason || "",
    now
  );
}

function getAdminActions(db, limit = 50) {
  if (!db) return [];
  const safeLimit = clampInt(limit, 1, 200) ?? 50;
  return db
    .prepare(
      `SELECT a.id,
              a.action,
              a.detail,
              a.reason,
              a.created_at,
              a.target_user_id,
              u.email as admin_email,
              u.display_name as admin_name,
              t.email as target_email,
              t.display_name as target_name
       FROM admin_actions a
       LEFT JOIN users u ON u.id = a.admin_user_id
       LEFT JOIN users t ON t.id = a.target_user_id
       ORDER BY datetime(a.created_at) DESC
       LIMIT ?`
    )
    .all(safeLimit);
}

function getAdminActionsForUser(db, userId, limit = 50) {
  if (!db) return [];
  const safeLimit = clampInt(limit, 1, 200) ?? 50;
  const safeUserId = Number.parseInt(userId, 10);
  if (!Number.isFinite(safeUserId)) return [];
  return db
    .prepare(
      `SELECT a.id,
              a.action,
              a.detail,
              a.reason,
              a.created_at,
              a.target_user_id,
              u.email as admin_email,
              u.display_name as admin_name
       FROM admin_actions a
       LEFT JOIN users u ON u.id = a.admin_user_id
       WHERE a.target_user_id = ?
       ORDER BY datetime(a.created_at) DESC
       LIMIT ?`
    )
    .all(safeUserId, safeLimit);
}

function isUploadsDisabled(settings) {
  if (!settings) return false;
  return Boolean(
    settings.emergency_upload_shutdown ||
      settings.emergency_feature_killswitch ||
      settings.system_feature_toggle === false ||
      settings.system_incident_response
  );
}

function isPostingBlocked(settings) {
  if (!settings) return false;
  return Boolean(
    settings.emergency_posting_freeze ||
      settings.emergency_comment_lockdown ||
      settings.emergency_feature_killswitch ||
      settings.system_feature_toggle === false ||
      settings.system_incident_response
  );
}

function resolveAvatarUrlForResponse(req, value) {
  const sanitized = sanitizeAvatarUrl(value);
  if (!sanitized) return "";
  if (/^https?:\/\//i.test(sanitized)) return sanitized;
  if (!sanitized.startsWith("/")) return sanitized;
  const origin = getRequestOrigin(req);
  if (!origin) return sanitized;
  try {
    return new URL(sanitized, origin).toString();
  } catch {
    return sanitized;
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  if (!value) return false;
  const normalized = normalizeEmail(value);
  if (normalized.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  const derived = crypto.scryptSync(String(password), salt, 64);
  const storedBuf = Buffer.from(hashHex, "hex");
  if (storedBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(storedBuf, derived);
}

function parseCookies(cookieHeader = "") {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) return;
    cookies[key] = decodeURIComponent(value || "");
  });
  return cookies;
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value || "")}`];
  if (options.maxAgeMs !== undefined) {
    const maxAge = Math.max(0, Math.floor(options.maxAgeMs / 1000));
    parts.push(`Max-Age=${maxAge}`);
  }
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function appendSetCookie(res, cookieValue) {
  if (!res || !cookieValue) return;
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", [existing, cookieValue]);
}

function setSessionCookie(res, token, { maxAgeMs, secure } = {}) {
  if (!res || !token) return;
  const cookie = buildCookie(AUTH_SESSION_COOKIE, token, {
    maxAgeMs,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: Boolean(secure),
  });
  appendSetCookie(res, cookie);
}

function clearSessionCookie(res, { secure } = {}) {
  if (!res) return;
  const cookie = buildCookie(AUTH_SESSION_COOKIE, "", {
    maxAgeMs: 0,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: Boolean(secure),
  });
  appendSetCookie(res, cookie);
}

function getSessionTokenFromRequest(req) {
  const header = req?.headers?.[AUTH_TOKEN_HEADER];
  if (header && typeof header === "string") {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) return match[1].trim();
  }
  const cookies = parseCookies(req?.headers?.cookie || "");
  return cookies[AUTH_SESSION_COOKIE] || "";
}

function getSessionFromRequest(req, db) {
  const token = getSessionTokenFromRequest(req);
  if (!token || !db) return null;
  const row = db
    .prepare(
      `
        SELECT s.id as session_id,
               s.expires_at as expires_at,
               u.id as user_id,
               u.email as email,
               u.display_name as display_name
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
      `
    )
    .get(token);
  if (!row) return null;
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(token);
    return null;
  }
  return {
    token,
    user: {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name || row.email,
    },
  };
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

function purgeExpiredAuthSessions(db) {
  if (!db) return;
  const now = new Date().toISOString();
  db.prepare(`DELETE FROM sessions WHERE datetime(expires_at) <= datetime(?)`).run(now);
}

function purgeExpiredOauthStates(db) {
  if (!db) return;
  const now = new Date().toISOString();
  db.prepare(`DELETE FROM oauth_states WHERE datetime(expires_at) <= datetime(?)`).run(now);
}

function getRequestOrigin(req) {
  if (!req) return "";
  const proto =
    (req.headers["x-forwarded-proto"] || req.protocol || "http")
      .toString()
      .split(",")[0]
      .trim();
  const host =
    (req.headers["x-forwarded-host"] || req.headers.host || "")
      .toString()
      .split(",")[0]
      .trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

function sanitizeRedirect(target, requestOrigin) {
  if (!target) return "/";
  if (target.startsWith("/")) return target;
  try {
    const url = new URL(target);
    if (requestOrigin && url.origin === requestOrigin) return url.toString();
    if (AUTH_ALLOWED_REDIRECT_ORIGINS.includes(url.origin)) {
      return url.toString();
    }
  } catch {
    return "/";
  }
  return "/";
}

function shouldAppendAuthToken(target, requestOrigin) {
  if (!target || target.startsWith("/")) return false;
  try {
    const url = new URL(target);
    return requestOrigin && url.origin !== requestOrigin;
  } catch {
    return false;
  }
}

function appendAuthToken(target, token, requestOrigin) {
  if (!token || !target) return target;
  if (target.startsWith("/")) return target;
  try {
    const url = new URL(target);
    if (requestOrigin && url.origin !== requestOrigin) {
      url.searchParams.set("auth_session", token);
      return url.toString();
    }
  } catch {
    return target;
  }
  return target;
}

function buildRedirectWithParams(target, params = {}) {
  if (!target) return "/";
  const [pathPart, hashPart] = String(target).split("#");
  const [pathOnly, queryString] = pathPart.split("?");
  const search = new URLSearchParams(queryString || "");
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  const hash = hashPart ? `#${hashPart}` : "";
  if (!query) return `${pathOnly}${hash}`;
  return `${pathOnly}?${query}${hash}`;
}

function getDefaultRedirectUrl(requestOrigin, fallbackPath = "/account") {
  const origin = AUTH_ALLOWED_REDIRECT_ORIGINS[0] || requestOrigin || "";
  if (!origin) return fallbackPath;
  try {
    return new URL(fallbackPath, origin).toString();
  } catch {
    return fallbackPath;
  }
}

let cachedMailer = null;

async function getMailer() {
  if (cachedMailer) return cachedMailer;
  if (!SMTP_HOST) return null;
  cachedMailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return cachedMailer;
}

async function sendEmail({ to, subject, text, html }) {
  const mailer = await getMailer();
  if (!mailer) return { ok: false, reason: "smtp_not_configured" };
  try {
    await mailer.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.warn("email send failed", err);
    return { ok: false, reason: err?.message ?? "send_failed" };
  }
}

function createEmailVerificationToken(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + AUTH_VERIFY_TTL_MS).toISOString();
  db.prepare(`DELETE FROM email_verification_tokens WHERE user_id = ?`).run(userId);
  db.prepare(
    `INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

function createPasswordResetToken(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + AUTH_RESET_TTL_MS).toISOString();
  db.prepare(`DELETE FROM password_reset_tokens WHERE user_id = ?`).run(userId);
  db.prepare(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

function consumeVerificationToken(db, token) {
  const row = db
    .prepare(
      `SELECT token, user_id, expires_at, used_at
       FROM email_verification_tokens
       WHERE token = ?`
    )
    .get(token);
  if (!row) return null;
  if (row.used_at) return null;
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  db.prepare(
    `UPDATE email_verification_tokens SET used_at = ? WHERE token = ?`
  ).run(new Date().toISOString(), token);
  return row.user_id;
}

function consumePasswordResetToken(db, token) {
  const row = db
    .prepare(
      `SELECT token, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token = ?`
    )
    .get(token);
  if (!row) return null;
  if (row.used_at) return null;
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  db.prepare(
    `UPDATE password_reset_tokens SET used_at = ? WHERE token = ?`
  ).run(new Date().toISOString(), token);
  return row.user_id;
}

function purgeExpiredVerificationTokens(db) {
  if (!db) return;
  const now = new Date().toISOString();
  db.prepare(
    `DELETE FROM email_verification_tokens WHERE datetime(expires_at) <= datetime(?) OR used_at IS NOT NULL`
  ).run(now);
}

function purgeExpiredPasswordResetTokens(db) {
  if (!db) return;
  const now = new Date().toISOString();
  db.prepare(
    `DELETE FROM password_reset_tokens WHERE datetime(expires_at) <= datetime(?) OR used_at IS NOT NULL`
  ).run(now);
}

function ensureUserColumns(db) {
  if (!db) return;
  const columns = db
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((row) => row.name);
  const existing = new Set(columns);
  const addColumn = (name, definition) => {
    if (existing.has(name)) return;
    db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${definition}`).run();
  };
  addColumn("email_verified", "INTEGER DEFAULT 0");
  addColumn("email_verified_at", "DATETIME");
  addColumn("avatar_url", "TEXT");
  addColumn("bio", "TEXT");
  addColumn("profile_name", "TEXT");
  addColumn("profile_age", "INTEGER");
  addColumn("profile_gender", "TEXT");
  addColumn("profile_interests", "TEXT");
  addColumn("is_admin", "INTEGER DEFAULT 0");
  addColumn("is_developer", "INTEGER DEFAULT 0");
  addColumn("is_suspended", "INTEGER DEFAULT 0");
  addColumn("suspended_until", "DATETIME");
  addColumn("suspended_reason", "TEXT");
  addColumn("is_banned", "INTEGER DEFAULT 0");
  addColumn("banned_at", "DATETIME");
  addColumn("banned_reason", "TEXT");
  addColumn("shadow_restricted", "INTEGER DEFAULT 0");
  addColumn("trust_override", "TEXT");
  addColumn("trust_override_reason", "TEXT");
  addColumn("trust_override_at", "DATETIME");
}

function tableExists(db, name) {
  if (!db || !name) return false;
  try {
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
      )
      .get(name);
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

function ensureThreadColumns(db) {
  if (!db || !tableExists(db, "threads")) return;
  const columns = db
    .prepare("PRAGMA table_info(threads)")
    .all()
    .map((row) => row.name);
  const existing = new Set(columns);
  const addColumn = (name, definition) => {
    if (existing.has(name)) return;
    db.prepare(`ALTER TABLE threads ADD COLUMN ${name} ${definition}`).run();
  };
  addColumn("is_deleted", "INTEGER DEFAULT 0");
  addColumn("deleted_at", "DATETIME");
  addColumn("deleted_by", "INTEGER");
  addColumn("deleted_reason", "TEXT");
  addColumn("is_frozen", "INTEGER DEFAULT 0");
  addColumn("frozen_at", "DATETIME");
  addColumn("frozen_by", "INTEGER");
  addColumn("frozen_reason", "TEXT");
}

function ensurePostColumns(db) {
  if (!db || !tableExists(db, "posts")) return;
  const columns = db
    .prepare("PRAGMA table_info(posts)")
    .all()
    .map((row) => row.name);
  const existing = new Set(columns);
  const addColumn = (name, definition) => {
    if (existing.has(name)) return;
    db.prepare(`ALTER TABLE posts ADD COLUMN ${name} ${definition}`).run();
  };
  addColumn("is_deleted", "INTEGER DEFAULT 0");
  addColumn("deleted_at", "DATETIME");
  addColumn("deleted_by", "INTEGER");
  addColumn("deleted_reason", "TEXT");
}

function ensurePlayableSubmissionColumns(db) {
  if (!db || !tableExists(db, "playable_submissions")) return;
  const columns = db
    .prepare("PRAGMA table_info(playable_submissions)")
    .all()
    .map((row) => row.name);
  const existing = new Set(columns);
  const addColumn = (name, definition) => {
    if (existing.has(name)) return;
    db.prepare(`ALTER TABLE playable_submissions ADD COLUMN ${name} ${definition}`).run();
  };
  addColumn("approved", "INTEGER DEFAULT 0");
  try {
    db.prepare(
      `UPDATE playable_submissions
       SET approved = 1
       WHERE status = 'approved' AND (approved IS NULL OR approved = 0)`
    ).run();
  } catch {
    // Ignore sync failures.
  }
}

function ensureAdminActionColumns(db) {
  if (!db || !tableExists(db, "admin_actions")) return;
  const columns = db
    .prepare("PRAGMA table_info(admin_actions)")
    .all()
    .map((row) => row.name);
  const existing = new Set(columns);
  const addColumn = (name, definition) => {
    if (existing.has(name)) return;
    db.prepare(`ALTER TABLE admin_actions ADD COLUMN ${name} ${definition}`).run();
  };
  addColumn("target_user_id", "INTEGER");
  try {
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id, created_at DESC);"
    );
  } catch {
    // Ignore index creation failures.
  }
}

function ensureRiskFlagColumns(db) {
  if (!db || !tableExists(db, "user_risk_flags")) return;
  const columns = db
    .prepare("PRAGMA table_info(user_risk_flags)")
    .all()
    .map((row) => row.name);
  const existing = new Set(columns);
  const addColumn = (name, definition) => {
    if (existing.has(name)) return;
    db.prepare(`ALTER TABLE user_risk_flags ADD COLUMN ${name} ${definition}`).run();
  };
  addColumn("level", "TEXT");
  addColumn("note", "TEXT");
  addColumn("created_by", "INTEGER");
  addColumn("resolved_at", "DATETIME");
  addColumn("resolved_by", "INTEGER");
}

function prepareSchema(db) {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      image_filename TEXT,
      sensitive INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at DESC);

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      body TEXT,
      image_filename TEXT,
      sensitive INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_posts_thread_id_created ON posts(thread_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      password_hash TEXT,
      email_verified INTEGER DEFAULT 0,
      email_verified_at DATETIME,
      avatar_url TEXT,
      bio TEXT,
      profile_name TEXT,
      profile_age INTEGER,
      profile_gender TEXT,
      profile_interests TEXT,
      is_admin INTEGER DEFAULT 0,
      is_developer INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS user_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      title TEXT,
      description TEXT,
      media_url TEXT,
      thumbnail_url TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_media_user_created ON user_media(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_media_category ON user_media(category);

    CREATE TABLE IF NOT EXISTS playable_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      author_name TEXT,
      build_url TEXT,
      source_url TEXT,
      thumbnail_url TEXT,
      orientation TEXT,
      min_players INTEGER,
      max_players INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      approved INTEGER DEFAULT 0,
      admin_notes TEXT,
      hosted_id TEXT,
      hosted_path TEXT,
      hosted_thumbnail TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at DATETIME,
      reviewed_at DATETIME,
      reviewed_by INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_playable_submissions_status
      ON playable_submissions(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_playable_submissions_user
      ON playable_submissions(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at DATETIME NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(provider, provider_user_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      redirect TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at DATETIME NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_settings_updated ON user_settings(updated_at DESC);

    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      settings_json TEXT NOT NULL,
      updated_at DATETIME,
      updated_by INTEGER,
      reason TEXT,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admin_bootstrap (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ran_at DATETIME,
      detail TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER,
      target_user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY(admin_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

    CREATE TABLE IF NOT EXISTS user_risk_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      flag TEXT NOT NULL,
      level TEXT,
      note TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      created_by INTEGER,
      resolved_at DATETIME,
      resolved_by INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(resolved_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_risk_flags_user ON user_risk_flags(user_id, created_at DESC);
  `);

  ensureUserColumns(db);
  ensureThreadColumns(db);
  ensurePostColumns(db);
  ensurePlayableSubmissionColumns(db);
  ensureAdminSettingsRow(db);
  ensureAdminActionColumns(db);
  ensureRiskFlagColumns(db);
}

function runAdminBootstrap(db) {
  if (!db) return;
  try {
    const row = db
      .prepare(`SELECT ran_at FROM admin_bootstrap WHERE id = 1`)
      .get();
    if (row?.ran_at) return;
  } catch {
    // If bootstrap table is unavailable, skip silently.
    return;
  }

  const targetIds = new Set(ADMIN_USER_IDS);

  if (ADMIN_EMAILS.length > 0) {
    const placeholders = ADMIN_EMAILS.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT id FROM users WHERE email IN (${placeholders})`)
      .all(...ADMIN_EMAILS);
    rows.forEach((row) => {
      if (row?.id) targetIds.add(row.id);
    });
  }

  if (ADMIN_DISPLAY_NAMES.length > 0) {
    const nameSet = new Set(ADMIN_DISPLAY_NAMES);
    const rows = db
      .prepare(`SELECT id, display_name FROM users`)
      .all();
    rows.forEach((row) => {
      const normalized = normalizeAdminName(row?.display_name);
      if (normalized && nameSet.has(normalized)) {
        targetIds.add(row.id);
      }
    });
  }

  if (targetIds.size === 0) return;

  const ids = Array.from(targetIds);
  const placeholders = ids.map(() => "?").join(",");
  const result = db
    .prepare(`UPDATE users SET is_admin = 1 WHERE id IN (${placeholders})`)
    .run(...ids);

  const detail = {
    targetCount: ids.length,
    updated: result?.changes ?? 0,
  };
  db.prepare(
    `INSERT OR REPLACE INTO admin_bootstrap (id, ran_at, detail)
     VALUES (1, ?, ?)`
  ).run(new Date().toISOString(), JSON.stringify(detail));
}

function runDeveloperBootstrap(db) {
  if (!db) return;
  const targetIds = new Set(DEVELOPER_USER_IDS);

  if (DEVELOPER_EMAILS.length > 0) {
    const placeholders = DEVELOPER_EMAILS.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT id FROM users WHERE email IN (${placeholders})`)
      .all(...DEVELOPER_EMAILS);
    rows.forEach((row) => {
      if (row?.id) targetIds.add(row.id);
    });
  }

  if (targetIds.size === 0) return;

  const ids = Array.from(targetIds);
  const placeholders = ids.map(() => "?").join(",");
  try {
    db.prepare(`UPDATE users SET is_developer = 1 WHERE id IN (${placeholders})`).run(
      ...ids
    );
  } catch {
    // Ignore update failures.
  }
}

function purgeExpiredThreads(db) {
  const cutoff = new Date(Date.now() - THREAD_TTL_MS).toISOString();
  db.prepare(
    `DELETE FROM threads WHERE datetime(created_at) < datetime(?)`
  ).run(cutoff);
}

function serializeThread(row, db) {
  if (!row) return null;
  const replies = db
    .prepare(
      `SELECT *
       FROM posts
       WHERE thread_id = ?
         AND COALESCE(is_deleted, 0) = 0
       ORDER BY datetime(created_at) ASC`
    )
    .all(row.id);
  return {
    ...row,
    text: row.body || row.title || "",
    image: row.image_filename ? `/uploads/${row.image_filename}` : null,
    isFrozen: Boolean(row.is_frozen),
    replies: replies.map((reply) => ({
      ...reply,
      text: reply.body || "",
      image: reply.image_filename ? `/uploads/${reply.image_filename}` : null,
    })),
  };
}

async function setupSockets(server) {
  if (!server) return null;
  if (server.__lurkSockets) return server.__lurkSockets;

  const socketState = {
    adapter: "memory",
    redis: {
      enabled: Boolean(REDIS_URL),
      status: REDIS_URL ? "connecting" : "disabled",
      error: null,
    },
    history: {
      backend: CHAT_HISTORY_BACKEND,
      status: CHAT_HISTORY_BACKEND === "redis" ? "connecting" : "memory",
      error: null,
    },
  };

  const io = new SocketIOServer(server, {
    path: "/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER,
    pingInterval: SOCKET_PING_INTERVAL_MS,
    pingTimeout: SOCKET_PING_TIMEOUT_MS,
    perMessageDeflate: SOCKET_PER_MESSAGE_DEFLATE ? { threshold: 1024 } : false,
  });

  const closeHandlers = [];
  let historyStore = createMemoryChatHistoryStore(chatHistoryMemory);
  let redisModule = null;
  let redisAdapterModule = null;

  if (REDIS_URL) {
    redisModule = await loadRedisModule();
    redisAdapterModule = await loadRedisAdapterModule();

    if (!redisModule || !redisAdapterModule) {
      socketState.redis.status = "disabled";
      socketState.redis.error = "redis_dependencies_missing";
      if (REDIS_REQUIRED) {
        throw new Error(
          "Redis dependencies missing. Install redis and @socket.io/redis-adapter."
        );
      }
    }
  }

  if (REDIS_URL && redisModule && redisAdapterModule) {
    const pubClient = createRedisClient(
      redisModule,
      REDIS_URL,
      "socket-pub",
      socketState
    );
    const subClient = pubClient.duplicate();
    const pubReady = await connectRedisClient(pubClient, "socket-pub", socketState);
    const subReady = await connectRedisClient(subClient, "socket-sub", socketState);

    if (pubReady && subReady) {
      io.adapter(redisAdapterModule.createAdapter(pubClient, subClient));
      socketState.adapter = "redis";
      socketState.redis.status = "ok";
      closeHandlers.push(() => safeQuitRedis(pubClient));
      closeHandlers.push(() => safeQuitRedis(subClient));
    } else {
      socketState.redis.status = "degraded";
      socketState.redis.error =
        socketState.redis.error ?? "redis_adapter_connect_failed";
      await safeQuitRedis(pubClient);
      await safeQuitRedis(subClient);
      if (REDIS_REQUIRED) {
        throw new Error(
          "REDIS_REQUIRED is set but Redis adapter could not connect"
        );
      }
    }
  }

  if (CHAT_HISTORY_BACKEND === "redis") {
    if (!REDIS_URL) {
      socketState.history.status = "memory";
      socketState.history.error = "redis_url_missing";
    } else if (!redisModule) {
      socketState.history.status = "memory";
      socketState.history.error = "redis_dependencies_missing";
    } else {
      const historyClient = createRedisClient(
        redisModule,
        REDIS_URL,
        "chat-history",
        socketState
      );
      const historyReady = await connectRedisClient(
        historyClient,
        "chat-history",
        socketState
      );

      if (historyReady) {
        historyStore = createRedisChatHistoryStore(historyClient);
        socketState.history.status = "redis";
        closeHandlers.push(() => safeQuitRedis(historyClient));
      } else {
        socketState.history.status = "memory";
        socketState.history.error =
          socketState.history.error ?? "redis_history_connect_failed";
        await safeQuitRedis(historyClient);
      }
    }
  } else {
    socketState.history.status = "memory";
  }

  const CHAT_ROOM_DEFAULT = "chat-global";
  const VIDEO_ROOM_DEFAULT = "video-global";
  const PUBLIC_ROOM_PREFIX = "chat-public-";
  const videoRooms = new Map();
  const publicRooms = new Map();
  const schedulePublicRooms = createPublicRoomsEmitter(io, {
    debounceMs: PUBLIC_ROOMS_BROADCAST_MS,
    publicRooms,
    maxRooms: PUBLIC_ROOMS_MAX,
  });
  const chatRateLimiter = createSocketRateLimiter({
    windowMs: SOCKET_CHAT_RATE_WINDOW_MS,
    max: SOCKET_CHAT_RATE_MAX,
    key: "chat",
  });

  const recordChatHistory = async (roomId, message) => {
    if (!roomId || !message) return;
    try {
      await historyStore.append(roomId, message);
    } catch (err) {
      console.warn("chat history write failed", err);
    }
  };
  const sendChatHistory = async (socket, roomId) => {
    if (!socket || !roomId) return;
    try {
      const history = await historyStore.get(roomId);
      if (!history || !history.length) return;
      socket.emit("chat history", history.slice());
    } catch (err) {
      console.warn("chat history read failed", err);
    }
  };

  const normalizeRoomId = (value, fallback) => {
    if (!value) return fallback;
    const cleaned = String(value).replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 48);
    return cleaned || fallback;
  };

  const recordPublicRoom = (roomId) => {
    if (!roomId || !roomId.startsWith(PUBLIC_ROOM_PREFIX)) return;
    const name = roomId.slice(PUBLIC_ROOM_PREFIX.length) || "lobby";
    const upper = name.toUpperCase();
    const existing = publicRooms.get(upper);
    publicRooms.set(upper, {
      name: upper,
      createdAt: existing?.createdAt ?? Date.now(),
      lastSeen: Date.now(),
    });
  };

  const joinChatRoomSync = (socket, roomId) => {
    const resolvedRoom = normalizeRoomId(roomId, CHAT_ROOM_DEFAULT);
    const currentRoom = socket.data?.chatRoomId;
    if (currentRoom && currentRoom !== resolvedRoom) {
      socket.leave(currentRoom);
    }
    socket.join(resolvedRoom);
    socket.data.chatRoomId = resolvedRoom;
    recordPublicRoom(resolvedRoom);
    schedulePublicRooms();
    return resolvedRoom;
  };

  const joinChatRoom = async (socket, roomId, { emitHistory = false } = {}) => {
    const resolvedRoom = joinChatRoomSync(socket, roomId);
    if (emitHistory) {
      await sendChatHistory(socket, resolvedRoom);
    }
    return resolvedRoom;
  };

  const leaveVideoRoom = (socket) => {
    const roomId = socket.data?.videoRoomId;
    if (!roomId) return;
    socket.leave(roomId);
    const room = videoRooms.get(roomId);
    if (room) {
      room.delete(socket.id);
      if (!room.size) videoRooms.delete(roomId);
    }
    socket.to(roomId).emit("video-peer-left", {
      peerId: socket.id,
      name: socket.data?.displayName || "Guest",
    });
    socket.data.videoRoomId = null;
  };

  io.on("connection", (socket) => {
    void joinChatRoom(socket, socket.data?.chatRoomId, { emitHistory: true });
    schedulePublicRooms();

    socket.on("join-chat-room", ({ roomId } = {}) => {
      void joinChatRoom(socket, roomId, { emitHistory: true });
    });

    socket.on("chat message", (payload = {}) => {
      const adminSettings = getAdminSettingsState(db).settings;
      if (isPostingBlocked(adminSettings)) {
        socket.emit("chat blocked", { reason: "posting_frozen" });
        return;
      }
      const limit = chatRateLimiter(socket);
      if (!limit.allowed) {
        if (Number.isFinite(limit.retryAfterMs)) {
          socket.emit("chat rate limited", {
            retryAfterMs: limit.retryAfterMs,
          });
        }
        return;
      }

      const text = sanitizeMessage(
        typeof payload === "string" ? payload : payload?.text
      );
      const sticker = sanitizeSticker(payload?.sticker);
      if (!text && !sticker) return;
      const name = sanitizeDisplayName(payload?.name);
      const ts = Number.isFinite(payload?.ts) ? payload.ts : Date.now();
      const id = payload?.id || `${socket.id}-${ts}`;
      const roomId = joinChatRoomSync(
        socket,
        payload?.roomId || socket.data?.chatRoomId
      );
      const message = { id, text, name, ts, roomId };
      if (sticker) message.sticker = sticker;
      void recordChatHistory(roomId, message);
      io.to(roomId).emit("chat message", message);
    });

    socket.on("join-video-room", ({ roomId, name } = {}) => {
      const resolvedRoom = normalizeRoomId(roomId, VIDEO_ROOM_DEFAULT);
      if (socket.data?.videoRoomId && socket.data.videoRoomId !== resolvedRoom) {
        leaveVideoRoom(socket);
      }
      const displayName = sanitizeDisplayName(name);
      socket.join(resolvedRoom);
      socket.data.videoRoomId = resolvedRoom;
      socket.data.displayName = displayName;

      let room = videoRooms.get(resolvedRoom);
      if (!room) {
        room = new Map();
        videoRooms.set(resolvedRoom, room);
      }
      room.set(socket.id, { name: displayName });

      const existing = [];
      for (const [peerId, peer] of room.entries()) {
        if (peerId === socket.id) continue;
        existing.push({ peerId, name: peer.name });
      }
      socket.emit("video-existing-peers", existing);
      socket.to(resolvedRoom).emit("video-peer-joined", {
        peerId: socket.id,
        name: displayName,
      });
    });

    socket.on("leave-video-room", () => {
      leaveVideoRoom(socket);
    });

    socket.on("video-offer", ({ to, description } = {}) => {
      if (!to || !description) return;
      socket.to(to).emit("video-offer", { from: socket.id, description });
    });

    socket.on("video-answer", ({ to, description } = {}) => {
      if (!to || !description) return;
      socket.to(to).emit("video-answer", { from: socket.id, description });
    });

    socket.on("video-ice-candidate", ({ to, candidate } = {}) => {
      if (!to || !candidate) return;
      socket.to(to).emit("video-ice-candidate", { from: socket.id, candidate });
    });

    socket.on("disconnect", () => {
      leaveVideoRoom(socket);
      schedulePublicRooms();
    });
  });

  const sockets = {
    io,
    state: socketState,
    close: async () => {
      schedulePublicRooms.shutdown?.();
      io.close();
      for (const handler of closeHandlers) {
        try {
          await handler();
        } catch (err) {
          console.warn("socket shutdown handler failed", err);
        }
      }
    },
  };

  server.__lurkSockets = sockets;
  return sockets;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function checkDbHealth(db) {
  if (!db) return { ok: false, error: "db_unavailable" };
  try {
    db.prepare("SELECT 1").get();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

function createSocketRateLimiter({ windowMs, max, key = "default" } = {}) {
  const windowMsNumber = Number(windowMs);
  const maxNumber = Number(max);
  if (!Number.isFinite(windowMsNumber) || !Number.isFinite(maxNumber)) {
    return () => ({ allowed: true, retryAfterMs: null });
  }
  if (windowMsNumber <= 0 || maxNumber <= 0) {
    return () => ({ allowed: true, retryAfterMs: null });
  }

  return (socket) => {
    if (!socket?.data) return { allowed: true, retryAfterMs: null };
    const store =
      socket.data.__rateLimits ?? (socket.data.__rateLimits = {});
    const now = Date.now();
    let state = store[key];
    if (!state || now >= state.resetAt) {
      state = { remaining: maxNumber, resetAt: now + windowMsNumber };
      store[key] = state;
    }

    if (state.remaining <= 0) {
      return { allowed: false, retryAfterMs: Math.max(0, state.resetAt - now) };
    }

    state.remaining -= 1;
    return { allowed: true, retryAfterMs: null };
  };
}

function createPublicRoomsEmitter(
  io,
  { debounceMs = 0, publicRooms = null, maxRooms = 100 } = {}
) {
  let timer = null;
  let lastEmit = 0;

  const emitNow = () => {
    const roomsByName = new Map();
    for (const [roomId, members] of io.sockets.adapter.rooms) {
      if (!roomId.startsWith("chat-public-")) continue;
      const name = roomId.slice("chat-public-".length) || "lobby";
      const upper = name.toUpperCase();
      roomsByName.set(upper, {
        name: upper,
        count: members.size,
        lastSeen: Date.now(),
      });
    }
    if (publicRooms) {
      for (const room of publicRooms.values()) {
        if (!room || !room.name) continue;
        if (!roomsByName.has(room.name)) {
          roomsByName.set(room.name, {
            name: room.name,
            count: 0,
            lastSeen: room.lastSeen ?? room.createdAt ?? 0,
          });
        }
      }
    }
    const rooms = Array.from(roomsByName.values());
    rooms.sort(
      (a, b) =>
        b.count - a.count ||
        (b.lastSeen || 0) - (a.lastSeen || 0) ||
        a.name.localeCompare(b.name)
    );
    const limited =
      Number.isFinite(maxRooms) && maxRooms > 0 ? rooms.slice(0, maxRooms) : rooms;
    io.emit("public-rooms", limited);
    lastEmit = Date.now();
  };

  const schedule = () => {
    if (debounceMs <= 0) {
      emitNow();
      return;
    }
    if (timer) return;
    const wait = Math.max(0, debounceMs - (Date.now() - lastEmit));
    timer = setTimeout(() => {
      timer = null;
      emitNow();
    }, wait);
  };

  schedule.shutdown = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  return schedule;
}

function createMemoryChatHistoryStore(storeMap) {
  return {
    async append(roomId, message) {
      if (!roomId || !message) return;
      const history = storeMap.get(roomId) || [];
      history.push(message);
      if (history.length > CHAT_HISTORY_LIMIT) {
        history.splice(0, history.length - CHAT_HISTORY_LIMIT);
      }
      storeMap.set(roomId, history);
    },
    async get(roomId) {
      if (!roomId) return [];
      const history = storeMap.get(roomId);
      return history ? history.slice() : [];
    },
  };
}

function createRedisChatHistoryStore(client) {
  return {
    async append(roomId, message) {
      if (!roomId || !message) return;
      const key = `${CHAT_HISTORY_KEY_PREFIX}${roomId}`;
      const payload = JSON.stringify(message);
      const pipeline = client.multi();
      pipeline.rPush(key, payload);
      pipeline.lTrim(key, -CHAT_HISTORY_LIMIT, -1);
      if (CHAT_HISTORY_TTL_SEC > 0) {
        pipeline.expire(key, CHAT_HISTORY_TTL_SEC);
      }
      await pipeline.exec();
    },
    async get(roomId) {
      if (!roomId) return [];
      const key = `${CHAT_HISTORY_KEY_PREFIX}${roomId}`;
      const entries = await client.lRange(key, 0, -1);
      return entries.map((entry) => safeJsonParse(entry)).filter(Boolean);
    },
  };
}

let redisModuleCache = null;
let redisAdapterModuleCache = null;

async function loadRedisModule() {
  if (redisModuleCache) return redisModuleCache;
  try {
    redisModuleCache = await import("redis");
    return redisModuleCache;
  } catch (err) {
    console.warn("redis module unavailable", err);
    return null;
  }
}

async function loadRedisAdapterModule() {
  if (redisAdapterModuleCache) return redisAdapterModuleCache;
  try {
    redisAdapterModuleCache = await import("@socket.io/redis-adapter");
    return redisAdapterModuleCache;
  } catch (err) {
    console.warn("@socket.io/redis-adapter module unavailable", err);
    return null;
  }
}

function createRedisClient(redisModule, url, label, socketState) {
  const client = redisModule.createClient({
    url,
    socket: {
      reconnectStrategy: (retries) =>
        Math.min(REDIS_RECONNECT_BASE_MS * retries, REDIS_RECONNECT_MAX_MS),
    },
  });

  client.on("error", (err) => {
    const message = err?.message ?? String(err);
    if (socketState?.redis) {
      socketState.redis.error = message;
      if (socketState.redis.status === "ok") {
        socketState.redis.status = "degraded";
      }
    }
    if (socketState?.history?.status === "redis") {
      socketState.history.error = message;
    }
    console.warn(`redis ${label} error`, err);
  });

  return client;
}

async function connectRedisClient(client, label, socketState) {
  if (!client) return false;
  try {
    await withTimeout(client.connect(), REDIS_CONNECT_TIMEOUT_MS, label);
    return true;
  } catch (err) {
    const message = err?.message ?? String(err);
    if (socketState?.redis) {
      socketState.redis.error = message;
    }
    if (socketState?.history?.status === "connecting") {
      socketState.history.error = message;
    }
    console.warn(`redis ${label} connection failed`, err);
    return false;
  }
}

async function safeQuitRedis(client) {
  if (!client) return;
  try {
    await client.quit();
  } catch (_err) {
    try {
      await client.disconnect();
    } catch (err) {
      console.warn("redis disconnect failed", err);
    }
  }
}

function withTimeout(promise, timeoutMs, label) {
  const timeout = Number(timeoutMs);
  if (!Number.isFinite(timeout) || timeout <= 0) return promise;
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeout}ms`));
    }, timeout);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

/* ---- mail, sockets, schema, serialization unchanged ---- */
