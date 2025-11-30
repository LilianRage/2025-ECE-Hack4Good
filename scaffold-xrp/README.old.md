# Scaffold-XRP

A Next.js-based development stack for building decentralized applications on XRPL. Built with Turborepo, inspired by Scaffold-ETH-2.

## Features

- **Next.js 14** - Modern React framework with App Router
- **Turborepo** - High-performance build system for monorepos
- **XRPL Integration** - Full XRPL client with WebSocket support
- **Multi-Wallet Support** - Connect with Xaman, Crossmark, GemWallet, or manual address
- **Network Switching** - Easy switching between AlphaNet, Testnet, and Devnet
- **Faucet Integration** - Request test XRP directly from the UI
- **Transaction History** - View your transaction history with explorer links
- **Debug Panel** - Execute custom XRPL commands and view network info

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
scaffold-xrp/
├── apps/
│   └── web/                 # Next.js application
│       ├── app/             # Next.js App Router
│       ├── components/      # React components
│       └── lib/             # Utilities and configurations
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Usage

### Connecting Your Wallet

1. Click "Connect Wallet" in the header
2. Choose your wallet (Xaman, Crossmark, GemWallet) or enter address manually
3. Approve the connection in your wallet extension

### Getting Test XRP

1. Connect your wallet
2. Go to the "Faucet" section
3. Click "Request Test XRP"
4. Wait for the transaction to complete


### Available Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm format       # Format code with Prettier
pnpm clean        # Clean build artifacts
```

### Environment Variables

Create a `.env.local` file in `apps/web/`:

```env
# Optional: Configure default network
NEXT_PUBLIC_DEFAULT_NETWORK=alphanet
```

## Networks

### AlphaNet (Default)
- **WebSocket:** wss://alphanet.nerdnest.xyz
- **Network ID:** 21465
- **Faucet:** https://alphanet.faucet.nerdnest.xyz/accounts
- **Explorer:** https://alphanet.xrpl.org

### Testnet
- **WebSocket:** wss://s.altnet.rippletest.net:51233
- **Network ID:** 1
- **Faucet:** https://faucet.altnet.rippletest.net/accounts
- **Explorer:** https://testnet.xrpl.org

### Devnet
- **WebSocket:** wss://s.devnet.rippletest.net:51233
- **Network ID:** 2
- **Faucet:** https://faucet.devnet.rippletest.net/accounts
- **Explorer:** https://devnet.xrpl.org

## Components

### Core Components

- **Header** - Navigation with wallet connection and network switching
- **AccountInfo** - Display wallet address and balance
- **FaucetRequest** - Request test XRP from network faucet
- **TransactionHistory** - View transaction history
- **DebugPanel** - Execute custom XRPL commands

### Providers

- **XRPLProvider** - Global state for XRPL connection, wallet, and network

## Technologies

- [Next.js 14](https://nextjs.org/)
- [React 18](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Turborepo](https://turbo.build/)
- [xrpl.js](https://js.xrpl.org/)

## Resources

- [XRPL Documentation](https://xrpl.org/)
- [XRPL Smart Contracts Guide](https://xrpl.org/docs.html)
- [Scaffold-ETH-2](https://github.com/scaffold-eth/scaffold-eth-2)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Inspired by [Scaffold-ETH-2](https://github.com/scaffold-eth/scaffold-eth-2)
- Built for the XRPL community