const express = require('express');
require('express-async-errors'); // forwards async route errors to the 500 handler
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'joineazy-backend' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/analytics', require('./routes/analytics'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;

async function start() {
  // In-memory test mode: seed the fresh database on every start.
  if (process.env.USE_PG_MEM === '1') {
    await require('./seed')();
  }
  app.listen(PORT, () => console.log(`Joineazy API running on http://localhost:${PORT}`));
}
start().catch((e) => { console.error(e); process.exit(1); });
