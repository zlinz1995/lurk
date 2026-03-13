-- Server creates schema automatically; this is for reference/inspection.
CREATE TABLE threads (
id INTEGER PRIMARY KEY AUTOINCREMENT,
public_id TEXT UNIQUE,
user_id INTEGER,
title TEXT NOT NULL,
body TEXT,
image_filename TEXT,
created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_threads_created_at ON threads(created_at DESC);
CREATE INDEX idx_threads_user_created ON threads(user_id, created_at DESC);


CREATE TABLE posts (
id INTEGER PRIMARY KEY AUTOINCREMENT,
public_id TEXT UNIQUE,
thread_id INTEGER NOT NULL,
user_id INTEGER,
body TEXT,
image_filename TEXT,
created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE,
FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_posts_thread_id_created ON posts(thread_id, created_at ASC);
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC);
