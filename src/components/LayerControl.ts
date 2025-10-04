class LayerControl {
    private layers: { [key: string]: boolean };

    constructor() {
        this.layers = {};
    }

    addLayer(layerName: string): void {
        this.layers[layerName] = false; // Layer is initially hidden
    }

    toggleLayer(layerName: string): void {
        if (this.layers.hasOwnProperty(layerName)) {
            this.layers[layerName] = !this.layers[layerName];
        }
    }

    isLayerVisible(layerName: string): boolean {
        return this.layers[layerName] || false;
    }

    getVisibleLayers(): string[] {
        return Object.keys(this.layers).filter(layer => this.layers[layer]);
    }
}

export default LayerControl;