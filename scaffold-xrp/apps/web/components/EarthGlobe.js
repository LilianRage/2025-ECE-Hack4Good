"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useWallet } from "./providers/WalletProvider";

export const EarthGlobe = forwardRef(({ onTileSelected }, ref) => {
    const { accountInfo, walletManager } = useWallet();
    const iframeRef = useRef(null);

    useImperativeHandle(ref, () => ({
        refreshTiles: (tileId) => {
            if (iframeRef.current) {
                if (tileId) {
                    iframeRef.current.contentWindow.postMessage(
                        { type: 'PURCHASE_SUCCESS', h3Index: tileId },
                        'http://localhost:5173'
                    );
                }
                iframeRef.current.contentWindow.postMessage(
                    { type: 'REFRESH_TILES' },
                    'http://localhost:5173'
                );
            }
        }
    }));

    useEffect(() => {
        if (accountInfo?.address && iframeRef.current) {
            // Send wallet address to the iframe
            iframeRef.current.contentWindow.postMessage(
                { type: 'WALLET_UPDATE', address: accountInfo.address },
                'http://localhost:5173' // Target origin (frontend URL)
            );
        }
    }, [accountInfo]);

    // Listen for messages from iframe
    useEffect(() => {
        const handleMessage = async (event) => {
            // Verify origin
            if (event.origin !== "http://localhost:5173") return;

            if (event.data?.type === 'TILE_SELECTED') {
                console.log("Parent received tile selection:", event.data.h3Index, "Is Conflict:", event.data.isConflictZone);
                if (onTileSelected) {
                    onTileSelected(event.data.h3Index, event.data.isConflictZone);
                }
            }

            if (event.data?.type === 'SIGN_TRANSACTION') {
                console.log("Parent received sign request:", event.data.transaction);

                if (!walletManager) {
                    console.error("No wallet manager available");
                    iframeRef.current?.contentWindow.postMessage(
                        { type: 'SIGN_TRANSACTION_ERROR', error: 'Wallet not connected' },
                        'http://localhost:5173'
                    );
                    return;
                }

                try {
                    const result = await walletManager.signAndSubmit(event.data.transaction);
                    console.log("Parent signed transaction:", result);

                    iframeRef.current?.contentWindow.postMessage(
                        { type: 'SIGN_TRANSACTION_RESULT', result },
                        'http://localhost:5173'
                    );
                } catch (error) {
                    console.error("Signing error:", error);
                    iframeRef.current?.contentWindow.postMessage(
                        { type: 'SIGN_TRANSACTION_ERROR', error: error.message || 'Signing failed' },
                        'http://localhost:5173'
                    );
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [walletManager, onTileSelected]);

    return (
        <div className="absolute inset-0 w-full h-full bg-black">
            <iframe
                ref={iframeRef}
                src="http://localhost:5173"
                className="w-full h-full border-none"
                title="Earth Metaverse"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    );
});

EarthGlobe.displayName = "EarthGlobe";
