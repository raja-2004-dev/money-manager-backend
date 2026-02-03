const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

/* =====================================================
   ADD TRANSACTION + AUTO BALANCE UPDATE
===================================================== */

router.post("/", auth, (req, res) => {

  const {
    type,
    amount,
    category,
    division,
    description,
    date,
    account
  } = req.body;

  const insertSql = `
    INSERT INTO transactions
    (type, amount, category, division, description, date, account, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(
    insertSql,
    [type, amount, category, division, description, date, account, req.userId],
    err => {
      if (err) return res.status(500).json(err);

      /* 🔥 Bullet-proof balance logic */

      const balanceSql = `
        UPDATE accounts
        SET balance = 
          CASE 
            WHEN ? = 'income' THEN balance + ?
            WHEN ? = 'expense' THEN balance - ?
          END
        WHERE name=? AND user_id=?
      `;

      db.query(
        balanceSql,
        [type, amount, type, amount, account, req.userId],
        err2 => {
          if (err2) return res.status(500).json(err2);
          res.json("Transaction added & balance updated");
        }
      );
    }
  );
});

/* =====================================================
   GET ALL TRANSACTIONS
===================================================== */

router.get("/", auth, (req, res) => {
  db.query(
    "SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC",
    [req.userId],
    (err, rows) => res.json(rows)
  );
});

/* =====================================================
   EDIT (ALLOWED ONLY WITHIN 12 HOURS)
===================================================== */

router.put("/:id", auth, (req, res) => {

  const checkSql = `
    SELECT TIMESTAMPDIFF(HOUR, created_at, NOW()) AS hoursPassed
    FROM transactions
    WHERE id=? AND user_id=?
  `;

  db.query(checkSql, [req.params.id, req.userId], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (!rows.length) return res.status(404).json("Not found");

    if (rows[0].hoursPassed > 12)
      return res.status(403).json("Edit allowed only within 12 hours");

    const { amount, category, division, description } = req.body;

    db.query(
      `UPDATE transactions 
       SET amount=?, category=?, division=?, description=?
       WHERE id=? AND user_id=?`,
      [amount, category, division, description, req.params.id, req.userId],
      err2 => {
        if (err2) return res.status(500).json(err2);
        res.json("Updated successfully");
      }
    );
  });
});

/* =====================================================
   FILTER
===================================================== */

router.get("/filter", auth, (req, res) => {

  let sql = "SELECT * FROM transactions WHERE user_id=?";
  let params = [req.userId];

  if (req.query.category) {
    sql += " AND category=?";
    params.push(req.query.category);
  }

  if (req.query.division) {
    sql += " AND division=?";
    params.push(req.query.division);
  }

  if (req.query.from) {
    sql += " AND date >= ?";
    params.push(req.query.from);
  }

  if (req.query.to) {
    sql += " AND date <= ?";
    params.push(req.query.to);
  }

  db.query(sql, params, (err, rows) => res.json(rows));
});

/* =====================================================
   ACCOUNTS
===================================================== */

router.post("/accounts", auth, (req, res) => {
  db.query(
    "INSERT INTO accounts (name, balance, user_id) VALUES (?, ?, ?)",
    [req.body.name, req.body.balance, req.userId],
    err => {
      if (err) return res.status(500).json(err);
      res.json("Account created");
    }
  );
});

router.get("/accounts", auth, (req, res) => {
  db.query(
    "SELECT * FROM accounts WHERE user_id=?",
    [req.userId],
    (err, rows) => res.json(rows)
  );
});

/* =====================================================
   SUMMARY (WEEKLY / MONTHLY / YEARLY)
===================================================== */

router.get("/summary/weekly", auth, (req, res) => {
  db.query(
    `SELECT type, SUM(amount)+0 total
     FROM transactions
     WHERE user_id=? AND created_at >= NOW() - INTERVAL 7 DAY
     GROUP BY type`,
    [req.userId],
    (e, r) => res.json(r)
  );
});

router.get("/summary/monthly", auth, (req, res) => {
  db.query(
    `SELECT type, SUM(amount)+0 total
     FROM transactions
     WHERE user_id=?
     AND MONTH(created_at)=MONTH(NOW())
     AND YEAR(created_at)=YEAR(NOW())
     GROUP BY type`,
    [req.userId],
    (e, r) => res.json(r)
  );
});

router.get("/summary/yearly", auth, (req, res) => {
  db.query(
    `SELECT type, SUM(amount)+0 total
     FROM transactions
     WHERE user_id=?
     AND YEAR(created_at)=YEAR(NOW())
     GROUP BY type`,
    [req.userId],
    (e, r) => res.json(r)
  );
});

/* =====================================================
   CATEGORY ANALYTICS
===================================================== */

router.get("/summary/category", auth, (req, res) => {
  db.query(
    `SELECT category, SUM(amount)+0 total
     FROM transactions
     WHERE user_id=? AND type='expense'
     GROUP BY category`,
    [req.userId],
    (e, r) => res.json(r)
  );
});

module.exports = router;
