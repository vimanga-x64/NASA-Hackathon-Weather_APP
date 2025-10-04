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

interface WeatherWidget {
    type: string;
    name: string;
    icon: string;
    layer?: L.TileLayer;
}

class WeatherForecastApp {
    private map!: L.Map;
    private activeWidgets: Map<string, WeatherWidget> = new Map();
    private draggedWidgetType: string | null = null;

    constructor() {
        console.log('App initialized');
        this.initMap();
        this.initDragAndDrop();
        this.initSidebarToggle();
        this.initLucideIcons();
        new Preferences('preferences');
    }

    private initLucideIcons(): void {
        // Initialize Lucide icons
        if (typeof (window as any).lucide !== 'undefined') {
            (window as any).lucide.createIcons();
        }
    }

    private initSidebarToggle(): void {
        const toggleBtn = document.getElementById('toggle-sidebar');
        const sidebar = document.getElementById('sidebar');

        toggleBtn?.addEventListener('click', () => {
            const isCollapsed = sidebar?.classList.contains('collapsed');

            sidebar?.classList.toggle('collapsed');
            sidebar?.classList.toggle('expanded');

            // Update button position based on sidebar state
            if (isCollapsed) {
                // Expanding - move button back to sidebar edge
                toggleBtn.style.left = '364px';
            } else {
                // Collapsing - move button to left edge
                toggleBtn.style.left = '20px';
            }

            // Give the sidebar time to animate, then resize the map
            setTimeout(() => {
                this.map.invalidateSize();
            }, 300);
        });
    }

    private initMap(): void {
        console.log('Initializing map...');
        const worldBounds =  L.latLngBounds(L.latLng(-90, -Infinity), L.latLng(90, Infinity));

        // Initialize map centered on NYC with zoom controls in bottom right
        this.map = L.map('map', {
            zoomControl: false,
            worldCopyJump: true,

            maxBounds: worldBounds,

            maxBoundsViscosity: 1.0,// Disable default zoom control
        }).setView([40.7128, -74.0060], 5);

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
        
        console.log('Map created');

        // OpenStreetMap base layer
        const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            minZoom: 1.5,
            bounds: worldBounds,
            attribution: '© OpenStreetMap contributors'
        });

        // NASA Blue Marble layer
        const nasaBlueMarble = L.tileLayer(
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
            {
                attribution: 'NASA GIBS',
                maxZoom: 8,
                minZoom: 1.5,
                bounds: worldBounds,
                opacity: 0.7
            }
        );

        // NASA MODIS True Color (recent imagery)
        const nasaModis = L.tileLayer(
            `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${this.getYesterdayDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
            {
                attribution: 'NASA EOSDIS GIBS',
                maxZoom: 9,
                minZoom: 1.5,
                bounds: worldBounds,
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

        // Add layer control to switch between maps (top right)
        L.control.layers(baseMaps, overlayMaps, {
            position: 'topright'
        }).addTo(this.map);

        // Add default layers
        osm.addTo(this.map);
        nasaBlueMarble.addTo(this.map);
        
        console.log('Layers added');

        // Add click event to place markers with weather info
        this.map.on('click', async (e) => {
            const weatherInfo = await this.getWeatherAtLocation(e.latlng.lat, e.latlng.lng);

            L.marker([e.latlng.lat, e.latlng.lng])
                .addTo(this.map)
                .bindPopup(weatherInfo)
                .openPopup();
        });

        // Ensure map resizes properly on window resize
        window.addEventListener('resize', () => {
            this.map.invalidateSize();
        });

        // Force initial resize after a short delay
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }

    private initDragAndDrop(): void {
        const draggableWidgets = document.querySelectorAll('.draggable');
        const mapContainer = document.getElementById('map');

        draggableWidgets.forEach(widget => {
            widget.addEventListener('dragstart', (e) => {
                const target = e.target as HTMLElement;
                this.draggedWidgetType = target.dataset.type || null;
                target.classList.add('dragging');
            });

            widget.addEventListener('dragend', (e) => {
                const target = e.target as HTMLElement;
                target.classList.remove('dragging');
            });
        });

        if (mapContainer) {
            mapContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                mapContainer.classList.add('drag-over');
            });

            mapContainer.addEventListener('dragleave', () => {
                mapContainer.classList.remove('drag-over');
            });

            mapContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                mapContainer.classList.remove('drag-over');

                if (this.draggedWidgetType) {
                    this.addWeatherLayer(this.draggedWidgetType);
                    this.draggedWidgetType = null;
                }
            });
        }
    }

    private addWeatherLayer(type: string): void {
        // Prevent duplicate widgets
        if (this.activeWidgets.has(type)) {
            alert(`${this.getWidgetName(type)} is already active!`);
            return;
        }

        const widget: WeatherWidget = {
            type,
            name: this.getWidgetName(type),
            icon: this.getWidgetIcon(type)
        };

        // Add OpenWeatherMap layer for the widget type
        const layerUrl = this.getWeatherLayerUrl(type);
        if (layerUrl) {
            widget.layer = L.tileLayer(layerUrl, {
                attribution: 'Weather from OpenWeatherMap',
                opacity: 0.6,
                maxZoom: 19
            });
            widget.layer.addTo(this.map);
        }

        this.activeWidgets.set(type, widget);
        this.updateActiveWidgetsList();
    }

    private removeWeatherLayer(type: string): void {
        const widget = this.activeWidgets.get(type);
        if (widget && widget.layer) {
            this.map.removeLayer(widget.layer);
        }
        this.activeWidgets.delete(type);
        this.updateActiveWidgetsList();
    }

    private updateActiveWidgetsList(): void {
        const listContainer = document.getElementById('active-widgets-list');
        if (!listContainer) return;

        if (this.activeWidgets.size === 0) {
            listContainer.innerHTML = '<div class="empty-state">Drag widgets to activate</div>';
            return;
        }

        listContainer.innerHTML = '';
        this.activeWidgets.forEach((widget, type) => {
            const item = document.createElement('div');
            item.className = 'active-widget-item';
            item.innerHTML = `
                <i data-lucide="${widget.icon}" class="widget-icon"></i>
                <div class="active-widget-info">
                    <div class="active-widget-name">${widget.name}</div>
                    <div class="active-widget-value">Active</div>
                </div>
                <button class="remove-widget-btn" data-type="${type}">×</button>
            `;

            const removeBtn = item.querySelector('.remove-widget-btn');
            removeBtn?.addEventListener('click', () => {
                this.removeWeatherLayer(type);
            });

            listContainer.appendChild(item);
        });

        // Re-initialize Lucide icons for dynamically added elements
        if (typeof (window as any).lucide !== 'undefined') {
            (window as any).lucide.createIcons();
        }
    }

    private getWeatherLayerUrl(type: string): string {
        // Note: Replace 'YOUR_API_KEY' with actual OpenWeatherMap API key for live data
        const baseUrl = 'https://tile.openweathermap.org/map';
        const apiKey = 'YOUR_API_KEY'; // Add your key here later

        const layerMap: { [key: string]: string } = {
            'temperature': `${baseUrl}/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`,
            'precipitation': `${baseUrl}/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`,
            'wind': `${baseUrl}/wind_new/{z}/{x}/{y}.png?appid=${apiKey}`,
            'clouds': `${baseUrl}/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`,
            'pressure': `${baseUrl}/pressure_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        };

        return layerMap[type] || '';
    }

    private getWidgetName(type: string): string {
        const names: { [key: string]: string } = {
            'temperature': 'Temperature',
            'precipitation': 'Precipitation',
            'wind': 'Wind Speed',
            'humidity': 'Humidity',
            'clouds': 'Cloud Cover',
            'visibility': 'Visibility',
            'pressure': 'Pressure',
            'uvindex': 'UV Index'
        };
        return names[type] || type;
    }

    private getWidgetIcon(type: string): string {
        const icons: { [key: string]: string } = {
            'temperature': 'thermometer',
            'precipitation': 'cloud-rain',
            'wind': 'wind',
            'humidity': 'droplets',
            'clouds': 'cloud',
            'visibility': 'eye',
            'pressure': 'gauge',
            'uvindex': 'sun'
        };
        return icons[type] || 'gauge';
    }

    private async getWeatherAtLocation(lat: number, lon: number): Promise<string> {
        // Mock weather data - replace with real API call later
        return `
            <strong>Location</strong><br>
            Lat: ${lat.toFixed(4)}<br>
            Lon: ${lon.toFixed(4)}<br><br>
            <strong>Active Layers:</strong><br>
            ${Array.from(this.activeWidgets.values()).map(w => `• ${w.name}`).join('<br>') || 'None'}
        `;
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