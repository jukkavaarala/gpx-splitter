/**
 * GPX Splitter - Main Entry Point
 * Initializes the application and wires up all modules
 */

import { MapManager } from './js/map/mapManager.js';
import { LineManager } from './js/map/lineManager.js';
import { initializePanelDragAndResize } from './js/ui/panelManager.js';
import { initializeEventHandlers } from './js/events/eventHandlers.js';

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    const mapManager = new MapManager();
    const map = mapManager.initialize();
    
    // Initialize line manager with the lines group from map manager
    const lineManager = new LineManager(map, mapManager.getLinesGroup());
    
    // Get playback layer from map manager
    const playbackLayer = mapManager.getPlaybackLayer();
    
    // Initialize draggable/resizable panels
    initializePanelDragAndResize();
    
    // Initialize all event handlers
    initializeEventHandlers(map, lineManager, playbackLayer);
    
    console.log('GPX Splitter initialized successfully');
});
