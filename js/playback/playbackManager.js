/**
 * Playback Manager
 * Manages track playback animation and state
 */

import { playbackState, gpxFiles } from '../state.js';
import { findTrackLaps } from '../gpx/intersection.js';
import { calculateCumulativeDistances } from '../utils/geometry.js';
import { PLAYBACK_CONFIG } from '../config.js';

/**
 * Prepare tracks for simultaneous playback
 * @param {Object} startLine - Start line object
 * @param {Object} finishLine - Finish line object
 * @returns {Object} Object with tracks array and maxPoints
 */
export function prepareTracksForPlayback(startLine, finishLine) {
    const tracks = [];
    let maxPoints = 0;
    
    gpxFiles.forEach((file, fileId) => {
        if (file.visible && file.data.tracks.length > 0) {
            file.data.tracks.forEach((track, trackIndex) => {
                if (track.points.length > 0) {
                    const smoothedPoints = track.playbackPoints || track.points;
                    const smoothingFactor = track.points.length > 1 ?
                        (smoothedPoints.length - 1) / (track.points.length - 1) : 1;
                    const playbackPoints = playbackState.smoothInterpolation ? smoothedPoints : track.points;
                    const laps = findTrackLaps(track, startLine, finishLine);
                    
                    laps.forEach((lap, lapIndex) => {
                        let trackDisplayName = file.fileName;
                        if (laps.length > 1) {
                            trackDisplayName = `${file.fileName} (Lap ${lap.lapNumber})`;
                        }
                        
                        const startIndex = playbackState.smoothInterpolation ?
                            Math.round(lap.startIndex * smoothingFactor) : lap.startIndex;
                        const endIndex = playbackState.smoothInterpolation ?
                            Math.round(lap.endIndex * smoothingFactor) : lap.endIndex;
                        const trackData = {
                            fileId: fileId,
                            fileName: file.fileName,
                            trackName: trackDisplayName,
                            trackIndex: trackIndex,
                            color: file.color,
                            points: playbackPoints,
                            sourcePointCount: track.points.length,
                            playbackPointCount: playbackPoints.length,
                            startIndex: startIndex,
                            endIndex: endIndex,
                            currentPointIndex: startIndex,
                            segmentPoints: endIndex - startIndex + 1,
                            hasStartLine: lap.hasStartLine,
                            hasFinishLine: lap.hasFinishLine,
                            interpolatedStart: lap.interpolatedStart,
                            interpolatedEnd: lap.interpolatedEnd,
                            lapNumber: lap.lapNumber,
                            isComplete: false,
                            marker: null,
                            startTime: null,
                            trackStartTime: null,
                            pausedTime: 0,
                            usingInterpolatedStart: false,
                            currentPosition: null,
                            targetPosition: null,
                            interpolationProgress: 0
                        };
                        
                        // Set track start time if available
                        if (playbackPoints[startIndex]?.time) {
                            trackData.trackStartTime = new Date(playbackPoints[startIndex].time).getTime();
                        }
                        
                        tracks.push(trackData);
                        maxPoints = Math.max(maxPoints, lap.totalPoints);
                    });
                }
            });
        }
    });
    
    return { tracks, maxPoints };
}

/**
 * Update track position during playback
 * @param {Object} track - Track object
 * @returns {Object} Current position {lat, lng}
 */
export function updateTrackPosition(track) {
    const currentPoint = track.points[track.currentPointIndex];
    if (!currentPoint) return null;
    if (track.usingInterpolatedStart && track.interpolatedStart) {
        return track.interpolatedStart;
    }
    return { lat: currentPoint.lat, lng: currentPoint.lng };
}

/**
 * Calculate playback progress percentage
 * @returns {number} Progress percentage (0-100)
 */
export function calculatePlaybackProgress() {
    if (playbackState.tracks.length === 0) return 0;
    
    let maxProgress = 0;
    let totalSegmentPoints = 0;
    let currentSegmentPoints = 0;
    
    playbackState.tracks.forEach(track => {
        const file = gpxFiles.get(track.fileId);
        if (file && file.visible) {
            const segmentProgress = track.segmentPoints > 0 ? 
                (track.currentPointIndex - track.startIndex) / (track.endIndex - track.startIndex) : 0;
            maxProgress = Math.max(maxProgress, segmentProgress);
            
            totalSegmentPoints += track.segmentPoints;
            currentSegmentPoints += Math.max(0, track.currentPointIndex - track.startIndex);
        }
    });
    
    return maxProgress * 100;
}

/**
 * Seek playback to specific distance
 * @param {number} targetDistance - Target distance in meters
 */
export function seekPlaybackToDistance(targetDistance) {
    playbackState.tracks.forEach(track => {
        if (track.points.length === 0) return;
        
        // Calculate cumulative distances for this track
        const distances = calculateCumulativeDistances(
            track.points.slice(track.startIndex, track.endIndex + 1)
        );
        
        // Find the point index closest to target distance
        let closestIndex = 0;
        let minDiff = Math.abs(distances[0] - targetDistance);
        
        for (let i = 1; i < distances.length; i++) {
            const diff = Math.abs(distances[i] - targetDistance);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        // Update track position
        track.currentPointIndex = track.startIndex + closestIndex;
        track.isComplete = track.currentPointIndex >= track.endIndex;
        
        // Reset timing when seeking
        track.startTime = null;
        track.trackStartTime = null;
        track.pausedTime = 0;
        track.usingInterpolatedStart = false;
        track.currentPosition = null;
        track.targetPosition = null;
        track.interpolationProgress = 0;
    });
}

/**
 * Seek playback to specific percentage
 * @param {number} percent - Progress percentage (0-100)
 */
export function seekToPosition(percent) {
    playbackState.tracks.forEach(track => {
        const segmentLength = track.endIndex - track.startIndex;
        const targetOffset = Math.floor((percent / 100) * segmentLength);
        const targetIndex = track.startIndex + targetOffset;
        
        track.currentPointIndex = Math.max(track.startIndex, Math.min(targetIndex, track.endIndex));
        track.isComplete = track.currentPointIndex >= track.endIndex;
        
        // Reset timing when seeking
        track.startTime = null;
        track.trackStartTime = null;
        track.pausedTime = 0;
        track.usingInterpolatedStart = false;
        track.currentPosition = null;
        track.targetPosition = null;
        track.interpolationProgress = 0;
        
        // Handle interpolated start position
        if (percent === 0 && track.interpolatedStart && track.hasStartLine) {
            track.usingInterpolatedStart = true;
        }
    });
}

/**
 * Reset playback to beginning
 */
export function resetPlayback() {
    playbackState.tracks.forEach(track => {
        track.currentPointIndex = track.startIndex;
        track.isComplete = false;
        track.marker = null;
        track.startTime = null;
        track.trackStartTime = null;
        track.pausedTime = 0;
        track.usingInterpolatedStart = false;
        track.currentPosition = null;
        track.targetPosition = null;
        track.interpolationProgress = 0;
    });
}

/**
 * Check if playback has timing data
 * @returns {boolean} True if tracks have timing data
 */
export function hasTimingData() {
    return playbackState.tracks.some(track => 
        track.points[track.startIndex]?.time && track.points[track.endIndex]?.time
    );
}

/**
 * Get playback status message
 * @param {Object} startLine - Start line object
 * @param {Object} finishLine - Finish line object
 * @returns {string} Status message
 */
export function getPlaybackStatusMessage(startLine, finishLine) {
    let message = `Playing ${playbackState.tracks.length} track${playbackState.tracks.length !== 1 ? 's' : ''} simultaneously`;
    
    if (startLine || finishLine) {
        let lineInfo = [];
        if (startLine) lineInfo.push('start line');
        if (finishLine) lineInfo.push('finish line');
        message += ` + ${lineInfo.join(' and ')}`;
    }
    
    if (hasTimingData()) {
        message += ' (realtime timing)';
    } else {
        message += ' (no timing data - using intervals)';
    }
    
    return message;
}
