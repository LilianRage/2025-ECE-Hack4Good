import { Request, Response } from 'express';
import { cellToLatLng } from 'h3-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Tile from '../models/tile.model';
import { verifyTransaction } from '../services/xrpl.service';

// Merchant Wallet Address (Should be in env)
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || 'rP3oLJYmRLujC2EAjBXLPe2MCyBsKHaPSY';
const TILE_PRICE_DROPS = '10000000'; // 10 XRP

export const lockTile = async (req: Request, res: Response) => {
    const { h3Index, userWallet, gameDate } = req.body;

    if (!h3Index || !userWallet || !gameDate) {
        return res.status(400).json({ error: 'Missing h3Index, userWallet, or gameDate' });
    }

    // 1. Calculate geo for MongoDB
    const [lat, lon] = cellToLatLng(h3Index);

    try {
        // Check if tile exists and is not expired
        // Note: With gameDate, uniqueness might need to be scoped by date if we allow multiple owners for different times.
        // For now, assuming 1 tile = 1 owner regardless of time, OR we should check if tile exists at this specific time.
        // User request: "afficher les tuiles acheté à une heure précise". 
        // This implies we can have the same tile purchased at different times? 
        // Or just that we filter the VIEW. 
        // Let's assume for now that a tile is unique per (h3Index, gameDate).
        // BUT the current schema has _id = h3Index, which enforces uniqueness globally.
        // If we want multiple dates, we need to change _id or use a composite index.
        // Given the constraint of the current task and previous setup, I will assume for now that 
        // we are just adding metadata to the unique tile. 
        // WAIT, if I want to buy a tile "at a specific hour", it usually means I'm buying a slot.
        // If I just tag a date to a permanent purchase, that's easier.
        // Let's stick to: One tile, one owner, but it has a "Game Date" property.

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

        // --- SIMULATION: Local Asset Image ---
        // 1. Read local file
        const imagePath = path.join(__dirname, '../assets/desert.jpeg');
        const imageBuffer = fs.readFileSync(imagePath);

        // 2. Hash the image content
        const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

        // 3. Construct URL (assuming server is reachable at same host/port for now)
        // In production, this should be a full URL or relative if proxied.
        // Using localhost for dev simulation as requested.
        const protocol = req.protocol;
        const host = req.get('host');
        const imageUrl = `${protocol}://${host}/assets/desert.jpeg`;

        console.log(`Using Local Image: ${imageUrl}`);
        console.log(`Image Hash: ${imageHash}`);
        // --------------------------------------------

        const tile = await Tile.create({
            _id: h3Index,
            location: { coordinates: [lon, lat] }, // Note the inversion!
            status: 'LOCKED',
            owner: { address: userWallet },
            gameDate: new Date(gameDate),
            metadata: {
                imageUrl: imageUrl,
                imageHash: imageHash
            }
        });
        return res.status(201).json({ success: true, tile, imageHash });
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
    const { minLon, minLat, maxLon, maxLat, filterDate } = req.query;

    if (!minLon || !minLat || !maxLon || !maxLat) {
        return res.status(400).json({ error: 'Missing bbox parameters' });
    }

    const query: any = {
        location: {
            $geoWithin: {
                $box: [
                    [parseFloat(minLon as string), parseFloat(minLat as string)], // Bottom-left
                    [parseFloat(maxLon as string), parseFloat(maxLat as string)]  // Top-right
                ]
            }
        },
        status: { $in: ['LOCKED', 'OWNED', 'PAID'] }
    };

    // Filter by Date (Hour precision)
    if (filterDate) {
        const date = new Date(filterDate as string);
        // Start of hour
        const start = new Date(date);
        start.setMinutes(0, 0, 0);
        // End of hour
        const end = new Date(start);
        end.setHours(end.getHours() + 1);

        query.gameDate = {
            $gte: start,
            $lt: end
        };
    }

    try {
        const tiles = await Tile.find(query)
            .select('_id status owner.address metadata.ipfsImage metadata.txHash metadata.imageUrl metadata.imageHash metadata.pricePaid gameDate')
            .lean();

        return res.status(200).json(tiles);
    } catch (error) {
        console.error('Error getting tiles:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
