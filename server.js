require('dotenv').config(); // Add this at the very top
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Your routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Money Manager API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});