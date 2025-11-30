const API_URL = 'http://localhost:3001/api';

export const fetchTiles = async (bbox, filterDate) => {
    try {
        const params = new URLSearchParams(bbox);
        if (filterDate) {
            params.append('filterDate', filterDate);
        }
        const queryParams = params.toString();
        const response = await fetch(`${API_URL}/tiles?${queryParams}`);
        if (!response.ok) {
            throw new Error('Failed to fetch tiles');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching tiles:', error);
        return [];
    }
};

export const fetchUserTiles = async (walletAddress) => {
    try {
        const response = await fetch(`${API_URL}/tiles/user/${walletAddress}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user tiles');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching user tiles:', error);
        return [];
    }
};

export const lockTile = async (h3Index, userWallet, gameDate) => {
    try {
        const response = await fetch(`${API_URL}/tile/lock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ h3Index, userWallet, gameDate }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to lock tile');
        }

        return data;
    } catch (error) {
        console.error('Error locking tile:', error);
        throw error;
    }
};

export const confirmTile = async (h3Index, txHash, userWallet) => {
    try {
        const response = await fetch(`${API_URL}/tile/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ h3Index, txHash, userWallet }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to confirm tile');
        }

        return data;
    } catch (error) {
        console.error('Error confirming tile:', error);
        throw error;
    }
};
