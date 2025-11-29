import { Client, Payment } from 'xrpl';

// Connect to Testnet (or Mainnet later)
const XRPL_RPC_URL = process.env.XRPL_RPC_URL || 'wss://s.altnet.rippletest.net:51233';

let client: Client | null = null;

export const getXrplClient = async (): Promise<Client> => {
    if (!client) {
        client = new Client(XRPL_RPC_URL);
        await client.connect();
        console.log('Connected to XRPL:', XRPL_RPC_URL);
    }
    if (!client.isConnected()) {
        await client.connect();
    }
    return client;
};

export const verifyTransaction = async (txHash: string, expectedAmountDrops: string, expectedDestination: string, expectedMemoData: string): Promise<boolean> => {
    try {
        const client = await getXrplClient();
        const tx = await client.request({
            command: 'tx',
            transaction: txHash
        });

        if (!tx.result || !tx.result.validated) {
            console.error('Transaction not validated yet or not found');
            return false;
        }

        // Check if it is a Payment transaction
        if (tx.result.TransactionType !== 'Payment') {
            console.error('Transaction is not a Payment');
            return false;
        }

        // Cast to Payment to access specific fields
        const payment = tx.result as unknown as Payment;

        // 1. Verify Destination
        if (payment.Destination !== expectedDestination) {
            console.error('Wrong destination:', payment.Destination);
            return false;
        }

        // 2. Verify Amount (Simple XRP check)
        // Note: Amount can be an object for tokens, but here we expect drops string for XRP
        if (typeof payment.Amount !== 'string' || payment.Amount !== expectedAmountDrops) {
            console.error('Wrong amount:', payment.Amount);
            return false;
        }

        // 3. Verify Memo (The H3 Index)
        // Memos is an array of objects
        const memos = payment.Memos;
        if (!memos || memos.length === 0) {
            console.error('No memos found');
            return false;
        }

        // We expect at least one memo with our data
        // Memo data is hex encoded
        const foundMemo = memos.find((m: any) => m.Memo.MemoData === expectedMemoData);
        if (!foundMemo) {
            console.error('Memo mismatch. Expected:', expectedMemoData);
            return false;
        }

        return true;

    } catch (error) {
        console.error('Error verifying transaction:', error);
        return false;
    }
};
