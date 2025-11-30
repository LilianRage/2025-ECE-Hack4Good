# Scaffold-XRP Technical Documentation

This directory contains the source code for the frontend application. It is built using **Next.js 14** and interacts directly with the **XRP Ledger**.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Blockchain SDK**: `xrpl.js`
- **Package Manager**: pnpm (via Turborepo)

## Architecture

The application is structured as a monorepo. The main frontend logic resides in `apps/web`.

### Key Components

- **`components/DashboardPanel.js`**: This is the heart of the application. It handles:
  - State management for selected tiles.
  - Interaction with the 3D Globe (via props/callbacks).
  - Transaction construction and submission.
  - UI for "My Lands", "Collaboration", and "Buy Zone".

- **`components/providers/WalletProvider.js`**: Manages wallet connections (GemWallet, Xaman, Crossmark) and exposes the `walletManager` to the rest of the app.

## XRPL Integration Details

We use specific transaction types and patterns to implement the game logic on-chain.

### 1. Tile Purchase Flow

When a user buys a tile, the following happens:

1.  **Locking**: The frontend calls the backend API `lockTile` to reserve the zone and generate a unique image hash.
2.  **Transaction Construction**:
    - **Instant Purchase**: Uses a standard `Payment` transaction.
    - **Future Purchase**: Uses an `EscrowCreate` transaction.
        - `FinishAfter`: Set to the release date (converted to Ripple Epoch).
        - `Condition`: (Optional) If cryptographic conditions were needed, but here we rely on time.
3.  **Memos**: Critical data is attached to the transaction via Memos:
    - `h3Index`: The hexagonal grid ID of the tile.
    - `ImageHash`: The hash of the generated tile image.
    - `GameDate`: The ISO date string for the game logic.
4.  **Confirmation**: After signing, the transaction hash is sent to the backend (`confirmTile`) to finalize the database record.

### 2. NFT Claiming (Mint & Sell)

Tiles are represented as NFTs. The flow is "Mint-and-Sell" to ensure the user gets the token:

1.  **Backend Minting**: The backend mints the NFT on the **Issuer Account**.
2.  **Sell Offer**: The backend creates an `NFTokenCreateOffer` (Sell Offer) destined for the user's wallet address.
3.  **Frontend Acceptance**:
    - The frontend detects the `nftOfferId` in the tile metadata.
    - The user clicks "Claim NFT".
    - The frontend submits an `NFTokenAcceptOffer` transaction.
    - **Result**: The NFT is transferred from the Issuer to the User.

## Setup & Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

The app runs on `http://localhost:3000`.

## Environment Variables

Ensure you have a `.env.local` in `apps/web` with necessary API endpoints if running against a custom backend.
