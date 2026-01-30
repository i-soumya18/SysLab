import { Router } from 'express';

const router = Router();

// Placeholder routes - will be implemented in later tasks
router.post('/start', (req, res) => {
  res.json({ message: 'Start simulation - to be implemented' });
});

router.post('/stop', (req, res) => {
  res.json({ message: 'Stop simulation - to be implemented' });
});

router.get('/status', (req, res) => {
  res.json({ message: 'Get simulation status - to be implemented' });
});

export default router;