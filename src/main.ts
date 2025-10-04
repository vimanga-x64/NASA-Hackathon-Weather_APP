import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles/main.css';

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

interface RecommendationResponse {
    location: {
        latitude: number;
        longitude: number;
    };
    date: string;
    weather: {
        temp: number;
        precipitation: number;
        wind: number;
        cloud_cover: number;
        humidity?: number;
        description?: string;
        location_name?: string;
    };
    recommendation: {
        rating: string;
        one_liner: string;
        why: string[];
        alternatives: string[];
        icon?: string;  // Add this
        icon_name?: string;  // Add this
    };
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
    private apiBaseUrl = 'http://localhost:5000'; // Change this to your Flask server URL

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

        this.loadActivityPreferences();

        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
            dropdownBtn.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target as Node) && e.target !== dropdownBtn) {
                dropdownMenu.classList.remove('show');
                dropdownBtn.classList.remove('active');
            }
        });

        const checkboxes = dropdownMenu.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const input = checkbox as HTMLInputElement;
            
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

        predictBtn.addEventListener('click', async () => {
            await this.makeRecommendation();
        });
    }

    private async makeRecommendation(): Promise<void> {
        const predictBtn = document.getElementById('predict-btn');
        
        // Validate inputs
        if (!this.selectedLocation) {
            alert('Please select a location first!');
            return;
        }

        if (this.selectedActivities.length === 0) {
            alert('Please select at least one activity!');
            return;
        }

        const datePicker = document.getElementById('date-picker') as HTMLInputElement;
        const timePicker = document.getElementById('time-picker') as HTMLInputElement;

        if (!datePicker?.value) {
            alert('Please select a date!');
            return;
        }

        // Show loading state
        if (predictBtn) {
            predictBtn.innerHTML = '<i data-lucide="loader"></i> Predicting...';
            predictBtn.setAttribute('disabled', 'true');
            this.initLucideIcons();
        }

        try {
            const requestData = {
                location: {
                    latitude: this.selectedLocation.lat,
                    longitude: this.selectedLocation.lon
                },
                date: datePicker.value,
                preferences: this.selectedActivities
            };

            console.log('Sending request:', requestData);

            const response = await fetch(`${this.apiBaseUrl}/recommend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data: RecommendationResponse = await response.json();
            console.log('Recommendation received:', data);

            this.displayRecommendation(data);

        } catch (error) {
            console.error('Prediction error:', error);
            alert('Failed to get recommendation. Please make sure the Flask server is running on http://localhost:5000');
        } finally {
            // Reset button
            if (predictBtn) {
                predictBtn.innerHTML = '<i data-lucide="sparkles"></i> Predict';
                predictBtn.removeAttribute('disabled');
                this.initLucideIcons();
            }
        }
    }

    private displayRecommendation(data: RecommendationResponse): void {
        console.log('displayRecommendation called with data:', data);
        
        const recommendationPanel = document.getElementById('weather-recommendation-panel');
        console.log('Recommendation panel element:', recommendationPanel);
        
        if (!recommendationPanel) {
            console.error('Recommendation panel not found in DOM!');
            alert('Error: Recommendation panel not found. Please check HTML.');
            return;
        }

        // Clear existing recommendation
        recommendationPanel.innerHTML = '';
        console.log('Panel cleared, creating recommendation box...');

        // Create recommendation box
        const recommendationBox = document.createElement('div');
        recommendationBox.className = 'recommendation-box';

        // Normalize rating for CSS class (handle spaces)
        const ratingClass = data.recommendation.rating.toLowerCase().replace(/\s+/g, '-');
        
        // Use icon from API response if available, otherwise fallback
        const ratingEmoji = data.recommendation.icon || this.getRatingEmoji(data.recommendation.rating);
        const iconName = data.recommendation.icon_name || this.getRatingIconName(data.recommendation.rating);
        
        console.log('Rating:', data.recommendation.rating);
        console.log('Rating class:', ratingClass);
        console.log('Rating emoji:', ratingEmoji);
        console.log('Icon name:', iconName);

        recommendationBox.innerHTML = `
            <div class="recommendation-header">
                <div class="recommendation-title">
                    <i data-lucide="${iconName}"></i>
                    <span>Weather Recommendation</span>
                </div>
                <button class="close-recommendation" id="close-recommendation">×</button>
            </div>
            
            <div class="recommendation-rating ${ratingClass}">
                <span class="rating-emoji">${ratingEmoji}</span>
                <span class="rating-text">${data.recommendation.rating}</span>
            </div>

            <div class="recommendation-summary">
                ${data.recommendation.one_liner}
            </div>

            <div class="weather-details">
                <div class="weather-detail-item">
                    <i data-lucide="thermometer"></i>
                    <span>${data.weather.temp}°C</span>
                </div>
                <div class="weather-detail-item">
                    <i data-lucide="cloud-rain"></i>
                    <span>${data.weather.precipitation}mm</span>
                </div>
                <div class="weather-detail-item">
                    <i data-lucide="wind"></i>
                    <span>${data.weather.wind} km/h</span>
                </div>
                <div class="weather-detail-item">
                    <i data-lucide="cloud"></i>
                    <span>${data.weather.cloud_cover}%</span>
                </div>
            </div>

            <div class="recommendation-reasons">
                <h5>Why This Rating?</h5>
                ${data.recommendation.why.map(reason => `
                    <div class="reason-item">
                        <i data-lucide="${this.getReasonIcon(ratingClass)}"></i>
                        <span>${reason}</span>
                    </div>
                `).join('')}
            </div>

            ${data.recommendation.alternatives && data.recommendation.alternatives.length > 0 ? `
                <div class="recommendation-alternatives">
                    <h5>Alternative Activities</h5>
                    <div class="alternatives-list">
                        ${data.recommendation.alternatives.map(alt => `
                            <span class="alternative-tag">${alt}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        console.log('Appending recommendation box to panel...');
        recommendationPanel.appendChild(recommendationBox);
        recommendationPanel.classList.add('show');
        console.log('Panel should now be visible');

        // Add close button functionality
        const closeBtn = document.getElementById('close-recommendation');
        closeBtn?.addEventListener('click', () => {
            console.log('Close button clicked');
            recommendationPanel.classList.remove('show');
            setTimeout(() => {
                recommendationPanel.innerHTML = '';
            }, 300);
        });

        // Reinitialize Lucide icons
        this.initLucideIcons();
        console.log('Recommendation display complete');
    }

    private getRatingEmoji(rating: string): string {
        const normalizedRating = rating.toUpperCase().replace(/\s+/g, '_');
        const emojis: { [key: string]: string } = {
            'IDEAL': '✅',
            'MODERATE': '⚠️',
            'NOT_IDEAL': '❌',
            'CAUTION': '⚠️',
            'EXERCISE_CAUTION': '⚠️',
            'NO-GO': '❌',
            'NO_GO': '❌'
        };
        return emojis[normalizedRating] || '📊';
    }

    private getRatingIconName(rating: string): string {
        const normalizedRating = rating.toUpperCase().replace(/\s+/g, '_');
        const icons: { [key: string]: string } = {
            'IDEAL': 'check-circle',
            'MODERATE': 'alert-triangle',
            'NOT_IDEAL': 'x-circle',
            'CAUTION': 'alert-triangle',
            'EXERCISE_CAUTION': 'alert-triangle',
            'NO-GO': 'x-circle',
            'NO_GO': 'x-circle'
        };
        return icons[normalizedRating] || 'info';
    }

    private getReasonIcon(ratingClass: string): string {
        if (ratingClass === 'ideal') {
            return 'check-circle';
        } else if (ratingClass === 'moderate') {
            return 'alert-triangle';
        } else if (ratingClass === 'not-ideal' || ratingClass === 'no-go') {
            return 'x-circle';
        }
        return 'info';
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

        const worldBounds =  L.latLngBounds(L.latLng(-90, -Infinity), L.latLng(90, Infinity));

        this.map = L.map('map', {
            zoomControl: false,
            worldCopyJump: true,

            maxBounds: worldBounds,

            maxBoundsViscosity: 1.0,
        }).setView([40.7128, -74.0060], 5);
        
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
        
        console.log('Map created');

        const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            minZoom: 1.5,
            bounds: worldBounds,
            attribution: '© OpenStreetMap contributors'
        });

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

        L.control.layers(baseMaps, overlayMaps, {
            position: 'topright'
        }).addTo(this.map);

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

        // Keep recommendation box if it exists
        const recommendationBox = document.getElementById('recommendation-box');
        
        if (this.activeWidgets.size === 0) {
            listContainer.innerHTML = '<div class="empty-state">Drag widgets to activate</div>';
            if (recommendationBox) {
                listContainer.insertBefore(recommendationBox, listContainer.firstChild);
            }
            return;
        }

        listContainer.innerHTML = '';
        
        // Add recommendation box back if it exists
        if (recommendationBox) {
            listContainer.appendChild(recommendationBox);
        }

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