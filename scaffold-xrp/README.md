# Earth Metaverse - Hack4Good

This project is a decentralized application built on the XRP Ledger. It allows users to explore a 3D Earth, select hexagonal zones (tiles), and purchase them using XRP.

## Project Overview

The goal is to create a transparent and interactive way to own digital land. Users can navigate the globe, check the status of different zones, and participate in community missions like the "Sahara Conflict".

## How It Works (The Technique)

We use a straightforward technical approach to handle ownership and payments on the XRPL:

1. **Tile System**: The world is divided into hexagonal tiles using the H3 indexing system. Each tile has a unique ID.

2. **Purchase Mechanisms**:
   - **Instant Buy**: A standard XRP Payment transaction is sent to the merchant wallet.
   - **Future/Escrow**: For scheduled releases, we use the XRPL `EscrowCreate` transaction. This locks the XRP on the ledger until a specific date, ensuring the funds are safe and the purchase is guaranteed to execute only when the time comes.

3. **NFT Integration**:
   - Every tile is represented as an NFT.
   - When a purchase is confirmed, the backend mints an NFT and creates a sell offer for the buyer.
   - The buyer then signs an `NFTokenAcceptOffer` transaction to claim the NFT, transferring full ownership to their wallet.

4. **Verification**: The system listens for transactions on the ledger to update the tile status in real-time, ensuring the map is always in sync with the blockchain.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Running the App

```bash
pnpm dev
```

The application will start at `http://localhost:3000`.

## Technologies

- **Frontend**: Next.js, Tailwind CSS
- **Blockchain**: XRPL (xrpl.js)
- **Wallets**: Support for GemWallet, Xaman, and Crossmark
