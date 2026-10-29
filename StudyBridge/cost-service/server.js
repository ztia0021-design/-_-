import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/calculate-cost', (req, res) => {
  const { agreedRate, durationMinutes } = req.body ?? {};

  if (agreedRate === undefined || durationMinutes === undefined) {
    return res.status(400).json({ error: 'agreedRate and durationMinutes are required' });
  }
  if (!Number.isFinite(agreedRate) || !Number.isFinite(durationMinutes)) {
    return res.status(400).json({ error: 'agreedRate and durationMinutes must be numbers' });
  }
  if (agreedRate <= 0) {
    return res.status(400).json({ error: 'agreedRate must be greater than 0' });
  }
  if (durationMinutes < 30 || durationMinutes > 180) {
    return res.status(400).json({ error: 'durationMinutes must be between 30 and 180' });
  }

  const subtotal = agreedRate * durationMinutes / 60;
  const platformFee = subtotal * 0.1;
  const total = subtotal + platformFee;

  res.json({
    subtotal: Number(subtotal.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    total: Number(total.toFixed(2)),
  });
});

const port = process.env.PORT || 8084;
app.listen(port, () => console.log(`Cost service listening on port ${port}`));
