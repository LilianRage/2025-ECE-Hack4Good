import { Request, Response } from 'express';
import { cellToLatLng } from 'h3-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Tile from '../models/tile.model';
import { verifyTransaction, verifyEscrowTransaction } from '../services/xrpl.service';
import { Client, Wallet, convertStringToHex } from 'xrpl';

// Merchant Wallet Address (Should be in env)
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || 'rKfLLRRRNw12Yo5Ysrx6LsVn3BpRGZNX1v';
// TESTNET SEED - For demo purposes only. In production, use secure env var.
const MERCHANT_SEED = process.env.MERCHANT_SEED || 'sEdSjbWAYaByvWkn7wxv8gLNhsopDdk';
const TILE_PRICE_DROPS = '100000'; // 0.1 XRP
const XRPL_NET = 'wss://s.altnet.rippletest.net:51233';

export const lockTile = async (req: Request, res: Response) => {
    const { h3Index, userWallet, gameDate } = req.body;

    if (!h3Index || !userWallet || !gameDate) {
        return res.status(400).json({ error: 'Missing h3Index, userWallet, or gameDate' });
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

        // --- SIMULATION: Local Asset Image with Cycling ---
        // 1. Get all images from assets
        const assetsDir = path.join(__dirname, '../assets');
        const files = fs.readdirSync(assetsDir).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));

        if (files.length === 0) {
            throw new Error('No images found in assets directory');
        }

        // 2. Determine which image to use based on total tiles count
        const totalTiles = await Tile.countDocuments();
        const imageIndex = totalTiles % files.length;
        const selectedImage = files[imageIndex];

        // 3. Read file
        const imagePath = path.join(assetsDir, selectedImage);
        const imageBuffer = fs.readFileSync(imagePath);

        // 4. Hash the image content
        const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

        // 5. Construct URL
        const protocol = req.protocol;
        const host = req.get('host');
        const imageUrl = `${protocol}://${host}/assets/${selectedImage}`;

        console.log(`Using Local Image: ${imageUrl} (Index: ${imageIndex})`);
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

        // Check if it's an Escrow Transaction first
        // We need to fetch the tx to know the type, or try verifyEscrowTransaction first?
        // Let's try verifyTransaction (Payment) first, if it fails, try Escrow.
        // OR, we can just fetch the tx here and decide.
        // But our helpers fetch the tx too.
        // Let's try verifyTransaction first (most common).

        let isPayment = await verifyTransaction(txHash, TILE_PRICE_DROPS, MERCHANT_WALLET, expectedMemo);

        if (isPayment) {
            // STANDARD PAYMENT
            tile.status = 'OWNED';
            tile.metadata = {
                ...tile.metadata,
                txHash: txHash,
                pricePaid: TILE_PRICE_DROPS
            };
            await tile.save();

            // MINT NFT
            mintTileNFT(tile._id, tile.metadata.imageHash, userWallet).catch(err => {
                console.error('Failed to mint NFT for tile', tile._id, err);
            });

            return res.status(200).json({ success: true, tile });
        }

        // Try Escrow
        const { isValid, sequence, owner, finishAfter } = await verifyEscrowTransaction(txHash, TILE_PRICE_DROPS, MERCHANT_WALLET, expectedMemo);

        if (isValid) {
            // ESCROW CREATED
            tile.status = 'LOCKED'; // Keep it LOCKED or use a new status 'ESCROWED'?
            // Let's use 'ESCROWED' to distinguish.
            // But we need to update the enum in model? 
            // Model has: ['LOCKED', 'PAID', 'PROCESSING', 'OWNED']
            // Let's use 'PROCESSING' for Escrow? Or just 'LOCKED' with metadata?
            // Let's use 'PROCESSING' as "Pending Completion".
            tile.status = 'PROCESSING';

            tile.metadata = {
                ...tile.metadata,
                txHash: txHash,
                pricePaid: TILE_PRICE_DROPS,
                escrowSequence: sequence,
                escrowOwner: owner,
                finishAfter: finishAfter
            };
            await tile.save();

            return res.status(200).json({ success: true, tile, message: "Escrow detected. NFT will be minted upon completion." });
        }

        return res.status(400).json({ error: 'Invalid transaction (Payment or Escrow)' });

    } catch (error) {
        console.error('Error confirming tile:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const checkAndProcessEscrows = async () => {
    try {
        const nowRipple = Math.floor((Date.now() - new Date("2000-01-01T00:00:00Z").getTime()) / 1000);

        // Find tiles that are PROCESSING (Escrowed) and ready to finish
        const tiles = await Tile.find({
            status: 'PROCESSING',
            'metadata.finishAfter': { $lte: nowRipple }
        });

        if (tiles.length > 0) {
            console.log(`Found ${tiles.length} mature escrows to process.`);
        }

        const results = [];

        for (const tile of tiles) {
            try {
                console.log(`Processing Escrow for Tile ${tile._id}...`);
                const client = new Client(XRPL_NET);
                await client.connect();

                const merchantWallet = Wallet.fromSeed(MERCHANT_SEED);

                // Create EscrowFinish Transaction
                const finishTx: any = {
                    TransactionType: "EscrowFinish",
                    Account: merchantWallet.classicAddress,
                    Owner: tile.metadata.escrowOwner,
                    OfferSequence: tile.metadata.escrowSequence
                };

                const result = await client.submitAndWait(finishTx, { wallet: merchantWallet });
                await client.disconnect();

                if (result.result.meta.TransactionResult === "tesSUCCESS") {
                    console.log(`Escrow Finished for ${tile._id}`);

                    // Update Tile
                    tile.status = 'OWNED';
                    await tile.save();

                    // Mint NFT
                    await mintTileNFT(tile._id, tile.metadata.imageHash, tile.owner.address);

                    results.push({ id: tile._id, status: "success" });
                } else {
                    console.error(`EscrowFinish failed for ${tile._id}:`, result.result.meta.TransactionResult);
                    results.push({ id: tile._id, status: "failed", error: result.result.meta.TransactionResult });
                }

            } catch (err: any) {
                console.error(`Error processing tile ${tile._id}:`, err);
                results.push({ id: tile._id, status: "error", error: err.message });
            }
        }

        return results;

    } catch (error) {
        console.error("Error processing escrows:", error);
        return [];
    }
};

export const processEscrows = async (req: Request, res: Response) => {
    const results = await checkAndProcessEscrows();
    return res.status(200).json({ processed: results.length, results });
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

    // Filter by Date (Active Duration: 1 Hour)
    // We want tiles that are ACTIVE at 'filterDate'.
    // A tile is active if: gameDate <= filterDate AND gameDate > (filterDate - 1 hour)
    // So we query for: gameDate > (filterDate - 1 hour) AND gameDate <= filterDate
    if (filterDate) {
        const viewDate = new Date(filterDate as string);

        // Calculate the start of the active window (1 hour ago relative to viewDate)
        const activeWindowStart = new Date(viewDate);
        activeWindowStart.setHours(activeWindowStart.getHours() - 1);

        query.gameDate = {
            $gt: activeWindowStart,
            $lte: viewDate
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

export const getUserTiles = async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!address) {
        return res.status(400).json({ error: 'Missing wallet address' });
    }

    try {
        const tiles = await Tile.find({ 'owner.address': address })
            .sort({ gameDate: -1 }) // Sort by gameDate descending (newest first)
            .select('_id status owner.address metadata.ipfsImage metadata.txHash metadata.imageUrl metadata.imageHash metadata.pricePaid metadata.nftOfferId metadata.nftId gameDate')
            .lean();

        return res.status(200).json(tiles);
    } catch (error) {
        console.error('Error getting user tiles:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const getNftMetadata = async (req: Request, res: Response) => {
    const { h3Index } = req.params;

    try {
        const tile = await Tile.findById(h3Index);
        if (!tile) {
            return res.status(404).json({ error: 'Tile not found' });
        }

        const metadata = {
            name: `Tile ${h3Index} - ${new Date(tile.gameDate).toLocaleDateString()}`,
            description: `Tile ${h3Index} purchased on ${new Date(tile.gameDate).toISOString()} for ${parseInt(tile.metadata.pricePaid || '0') / 1000000} XRP`,
            image: tile.metadata.imageUrl,
            attributes: [
                { trait_type: "Price Paid", value: `${parseInt(tile.metadata.pricePaid || '0') / 1000000} XRP` },
                { trait_type: "Purchase Date", value: new Date(tile.gameDate).toISOString() },
                { trait_type: "Tile ID", value: h3Index },
                { trait_type: "Image Hash", value: tile.metadata.imageHash }
            ]
        };

        return res.status(200).json(metadata);
    } catch (error) {
        console.error('Error fetching metadata:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAccountNfts = async (req: Request, res: Response) => {
    const { address } = req.params;
    const client = new Client(XRPL_NET);

    try {
        await client.connect();
        const response = await client.request({
            command: "account_nfts",
            account: address,
            ledger_index: "validated"
        });

        await client.disconnect();
        return res.status(200).json(response.result.account_nfts);
    } catch (error) {
        console.error('Error fetching account NFTs:', error);
        if (client.isConnected()) {
            await client.disconnect();
        }
        return res.status(500).json({ error: 'Failed to fetch NFTs' });
    }
};

async function mintTileNFT(tileId: string, imageHash: string, ownerAddress: string) {
    console.log(`Starting NFT Minting for Tile ${tileId}...`);
    const client = new Client(XRPL_NET);
    await client.connect();

    try {
        // Wallet du Marchand (Issuer)
        const merchantWallet = Wallet.fromSeed(MERCHANT_SEED);

        // 1. Préparer les métadonnées (URI)
        // Point to our own API metadata endpoint
        // In production, use the real domain. For local, we assume localhost:3001 or similar.
        // Since we don't have the request object here, we'll hardcode the base URL or use an env var.
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
        const metadataUrl = `${API_BASE_URL}/metadata/${tileId}`;
        const uri = convertStringToHex(metadataUrl);

        // 2. Transaction NFTokenMint
        const transactionBlob: any = {
            TransactionType: "NFTokenMint",
            Account: merchantWallet.classicAddress,
            URI: uri,
            Flags: 8, // tfTransferable
            NFTokenTaxon: 0,
        };

        const tx = await client.submitAndWait(transactionBlob, { wallet: merchantWallet });
        console.log("NFT Minted:", tx.result?.hash);

        // Parse metadata to find NFTokenID
        const nfts = await client.request({
            command: "account_nfts",
            account: merchantWallet.classicAddress
        });

        // Find the NFT with our URI
        // Note: account_nfts might return many NFTs. We should filter carefully.
        // Since we just minted it, it should be there.
        const mintedNFT = nfts.result.account_nfts.find((n: any) => n.URI === uri);

        if (mintedNFT) {
            console.log("Found Minted NFT ID:", mintedNFT.NFTokenID);

            // 3. Create Sell Offer (Transfer to User)
            const offerBlob: any = {
                TransactionType: "NFTokenCreateOffer",
                Account: merchantWallet.classicAddress,
                NFTokenID: mintedNFT.NFTokenID,
                Amount: "0", // Free transfer
                Destination: ownerAddress, // Only this user can claim it
                Flags: 1 // tfSellNFToken
            };

            const offerTx = await client.submitAndWait(offerBlob, { wallet: merchantWallet });
            console.log("NFT Offer Created:", offerTx.result?.hash);

            // Extract Offer ID from transaction metadata
            // The Offer ID is the 'LedgerIndex' of the 'NFTokenOffer' node created.
            // Parsing this from tx metadata is complex. 
            // EASIER WAY: Query account_nfts or account_offers again? No.
            // Actually, for NFTokenCreateOffer, the Offer ID is NOT in the top-level result.
            // It is in the metadata. 
            // Let's assume for now we can fetch it or just use the transaction hash to find it?
            // Wait, to accept the offer, we need the Offer ID (Index).
            // Let's try to parse it from metadata if possible, or fetch offers for the account.

            // Fetch offers for the merchant to find the one we just created
            const offers = await client.request({
                command: "nft_sell_offers",
                nft_id: mintedNFT.NFTokenID
            });

            const myOffer = offers.result.offers.find((o: any) => o.destination === ownerAddress);

            if (myOffer) {
                console.log("Found Offer ID:", myOffer.nft_offer_index);
                // Update Tile with Offer ID
                await Tile.findByIdAndUpdate(tileId, {
                    'metadata.nftOfferId': myOffer.nft_offer_index,
                    'metadata.nftId': mintedNFT.NFTokenID
                });
            }

        } else {
            console.error("Could not find minted NFT ID");
        }

    } catch (error) {
        console.error("NFT Minting Error:", error);
    } finally {
        await client.disconnect();
    }
}
