import mongoose from 'mongoose';

const TileSchema = new mongoose.Schema({
    // 1. L'ID EST L'INDEX H3 (ex: "8928308280fffff")
    // Cela permet de faire Tile.findById("892830...") directement.
    _id: {
        type: String,
        required: true
    },

    // 2. POSITION GEOGRAPHIQUE (Pour le "Culling" / Viewport)
    // MongoDB a besoin de ça pour savoir quelles tuiles renvoyer quand tu zoomes sur la France.
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
            required: true
        },
        // ATTENTION : MongoDB demande [Longitude, Latitude]. 
        // H3 renvoie souvent [Lat, Lon], il faudra inverser !
        coordinates: {
            type: [Number],
            required: true
        }
    },

    status: {
        type: String,
        enum: ['LOCKED', 'PAID', 'PROCESSING', 'OWNED'],
        default: 'LOCKED',
        index: true // Pour filtrer vite
    },

    // 4. PROPRIETAIRE (Wallet XRPL)
    owner: {
        address: { type: String, required: true, index: true },
        purchasedAt: { type: Date, default: Date.now }
    },

    // 5. DONNEES BLOCKCHAIN & SAT
    metadata: {
        pricePaid: String,      // "10000000" (drops)
        txHash: String,         // Hash de la transaction d'achat
        nftId: String,          // ID du NFT minté (optionnel)
        ipfsImage: String,      // URL de l'image satellite finale
        satelliteProvider: String // "Planet", "Maxar"
    }
}, { timestamps: true });

// L'INDEX MAGIQUE
// C'est ça qui permet de trouver 1000 tuiles en 2ms
TileSchema.index({ location: '2dsphere' });

export default mongoose.models.Tile || mongoose.model('Tile', TileSchema);
