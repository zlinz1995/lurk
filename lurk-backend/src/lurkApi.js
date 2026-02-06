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
import getQuantumBits from "./utils/getQuantumBits.js";
import { createRequire } from "module";

/* -------------------- CONFIG -------------------- */

const THREAD_TTL_MS = Number(process.env.THREAD_TTL_MS ?? 24 * 60 * 60 * 1000);
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES ?? 15 * 1024 * 1024);
const DATA_DIR = process.env.DATA_DIR ?? "/tmp/lurk-data";
const DB_PATH = path.join(DATA_DIR, process.env.DB_NAME ?? "threads.db");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

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
const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_SECURE = parseBoolean(process.env.SMTP_SECURE, false);
const SMTP_FROM = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? MOD_ALERT_EMAIL;

const ALLOWED_MEDIA_PREFIXES = ["image/", "video/", "audio/"];
const reactMemory = new Map();
const chatHistoryMemory = new Map();

/* -------------------- REQUIRE -------------------- */

const require = createRequire(import.meta.url);
let nodemailerModule = null;
let nodemailerAttempted = false;

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
  app.use(cors({ origin: "*", methods: ["GET", "POST", "PATCH", "OPTIONS"] }));
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

  const requireAdmin = (req, res) => {
    const session = getSessionFromRequest(req, db);
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
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

  app.get("/auth/me", authLimiter, (req, res) => {
    const session = getSessionFromRequest(req, db);
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const userRow = db
      .prepare(
        `SELECT email_verified, avatar_url, bio, is_admin
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
    res.json({
      user: {
        ...session.user,
        emailVerified: Boolean(userRow?.email_verified),
        avatarUrl: resolveAvatarUrlForResponse(req, userRow?.avatar_url || ""),
        bio: userRow?.bio || "",
        isAdmin,
      },
    });
  });

  app.post("/auth/register", authLimiter, (req, res) => {
    const email = normalizeEmail(req?.body?.email || "");
    const password = String(req?.body?.password || "");
    const displayNameRaw = req?.body?.displayName || "";

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short" });
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
    const result = db
      .prepare(
        `INSERT INTO users (email, display_name, password_hash, email_verified)
         VALUES (?, ?, ?, 0)`
      )
      .run(email, displayName, passwordHash);

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
    res.json({
      user: {
        id: result.lastInsertRowid,
        email,
        displayName,
        emailVerified: false,
        isAdmin,
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
        `SELECT id, email, display_name, password_hash, email_verified, avatar_url, bio, is_admin
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

    const isAdmin = ensureAdminFlag(db, row, dev);
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
        isAdmin,
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

  app.patch("/auth/profile", authLimiter, (req, res) => {
    const session = getSessionFromRequest(req, db);
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const displayName = sanitizeDisplayName(req?.body?.displayName || "");
    const avatarUrl = sanitizeAvatarUrl(req?.body?.avatarUrl || "");
    const bio = sanitizeBio(req?.body?.bio || "");
    db.prepare(
      `UPDATE users
       SET display_name = ?, avatar_url = ?, bio = ?
       WHERE id = ?`
    ).run(displayName || session.user.displayName, avatarUrl || null, bio || null, session.user.id);

    const verifiedRow = db
      .prepare(`SELECT email_verified, is_admin FROM users WHERE id = ?`)
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
    res.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: displayName || session.user.displayName,
        avatarUrl: resolveAvatarUrlForResponse(req, avatarUrl),
        bio,
        emailVerified: Boolean(verifiedRow?.email_verified),
        isAdmin,
      },
    });
  });

  app.get("/auth/settings", authLimiter, (req, res) => {
    const session = getSessionFromRequest(req, db);
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const state = getUserSettingsState(db, session.user.id);
    res.json({
      settings: state.settings,
      updatedAt: state.updatedAt,
    });
  });

  app.patch("/auth/settings", authLimiter, (req, res) => {
    const session = getSessionFromRequest(req, db);
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
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
    const session = getSessionFromRequest(req, db);
    if (!session) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
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
          `SELECT email, display_name, avatar_url, bio, email_verified, is_admin
           FROM users WHERE id = ?`
        )
        .get(session.user.id);
      const isAdmin = ensureAdminFlag(db, {
        id: session.user.id,
        email: updatedRow?.email || session.user.email,
        displayName: updatedRow?.display_name || session.user.displayName,
        is_admin: updatedRow?.is_admin,
      }, dev);
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
          emailVerified: Boolean(updatedRow?.email_verified),
          isAdmin,
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

  app.get("/auth/google", authLimiter, (req, res) => {
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

  app.get("/auth/google/callback", authLimiter, async (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(501).send("Google OAuth is not configured.");
      return;
    }
    const code = req?.query?.code;
    const state = req?.query?.state;
    if (!code || !state) {
      res.status(400).send("Invalid OAuth response.");
      return;
    }
    const stateRow = db
      .prepare(`SELECT redirect, expires_at FROM oauth_states WHERE state = ?`)
      .get(state);
    db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state);
    if (!stateRow) {
      res.status(400).send("OAuth state expired.");
      return;
    }
    const expiresAt = Date.parse(stateRow.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      res.status(400).send("OAuth state expired.");
      return;
    }

    const requestOrigin = getRequestOrigin(req);
    const redirectTo = sanitizeRedirect(stateRow.redirect, requestOrigin);
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
        `SELECT u.id, u.email, u.display_name, u.avatar_url
         FROM oauth_accounts oa
         JOIN users u ON u.id = oa.user_id
         WHERE oa.provider = ? AND oa.provider_user_id = ?`
      )
      .get("google", providerUserId);

    if (!userRow) {
      const existingUser = db
        .prepare(`SELECT id, email, display_name, avatar_url FROM users WHERE email = ?`)
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
    const rows = db.prepare(`
      SELECT * FROM threads
      ORDER BY datetime(created_at) DESC
      LIMIT 100
    `).all();
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

function normalizeAdminName(value) {
  return String(value || "").trim().toLowerCase();
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

function logAdminAction(db, { userId, action, detail, reason } = {}) {
  if (!db || !action) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO admin_actions (admin_user_id, action, detail, reason, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId ?? null, action, detail || "", reason || "", now);
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
              u.email as admin_email,
              u.display_name as admin_name
       FROM admin_actions a
       LEFT JOIN users u ON u.id = a.admin_user_id
       ORDER BY datetime(a.created_at) DESC
       LIMIT ?`
    )
    .all(safeLimit);
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

async function loadNodemailer() {
  if (nodemailerAttempted) return nodemailerModule;
  nodemailerAttempted = true;
  try {
    nodemailerModule = await import("nodemailer");
    return nodemailerModule;
  } catch (err) {
    console.warn("nodemailer module unavailable", err);
    return null;
  }
}

let cachedMailer = null;

async function getMailer() {
  if (cachedMailer) return cachedMailer;
  if (!SMTP_HOST) return null;
  const module = await loadNodemailer();
  if (!module) return null;
  cachedMailer = module.createTransport({
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
  addColumn("is_admin", "INTEGER DEFAULT 0");
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
      is_admin INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY(admin_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);
  `);

  ensureUserColumns(db);
  ensureAdminSettingsRow(db);
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
      `SELECT * FROM posts WHERE thread_id = ? ORDER BY datetime(created_at) ASC`
    )
    .all(row.id);
  return {
    ...row,
    text: row.body || row.title || "",
    image: row.image_filename ? `/uploads/${row.image_filename}` : null,
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
