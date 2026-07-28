/**
 * Geometry Utilities
 * Functions for geometric calculations and distance measurements
 */

import { EARTH_RADIUS_KM, EARTH_RADIUS_M } from '../config.js';

/**
 * Calculate distance from a point to a line segment
 * @param {Object} point - Point with lng and lat properties
 * @param {Object} line1 - First point of line segment
 * @param {Object} line2 - Second point of line segment
 * @returns {number} Distance to line segment
 */
export function distanceToLineSegment(point, line1, line2) {
    const A = point.lng - line1.lng;
    const B = point.lat - line1.lat;
    const C = line2.lng - line1.lng;
    const D = line2.lat - line1.lat;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = line1.lng;
        yy = line1.lat;
    } else if (param > 1) {
        xx = line2.lng;
        yy = line2.lat;
    } else {
        xx = line1.lng + param * C;
        yy = line1.lat + param * D;
    }

    const dx = point.lng - xx;
    const dy = point.lat - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find intersection between two line segments
 * @param {Object} p1 - First point of first segment
 * @param {Object} p2 - Second point of first segment
 * @param {Object} p3 - First point of second segment
 * @param {Object} p4 - Second point of second segment
 * @returns {Object|null} Intersection point or null if no intersection
 */
export function lineSegmentIntersection(p1, p2, p3, p4) {
    const x1 = p1.lng, y1 = p1.lat;
    const x2 = p2.lng, y2 = p2.lat;
    const x3 = p3.lng, y3 = p3.lat;
    const x4 = p4.lng, y4 = p4.lat;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // Lines are parallel
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            lat: y1 + t * (y2 - y1),
            lng: x1 + t * (x2 - x1)
        };
    }
    
    return null;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return EARTH_RADIUS_M * c;
}

/**
 * Calculate total track distance
 * @param {Array} points - Array of track points with lat/lng
 * @returns {number} Total distance in kilometers
 */
export function calculateTrackDistance(points) {
    if (!points || points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        const dLat = (curr.lat - prev.lat) * Math.PI / 180;
        const dLng = (curr.lng - prev.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistance += EARTH_RADIUS_KM * c;
    }
    
    return totalDistance;
}

/**
 * Calculate cumulative distances along a track
 * @param {Array} points - Array of track points
 * @returns {Array} Array of cumulative distances
 */
export function calculateCumulativeDistances(points) {
    const distances = [0];
    let totalDistance = 0;
    
    for (let i = 1; i < points.length; i++) {
        const dist = calculateHaversineDistance(
            points[i-1].lat, points[i-1].lng,
            points[i].lat, points[i].lng
        );
        totalDistance += dist;
        distances.push(totalDistance);
    }
    
    return distances;
}

/**
 * Interpolate position between two geographic points
 * @param {Object} pos1 - First position with lat/lng
 * @param {Object} pos2 - Second position with lat/lng
 * @param {number} progress - Progress value between 0 and 1
 * @returns {Object} Interpolated position
 */
export function interpolatePosition(pos1, pos2, progress) {
    if (!pos1 || !pos2) return pos1 || pos2;
    
    return {
        lat: pos1.lat + (pos2.lat - pos1.lat) * progress,
        lng: pos1.lng + (pos2.lng - pos1.lng) * progress
    };
}

/**
 * Generate a smoothed playback path using Catmull-Rom interpolation.
 * Source points are retained at segment boundaries and generated points
 * receive timestamps distributed between the surrounding source points.
 * @param {Array} points - Original GPS points
 * @param {number} subdivisions - Number of playback intervals per segment
 * @returns {Array} Precomputed playback points
 */
export function createSmoothedPlaybackPoints(points, subdivisions = 4) {
    if (points.length < 3 || subdivisions < 2) {
        return points.map(point => ({ ...point }));
    }

    const smoothedPoints = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let step = 0; step < subdivisions; step++) {
            const t = step / subdivisions;
            const t2 = t * t;
            const t3 = t2 * t;
            const lat = 0.5 * (
                2 * p1.lat +
                (-p0.lat + p2.lat) * t +
                (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
                (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3
            );
            const lng = 0.5 * (
                2 * p1.lng +
                (-p0.lng + p2.lng) * t +
                (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2 +
                (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3
            );

            const point = {
                lat,
                lng,
                elevation: p1.elevation,
                time: interpolatePointTime(p1.time, p2.time, t)
            };

            if (step === 0) {
                Object.assign(point, p1);
            }
            smoothedPoints.push(point);
        }
    }

    smoothedPoints.push({ ...points[points.length - 1] });
    return smoothedPoints;
}

function interpolatePointTime(startTime, endTime, progress) {
    if (!startTime || !endTime) return startTime || endTime || null;

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return startTime;

    return new Date(start + (end - start) * progress).toISOString();
}
