const router = require("express").Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "money_manager_secret_key";

/* ================= SIGNUP ================= */

router.post("/signup", (req, res) => {
  const { name, email, password } = req.body;

  const hashed = bcrypt.hashSync(password, 10);

  const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";

  db.query(sql, [name, email, hashed], (err) => {
    if (err) return res.status(400).json("Email already exists");
    res.json("Signup successful");
  });
});

/* ================= LOGIN ================= */

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, data) => {
    if (err || data.length === 0) return res.status(400).json("User not found");

    const user = data[0];

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json("Wrong password");

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  });
});

module.exports = router;
