import getQuantumBits from "../utils/getQuantumBits.js";
import db from "../db/index.js"; // adjust if needed

export async function createPost(userId, postData) {
  // Generate a 32-bit quantum random ID
  const bitString = await getQuantumBits(32);
  const postId = parseInt(bitString, 2);

  const { title, body } = postData;

  // Insert into the posts table
  const stmt = db.prepare(`
    INSERT INTO posts (id, user_id, title, body, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(postId, userId, title, body);

  // Return what the controller will send back
  return {
    status: "ok",
    postId,
    quantumBits: bitString
  };
}

export async function getFeed() {
  const stmt = db.prepare(`
    SELECT posts.*, users.username
    FROM posts
    JOIN users ON users.id = posts.user_id
    ORDER BY posts.created_at DESC
    LIMIT 50
  `);

  const results = stmt.all();
  return results;
}
