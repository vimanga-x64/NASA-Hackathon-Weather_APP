import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles/main.css';
import {GeoSearchControl, OpenStreetMapProvider} from "leaflet-geosearch";

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

interface SearchResult {
    display_name: string;
    lat: string;
    lon: string;
    name: string;
    type: string;
}

class WeatherForecastApp {
    private map!: L.Map;
    private activeWidgets: Map<string, WeatherWidget> = new Map();
    private draggedWidgetType: string | null = null;
    private searchMarker: L.Marker | null = null;
    private searchTimeout: number | null = null;
    private selectedLocation: { lat: number; lon: number; name: string } | null = null;
    private selectedActivities: string[] = [];
    private storageKey = 'user-activity-preferences';

    constructor() {
        console.log('App initialized');
        this.initMap();
        this.initDragAndDrop();
        this.initSidebarToggle();
        this.initMainSearch();
        this.initDateTimePickers();
        this.initActivityDropdown();
        this.initPredictButton();
        this.initLucideIcons();
    }

    private initLucideIcons(): void {
        if (typeof (window as any).lucide !== 'undefined') {
            (window as any).lucide.createIcons({
                attrs: {
                    'stroke-width': '1.5',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round'
                }
            });
            
            // Apply stroke-width to specific icon types for better visuals
            document.querySelectorAll('.predict-btn i, .dropdown-btn .chevron').forEach(icon => {
                icon.setAttribute('stroke-width', '2');
            });
        }
    }

    private initActivityDropdown(): void {
        const dropdownBtn = document.getElementById('activities-dropdown-btn');
        const dropdownMenu = document.getElementById('activities-dropdown');
        const selectedCountSpan = document.getElementById('selected-count');
        
        if (!dropdownBtn || !dropdownMenu || !selectedCountSpan) return;

        // Load saved preferences
        this.loadActivityPreferences();

        // Toggle dropdown
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
            dropdownBtn.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target as Node) && e.target !== dropdownBtn) {
                dropdownMenu.classList.remove('show');
                dropdownBtn.classList.remove('active');
            }
        });

        // Handle checkbox changes
        const checkboxes = dropdownMenu.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const input = checkbox as HTMLInputElement;
            
            // Set initial checked state
            if (this.selectedActivities.includes(input.value)) {
                input.checked = true;
            }

            input.addEventListener('change', () => {
                if (input.checked) {
                    if (!this.selectedActivities.includes(input.value)) {
                        this.selectedActivities.push(input.value);
                    }
                } else {
                    this.selectedActivities = this.selectedActivities.filter(
                        activity => activity !== input.value
                    );
                }

                this.saveActivityPreferences();
                this.updateSelectedCount();
                console.log('Selected Activities:', this.selectedActivities);
            });
        });

        this.updateSelectedCount();
    }

    private updateSelectedCount(): void {
        const selectedCountSpan = document.getElementById('selected-count');
        if (selectedCountSpan) {
            const count = this.selectedActivities.length;
            selectedCountSpan.textContent = `Activities (${count})`;
        }
    }

    private initPredictButton(): void {
        const predictBtn = document.getElementById('predict-btn');
        
        if (!predictBtn) return;

        predictBtn.addEventListener('click', () => {
            console.log('Predict button clicked!');
            console.log('Selected Location:', this.selectedLocation);
            console.log('Selected Activities:', this.selectedActivities);
            
            const datePicker = document.getElementById('date-picker') as HTMLInputElement;
            const timePicker = document.getElementById('time-picker') as HTMLInputElement;
            
            console.log('Date:', datePicker?.value);
            console.log('Time:', timePicker?.value);
            
            // You can add your predict functionality here later
        });
    }

    private saveActivityPreferences(): void {
        localStorage.setItem(this.storageKey, JSON.stringify(this.selectedActivities));
    }

    private loadActivityPreferences(): void {
        const savedPreferences = localStorage.getItem(this.storageKey);
        if (savedPreferences) {
            this.selectedActivities = JSON.parse(savedPreferences);
        }
    }

    public getSelectedActivities(): string[] {
        return this.selectedActivities;
    }

    private initDateTimePickers(): void {
        const datePicker = document.getElementById('date-picker') as HTMLInputElement;
        const timePicker = document.getElementById('time-picker') as HTMLInputElement;

        if (datePicker) {
            const today = new Date().toISOString().split('T')[0];
            datePicker.value = today;
            datePicker.min = today;
        }

        if (timePicker) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timePicker.value = `${hours}:${minutes}`;
        }
    }

    private initMainSearch(): void {
        const mainSearchInput = document.getElementById('main-location-input') as HTMLInputElement;
        const mainSearchResults = document.getElementById('main-search-results');

        if (!mainSearchInput || !mainSearchResults) return;

        mainSearchInput.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.trim();

            if (query.length < 3) {
                mainSearchResults.classList.remove('show');
                return;
            }

            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            this.searchTimeout = window.setTimeout(() => {
                this.performMainSearch(query);
            }, 500);
        });

        mainSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = mainSearchInput.value.trim();
                if (query.length >= 3) {
                    if (this.searchTimeout) {
                        clearTimeout(this.searchTimeout);
                    }
                    this.performMainSearch(query);
                }
            }
        });
    }

    private async performMainSearch(query: string): Promise<void> {
        const mainSearchResults = document.getElementById('main-search-results');
        if (!mainSearchResults) return;

        mainSearchResults.classList.add('show');
        mainSearchResults.innerHTML = '<div style="padding: 16px; text-align: center; color: #616161; font-size: 13px;">Searching...</div>';

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
            );

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const results: SearchResult[] = await response.json();

            if (results.length === 0) {
                mainSearchResults.innerHTML = '<div style="padding: 16px; text-align: center; color: #616161; font-size: 13px;">No locations found</div>';
                return;
            }

            mainSearchResults.innerHTML = '';
            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'main-search-result-item';
                item.innerHTML = `
                    <i data-lucide="map-pin"></i>
                    <div class="main-search-result-text">
                        <div class="main-search-result-name">${result.name || 'Unknown'}</div>
                        <div class="main-search-result-address">${result.display_name}</div>
                    </div>
                `;

                item.addEventListener('click', () => {
                    this.selectMainLocation(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
                });

                mainSearchResults.appendChild(item);
            });

            if (typeof (window as any).lucide !== 'undefined') {
                (window as any).lucide.createIcons();
            }

        } catch (error) {
            console.error('Search error:', error);
            mainSearchResults.innerHTML = '<div style="padding: 16px; text-align: center; color: #616161; font-size: 13px;">Search failed. Please try again.</div>';
        }
    }

    private selectMainLocation(lat: number, lon: number, name: string): void {
        this.selectedLocation = { lat, lon, name };
        
        const mainSearchInput = document.getElementById('main-location-input') as HTMLInputElement;
        const mainSearchResults = document.getElementById('main-search-results');

        if (mainSearchInput) {
            mainSearchInput.value = name;
        }

        if (mainSearchResults) {
            mainSearchResults.classList.remove('show');
        }

        if (this.searchMarker) {
            this.map.removeLayer(this.searchMarker);
        }

        this.searchMarker = L.marker([lat, lon])
            .addTo(this.map)
            .bindPopup(`<strong>${name}</strong><br>Lat: ${lat.toFixed(4)}<br>Lon: ${lon.toFixed(4)}`)
            .openPopup();

        this.map.flyTo([lat, lon], 10, { duration: 1.5 });
    }

    private initSidebarToggle(): void {
        const toggleBtn = document.getElementById('toggle-sidebar');
        const sidebar = document.getElementById('sidebar');

        toggleBtn?.addEventListener('click', () => {
            const isCollapsed = sidebar?.classList.contains('collapsed');
            
            sidebar?.classList.toggle('collapsed');
            sidebar?.classList.toggle('expanded');
            
            if (isCollapsed) {
                toggleBtn.style.left = '364px';
            } else {
                toggleBtn.style.left = '20px';
            }
            
            setTimeout(() => {
                this.map.invalidateSize();
            }, 300);
        });
    }

    private initMap(): void {
        console.log('Initializing map...');

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

        const provider = new OpenStreetMapProvider();
        const searchControl = new GeoSearchControl({
            provider: provider,
            style: 'bar',
            showMarker: true,
            showPopup: false,
            autoClose: true,
            retainZoomLevel: false,
            animateZoom: true,
            keepResult: true,
            searchLabel: 'Enter address',
        });

        this.map.addControl(searchControl)

        // NASA Blue Marble layer
        const nasaBlueMarble = L.tileLayer(
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
            {
                attribution: 'NASA GIBS',
                maxZoom: 19,
                maxNativeZoom: 8,
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
                maxZoom: 19,
                minZoom: 1.5,
                maxNativeZoom: 9,
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

        this.map.on('click', async (e) => {
            const weatherInfo = await this.getWeatherAtLocation(e.latlng.lat, e.latlng.lng);
            
            L.marker([e.latlng.lat, e.latlng.lng])
                .addTo(this.map)
                .bindPopup(weatherInfo)
                .openPopup();
        });

        window.addEventListener('resize', () => {
            this.map.invalidateSize();
        });

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
        if (this.activeWidgets.has(type)) {
            alert(`${this.getWidgetName(type)} is already active!`);
            return;
        }

        const widget: WeatherWidget = {
            type,
            name: this.getWidgetName(type),
            icon: this.getWidgetIcon(type)
        };

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

        if (typeof (window as any).lucide !== 'undefined') {
            (window as any).lucide.createIcons();
        }
    }

    private getWeatherLayerUrl(type: string): string {
        const baseUrl = 'https://tile.openweathermap.org/map';
        const apiKey = 'YOUR_API_KEY';
        
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

console.log('Starting app...');
new WeatherForecastApp();