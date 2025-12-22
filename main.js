/**
 * GPX Splitter - Main Entry Point
 * Initializes the application and wires up all modules
 */

import { initializeMap } from './js/map/mapManager.js';
import { LineManager } from './js/map/lineManager.js';
import { initializePanelManager } from './js/ui/panelManager.js';
import { initializeEventHandlers } from './js/events/eventHandlers.js';

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    const map = initializeMap();
    
    // Initialize line manager
    const lineManager = new LineManager(map);
    
    // Create playback layer
    const playbackLayer = L.layerGroup().addTo(map);
    
    // Initialize draggable/resizable panels
    initializePanelManager();
    
    // Initialize all event handlers
    initializeEventHandlers(map, lineManager, playbackLayer);
    
    console.log('GPX Splitter initialized successfully');
});
