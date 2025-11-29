import React, { useEffect, useRef, useState, useCallback } from 'react';

import * as Cesium from 'cesium';
import * as h3 from 'h3-js';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { fetchTiles, lockTile, confirmTile } from '../services/api';

const GlobeViewer = () => {
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const [selectedH3Index, setSelectedH3Index] = useState(null);
    const [lockedTiles, setLockedTiles] = useState(new Map()); // Map<h3Index, tileData>
    const [isLocking, setIsLocking] = useState(false);

    // Fetch tiles function
    const loadTiles = useCallback(async () => {
        // For now, we fetch a large area or all. 
        // In a real app with millions of tiles, we'd use the camera bbox.
        // Here we just fetch everything for simplicity as we don't have many locked tiles yet.
        const bbox = {
            minLon: -180,
            minLat: -90,
            maxLon: 180,
            maxLat: 90
        };
        const tiles = await fetchTiles(bbox);
        const newLockedTiles = new Map();
        tiles.forEach(tile => {
            newLockedTiles.set(tile._id, tile);
        });
        setLockedTiles(newLockedTiles);
    }, []);

    useEffect(() => {
        loadTiles();
    }, [loadTiles]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current, {
            animation: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            vrButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            creditContainer: document.createElement('div'), // Hide credits or move them
        });
        viewerRef.current = viewer;

        // --- H3 Integration ---

        // Generate global hexagons at Resolution 3 (approx 41,162 cells)
        const res0Cells = h3.getRes0Cells();
        const allHexagons = res0Cells.flatMap(res0 => h3.cellToChildren(res0, 3));

        // Create instances for the Primitive API
        const instances = [];
        const outlineInstances = [];

        const baseColor = Cesium.Color.GRAY.withAlpha(0.1);
        const lockedColor = Cesium.Color.RED.withAlpha(0.5);
        const outlineColor = Cesium.Color.WHITE.withAlpha(0.3);

        allHexagons.forEach((h3Index) => {
            // Skip pentagons
            if (h3.isPentagon(h3Index)) return;

            const boundary = h3.cellToBoundary(h3Index);

            // Filter 1: Check for IDL crossing
            let crossesIDL = false;
            for (let i = 0; i < boundary.length; i++) {
                const lon = boundary[i][1];
                const nextLon = boundary[(i + 1) % boundary.length][1];
                if (Math.abs(lon - nextLon) > 180) {
                    crossesIDL = true;
                    break;
                }
            }
            if (crossesIDL) return;

            // Filter 2: Remove duplicate points
            const uniquePositions = [];
            const seen = new Set();

            boundary.forEach(([lat, lon]) => {
                const key = `${lat},${lon}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniquePositions.push(lon, lat); // Cesium expects [lon, lat]
                }
            });

            // Filter 3: Ensure at least 3 points
            if (uniquePositions.length < 6) return;

            const polygonHierarchy = new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray(uniquePositions)
            );

            // Determine color based on locked status
            const isLocked = lockedTiles.has(h3Index);
            const color = isLocked ? lockedColor : baseColor;

            // Fill Instance
            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonGeometry({
                    polygonHierarchy: polygonHierarchy,
                    height: 0,
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
                },
                id: h3Index,
            }));

            // Outline Instance
            outlineInstances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonOutlineGeometry({
                    polygonHierarchy: polygonHierarchy,
                    height: 0,
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(outlineColor),
                },
            }));
        });

        // Add Fill Primitive
        const primitive = new Cesium.Primitive({
            geometryInstances: instances,
            appearance: new Cesium.PerInstanceColorAppearance({
                flat: true,
                translucent: true,
            }),
            asynchronous: false,
        });
        viewer.scene.primitives.add(primitive);

        // Add Outline Primitive
        const outlinePrimitive = new Cesium.Primitive({
            geometryInstances: outlineInstances,
            appearance: new Cesium.PerInstanceColorAppearance({
                flat: true,
                translucent: true,
            }),
            asynchronous: false,
        });
        viewer.scene.primitives.add(outlinePrimitive);

        // Fly to a global view
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000),
        });

        // --- Interaction (Picking) ---
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((movement) => {
            const pickedObject = viewer.scene.pick(movement.position);
            if (Cesium.defined(pickedObject) && typeof pickedObject.id === 'string') {
                console.log('Clicked H3 Hexagon ID:', pickedObject.id);
                setSelectedH3Index(pickedObject.id);
            } else {
                setSelectedH3Index(null);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Cleanup
        return () => {
            handler.destroy();
            viewer.destroy();
        };
    }, [lockedTiles]); // Re-render when lockedTiles changes

    const [walletAddress, setWalletAddress] = useState('');

    // Listen for wallet updates from parent (iframe container)
    useEffect(() => {
        const handleMessage = (event) => {
            // Verify origin for security (optional but recommended)
            // if (event.origin !== "http://localhost:3000") return;

            if (event.data && event.data.type === 'WALLET_UPDATE') {
                console.log("Received wallet address:", event.data.address);
                setWalletAddress(event.data.address);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleBuyTile = async () => {
        if (!selectedH3Index) return;
        if (!walletAddress.trim()) {
            alert('Please connect your wallet first (or enter address)');
            return;
        }

        setIsLocking(true);
        try {
            // 1. Lock the tile
            console.log('Locking tile...');
            await lockTile(selectedH3Index, walletAddress);

            // 2. Prepare Transaction
            const amountDrops = "10000000"; // 10 XRP
            const destination = "r34oNndfhcrg5699bV5jMKyTytba4KPgne"; // Merchant Wallet
            // Memo must be hex encoded h3Index
            const memoData = Array.from(new TextEncoder().encode(selectedH3Index))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .toUpperCase();

            const transaction = {
                TransactionType: 'Payment',
                Destination: destination,
                Amount: amountDrops,
                Memos: [
                    {
                        Memo: {
                            MemoData: memoData,
                            MemoType: "6833496E646578", // "h3Index" in hex (optional)
                            MemoFormat: "746578742F706C61696E" // "text/plain" in hex (optional)
                        }
                    }
                ]
            };

            // 3. Sign with Wallet (via Parent)
            console.log('Requesting signature from parent...', transaction);

            // Create a promise to wait for the response
            const signPromise = new Promise((resolve, reject) => {
                const handleSignResponse = (event) => {
                    // if (event.origin !== "http://localhost:3000") return; // Optional check

                    if (event.data?.type === 'SIGN_TRANSACTION_RESULT') {
                        window.removeEventListener('message', handleSignResponse);
                        resolve(event.data.result);
                    } else if (event.data?.type === 'SIGN_TRANSACTION_ERROR') {
                        window.removeEventListener('message', handleSignResponse);
                        reject(new Error(event.data.error));
                    }
                };
                window.addEventListener('message', handleSignResponse);

                // Send request to parent
                window.parent.postMessage(
                    { type: 'SIGN_TRANSACTION', transaction },
                    '*' // Target origin (ideally http://localhost:3000)
                );

                // Timeout safety
                setTimeout(() => {
                    window.removeEventListener('message', handleSignResponse);
                    reject(new Error('Signing timed out'));
                }, 60000); // 1 minute timeout
            });

            const response = await signPromise;
            console.log('Wallet Response:', response);

            // Handle different response formats
            const txHash = response?.result?.hash || response?.response?.hash || response?.hash;

            if (!txHash) {
                throw new Error('Transaction failed or rejected');
            }

            console.log('Transaction sent! Hash:', txHash);

            // 4. Confirm with Backend
            console.log('Confirming purchase...');
            await confirmTile(selectedH3Index, txHash, walletAddress);

            // Refresh tiles
            await loadTiles();
            alert(`Tile ${selectedH3Index} purchased successfully!`);

        } catch (error) {
            console.error(error);
            alert(`Failed to buy tile: ${error.message}`);
        } finally {
            setIsLocking(false);
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', margin: 0, padding: 0, overflow: 'hidden' }}
            />
            {selectedH3Index && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontFamily: 'Inter, sans-serif',
                    zIndex: 1000,
                    minWidth: '200px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '600' }}>Tile Selected</h3>
                    <div style={{ marginBottom: '15px', fontSize: '14px', opacity: 0.8 }}>
                        ID: <span style={{ fontFamily: 'monospace' }}>{selectedH3Index}</span>
                    </div>

                    {lockedTiles.has(selectedH3Index) ? (
                        <div style={{
                            padding: '8px',
                            background: 'rgba(255, 50, 50, 0.2)',
                            border: '1px solid rgba(255, 50, 50, 0.5)',
                            borderRadius: '6px',
                            textAlign: 'center',
                            color: '#ff6b6b'
                        }}>
                            {lockedTiles.get(selectedH3Index).status === 'OWNED' ? '👑 Owned' : '🔒 Locked'}
                            <div style={{ fontSize: '10px', marginTop: '4px', color: '#ccc' }}>
                                {lockedTiles.get(selectedH3Index).owner.address}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="Enter Wallet Address"
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                disabled={!!walletAddress} // Disable if auto-filled
                                style={{
                                    padding: '8px',
                                    borderRadius: '6px',
                                    border: '1px solid #555',
                                    background: 'rgba(255,255,255,0.1)',
                                    color: 'white',
                                    outline: 'none',
                                    cursor: walletAddress ? 'not-allowed' : 'text',
                                    opacity: walletAddress ? 0.7 : 1
                                }}
                            />
                            <button
                                onClick={handleBuyTile}
                                disabled={isLocking}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: isLocking ? '#555' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: 'white',
                                    fontWeight: '600',
                                    cursor: isLocking ? 'not-allowed' : 'pointer',
                                    transition: 'transform 0.1s',
                                }}
                            >
                                {isLocking ? 'Processing...' : 'Buy Tile (10 XRP)'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobeViewer;

