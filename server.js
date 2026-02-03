const express = require("express");
const cors = require("cors");
const db = require("./db");

const transactionRoutes = require("./routes/transactionRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);

app.listen(5000, () => console.log("Server running on 5000"));
