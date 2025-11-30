const xrpl = require('xrpl');

async function main() {
    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();

    console.log('Funding wallet...');
    const { wallet } = await client.fundWallet();

    console.log('Wallet Address:', wallet.classicAddress);
    console.log('Wallet Seed:', wallet.seed);

    await client.disconnect();
}

main().catch(console.error);
