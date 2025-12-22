/**
 * Track Analyzer
 * Calculates time differences and statistics between tracks
 */

import { gpxFiles, getBaselineSelection } from '../state.js';
import { findTrackLaps } from '../gpx/intersection.js';
import { calculateCumulativeDistances, calculateHaversineDistance } from '../utils/geometry.js';
import { PLAYBACK_CONFIG } from '../config.js';

/**
 * Calculate track analysis comparing visible tracks to a baseline
 * @param {Object} startLine - Start line object
 * @param {Object} finishLine - Finish line object
 * @returns {Object} Analysis result or error
 */
export function calculateTrackAnalysis(startLine, finishLine) {
    const visibleTracks = getVisibleTracks(startLine, finishLine);
    
    if (visibleTracks.length < 2) {
        return {
            success: false,
            message: 'Need at least 2 visible tracks for analysis'
        };
    }
    
    // Find the baseline track
    const { baselineTrack, baselineIndex } = findBaselineTrack(visibleTracks);
    
    // Get comparison tracks
    const comparisonTracks = visibleTracks.filter((_, index) => index !== baselineIndex);
    
    // Calculate cumulative distances for baseline
    const baselineDistances = calculateCumulativeDistances(baselineTrack.points);
    
    // Analyze each comparison track
    const analysisResults = comparisonTracks.map(track => {
        const trackDistances = calculateCumulativeDistances(track.points);
        const timeDifferences = calculateTimeDifferences(
            baselineTrack, track, baselineDistances, trackDistances
        );
        
        return {
            fileName: track.fileName,
            color: track.color,
            distances: trackDistances,
            timeDifferences: timeDifferences,
            stats: calculateTrackStats(timeDifferences),
            fileId: track.fileId,
            trackIndex: track.trackIndex,
            lapNumber: track.lapNumber,
            points: track.points
        };
    });
    
    return {
        success: true,
        baseline: {
            fileName: baselineTrack.fileName,
            color: baselineTrack.color,
            distances: baselineDistances,
            fileId: baselineTrack.fileId,
            trackIndex: baselineTrack.trackIndex,
            lapNumber: baselineTrack.lapNumber,
            points: baselineTrack.points
        },
        comparisons: analysisResults
    };
}

/**
 * Get all visible tracks with lap information
 */
function getVisibleTracks(startLine, finishLine) {
    const visibleTracks = [];
    
    gpxFiles.forEach((file, fileId) => {
        if (file.visible && file.data.tracks.length > 0) {
            file.data.tracks.forEach((track, trackIndex) => {
                if (track.points.length > 0) {
                    const lapMatch = file.fileName.match(/^(.+) \(Lap (\d+)\)(.*)$/);
                    
                    if (lapMatch) {
                        // Standalone lap file
                        visibleTracks.push({
                            fileId: fileId,
                            fileName: file.fileName,
                            trackIndex: trackIndex,
                            lapNumber: parseInt(lapMatch[2]),
                            points: track.points,
                            color: file.color
                        });
                    } else {
                        // Original file - check for laps
                        const laps = findTrackLaps(track, startLine, finishLine);
                        
                        laps.forEach((lap) => {
                            const trackPoints = [];
                            for (let i = lap.startIndex; i <= lap.endIndex; i++) {
                                if (track.points[i]) {
                                    trackPoints.push({
                                        ...track.points[i],
                                        originalIndex: i
                                    });
                                }
                            }
                            
                            if (trackPoints.length > 1) {
                                let trackName = file.fileName;
                                if (laps.length > 1) {
                                    const baseFileName = file.fileName.replace(/\.[^/.]+$/, '');
                                    const extension = file.fileName.match(/\.[^/.]+$/) || [''];
                                    trackName = `${baseFileName} (Lap ${lap.lapNumber})${extension[0]}`;
                                }
                                
                                visibleTracks.push({
                                    fileId: fileId,
                                    fileName: trackName,
                                    trackIndex: trackIndex,
                                    lapNumber: lap.lapNumber || 1,
                                    points: trackPoints,
                                    color: file.color,
                                    segment: lap
                                });
                            }
                        });
                    }
                }
            });
        }
    });
    
    return visibleTracks;
}

/**
 * Find the baseline track based on selection or use first track
 */
function findBaselineTrack(visibleTracks) {
    const baseline = getBaselineSelection();
    let baselineTrack = null;
    let baselineIndex = -1;
    
    if (baseline.fileId !== null) {
        for (let i = 0; i < visibleTracks.length; i++) {
            const track = visibleTracks[i];
            
            if (track.fileId === baseline.fileId) {
                const lapMatches = (baseline.lapNumber === null && track.lapNumber === undefined) ||
                                 (baseline.lapNumber !== null && track.lapNumber === baseline.lapNumber);
                
                if (lapMatches) {
                    baselineTrack = track;
                    baselineIndex = i;
                    break;
                }
            }
        }
    }
    
    // If no baseline selected or not visible, use first track
    if (!baselineTrack) {
        baselineTrack = visibleTracks[0];
        baselineIndex = 0;
    }
    
    return { baselineTrack, baselineIndex };
}

/**
 * Calculate time differences between baseline and comparison track
 */
function calculateTimeDifferences(baselineTrack, comparisonTrack, baselineDistances, comparisonDistances) {
    const differences = [];
    const maxDistance = Math.min(
        baselineDistances[baselineDistances.length - 1],
        comparisonDistances[comparisonDistances.length - 1]
    );
    
    const sampleInterval = maxDistance / PLAYBACK_CONFIG.SAMPLE_POINTS;
    let initialTimeDifference = null;
    
    for (let dist = 0; dist <= maxDistance; dist += sampleInterval) {
        const baselineTime = interpolateTimeAtDistance(baselineTrack.points, baselineDistances, dist);
        const comparisonTime = interpolateTimeAtDistance(comparisonTrack.points, comparisonDistances, dist);
        
        if (baselineTime !== null && comparisonTime !== null) {
            const timeDiff = (comparisonTime - baselineTime) / 1000; // Convert to seconds
            
            if (initialTimeDifference === null) {
                initialTimeDifference = timeDiff;
            }
            
            // Normalize so it starts at 0
            const normalizedTimeDiff = timeDiff - initialTimeDifference;
            
            differences.push({
                distance: dist,
                timeDifference: normalizedTimeDiff
            });
        }
    }
    
    return differences;
}

/**
 * Interpolate time at a specific distance
 */
function interpolateTimeAtDistance(points, distances, targetDistance) {
    if (targetDistance <= 0) {
        return points[0].time ? new Date(points[0].time).getTime() : null;
    }
    
    for (let i = 1; i < distances.length; i++) {
        if (distances[i] >= targetDistance) {
            const t = (targetDistance - distances[i-1]) / (distances[i] - distances[i-1]);
            
            const time1 = points[i-1].time ? new Date(points[i-1].time).getTime() : null;
            const time2 = points[i].time ? new Date(points[i].time).getTime() : null;
            
            if (time1 !== null && time2 !== null) {
                return time1 + t * (time2 - time1);
            }
        }
    }
    
    const lastPoint = points[points.length - 1];
    return lastPoint.time ? new Date(lastPoint.time).getTime() : null;
}

/**
 * Calculate statistics from time differences
 */
function calculateTrackStats(timeDifferences) {
    if (timeDifferences.length === 0) return null;
    
    const times = timeDifferences.map(d => d.timeDifference);
    const avgDiff = times.reduce((a, b) => a + b, 0) / times.length;
    const maxDiff = Math.max(...times);
    const minDiff = Math.min(...times);
    
    return {
        average: avgDiff,
        maximum: maxDiff,
        minimum: minDiff,
        finalDifference: times[times.length - 1]
    };
}
