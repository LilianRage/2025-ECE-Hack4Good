"use client";

import { useState, useEffect } from "react";
import { useWallet } from "./providers/WalletProvider";
import { lockTile, confirmTile, fetchUserTiles } from "../services/api";


export function DashboardPanel({ selectedTile, onRefreshTiles, isConflictZone }) {
    const [activeTab, setActiveTab] = useState("my lands");
    const [missionView, setMissionView] = useState('list'); // 'list' or 'details'
    const { accountInfo, walletManager } = useWallet();
    const [isProcessing, setIsProcessing] = useState(false);

    const [purchaseMode, setPurchaseMode] = useState("instant"); // "instant" or "future"

    // Initialize with local time formatted for datetime-local input (YYYY-MM-DDTHH:mm)
    const [purchaseDate, setPurchaseDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });

    const [activeTiles, setActiveTiles] = useState([]);
    const [archiveTiles, setArchiveTiles] = useState([]);
    const [futureTiles, setFutureTiles] = useState([]); // New state for Future/Escrow/Unclaimed
    const [newTileId, setNewTileId] = useState(null); // For animation
    const [selectedOwnedTile, setSelectedOwnedTile] = useState(null); // For details view
    const [ownedNfts, setOwnedNfts] = useState(new Set());

    // Collapsible sections state (default collapsed)
    const [expandedSections, setExpandedSections] = useState({
        future: false,
        active: false,
        archive: false
    });

    const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Fetch User's Owned NFTs
    useEffect(() => {
        const fetchOwnedNfts = async () => {
            if (walletManager && accountInfo?.address) {
                try {
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
                const future = [];

                tiles.forEach(tile => {
                    const gameDate = new Date(tile.gameDate);

                    // Check for Escrow (PROCESSING)
                    if (tile.status === 'PROCESSING') {
                        future.push(tile);
                        return;
                    }

                    // Check for Unclaimed NFT (OWNED but NFT not in wallet)
                    // We need to be careful: if we haven't fetched NFTs yet, we might wrongly categorize.
                    // But ownedNfts starts empty. 
                    // Let's assume if it has nftId but not in ownedNfts, it's unclaimed?
                    // OR if it has nftOfferId?
                    // If tile.status is OWNED:
                    if (tile.status === 'OWNED') {
                        // If we have an NFT ID and it IS in the wallet -> Active/Archive
                        if (tile.metadata?.nftId && ownedNfts.has(tile.metadata.nftId)) {
                            if (gameDate > activeWindowStart) {
                                active.push(tile);
                            } else {
                                archive.push(tile);
                            }
                        } else {
                            // Not in wallet yet (Unclaimed or just minted and not indexed)
                            // Treat as Future/Unclaimed
                            future.push(tile);
                        }
                    }
                });

                setActiveTiles(active);
                setArchiveTiles(archive);
                setFutureTiles(future);
            } else {
                setActiveTiles([]);
                setArchiveTiles([]);
                setFutureTiles([]);
            }
        };

        // Reload when tab changes or ownedNfts updates
        if (activeTab === "my lands") {
            loadUserTiles();
        }
    }, [accountInfo, activeTab, ownedNfts]);

    // Switch to "acheter une zone" when a tile is selected from map
    useEffect(() => {
        if (selectedTile && !isConflictZone) {
            setActiveTab("buy zone");
            setSelectedOwnedTile(null); // Close details if map selection happens
        } else if (isConflictZone) {
            setActiveTab("collaboration");
            setMissionView('details');
            setSelectedOwnedTile(null);
        }
    }, [selectedTile, isConflictZone]);

    const handleBuyTile = async () => {
        if (!selectedTile) return;
        if (!accountInfo?.address) {
            alert('Please connect your wallet first');
            return;
        }

        setIsProcessing(true);
        try {
            // Determine Game Date
            let gameDateIso;
            if (purchaseMode === "instant") {
                gameDateIso = new Date().toISOString();
            } else {
                const dateObj = new Date(purchaseDate);
                // Ensure future date for Escrow
                if (dateObj <= new Date()) {
                    throw new Error("For a scheduled purchase, the date must be in the future.");
                }
                gameDateIso = dateObj.toISOString();
            }

            // 1. Lock the tile
            console.log('Locking tile...', selectedTile);
            const lockResponse = await lockTile(selectedTile, accountInfo.address, gameDateIso);
            const { imageHash } = lockResponse;
            console.log('Received Image Hash:', imageHash);

            // 2. Prepare Transaction
            const amountDrops = "1140000"; // 1.14 XRP
            const destination = "rKfLLRRRNw12Yo5Ysrx6LsVn3BpRGZNX1v"; // Merchant Wallet (Testnet)

            // Memo 1: H3 Index
            const memoDataH3 = Array.from(new TextEncoder().encode(selectedTile))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .toUpperCase();

            // Memo 2: Game Date (ISO String)
            const memoDataDate = Array.from(new TextEncoder().encode(gameDateIso))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .toUpperCase();

            // Memo 3: Image Hash (Already Hex)
            const memoDataHash = imageHash.toUpperCase();

            let transaction;

            if (purchaseMode === "instant") {
                // STANDARD PAYMENT
                transaction = {
                    TransactionType: 'Payment',
                    Destination: destination,
                    Amount: amountDrops,
                    Memos: [
                        {
                            Memo: {
                                MemoData: memoDataH3,
                                MemoType: "6833496E646578", // "h3Index"
                                MemoFormat: "746578742F706C61696E"
                            }
                        },
                        {
                            Memo: {
                                MemoData: memoDataHash,
                                MemoType: "496D61676548617368", // "ImageHash"
                                MemoFormat: "746578742F706C61696E"
                            }
                        }
                    ]
                };
            } else {
                // ESCROW CREATE
                // Convert Date to Ripple Epoch (Seconds since 2000-01-01 00:00:00 UTC)
                const rippleEpochStart = new Date("2000-01-01T00:00:00Z").getTime();
                const finishAfterTime = new Date(gameDateIso).getTime();
                const finishAfterRipple = Math.floor((finishAfterTime - rippleEpochStart) / 1000);

                transaction = {
                    TransactionType: 'EscrowCreate',
                    Destination: destination,
                    Amount: amountDrops,
                    FinishAfter: finishAfterRipple,
                    Memos: [
                        {
                            Memo: {
                                MemoData: memoDataH3,
                                MemoType: "6833496E646578", // "h3Index"
                                MemoFormat: "746578742F706C61696E"
                            }
                        },
                        {
                            Memo: {
                                MemoData: memoDataHash,
                                MemoType: "496D61676548617368", // "ImageHash"
                                MemoFormat: "746578742F706C61696E"
                            }
                        },
                        {
                            Memo: {
                                MemoData: memoDataDate,
                                MemoType: "47616D6544617465", // "GameDate"
                                MemoFormat: "746578742F706C61696E"
                            }
                        }
                    ]
                };
            }

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
            setActiveTab("my lands"); // Switch back to my land or stay?

        } catch (error) {
            console.error(error);
            alert(`Failed to buy tile: ${error.message}`);
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
                    alert("The NFT offer is being created. Please try again in a few seconds.");
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
                if (onRefreshTiles && selectedOwnedTile) {
                    onRefreshTiles(selectedOwnedTile._id);
                }
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
                {["my lands", "collaboration", "buy zone"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => {
                            setActiveTab(tab);
                            setSelectedOwnedTile(null);
                        }}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 capitalize ${activeTab === tab
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
                {activeTab === "my lands" && (
                    <>
                        {selectedOwnedTile ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                                <button
                                    onClick={() => {
                                        setSelectedOwnedTile(null);
                                        setShowAdvancedDetails(false);
                                    }}
                                    className="flex items-center text-gray-400 hover:text-white transition-colors mb-2 group"
                                >
                                    <div className="bg-white/5 p-1 rounded-md mr-2 group-hover:bg-white/10 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium">Back to list</span>
                                </button>

                                <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden flex-1 flex flex-col shadow-2xl">
                                    {/* Image Header */}
                                    <div className="h-56 bg-gray-900 relative group">
                                        {selectedOwnedTile.metadata?.imageUrl ? (
                                            <img
                                                src={selectedOwnedTile.metadata.imageUrl}
                                                alt="Tile Asset"
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-900">
                                                <span className="text-sm">No Image Available</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <h2 className="text-2xl font-bold text-white mb-1">Zone {selectedOwnedTile._id.substring(0, 8)}</h2>
                                            <p className="text-gray-400 text-xs font-mono">{selectedOwnedTile._id}</p>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                                        {/* Primary Info Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Acquisition Date</label>
                                                <p className="text-gray-200 font-medium text-sm">
                                                    {new Date(selectedOwnedTile.gameDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Value</label>
                                                <p className="text-white font-bold text-sm">
                                                    {selectedOwnedTile.metadata?.pricePaid ? parseInt(selectedOwnedTile.metadata.pricePaid) / 1000000 : '1.14'} XRP
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status / Action Area */}
                                        <div>
                                            {selectedOwnedTile.status === 'PROCESSING' ? (
                                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                                    <div className="flex items-center mb-2">
                                                        <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse"></span>
                                                        <h4 className="text-yellow-500 font-bold text-sm uppercase tracking-wider">
                                                            Escrow in Progress
                                                        </h4>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                                                        Payment is locked until the release date.
                                                    </p>
                                                    <div className="bg-black/20 rounded-lg px-3 py-2 border border-white/5 flex justify-between items-center">
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Release</span>
                                                        <span className="text-xs text-yellow-200 font-mono">
                                                            {new Date(selectedOwnedTile.metadata.finishAfter * 1000 + new Date("2000-01-01T00:00:00Z").getTime()).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : selectedOwnedTile.metadata?.nftId && ownedNfts.has(selectedOwnedTile.metadata.nftId) ? (
                                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                                    <div className="flex items-center mb-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                                        <h4 className="text-green-500 font-bold text-sm uppercase tracking-wider">
                                                            Certified Ownership
                                                        </h4>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mb-3">
                                                        This NFT is secured in your wallet.
                                                    </p>
                                                    <a
                                                        href={`https://testnet.xrpl.org/nft/${selectedOwnedTile.metadata.nftId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-center w-full py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-bold rounded-lg transition-colors"
                                                    >
                                                        View on Explorer
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <button
                                                        onClick={handleClaimNFT}
                                                        disabled={isProcessing}
                                                        className={`w-full py-3 rounded-xl bg-white text-black font-bold text-sm shadow-lg hover:bg-gray-100 transition-all transform active:scale-[0.98] ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {isProcessing ? (
                                                            <span className="flex items-center justify-center">
                                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Processing...
                                                            </span>
                                                        ) : (
                                                            "Claim my NFT"
                                                        )}
                                                    </button>
                                                    <p className="text-[10px] text-center text-gray-500">
                                                        A transaction will be initiated to transfer the NFT to your wallet.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Advanced Details Section */}
                                        <div className="border-t border-white/5 pt-2">
                                            <button
                                                onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                                                className="flex items-center justify-between w-full py-2 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                <span>Technical Details</span>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className={`h-4 w-4 transition-transform duration-300 ${showAdvancedDetails ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {showAdvancedDetails && (
                                                <div className="mt-3 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div>
                                                        <label className="text-[10px] text-gray-600 uppercase font-bold tracking-wider mb-1 block">Transaction Hash</label>
                                                        <a
                                                            href={`https://testnet.xrpl.org/transactions/${selectedOwnedTile.metadata?.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block text-[10px] text-blue-400 hover:text-blue-300 font-mono break-all bg-blue-500/5 p-2 rounded border border-blue-500/10 hover:border-blue-500/30 transition-colors"
                                                        >
                                                            {selectedOwnedTile.metadata?.txHash || 'N/A'}
                                                        </a>
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] text-gray-600 uppercase font-bold tracking-wider mb-1 block">Image Hash (SHA-256)</label>
                                                        <div className="text-[10px] text-gray-500 font-mono break-all bg-white/5 p-2 rounded border border-white/5">
                                                            {selectedOwnedTile.metadata?.imageHash || 'N/A'}
                                                        </div>
                                                    </div>

                                                    {selectedOwnedTile.metadata?.nftId && (
                                                        <div>
                                                            <label className="text-[10px] text-gray-600 uppercase font-bold tracking-wider mb-1 block">Token ID</label>
                                                            <div className="text-[10px] text-gray-500 font-mono break-all bg-white/5 p-2 rounded border border-white/5">
                                                                {selectedOwnedTile.metadata.nftId}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Future / Escrow / Unclaimed Tiles */}
                                {futureTiles.length > 0 && (
                                    <div>
                                        <div
                                            className="flex items-center justify-between mb-4 cursor-pointer group/header"
                                            onClick={() => toggleSection('future')}
                                        >
                                            <h3 className="text-purple-400 text-xs font-semibold tracking-wider uppercase flex items-center">
                                                <span className="w-2 h-2 bg-purple-400 rounded-full mr-2 animate-pulse"></span>
                                                PENDING / TO CLAIM
                                            </h3>
                                            <div className={`text-purple-400 transition-transform duration-300 ${expandedSections.future ? 'rotate-180' : ''}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>

                                        {expandedSections.future && (
                                            <div className="space-y-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {futureTiles.map((tile) => (
                                                    <div
                                                        key={tile._id}
                                                        onClick={() => setSelectedOwnedTile(tile)}
                                                        className="group flex items-center justify-between bg-black/20 backdrop-blur-sm border border-white/5 rounded-lg p-3 transition-all duration-300 hover:bg-white/5 hover:border-purple-500/30 cursor-pointer"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            {/* Minimal Icon */}
                                                            <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>

                                                            {/* Text Info */}
                                                            <div>
                                                                <h4 className="text-gray-200 font-medium text-sm">Zone {tile._id.substring(0, 8)}...</h4>
                                                                {tile.status === 'PROCESSING' ? (
                                                                    <p className="text-gray-500 text-xs mt-0.5">
                                                                        Release : {new Date(tile.metadata.finishAfter * 1000 + new Date("2000-01-01T00:00:00Z").getTime()).toLocaleDateString()}
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-gray-500 text-xs mt-0.5">
                                                                        Ready to claim
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Status Indicator (Minimal) */}
                                                        <div className="flex items-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 ml-3 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Active Tiles */}
                                <div>
                                    <div
                                        className="flex items-center justify-between mb-4 cursor-pointer group/header"
                                        onClick={() => toggleSection('active')}
                                    >
                                        <h3 className="text-cyan-400 text-xs font-semibold tracking-wider uppercase flex items-center">
                                            <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 animate-pulse"></span>
                                            ACTIVE TILES
                                        </h3>
                                        <div className={`text-cyan-400 transition-transform duration-300 ${expandedSections.active ? 'rotate-180' : ''}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {expandedSections.active && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {activeTiles.length === 0 ? (
                                                <p className="text-gray-600 text-xs italic text-center py-4">No active tiles</p>
                                            ) : (
                                                activeTiles.map((tile) => (
                                                    <div
                                                        key={tile._id}
                                                        onClick={() => setSelectedOwnedTile(tile)}
                                                        className={`group flex items-center justify-between bg-black/20 backdrop-blur-sm border border-white/5 rounded-lg p-3 transition-all duration-300 hover:bg-white/5 hover:border-cyan-500/30 cursor-pointer ${newTileId === tile._id ? 'animate-in fade-in slide-in-from-top-4 border-cyan-500/50 shadow-lg shadow-cyan-500/10' : ''}`}
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 rounded-md bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-gray-200 font-medium text-sm">Zone {tile._id.substring(0, 8)}...</h4>
                                                                <p className="text-gray-500 text-xs mt-0.5">
                                                                    {new Date(tile.gameDate).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 ml-3 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Archive Tiles */}
                                <div>
                                    <div
                                        className="flex items-center justify-between mb-4 cursor-pointer group/header"
                                        onClick={() => toggleSection('archive')}
                                    >
                                        <h3 className="text-gray-500 text-xs font-semibold tracking-wider uppercase">
                                            ARCHIVES
                                        </h3>
                                        <div className={`text-gray-500 transition-transform duration-300 ${expandedSections.archive ? 'rotate-180' : ''}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {expandedSections.archive && (
                                        <div className="space-y-3 opacity-75 hover:opacity-100 transition-opacity animate-in fade-in slide-in-from-top-2 duration-200">
                                            {archiveTiles.length === 0 ? (
                                                <p className="text-gray-600 text-xs italic text-center py-4">No archives</p>
                                            ) : (
                                                archiveTiles.map((tile) => (
                                                    <div
                                                        key={tile._id}
                                                        onClick={() => setSelectedOwnedTile(tile)}
                                                        className="group flex items-center justify-between bg-black/20 backdrop-blur-sm border border-white/5 rounded-lg p-3 transition-all duration-300 hover:bg-white/5 cursor-pointer opacity-60 hover:opacity-100"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center text-gray-500 group-hover:bg-white/10 transition-colors">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-gray-400 font-medium text-sm group-hover:text-gray-300 transition-colors">Zone {tile._id.substring(0, 8)}...</h4>
                                                                <p className="text-gray-600 text-xs mt-0.5">
                                                                    {new Date(tile.gameDate).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700 ml-3 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === "collaboration" && (
                    <div className="h-full flex flex-col">
                        {missionView === 'details' || isConflictZone ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                                <button
                                    onClick={() => setMissionView('list')}
                                    className="flex items-center text-gray-400 hover:text-white transition-colors mb-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back to missions
                                </button>

                                <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-xl">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-white font-bold text-xl mb-1">Sahara Conflict</h3>
                                            <p className="text-gray-500 font-medium text-xs uppercase tracking-wider">Community Mission</p>
                                        </div>
                                        <div className="bg-white/5 p-2 rounded-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Progress Bar */}
                                        <div>
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Tile Discovery Progress</span>
                                                <span className="text-white font-mono font-bold text-sm">65%</span>
                                            </div>
                                            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-white h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: '65%' }}
                                                ></div>
                                            </div>
                                            <p className="text-[10px] text-gray-600 mt-2 text-right">
                                                Goal: 100% to unlock the zone
                                            </p>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">XRPL Spent</p>
                                                <p className="text-xl font-bold text-white">
                                                    30 XRP
                                                </p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Participants</p>
                                                <p className="text-xl font-bold text-white">
                                                    1,248
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                onClick={() => setActiveTab("buy zone")}
                                                className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors shadow-lg active:scale-[0.98] transform duration-100"
                                            >
                                                Contribute to Mission
                                            </button>
                                            <p className="text-[10px] text-gray-600 mt-3 text-center">
                                                This will redirect you to buy zones in the conflict.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                <h3 className="text-gray-400 text-xs font-semibold tracking-wider uppercase mb-4">
                                    Available Missions
                                </h3>

                                {/* Mission Card */}
                                <div
                                    onClick={() => setMissionView('details')}
                                    className="group bg-black/20 backdrop-blur-sm border border-white/5 hover:border-white/20 rounded-xl p-4 transition-all duration-300 cursor-pointer hover:bg-white/5 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 4.4A1 1 0 0116 14H6a1 1 0 01-1-1V6zm5.5 1.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM5 11.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm3.5 1.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>

                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="text-white font-bold text-lg group-hover:text-red-400 transition-colors">
                                                Sahara Conflict
                                            </h4>
                                            <span className="bg-red-900/30 text-red-400 text-[10px] font-bold px-2 py-1 rounded-full border border-red-500/20">
                                                URGENT
                                            </span>
                                        </div>
                                        <p className="text-gray-400 text-xs mb-4 line-clamp-2">
                                            Participate in conflict resolution by securing strategic zones.
                                        </p>

                                        <div className="flex items-center space-x-4">
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[10px] mb-1">
                                                    <span className="text-gray-500">Progress</span>
                                                    <span className="text-red-400 font-mono">65%</span>
                                                </div>
                                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                                    <div className="bg-red-500 h-full rounded-full" style={{ width: '65%' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "buy zone" && (
                    <div className="h-full flex flex-col">
                        {selectedTile ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                                    <h3 className="text-white font-bold text-lg mb-1">Selected Zone</h3>
                                    <p className="text-cyan-400 font-mono text-sm">{selectedTile}</p>
                                </div>

                                {/* Purchase Mode Toggle */}
                                <div className="bg-gray-900/20 rounded-lg p-1 flex space-x-1 border border-gray-800">
                                    <button
                                        onClick={() => setPurchaseMode("instant")}
                                        className={`flex-1 py-2 text-xs font-bold uppercase rounded transition-all ${purchaseMode === "instant"
                                            ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                            }`}
                                    >
                                        Instant
                                    </button>
                                    <button
                                        onClick={() => setPurchaseMode("future")}
                                        className={`flex-1 py-2 text-xs font-bold uppercase rounded transition-all ${purchaseMode === "future"
                                            ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                            }`}
                                    >
                                        Scheduled
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {purchaseMode === "future" && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-purple-400 text-xs uppercase font-bold mb-2">
                                                Trigger Date (Escrow)
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={purchaseDate}
                                                onChange={(e) => setPurchaseDate(e.target.value)}
                                                className="w-full bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                                            />
                                            <p className="text-[10px] text-gray-500 mt-1">
                                                Funds will be locked until this date. The NFT will be generated automatically.
                                            </p>
                                        </div>
                                    )}

                                    {purchaseMode === "instant" && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <p className="text-xs text-gray-400 italic">
                                                Instant purchase. The NFT will be generated and transferred immediately.
                                            </p>
                                        </div>
                                    )}

                                    <div className="bg-gray-900/20 rounded-lg p-4 border border-gray-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-gray-400 text-sm">Price</span>
                                            <span className="text-white font-bold">1.14 XRP</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 text-sm">Estimated Fees</span>
                                            <span className="text-gray-500 text-sm">~0.000012 XRP</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleBuyTile}
                                        disabled={isProcessing || !accountInfo?.address}
                                        className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all duration-200 ${isProcessing || !accountInfo?.address
                                            ? "bg-gray-700 cursor-not-allowed"
                                            : purchaseMode === "instant"
                                                ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20"
                                                : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 shadow-lg shadow-purple-500/20"
                                            }`}
                                    >
                                        {isProcessing ? (
                                            <span className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Processing...
                                            </span>
                                        ) : !accountInfo?.address ? (
                                            "Connect your wallet"
                                        ) : (
                                            purchaseMode === "instant"
                                                ? "Buy Now (1.14 XRP)"
                                                : "Schedule Purchase (1.14 XRP)"
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center px-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>Select a zone on the map to view details and buy it</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
