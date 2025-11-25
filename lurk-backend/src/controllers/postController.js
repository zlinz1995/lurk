import * as postService from "../services/postService.js";

export async function createPost(req, res, next) {
  try {
    const data = await postService.createPost(req.user.id, req.body);
    res.json(data);
  } catch (err) { next(err); }
}

export async function getFeed(req, res, next) {
  try {
    const feed = await postService.getFeed();
    res.json(feed);
  } catch (err) { next(err); }
}
