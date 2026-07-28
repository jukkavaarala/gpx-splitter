/**
 * GPX Parser
 * Functions for parsing GPX files
 */

import { PLAYBACK_CONFIG } from '../config.js';
import { createSmoothedPlaybackPoints } from '../utils/geometry.js';

/**
 * Parse GPX file content
 * @param {string} gpxContent - GPX file content as string
 * @returns {Object} Parsed GPX data with tracks, routes, and waypoints
 */
export function parseGPX(gpxContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, "text/xml");
    
    const tracks = parseTracks(xmlDoc);
    tracks.forEach(track => {
        track.playbackPoints = createSmoothedPlaybackPoints(
            track.points,
            PLAYBACK_CONFIG.SMOOTHING_SUBDIVISIONS
        );
    });
    const routes = parseRoutes(xmlDoc);
    const waypoints = parseWaypoints(xmlDoc);
    
    return { tracks, routes, waypoints };
}

/**
 * Parse tracks from GPX XML document
 * @param {XMLDocument} xmlDoc - Parsed XML document
 * @returns {Array} Array of track objects
 */
function parseTracks(xmlDoc) {
    const tracks = [];
    const trkElements = xmlDoc.getElementsByTagName('trk');
    
    for (let i = 0; i < trkElements.length; i++) {
        const track = trkElements[i];
        const trackName = track.getElementsByTagName('name')[0]?.textContent || `Track ${i + 1}`;
        const segments = track.getElementsByTagName('trkseg');
        
        for (let j = 0; j < segments.length; j++) {
            const segment = segments[j];
            const points = segment.getElementsByTagName('trkpt');
            const trackPoints = [];
            
            for (let k = 0; k < points.length; k++) {
                const point = points[k];
                const lat = parseFloat(point.getAttribute('lat'));
                const lng = parseFloat(point.getAttribute('lon'));
                const ele = point.getElementsByTagName('ele')[0]?.textContent;
                const time = point.getElementsByTagName('time')[0]?.textContent;
                
                trackPoints.push({
                    lat: lat,
                    lng: lng,
                    elevation: ele ? parseFloat(ele) : null,
                    time: time
                });
            }
            
            if (trackPoints.length > 0) {
                tracks.push({
                    name: trackName,
                    segment: j,
                    points: trackPoints
                });
            }
        }
    }
    
    return tracks;
}

/**
 * Parse routes from GPX XML document
 * @param {XMLDocument} xmlDoc - Parsed XML document
 * @returns {Array} Array of route objects
 */
function parseRoutes(xmlDoc) {
    const routes = [];
    const rteElements = xmlDoc.getElementsByTagName('rte');
    
    for (let i = 0; i < rteElements.length; i++) {
        const route = rteElements[i];
        const routeName = route.getElementsByTagName('name')[0]?.textContent || `Route ${i + 1}`;
        const points = route.getElementsByTagName('rtept');
        const routePoints = [];
        
        for (let j = 0; j < points.length; j++) {
            const point = points[j];
            const lat = parseFloat(point.getAttribute('lat'));
            const lng = parseFloat(point.getAttribute('lon'));
            
            routePoints.push({ lat: lat, lng: lng });
        }
        
        if (routePoints.length > 0) {
            routes.push({
                name: routeName,
                points: routePoints
            });
        }
    }
    
    return routes;
}

/**
 * Parse waypoints from GPX XML document
 * @param {XMLDocument} xmlDoc - Parsed XML document
 * @returns {Array} Array of waypoint objects
 */
function parseWaypoints(xmlDoc) {
    const waypoints = [];
    const wptElements = xmlDoc.getElementsByTagName('wpt');
    
    for (let i = 0; i < wptElements.length; i++) {
        const waypoint = wptElements[i];
        const lat = parseFloat(waypoint.getAttribute('lat'));
        const lng = parseFloat(waypoint.getAttribute('lon'));
        const name = waypoint.getElementsByTagName('name')[0]?.textContent || `Waypoint ${i + 1}`;
        const desc = waypoint.getElementsByTagName('desc')[0]?.textContent || '';
        
        waypoints.push({
            lat: lat,
            lng: lng,
            name: name,
            description: desc
        });
    }
    
    return waypoints;
}
