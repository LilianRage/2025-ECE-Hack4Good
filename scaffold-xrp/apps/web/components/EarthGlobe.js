"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "./providers/WalletProvider";

export function EarthGlobe() {
    const { accountInfo } = useWallet();
    const iframeRef = useRef(null);

    useEffect(() => {
        if (accountInfo?.address && iframeRef.current) {
            // Send wallet address to the iframe
            iframeRef.current.contentWindow.postMessage(
                { type: 'WALLET_UPDATE', address: accountInfo.address },
                'http://localhost:5173' // Target origin (frontend URL)
            );
        }
    }, [accountInfo]);

    return (
        <div className="h-[600px] w-full relative overflow-hidden rounded-xl border border-gray-200 shadow-lg bg-black">
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
}
