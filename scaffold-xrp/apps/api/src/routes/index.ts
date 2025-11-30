import { Router } from 'express';
import { checkHealth } from '../controllers/health.controller';
import { lockTile, getTilesInView, confirmTile, getUserTiles, getNftMetadata, getAccountNfts } from '../controllers/tile.controller';

const router = Router();

router.get('/health', checkHealth);

// Tile routes
router.post('/tile/lock', lockTile);
router.post('/tile/confirm', confirmTile);
router.get('/tiles', getTilesInView);
router.get('/tiles/user/:address', getUserTiles);
router.get('/metadata/:h3Index', getNftMetadata);
router.get('/nfts/:address', getAccountNfts);

export default router;
