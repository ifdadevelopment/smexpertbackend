import { decodeTokenByJwt } from "../utils/utils.jwt.js";

/**
 * Protects a route with JWT. On success sets req.user.
 * Fails with 401 (no crashes on malformed tokens).
 */
export const authGuard = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || typeof auth !== "string") {
      return res.status(401).json({ error: "No token provided" });
    }

    const [scheme, token] = auth.split(" ");
    if (scheme !== "Bearer" || !token || token === "null" || token === "undefined") {
      return res.status(401).json({ error: "Invalid auth header" });
    }

    const { valid, decode } = await decodeTokenByJwt(token);
    if (!valid || !decode) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = decode;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

/** Optional: require admin role on top of authGuard */
export const requireAdmin = async (req, res, next) => {
  return authGuard(req, res, () => {
    if (req.user?.role === "admin") return next();
    return res.status(403).json({ error: "Admin access required" });
  });
};
