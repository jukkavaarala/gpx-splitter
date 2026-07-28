/**
 * GPX File Manager
 * Manages GPX file operations (add, remove, toggle, update)
 */

import { gpxFiles, getNextFileId } from '../state.js';
import { generateColor } from '../utils/colors.js';
import { GPX_TRACK_STYLE, GPX_WAYPOINT_STYLE, PLAYBACK_CONFIG } from '../config.js';
import { createSmoothedPlaybackPoints } from '../utils/geometry.js';

/**
 * Create Leaflet layers from GPX data
 * @param {Object} gpxData - Parsed GPX data
 * @param {string} color - Color for the track
 * @param {string} fileName - Name of the file
 * @param {L.Map} map - Leaflet map instance
 * @returns {Object} Object with layers array and total point count
 */
export function createGpxLayers(gpxData, color, fileName, map) {
    const layers = [];
    let totalPoints = 0;
    
    // Create tracks
    gpxData.tracks.forEach((track, index) => {
        const latLngs = track.points.map(point => [point.lat, point.lng]);
        totalPoints += track.points.length;
        
        if (latLngs.length > 0) {
            const polyline = L.polyline(latLngs, {
                ...GPX_TRACK_STYLE,
                color: color
            });
            
            // Add popup with track info
            const popupContent = `
                <div>
                    <h4>${track.name}</h4>
                    <p><strong>File:</strong> ${fileName}</p>
                    <p><strong>Points:</strong> ${track.points.length}</p>
                    <p><strong>Segment:</strong> ${track.segment + 1}</p>
                    ${track.points[0].elevation ? `<p><strong>Start Elevation:</strong> ${track.points[0].elevation}m</p>` : ''}
                </div>
            `;
            polyline.bindPopup(popupContent);
            
            layers.push(polyline);
        }
    });
    
    // Create routes
    gpxData.routes.forEach((route, index) => {
        const latLngs = route.points.map(point => [point.lat, point.lng]);
        totalPoints += route.points.length;
        
        if (latLngs.length > 0) {
            const polyline = L.polyline(latLngs, {
                ...GPX_TRACK_STYLE,
                color: color,
                dashArray: '5, 5'
            });
            
            polyline.bindPopup(`
                <div>
                    <h4>${route.name}</h4>
                    <p><strong>File:</strong> ${fileName}</p>
                    <p><strong>Route Points:</strong> ${route.points.length}</p>
                    <p><em>Route (planned path)</em></p>
                </div>
            `);
            
            layers.push(polyline);
        }
    });
    
    // Create waypoints
    gpxData.waypoints.forEach(waypoint => {
        const marker = L.circleMarker([waypoint.lat, waypoint.lng], {
            ...GPX_WAYPOINT_STYLE,
            fillColor: color
        });
        
        marker.bindPopup(`
            <div>
                <h4>${waypoint.name}</h4>
                <p><strong>File:</strong> ${fileName}</p>
                ${waypoint.description ? `<p>${waypoint.description}</p>` : ''}
                <p><strong>Coordinates:</strong> ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}</p>
            </div>
        `);
        
        layers.push(marker);
        totalPoints++;
    });
    
    return { layers, totalPoints };
}

/**
 * Add GPX file to the application
 * @param {string} fileName - Name of the file
 * @param {Object} gpxData - Parsed GPX data
 * @param {L.Map} map - Leaflet map instance
 * @param {string} color - Optional color override
 * @returns {number} File ID
 */
export function addGpxFile(fileName, gpxData, map, color = null) {
    const fileId = getNextFileId();
    const fileColor = color || generateColor(gpxFiles.size);

    gpxData.tracks.forEach(track => {
        if (!track.playbackPoints) {
            track.playbackPoints = createSmoothedPlaybackPoints(
                track.points,
                PLAYBACK_CONFIG.SMOOTHING_SUBDIVISIONS
            );
        }
    });

    const { layers, totalPoints } = createGpxLayers(gpxData, fileColor, fileName, map);
    
    // Add layers to map
    layers.forEach(layer => layer.addTo(map));
    
    // Store file data
    gpxFiles.set(fileId, {
        data: gpxData,
        layers: layers,
        visible: true,
        color: fileColor,
        fileName: fileName,
        totalPoints: totalPoints
    });
    
    console.log(`Added GPX file: ${fileName} (${totalPoints} points)`);
    return fileId;
}

/**
 * Remove GPX file from the application
 * @param {number} fileId - ID of the file to remove
 * @param {L.Map} map - Leaflet map instance
 */
export function removeGpxFile(fileId, map) {
    const file = gpxFiles.get(fileId);
    if (file) {
        // Remove layers from map
        file.layers.forEach(layer => map.removeLayer(layer));
        
        // Remove from storage
        gpxFiles.delete(fileId);
        console.log(`Removed GPX file with ID: ${fileId}`);
    }
}

/**
 * Toggle GPX file visibility
 * @param {number} fileId - ID of the file to toggle
 * @param {L.Map} map - Leaflet map instance
 * @returns {boolean} New visibility state
 */
export function toggleGpxFileVisibility(fileId, map) {
    const file = gpxFiles.get(fileId);
    if (file) {
        file.visible = !file.visible;
        
        if (file.visible) {
            file.layers.forEach(layer => layer.addTo(map));
        } else {
            file.layers.forEach(layer => map.removeLayer(layer));
        }
        
        console.log(`Toggled GPX file: ${file.fileName} (${file.visible ? 'visible' : 'hidden'})`);
        return file.visible;
    }
    return false;
}

/**
 * Get all visible GPX file bounds
 * @returns {Array} Array of {lat, lng} points for all visible data
 */
export function getVisibleBounds() {
    const bounds = [];
    
    gpxFiles.forEach(file => {
        if (file.visible) {
            // Add track points
            file.data.tracks.forEach(track => {
                track.points.forEach(point => {
                    bounds.push({ lat: point.lat, lng: point.lng });
                });
            });
            
            // Add route points
            file.data.routes.forEach(route => {
                route.points.forEach(point => {
                    bounds.push({ lat: point.lat, lng: point.lng });
                });
            });
            
            // Add waypoints
            file.data.waypoints.forEach(waypoint => {
                bounds.push({ lat: waypoint.lat, lng: waypoint.lng });
            });
        }
    });
    
    return bounds;
}

/**
 * Get GPX file by ID
 * @param {number} fileId - File ID
 * @returns {Object|undefined} File data or undefined
 */
export function getGpxFile(fileId) {
    return gpxFiles.get(fileId);
}

/**
 * Get all GPX files
 * @returns {Map} Map of all GPX files
 */
export function getAllGpxFiles() {
    return gpxFiles;
}

/**
 * Clear all GPX files
 * @param {L.Map} map - Leaflet map instance
 */
export function clearAllGpxFiles(map) {
    gpxFiles.forEach((file, fileId) => {
        removeGpxFile(fileId, map);
    });
}
