import { Router } from 'express';
import { checkHealth } from '../controllers/health.controller';
import { lockTile, getTilesInView } from '../controllers/tile.controller';

const router = Router();

router.get('/health', checkHealth);

// Tile routes
router.post('/tile/lock', lockTile);
router.get('/tiles', getTilesInView);

export default router;
