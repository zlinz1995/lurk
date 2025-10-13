-- Server creates schema automatically; this is for reference/inspection.
CREATE TABLE threads (
id INTEGER PRIMARY KEY AUTOINCREMENT,
title TEXT NOT NULL,
body TEXT,
image_filename TEXT,
created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_threads_created_at ON threads(created_at DESC);


CREATE TABLE posts (
id INTEGER PRIMARY KEY AUTOINCREMENT,
thread_id INTEGER NOT NULL,
body TEXT,
image_filename TEXT,
created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
CREATE INDEX idx_posts_thread_id_created ON posts(thread_id, created_at ASC);