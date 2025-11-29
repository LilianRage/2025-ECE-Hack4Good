import { Router } from 'express';
import { checkHealth } from '../controllers/health.controller';
import { lockTile, getTilesInView, confirmTile } from '../controllers/tile.controller';

const router = Router();

router.get('/health', checkHealth);

// Tile routes
router.post('/tile/lock', lockTile);
router.post('/tile/confirm', confirmTile);
router.get('/tiles', getTilesInView);

export default router;
