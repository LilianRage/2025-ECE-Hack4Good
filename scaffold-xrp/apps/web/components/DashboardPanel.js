"use client";

import { useState, useEffect } from "react";
import { useWallet } from "./providers/WalletProvider";
import { lockTile, confirmTile, fetchUserTiles } from "../services/api";


export function DashboardPanel({ selectedTile, onRefreshTiles }) {
    const [activeTab, setActiveTab] = useState("ma terre");
    const { accountInfo, walletManager } = useWallet();
    const [isProcessing, setIsProcessing] = useState(false);

    // Initialize with local time formatted for datetime-local input (YYYY-MM-DDTHH:mm)
    const [purchaseDate, setPurchaseDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });

    const [activeTiles, setActiveTiles] = useState([]);
    const [archiveTiles, setArchiveTiles] = useState([]);
    const [newTileId, setNewTileId] = useState(null); // For animation
    const [selectedOwnedTile, setSelectedOwnedTile] = useState(null); // For details view
    const [ownedNfts, setOwnedNfts] = useState(new Set());

    // Fetch User's Owned NFTs
    useEffect(() => {
        const fetchOwnedNfts = async () => {
            if (walletManager && accountInfo?.address) {
                try {
                    // We need to use the client from walletManager if exposed, or make a request
                    // Assuming walletManager has a method or we can use the client directly if we had access.
                    // But walletManager wraps the client.
                    // Let's assume we can use a direct XRPL client or if walletManager has a 'request' method.
                    // If not, we might need to add one to WalletManager.js or use a library.
                    // Wait, we don't have direct access to client here.
                    // Let's try to use the 'request' method if it exists, or check how signAndSubmit works.
                    // Actually, for now, let's assume we can't easily check without modifying WalletManager.
                    // BUT, we can use the 'xrpl' library if we import it, but we are in frontend.
                    // Let's try to see if walletManager exposes 'client'.

                    // Workaround: If we can't check, we default to showing "Claim" if we just bought it?
                    // No, that's what we had before.

                    // Let's try to fetch via our API? We don't have an endpoint for "my nfts".
                    // We should add one or use a public node.

                    // BETTER: Add a method to WalletManager (if I could edit it easily) or just use a public endpoint.
                    // Actually, let's just try to call 'account_nfts' if walletManager allows.
                    // If not, we will assume NOT owned if we just bought it.

                    // Let's look at WalletManager.js in the artifacts? No.
                    // Let's try to use a simple fetch to a public node?

                    // Use our own backend proxy to avoid CORS issues
                    const response = await fetch(`http://localhost:3001/api/nfts/${accountInfo.address}`);

                    const data = await response.json();
                    if (Array.isArray(data)) {
                        const ids = new Set(data.map(n => n.NFTokenID));
                        setOwnedNfts(ids);
                    }
                } catch (error) {
                    console.error("Error fetching owned NFTs:", error);
                }
            }
        };

        fetchOwnedNfts();
        // Poll every 10 seconds
        const interval = setInterval(fetchOwnedNfts, 10000);
        return () => clearInterval(interval);
    }, [walletManager, accountInfo]);

    useEffect(() => {
        const loadUserTiles = async () => {
            if (accountInfo?.address) {
                const tiles = await fetchUserTiles(accountInfo.address);

                const now = new Date();
                // Active Window: 1 hour ago
                const activeWindowStart = new Date(now.getTime() - 60 * 60 * 1000);

                const active = [];
                const archive = [];

                tiles.forEach(tile => {
                    const gameDate = new Date(tile.gameDate);
                    // Active if gameDate > activeWindowStart
                    if (gameDate > activeWindowStart) {
                        active.push(tile);
                    } else {
                        archive.push(tile);
                    }
                });

                setActiveTiles(active);
                setArchiveTiles(archive);
            } else {
                setActiveTiles([]);
                setArchiveTiles([]);
            }
        };

        if (activeTab === "ma terre") {
            loadUserTiles();
        }
    }, [accountInfo, activeTab]);

    // Switch to "acheter une zone" when a tile is selected from map
    useEffect(() => {
        if (selectedTile) {
            setActiveTab("acheter une zone");
            setSelectedOwnedTile(null); // Close details if map selection happens
        }
    }, [selectedTile]);

    const handleBuyTile = async () => {
        if (!selectedTile) return;
        if (!accountInfo?.address) {
            alert('Please connect your wallet first');
            return;
        }

        setIsProcessing(true);
        try {
            // 1. Lock the tile
            console.log('Locking tile...', selectedTile);
            const lockResponse = await lockTile(selectedTile, accountInfo.address, purchaseDate);
            const { imageHash } = lockResponse;
            console.log('Received Image Hash:', imageHash);

            // 2. Prepare Transaction
            const amountDrops = "100000"; // 0.1 XRP
            const destination = "rKfLLRRRNw12Yo5Ysrx6LsVn3BpRGZNX1v"; // Merchant Wallet (Testnet)

            // Memo 1: H3 Index
            const memoDataH3 = Array.from(new TextEncoder().encode(selectedTile))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .toUpperCase();

            // Memo 2: Game Date (ISO String)
            // purchaseDate is "YYYY-MM-DDTHH:mm" (Local)
            // Create a Date object from it, which uses browser's timezone
            const dateObj = new Date(purchaseDate);
            const isoDate = dateObj.toISOString();

            const memoDataDate = Array.from(new TextEncoder().encode(isoDate))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .toUpperCase();

            // Memo 2: Image Hash (Already Hex)
            const memoDataHash = imageHash.toUpperCase();

            const transaction = {
                TransactionType: 'Payment',
                Destination: destination,
                Amount: amountDrops,
                Memos: [
                    {
                        Memo: {
                            MemoData: memoDataH3,
                            MemoType: "6833496E646578", // "h3Index" in hex
                            MemoFormat: "746578742F706C61696E" // "text/plain" in hex
                        }
                    },
                    {
                        Memo: {
                            MemoData: memoDataHash,
                            MemoType: "496D61676548617368", // "ImageHash" in hex
                            MemoFormat: "746578742F706C61696E" // "text/plain" in hex
                        }
                    }
                ]
            };

            // 3. Sign with Wallet
            console.log('Requesting signature...', transaction);
            const result = await walletManager.signAndSubmit(transaction);
            console.log('Wallet Response:', result);

            const txHash = result?.result?.hash || result?.hash;

            if (!txHash) {
                throw new Error('Transaction failed or rejected');
            }

            console.log('Transaction sent! Hash:', txHash);

            // 4. Confirm with Backend
            console.log('Confirming purchase...');
            await confirmTile(selectedTile, txHash, accountInfo.address);

            // Refresh tiles and trigger animation
            if (onRefreshTiles) {
                onRefreshTiles(selectedTile);
            }

            // Set new tile ID for animation
            setNewTileId(selectedTile);

            // Force refresh of user tiles
            const tiles = await fetchUserTiles(accountInfo.address);
            const now = new Date();
            const activeWindowStart = new Date(now.getTime() - 60 * 60 * 1000);

            const active = [];
            const archive = [];

            tiles.forEach(tile => {
                const gameDate = new Date(tile.gameDate);
                if (gameDate > activeWindowStart) {
                    active.push(tile);
                } else {
                    archive.push(tile);
                }
            });

            setActiveTiles(active);
            setArchiveTiles(archive);


            console.log(`Tile ${selectedTile} purchased successfully!`);
            setActiveTab("ma terre"); // Switch back to my land or stay?

        } catch (error) {
            console.error(error);
            // alert(`Failed to buy tile: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClaimNFT = async () => {
        if (!selectedOwnedTile || !walletManager) return;

        setIsProcessing(true); // Set true at the very beginning

        let offerId = selectedOwnedTile.metadata?.nftOfferId;

        if (!offerId) {
            // Attempt to refresh data silently first
            try {
                console.log("Offer ID missing, refreshing user tiles...");
                const tiles = await fetchUserTiles(accountInfo.address);

                // Update the lists
                const now = new Date();
                const activeWindowStart = new Date(now.getTime() - 60 * 60 * 1000);

                const active = [];
                const archive = [];

                let updatedTile = null;

                tiles.forEach(tile => {
                    if (tile._id === selectedOwnedTile._id) {
                        updatedTile = tile;
                    }
                    const gameDate = new Date(tile.gameDate);
                    if (gameDate > activeWindowStart) {
                        active.push(tile);
                    } else {
                        archive.push(tile);
                    }
                });

                setActiveTiles(active);
                setArchiveTiles(archive);

                if (updatedTile && updatedTile.metadata?.nftOfferId) {
                    console.log("Found Offer ID after refresh:", updatedTile.metadata.nftOfferId);
                    setSelectedOwnedTile(updatedTile); // Update the view
                    offerId = updatedTile.metadata.nftOfferId;
                } else {
                    alert("L'offre NFT est en cours de création. Veuillez réessayer dans quelques secondes.");
                    setIsProcessing(false); // Reset processing state before returning
                    return;
                }
            } catch (err) {
                console.error("Error refreshing tiles:", err);
                alert("Error refreshing tile data: " + (err.message || "Unknown error"));
                setIsProcessing(false); // Reset processing state before returning
                return;
            }
        }

        try {
            console.log("Accepting NFT Offer:", offerId);

            const transaction = {
                TransactionType: "NFTokenAcceptOffer",
                NFTokenSellOffer: offerId
            };

            const result = await walletManager.signAndSubmit(transaction);
            console.log("Claim Result:", result);

            if (result?.result?.hash || result?.hash) {
                alert("NFT Claimed Successfully! It is now in your wallet.");
                // Refresh to show updated status if needed (though ownership doesn't change visually)
            } else {
                throw new Error("Transaction failed");
            }

        } catch (error) {
            console.error("Error claiming NFT:", error);
            alert("Error claiming NFT: " + (error.message || "Unknown error"));
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full h-full bg-black/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col transition-all duration-300 relative overflow-hidden">
            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-900/50 p-1 rounded-lg mb-6">
                {["ma terre", "collaboration", "acheter une zone"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => {
                            setActiveTab(tab);
                            setSelectedOwnedTile(null);
                        }}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === tab
                            ? "bg-cyan-400 text-black shadow-lg shadow-cyan-400/20"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {activeTab === "ma terre" && (
                    <>
                        {selectedOwnedTile ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                                <button
                                    onClick={() => setSelectedOwnedTile(null)}
                                    className="flex items-center text-gray-400 hover:text-white transition-colors mb-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Retour à la liste
                                </button>

                                <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                                    {/* Image */}
                                    <div className="h-48 bg-gray-800 relative">
                                        {selectedOwnedTile.metadata?.imageUrl ? (
                                            <img
                                                src={selectedOwnedTile.metadata.imageUrl}
                                                alt="Tile Asset"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                No Image
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-mono">
                                            {selectedOwnedTile._id}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold">Date du Jeu</label>
                                            <p className="text-white font-medium">
                                                {new Date(selectedOwnedTile.gameDate).toLocaleString()}
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold">Prix Payé</label>
                                            <p className="text-cyan-400 font-bold">
                                                {selectedOwnedTile.metadata?.pricePaid ? parseInt(selectedOwnedTile.metadata.pricePaid) / 1000000 : '0.1'} XRP
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold">Transaction Hash</label>
                                            <a
                                                href={`https://testnet.xrpl.org/transactions/${selectedOwnedTile.metadata?.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block text-xs text-blue-400 hover:text-blue-300 truncate font-mono mt-1"
                                            >
                                                {selectedOwnedTile.metadata?.txHash || 'N/A'}
                                            </a>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold">Image Hash (SHA-256)</label>
                                            <p className="text-xs text-gray-400 font-mono break-all mt-1">
                                                {selectedOwnedTile.metadata?.imageHash || 'N/A'}
                                            </p>
                                        </div>

                                        <div className="pt-4 border-t border-white/10">
                                            {/* Check if NFT is actually in wallet */}
                                            {selectedOwnedTile.metadata?.nftId && ownedNfts.has(selectedOwnedTile.metadata.nftId) ? (
                                                <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-xl p-4 text-center">
                                                    <h4 className="text-purple-400 font-bold text-sm uppercase tracking-wider mb-2">
                                                        NFT Possédé
                                                    </h4>
                                                    <p className="text-xs text-gray-400 mb-2">
                                                        Ce NFT est sécurisé dans votre wallet.
                                                    </p>
                                                    <div className="bg-black/40 rounded px-2 py-1 mt-2 border border-white/5">
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Token ID</p>
                                                        <p className="text-xs text-white font-mono break-all">
                                                            {selectedOwnedTile.metadata.nftId}
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={`https://testnet.xrpl.org/nft/${selectedOwnedTile.metadata.nftId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-block mt-3 text-xs text-purple-400 hover:text-purple-300 underline"
                                                    >
                                                        Voir sur l'explorateur
                                                    </a>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={handleClaimNFT}
                                                        disabled={isProcessing}
                                                        className={`w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 font-bold text-white shadow-lg hover:shadow-purple-500/25 transition-all transform hover:-translate-y-0.5 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {isProcessing ? (
                                                            <span className="flex items-center justify-center">
                                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Traitement...
                                                            </span>
                                                        ) : (
                                                            "Réclamer mon NFT (Wallet)"
                                                        )}
                                                    </button>
                                                    <p className="text-xs text-center text-gray-500 mt-2">
                                                        Une offre de transfert a été créée. Vous devez l'accepter dans votre wallet.
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Active Tiles */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-cyan-400 text-xs font-semibold tracking-wider uppercase flex items-center">
                                            <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 animate-pulse"></span>
                                            TUILES ACTIVES
                                        </h3>
                                        <span className="bg-cyan-900/30 text-cyan-400 text-xs font-bold px-2 py-1 rounded-full">
                                            {activeTiles.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {activeTiles.length === 0 ? (
                                            <p className="text-gray-600 text-xs italic text-center py-4">Aucune tuile active</p>
                                        ) : (
                                            activeTiles.map((tile) => (
                                                <div
                                                    key={tile._id}
                                                    onClick={() => setSelectedOwnedTile(tile)}
                                                    className={`group bg-gray-900/40 border border-gray-800 hover:border-cyan-500/50 rounded-xl p-4 transition-all duration-500 hover:bg-gray-900/60 cursor-pointer ${newTileId === tile._id ? 'animate-in fade-in slide-in-from-top-4 border-cyan-500 shadow-lg shadow-cyan-500/20' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 rounded-lg bg-cyan-900/20 flex items-center justify-center text-cyan-400">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-white font-medium text-sm">Zone {tile._id.substring(0, 8)}...</h4>
                                                                <p className="text-cyan-500 text-xs font-mono">
                                                                    {new Date(tile.gameDate).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-cyan-900 text-cyan-200">
                                                            ACTIF
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Archive Tiles */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-gray-500 text-xs font-semibold tracking-wider uppercase">
                                            ARCHIVES
                                        </h3>
                                        <span className="bg-gray-800 text-gray-400 text-xs font-bold px-2 py-1 rounded-full">
                                            {archiveTiles.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3 opacity-75 hover:opacity-100 transition-opacity">
                                        {archiveTiles.length === 0 ? (
                                            <p className="text-gray-600 text-xs italic text-center py-4">Aucune archive</p>
                                        ) : (
                                            archiveTiles.map((tile) => (
                                                <div
                                                    key={tile._id}
                                                    onClick={() => setSelectedOwnedTile(tile)}
                                                    className="group bg-black/20 border border-gray-800 rounded-xl p-4 transition-all duration-200 cursor-pointer hover:bg-gray-900/40"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-gray-400 font-medium text-sm">Zone {tile._id.substring(0, 8)}...</h4>
                                                                <p className="text-gray-600 text-xs font-mono">
                                                                    {new Date(tile.gameDate).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-gray-800 text-gray-500">
                                                            ARCHIVE
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === "collaboration" && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <p>Prochainement...</p>
                    </div>
                )}

                {activeTab === "acheter une zone" && (
                    <div className="h-full flex flex-col">
                        {selectedTile ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                                    <h3 className="text-white font-bold text-lg mb-1">Zone Sélectionnée</h3>
                                    <p className="text-cyan-400 font-mono text-sm">{selectedTile}</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-gray-400 text-xs uppercase font-bold mb-2">
                                            Date du Jeu
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={purchaseDate}
                                            onChange={(e) => setPurchaseDate(e.target.value)}
                                            className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                        />
                                    </div>

                                    <div className="bg-gray-900/20 rounded-lg p-4 border border-gray-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-gray-400 text-sm">Prix</span>
                                            <span className="text-white font-bold">0.1 XRP</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 text-sm">Frais estimés</span>
                                            <span className="text-gray-500 text-sm">~0.000012 XRP</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleBuyTile}
                                        disabled={isProcessing || !accountInfo?.address}
                                        className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all duration-200 ${isProcessing || !accountInfo?.address
                                            ? "bg-gray-700 cursor-not-allowed"
                                            : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20"
                                            }`}
                                    >
                                        {isProcessing ? (
                                            <span className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Traitement...
                                            </span>
                                        ) : !accountInfo?.address ? (
                                            "Connectez votre wallet"
                                        ) : (
                                            "Acheter la Zone (0.1 XRP)"
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center px-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>Sélectionnez une zone sur la carte pour voir les détails et l'acheter</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
