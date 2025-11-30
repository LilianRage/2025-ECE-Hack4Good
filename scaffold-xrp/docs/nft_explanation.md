# Stockage des Images et Création de NFT sur XRPL

## État Actuel (Simulation)

Actuellement, dans notre application de démonstration :
1.  **Stockage** : L'image de la tuile (ex: `desert.jpeg`) est stockée localement sur le serveur (`apps/api/src/assets`).
2.  **Lien** : L'URL de l'image est générée dynamiquement (ex: `http://localhost:3001/assets/desert.jpeg`) et stockée dans les métadonnées de la tuile dans la base de données MongoDB.
3.  **Hash** : Un hash SHA-256 de l'image est calculé et stocké pour garantir l'intégrité, mais il n'est pas encore ancré de manière immuable sur la blockchain en tant qu'URI de NFT.

## Vers une Solution NFT Réelle

Pour transformer ces tuiles en véritables NFTs (Non-Fungible Tokens) sur le XRP Ledger, voici les étapes techniques nécessaires :

### 1. Stockage Décentralisé (IPFS)
Au lieu de stocker l'image sur notre serveur centralisé, nous devons la stocker sur IPFS (InterPlanetary File System).
-   **Action** : Uploader l'image sur un noeud IPFS (via Pinata ou Infura).
-   **Résultat** : On obtient un CID (Content Identifier), ex: `ipfs://QmHash...`.

### 2. Création des Métadonnées (Standard LS-25d)
Créer un fichier JSON standard pour le NFT.
```json
{
  "name": "Zone H3 #8928308281fffff",
  "description": "Une parcelle de terre virtuelle...",
  "image": "ipfs://QmImageHash...",
  "attributes": [
    { "trait_type": "Location", "value": "Paris, France" },
    { "trait_type": "H3 Index", "value": "8928308281fffff" }
  ]
}
```
Ce fichier JSON est aussi uploadé sur IPFS -> `ipfs://QmMetadataHash...`.

### 3. Minting sur XRPL (Transaction `NFTokenMint`)
Nous devons envoyer une transaction `NFTokenMint` sur le ledger.

**Champs de la transaction :**
-   **TransactionType**: `NFTokenMint`
-   **Account**: L'adresse de l'émetteur (Issuer).
-   **URI**: Le CID des métadonnées converti en Hexadécimal.
-   **Flags**: `tfTransferable` (pour permettre la revente).
-   **TransferFee**: (Optionnel) Royalties pour le créateur (ex: 5000 = 5%).

### 4. Transfert à l'Acheteur
Une fois minté, le NFT appartient à l'émetteur. Il faut ensuite créer une `NFTokenOffer` pour vendre ou transférer le NFT à l'adresse de l'utilisateur (`rUser...`).

---

## Résumé du Flux
1.  Utilisateur achète une zone -> Paiement XRP reçu.
2.  Serveur génère l'image -> Upload sur IPFS.
3.  Serveur mint le NFT sur XRPL avec l'URI IPFS.
4.  Serveur transfère le NFT au wallet de l'utilisateur.

---

## Guide d'Implémentation Technique

Voici comment implémenter concrètement le minting dans le fichier `apps/api/src/controllers/tile.controller.ts`.

### Pré-requis
Installer la librairie xrpl :
```bash
npm install xrpl
```

### Code pour `tile.controller.ts`

Ajoutez cette fonction pour minter le NFT après la confirmation de l'achat.

```typescript
import { Client, Wallet, xrpToDrops, convertStringToHex } from 'xrpl';

// ... (imports existants)

const XRPL_NET = 'wss://s.altnet.rippletest.net:51233';

async function mintTileNFT(tileId: string, imageHash: string, ownerAddress: string) {
    const client = new Client(XRPL_NET);
    await client.connect();

    // Wallet du Marchand (Issuer) - Doit être sécurisé via ENV
    const merchantWallet = Wallet.fromSeed(process.env.MERCHANT_SEED || 'sEd...'); 

    // 1. Préparer les métadonnées (URI)
    // Idéalement, uploadez un JSON sur IPFS et utilisez le CID.
    // Pour l'instant, on utilise le hash de l'image comme URI simplifié.
    const uri = convertStringToHex(`ipfs://${imageHash}`);

    // 2. Transaction NFTokenMint
    const transactionBlob = {
        TransactionType: "NFTokenMint",
        Account: merchantWallet.classicAddress,
        URI: uri,
        Flags: 8, // tfTransferable
        NFTokenTaxon: 0, // Collection ID (0 par défaut)
    };

    const tx = await client.submitAndWait(transactionBlob, { wallet: merchantWallet });
    
    // Récupérer l'ID du NFT créé
    // (Nécessite de parser les métadonnées de la transaction pour trouver le NFTokenID)
    // ...

    // 3. Créer une Offre de Vente (NFTokenCreateOffer) pour transférer à l'utilisateur
    // L'utilisateur devra accepter l'offre (NFTokenAcceptOffer) côté frontend.
    // Alternative: Si le flag tfBurnable est activé, on peut parfois simplifier, 
    // mais le standard est Mint -> CreateOffer -> AcceptOffer.
    
    await client.disconnect();
    return tx;
}
```

### Intégration dans `confirmTile`

Dans la fonction `confirmTile`, appelez `mintTileNFT` après avoir validé le paiement.

```typescript
// ...
// Update Tile
tile.status = 'OWNED';
// ...
await tile.save();

// MINT NFT (Async, ne bloque pas la réponse HTTP)
mintTileNFT(tile._id, tile.metadata.imageHash, userWallet).catch(console.error);

return res.status(200).json({ success: true, tile });
```
