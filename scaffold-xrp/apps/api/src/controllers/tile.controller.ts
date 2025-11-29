import { Request, Response } from 'express';
import { cellToLatLng } from 'h3-js';
import Tile from '../models/tile.model';
import { verifyTransaction } from '../services/xrpl.service';

// Merchant Wallet Address (Should be in env)
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || 'r34oNndfhcrg5699bV5jMKyTytba4KPgne';
const TILE_PRICE_DROPS = '10000000'; // 10 XRP

export const lockTile = async (req: Request, res: Response) => {
    const { h3Index, userWallet } = req.body;

    if (!h3Index || !userWallet) {
        return res.status(400).json({ error: 'Missing h3Index or userWallet' });
    }

    // 1. Calculate geo for MongoDB
    const [lat, lon] = cellToLatLng(h3Index);

    try {
        // Check if tile exists and is not expired
        const existingTile = await Tile.findById(h3Index);
        if (existingTile) {
            // If it's already OWNED or PAID, reject
            if (existingTile.status === 'OWNED' || existingTile.status === 'PAID') {
                return res.status(409).json({ error: 'Tile already taken!' });
            }
            // If it's LOCKED but expired (e.g. > 10 mins), we could allow takeover, 
            // but for now let's just say it's taken unless we implement expiration logic.
            // Simplified: Reject if exists.
            return res.status(409).json({ error: 'Tile is currently locked or owned.' });
        }

        const tile = await Tile.create({
            _id: h3Index,
            location: { coordinates: [lon, lat] }, // Note the inversion!
            status: 'LOCKED',
            owner: { address: userWallet }
        });
        return res.status(201).json({ success: true, tile });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Tile already taken!' });
        }
        console.error('Error locking tile:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const confirmTile = async (req: Request, res: Response) => {
    const { h3Index, txHash, userWallet } = req.body;

    if (!h3Index || !txHash || !userWallet) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const tile = await Tile.findById(h3Index);
        if (!tile) {
            return res.status(404).json({ error: 'Tile not found' });
        }

        if (tile.status === 'OWNED') {
            return res.status(409).json({ error: 'Tile already owned' });
        }

        if (tile.owner.address !== userWallet) {
            return res.status(403).json({ error: 'Wallet mismatch' });
        }

        // Verify Transaction on XRPL
        // Memo data should be the h3Index in Hex
        const expectedMemo = Buffer.from(h3Index).toString('hex').toUpperCase();

        const isValid = await verifyTransaction(txHash, TILE_PRICE_DROPS, MERCHANT_WALLET, expectedMemo);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid transaction' });
        }

        // Update Tile
        tile.status = 'OWNED';
        tile.metadata = {
            ...tile.metadata,
            txHash: txHash,
            pricePaid: TILE_PRICE_DROPS
        };
        await tile.save();

        return res.status(200).json({ success: true, tile });

    } catch (error) {
        console.error('Error confirming tile:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const getTilesInView = async (req: Request, res: Response) => {
    const { minLon, minLat, maxLon, maxLat } = req.query;

    if (!minLon || !minLat || !maxLon || !maxLat) {
        return res.status(400).json({ error: 'Missing bbox parameters' });
    }

    try {
        const tiles = await Tile.find({
            location: {
                $geoWithin: {
                    $box: [
                        [parseFloat(minLon as string), parseFloat(minLat as string)], // Bottom-left
                        [parseFloat(maxLon as string), parseFloat(maxLat as string)]  // Top-right
                    ]
                }
            },
            status: { $in: ['LOCKED', 'OWNED', 'PAID'] }
        })
            .select('_id status owner.address metadata.ipfsImage')
            .lean();

        return res.status(200).json(tiles);
    } catch (error) {
        console.error('Error getting tiles:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
