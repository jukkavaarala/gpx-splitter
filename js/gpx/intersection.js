/**
 * GPX Track and Line Intersection
 * Functions for finding intersections between tracks and start/finish lines
 */

import { INTERSECTION_THRESHOLD } from '../config.js';
import { distanceToLineSegment, lineSegmentIntersection } from '../utils/geometry.js';

/**
 * Find all intersections between a track and a line
 * @param {Object} track - Track with points array
 * @param {Object} line - Line object with line property
 * @returns {Array} Array of intersection objects
 */
export function findAllLineIntersections(track, line) {
    if (!line || !track.points || track.points.length < 2) {
        return [];
    }

    const lineLatLngs = line.line.getLatLngs();
    const lineStart = lineLatLngs[0];
    const lineEnd = lineLatLngs[1];
    const allIntersections = [];
    
    // Find all points within threshold
    for (let i = 0; i < track.points.length; i++) {
        const point = track.points[i];
        const distance = distanceToLineSegment(point, lineStart, lineEnd);
        
        if (distance < INTERSECTION_THRESHOLD) {
            allIntersections.push({
                pointIndex: i,
                point: point,
                distance: distance
            });
        }
    }
    
    // Group consecutive intersections and return only one per crossing
    return groupConsecutiveIntersections(allIntersections);
}

/**
 * Group consecutive intersection points and return the best one per group
 * @param {Array} allIntersections - Array of all intersection points
 * @returns {Array} Array of grouped intersections
 */
function groupConsecutiveIntersections(allIntersections) {
    const intersections = [];
    let currentGroup = [];
    
    for (let i = 0; i < allIntersections.length; i++) {
        const intersection = allIntersections[i];
        
        if (currentGroup.length === 0 || 
            intersection.pointIndex === currentGroup[currentGroup.length - 1].pointIndex + 1) {
            // This point is consecutive to the current group
            currentGroup.push(intersection);
        } else {
            // Gap found, process the current group and start a new one
            if (currentGroup.length > 0) {
                const bestIntersection = currentGroup.reduce((best, current) => 
                    current.distance < best.distance ? current : best
                );
                intersections.push(bestIntersection);
            }
            currentGroup = [intersection];
        }
    }
    
    // Process the last group
    if (currentGroup.length > 0) {
        const bestIntersection = currentGroup.reduce((best, current) => 
            current.distance < best.distance ? current : best
        );
        intersections.push(bestIntersection);
    }
    
    return intersections;
}

/**
 * Calculate precise intersection point between track and line
 * @param {Object} track - Track with points array
 * @param {Object} line - Line object
 * @param {number} nearestPointIndex - Index of nearest point
 * @returns {Object|null} Intersection point or null
 */
export function calculateLineIntersectionPoint(track, line, nearestPointIndex) {
    if (!line || !track.points || nearestPointIndex >= track.points.length) {
        return null;
    }

    const lineLatLngs = line.line.getLatLngs();
    const lineStart = lineLatLngs[0];
    const lineEnd = lineLatLngs[1];
    
    const point = track.points[nearestPointIndex];
    
    let bestIntersection = { lat: point.lat, lng: point.lng };
    let bestDistance = distanceToLineSegment(point, lineStart, lineEnd);
    
    // Check previous segment
    if (nearestPointIndex > 0) {
        const prevPoint = track.points[nearestPointIndex - 1];
        const intersection = lineSegmentIntersection(
            prevPoint, point,
            lineStart, lineEnd
        );
        if (intersection) {
            const distance = distanceToLineSegment(intersection, lineStart, lineEnd);
            if (distance < bestDistance) {
                bestIntersection = intersection;
                bestDistance = distance;
            }
        }
    }
    
    // Check next segment
    if (nearestPointIndex < track.points.length - 1) {
        const nextPoint = track.points[nearestPointIndex + 1];
        const intersection = lineSegmentIntersection(
            point, nextPoint,
            lineStart, lineEnd
        );
        if (intersection) {
            const distance = distanceToLineSegment(intersection, lineStart, lineEnd);
            if (distance < bestDistance) {
                bestIntersection = intersection;
                bestDistance = distance;
            }
        }
    }
    
    return bestIntersection;
}

/**
 * Find all laps in a track based on start and finish lines
 * @param {Object} track - Track with points array
 * @param {Object} startLine - Start line object
 * @param {Object} finishLine - Finish line object
 * @returns {Array} Array of lap objects
 */
export function findTrackLaps(track, startLine, finishLine) {
    const startIntersections = startLine ? findAllLineIntersections(track, startLine) : [];
    const finishIntersections = finishLine ? findAllLineIntersections(track, finishLine) : [];
    
    console.log(`Track analysis: Found ${startIntersections.length} start intersections and ${finishIntersections.length} finish intersections`);
    
    const laps = [];
    
    if (startIntersections.length > 0 && finishIntersections.length > 0) {
        // Create laps by sequencing start->finish->start->finish...
        laps.push(...createStartFinishLaps(track, startLine, finishLine, startIntersections, finishIntersections));
    } else if (startIntersections.length > 0) {
        // Only start line exists
        laps.push(...createStartOnlyLaps(track, startLine, startIntersections));
    } else if (finishIntersections.length > 0) {
        // Only finish line exists
        laps.push(...createFinishOnlyLaps(track, finishLine, finishIntersections));
    }
    
    // If no intersections found, return single segment
    if (laps.length === 0) {
        laps.push({
            startIndex: 0,
            endIndex: track.points.length - 1,
            hasStartLine: false,
            hasFinishLine: false,
            totalPoints: track.points.length,
            interpolatedStart: null,
            interpolatedEnd: null,
            lapNumber: 1
        });
    }
    
    return laps;
}

/**
 * Create laps when both start and finish lines exist
 */
function createStartFinishLaps(track, startLine, finishLine, startIntersections, finishIntersections) {
    const laps = [];
    let lapNumber = 1;
    let lastFinishIndex = -1;
    
    for (let i = 0; i < startIntersections.length; i++) {
        const startPoint = startIntersections[i];
        
        if (startPoint.pointIndex > lastFinishIndex) {
            const finishPoint = finishIntersections.find(f => f.pointIndex > startPoint.pointIndex);
            
            if (finishPoint) {
                const interpolatedStart = calculateLineIntersectionPoint(track, startLine, startPoint.pointIndex);
                const interpolatedEnd = calculateLineIntersectionPoint(track, finishLine, finishPoint.pointIndex);
                
                laps.push({
                    startIndex: startPoint.pointIndex,
                    endIndex: finishPoint.pointIndex,
                    hasStartLine: true,
                    hasFinishLine: true,
                    totalPoints: finishPoint.pointIndex - startPoint.pointIndex + 1,
                    interpolatedStart,
                    interpolatedEnd,
                    lapNumber: lapNumber++
                });
                
                lastFinishIndex = finishPoint.pointIndex;
            }
        }
    }
    
    return laps;
}

/**
 * Create laps when only start line exists
 */
function createStartOnlyLaps(track, startLine, startIntersections) {
    const laps = [];
    
    for (let i = 0; i < startIntersections.length; i++) {
        const startPoint = startIntersections[i];
        const nextStartPoint = startIntersections[i + 1];
        const endIndex = nextStartPoint ? nextStartPoint.pointIndex : track.points.length - 1;
        
        const interpolatedStart = calculateLineIntersectionPoint(track, startLine, startPoint.pointIndex);
        
        laps.push({
            startIndex: startPoint.pointIndex,
            endIndex: endIndex,
            hasStartLine: true,
            hasFinishLine: false,
            totalPoints: endIndex - startPoint.pointIndex + 1,
            interpolatedStart,
            interpolatedEnd: null,
            lapNumber: i + 1
        });
    }
    
    return laps;
}

/**
 * Create laps when only finish line exists
 */
function createFinishOnlyLaps(track, finishLine, finishIntersections) {
    const laps = [];
    
    for (let i = 0; i < finishIntersections.length; i++) {
        const finishPoint = finishIntersections[i];
        const prevFinishPoint = finishIntersections[i - 1];
        const startIndex = prevFinishPoint ? prevFinishPoint.pointIndex : 0;
        
        const interpolatedEnd = calculateLineIntersectionPoint(track, finishLine, finishPoint.pointIndex);
        
        laps.push({
            startIndex: startIndex,
            endIndex: finishPoint.pointIndex,
            hasStartLine: false,
            hasFinishLine: true,
            totalPoints: finishPoint.pointIndex - startIndex + 1,
            interpolatedStart: null,
            interpolatedEnd,
            lapNumber: i + 1
        });
    }
    
    return laps;
}
