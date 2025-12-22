/**
 * Map Manager
 * Handles map initialization and control setup
 */

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../config.js';

export class MapManager {
    constructor() {
        this.map = null;
        this.linesGroup = null;
        this.playbackLayer = null;
    }

    /**
     * Initialize the Leaflet map
     * @returns {L.Map} Initialized Leaflet map
     */
    initialize() {
        // Initialize the map
        this.map = L.map('map', {
            center: DEFAULT_MAP_CENTER,
            zoom: DEFAULT_MAP_ZOOM,
            zoomControl: false,
            attributionControl: true
        });

        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
        }).addTo(this.map);

        // Add satellite imagery option
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 18,
        });

        // Layer control
        const baseMaps = {
            "Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }),
            "Satellite": satelliteLayer
        };

        // Add controls
        this.addControls(baseMaps);

        // Add scale control
        L.control.scale({
            position: 'bottomright',
            metric: true,
            imperial: false
        }).addTo(this.map);

        // Create layer groups
        this.linesGroup = L.layerGroup().addTo(this.map);
        this.playbackLayer = L.layerGroup().addTo(this.map);

        return this.map;
    }

    /**
     * Add map controls (zoom, layer selector)
     */
    addControls(baseMaps) {
        const zoomControl = L.control.zoom({
            position: 'topright'
        }).addTo(this.map);

        const layerControl = L.control.layers(baseMaps, null, {
            position: 'topright'
        }).addTo(this.map);

        // Position controls side-by-side
        setTimeout(() => {
            const zoomElement = zoomControl.getContainer();
            const layerElement = layerControl.getContainer();
            
            if (zoomElement && layerElement) {
                zoomElement.style.marginRight = '10px';
                layerElement.style.clear = 'none';
                layerElement.style.marginTop = '0';
                
                const controlsContainer = document.createElement('div');
                controlsContainer.style.display = 'flex';
                controlsContainer.style.alignItems = 'flex-start';
                controlsContainer.style.gap = '10px';
                controlsContainer.style.position = 'absolute';
                controlsContainer.style.top = '10px';
                controlsContainer.style.right = '10px';
                controlsContainer.style.zIndex = '1000';
                
                const mapContainer = this.map.getContainer();
                mapContainer.appendChild(controlsContainer);
                controlsContainer.appendChild(layerElement);
                controlsContainer.appendChild(zoomElement);
            }
        }, 100);
    }

    /**
     * Fit map bounds to show all visible GPX data
     * @param {Array} visibleBounds - Array of {lat, lng} points
     */
    fitBounds(visibleBounds) {
        if (visibleBounds.length === 0) return;

        const bounds = L.latLngBounds(visibleBounds);
        this.map.fitBounds(bounds, { padding: [20, 20] });
    }

    /**
     * Get the map instance
     */
    getMap() {
        return this.map;
    }

    /**
     * Get the lines layer group
     */
    getLinesGroup() {
        return this.linesGroup;
    }

    /**
     * Get the playback layer group
     */
    getPlaybackLayer() {
        return this.playbackLayer;
    }
}
