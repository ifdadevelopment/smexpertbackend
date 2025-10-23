const requireUser = (req, res, next) => {
  try {
    if (req.user) return next();
    return res.status(401).json({ error: "Unauthorized User" });
  } catch {
    return res.status(401).json({ error: "Unauthorized User" });
  }
};
export default requireUser;
