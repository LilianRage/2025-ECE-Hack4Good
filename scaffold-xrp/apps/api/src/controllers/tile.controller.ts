import { Request, Response } from 'express';
import { cellToLatLng } from 'h3-js';
import Tile from '../models/tile.model';

export const lockTile = async (req: Request, res: Response) => {
    const { h3Index, userWallet } = req.body;

    if (!h3Index || !userWallet) {
        return res.status(400).json({ error: 'Missing h3Index or userWallet' });
    }

    // 1. Calculate geo for MongoDB
    const [lat, lon] = cellToLatLng(h3Index);

    try {
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
            status: 'LOCKED' // We WANT to show locked tiles
        })
            .select('_id status owner.address metadata.ipfsImage')
            .lean();

        return res.status(200).json(tiles);
    } catch (error) {
        console.error('Error getting tiles:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
