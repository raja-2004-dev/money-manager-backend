const jwt = require("jsonwebtoken");

const JWT_SECRET = "money_manager_secret_key";

module.exports = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json("No token provided");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(403).json("Invalid token");
  }
};
