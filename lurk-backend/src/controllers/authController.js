import * as authService from "../services/authService.js";

export async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);
    res.json(data);
  } catch (err) { next(err); }
}

export async function login(req, res, next) {
  try {
    const data = await authService.login(req.body);
    res.json(data);
  } catch (err) { next(err); }
}
