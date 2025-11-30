"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "./providers/WalletProvider";
import { useWalletConnector } from "../hooks/useWalletConnector";

// Simple deterministic gradient generator
const generateGradient = (address) => {
    if (!address) return "linear-gradient(135deg, #eee, #ccc)";

    let hash = 0;
    for (let i = 0; i < address.length; i++) {
        hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }

    const c1 = (hash & 0x00ffffff).toString(16).toUpperCase();
    const c2 = ((hash >> 8) & 0x00ffffff).toString(16).toUpperCase();

    return `linear-gradient(135deg, #${"00000".substring(0, 6 - c1.length) + c1}, #${"00000".substring(0, 6 - c2.length) + c2})`;
};

export function CustomWalletConnect() {
    const { isConnected, accountInfo, walletManager } = useWallet();
    const walletConnectorRef = useWalletConnector(walletManager);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDisconnect = () => {
        if (walletManager) {
            walletManager.disconnect();
            setShowDropdown(false);
        }
    };

    const handleCopyAddress = () => {
        if (accountInfo?.address) {
            navigator.clipboard.writeText(accountInfo.address);
            setShowDropdown(false);
            // Could add a toast here
        }
    };

    if (!isConnected || !accountInfo) {
        return (
            <div className="relative z-10">
                <xrpl-wallet-connector
                    ref={walletConnectorRef}
                    id="wallet-connector"
                    style={{
                        "--xc-background-color": "#ffffff",
                        "--xc-text-color": "#000000",
                        "--xc-border-radius": "20px", // Explicit rounded corners
                        "--xc-button-padding": "6px 14px", // Thinner and compact
                        "--xc-font-family": "inherit",
                        "--xc-font-weight": "600", // Slightly bolder text
                        "--xc-font-size": "0.8rem", // Smaller text
                        "--xc-button-hover-background-color": "#f0f0f0",
                        "--xc-modal-box-shadow": "0 10px 40px rgba(0, 0, 0, 0.5)",
                        "boxShadow": "0 2px 4px rgba(0,0,0,0.1)", // Better shadow
                        "border": "none", // Remove border for cleaner look
                        "display": "block",
                    }}
                    primary-wallet="xaman"
                />
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 hover:border-white/40 transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                title={accountInfo.address}
            >
                <div
                    className="w-full h-full"
                    style={{ background: generateGradient(accountInfo.address) }}
                />
            </button>

            {showDropdown && (
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full py-1.5 px-2 shadow-xl animate-in fade-in slide-in-from-right-4 duration-200 z-50">
                    <button
                        onClick={handleCopyAddress}
                        className="p-2 text-gray-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Copy Address"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <div className="w-px h-4 bg-white/20"></div>
                    <button
                        onClick={handleDisconnect}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
                        title="Disconnect"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            )}
        </div>
    );
}

