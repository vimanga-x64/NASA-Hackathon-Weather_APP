import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import { Preferences } from './components/Preferences';

// Fix marker icon paths to use CDN
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

class WeatherForecastApp {
    private map!: L.Map;

    constructor() {
        console.log('App initialized');
        this.initMap();
        new Preferences('preferences');
    }

    private initMap(): void {
        console.log('Initializing map...');
        
        // Initialize map centered on NYC
        this.map = L.map('map').setView([40.7128, -74.0060], 5);
        
        console.log('Map created');

        // OpenStreetMap base layer
        const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        });

        // NASA Blue Marble layer
        const nasaBlueMarble = L.tileLayer(
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
            {
                attribution: 'NASA GIBS',
                maxZoom: 8,
                opacity: 0.7
            }
        );

        // NASA MODIS True Color (recent imagery)
        const nasaModis = L.tileLayer(
            `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${this.getYesterdayDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
            {
                attribution: 'NASA EOSDIS GIBS',
                maxZoom: 9,
                opacity: 0.8
            }
        );

        const baseMaps = {
            "OpenStreetMap": osm
        };

        const overlayMaps = {
            "NASA Blue Marble": nasaBlueMarble,
            "NASA MODIS (Recent)": nasaModis
        };

        // Add layer control to switch between maps
        L.control.layers(baseMaps, overlayMaps).addTo(this.map);

        // Add default layers
        osm.addTo(this.map);
        nasaBlueMarble.addTo(this.map);
        
        console.log('Layers added');

        // Add click event to place markers
        this.map.on('click', (e) => {
            L.marker([e.latlng.lat, e.latlng.lng])
                .addTo(this.map)
                .bindPopup(`Lat: ${e.latlng.lat.toFixed(4)}<br>Lon: ${e.latlng.lng.toFixed(4)}`)
                .openPopup();
        });
    }

    private getYesterdayDate(): string {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    }
}

// Initialize the app
console.log('Starting app...');
new WeatherForecastApp();