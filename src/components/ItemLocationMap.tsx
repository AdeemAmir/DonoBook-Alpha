import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin } from 'lucide-react';

interface ItemLocationMapProps {
    address: string;       // e.g. "Gulshan-e-Iqbal, Karachi"
    ownerName: string;
}

const simplifyAddress = (address: string): string => {
    // Remove common noise words and numbers that confuse Nominatim
    return address
        .replace(/sheet\s*\d+/gi, '')      // removes "Sheet 25"
        .replace(/house\s*#?\s*\d+/gi, '') // removes "House 123"
        .replace(/flat\s*#?\s*\d+/gi, '')  // removes "Flat 4"
        .replace(/plot\s*#?\s*\d+/gi, '')  // removes "Plot 7"
        .replace(/block\s*[a-z0-9]+/gi, '') // removes "Block B"
        .replace(/\s+/g, ' ')              // clean up extra spaces
        .trim();
};

const ItemLocationMap = ({ address, ownerName }: ItemLocationMapProps) => {
    const [coords, setCoords] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!address) return;

        // Nominatim is OpenStreetMap's free geocoding API — no key needed
        // We append ", Karachi, Pakistan" to improve accuracy for your use case
        const simplified = simplifyAddress(address);
        const query = encodeURIComponent(`${simplified}, Karachi, Pakistan`);

        fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
                } else {
                    setError(true);
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [address]);

    if (loading) {
        return (
            <div className="h-48 rounded-lg bg-muted flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
        );
    }

    if (error || !coords) {
        return (
            <div className="h-48 rounded-lg bg-muted flex items-center justify-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    Location: {address || 'Shared on chat'}
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg h-full w-full overflow-hidden border">
            <MapContainer
                center={coords}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false} // prevents accidental zoom while scrolling page
            >
                {/* Free OpenStreetMap tiles — no API key */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={coords}>
                    <Popup>
                        <div className="text-sm">
                            <p className="font-semibold">{ownerName}</p>
                            <p className="text-muted-foreground">{address}</p>
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    );
};

export default ItemLocationMap;