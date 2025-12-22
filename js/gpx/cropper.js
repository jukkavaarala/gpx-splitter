/**
 * GPX Cropper
 * Handles cropping GPX tracks to start/finish lines
 */

import { gpxFiles, setBackup, getBackup, clearBackup } from '../state.js';
import { findTrackLaps } from './intersection.js';
import { addGpxFile, removeGpxFile } from './fileManager.js';
import { generateLapColor } from '../utils/colors.js';

/**
 * Crop GPX data based on start and finish lines
 * @param {Object} gpxData - Original GPX data
 * @param {Object} startLine - Start line object
 * @param {Object} finishLine - Finish line object
 * @returns {Object|null} Cropped GPX data or null if no valid tracks
 */
export function cropGpxData(gpxData, startLine, finishLine) {
    const croppedTracks = [];
    let hasValidTracks = false;
    
    gpxData.tracks.forEach((track, trackIndex) => {
        if (track.points.length > 0) {
            const laps = findTrackLaps(track, startLine, finishLine);
            
            // Process each lap as a separate track
            laps.forEach((lap, lapIndex) => {
                // Only include laps that have intersections with at least one line
                if (lap.hasStartLine || lap.hasFinishLine) {
                    const croppedPoints = [];
                    
                    // Add interpolated start point if available
                    if (lap.interpolatedStart) {
                        croppedPoints.push({
                            lat: lap.interpolatedStart.lat,
                            lng: lap.interpolatedStart.lng,
                            elevation: track.points[lap.startIndex]?.elevation || null,
                            time: track.points[lap.startIndex]?.time || null
                        });
                    }
                    
                    // Add the track points between start and end
                    for (let i = lap.startIndex; i <= lap.endIndex; i++) {
                        croppedPoints.push(track.points[i]);
                    }
                    
                    // Add interpolated end point if available
                    if (lap.interpolatedEnd) {
                        croppedPoints.push({
                            lat: lap.interpolatedEnd.lat,
                            lng: lap.interpolatedEnd.lng,
                            elevation: track.points[lap.endIndex]?.elevation || null,
                            time: track.points[lap.endIndex]?.time || null
                        });
                    }
                    
                    if (croppedPoints.length > 1) {
                        let trackName = track.name || `Track ${trackIndex + 1}`;
                        if (laps.length > 1) {
                            trackName += ` (Lap ${lap.lapNumber})`;
                        }
                        
                        croppedTracks.push({
                            name: trackName,
                            segment: track.segment,
                            points: croppedPoints,
                            originalTrackIndex: trackIndex,
                            lapNumber: lap.lapNumber,
                            totalLaps: laps.length
                        });
                        hasValidTracks = true;
                    }
                }
            });
        }
    });
    
    if (!hasValidTracks) {
        return null;
    }
    
    return {
        tracks: croppedTracks,
        routes: [],
        waypoints: []
    };
}

/**
 * Crop all GPX files based on start/finish lines
 * @param {Object} startLine - Start line object
 * @param {Object} finishLine - Finish line object
 * @param {L.Map} map - Leaflet map instance
 * @returns {Object} Result with counts and messages
 */
export function cropAllGpxFiles(startLine, finishLine, map) {
    if (!startLine && !finishLine) {
        return {
            success: false,
            message: 'Please set at least one line (start or finish) before cropping.'
        };
    }
    
    if (gpxFiles.size === 0) {
        return {
            success: false,
            message: 'No GPX files to crop. Please load some GPX files first.'
        };
    }
    
    // Create backup before cropping
    createBackup();
    
    let croppedCount = 0;
    const filesToRemove = [];
    const filesToAdd = [];
    const filesWithoutIntersections = [];
    
    gpxFiles.forEach((file, fileId) => {
        if (file.data.tracks.length > 0) {
            const croppedGpxData = cropGpxData(file.data, startLine, finishLine);
            
            // Always mark the original file for removal
            filesToRemove.push(fileId);
            
            if (croppedGpxData && croppedGpxData.tracks.length > 0) {
                // File has tracks that intersect with lines
                const lapGroups = groupTracksByLap(croppedGpxData.tracks);
                
                // Create a separate file entry for each lap
                lapGroups.forEach((lapMap, originalTrackIndex) => {
                    const totalLapsForTrack = lapMap.size;
                    lapMap.forEach((tracks, lapNumber) => {
                        let fileName = file.fileName;
                        let lapColor = file.color;
                        
                        if (lapGroups.size > 1 || lapMap.size > 1) {
                            const baseFileName = file.fileName.replace(/\.[^/.]+$/, '');
                            const extension = file.fileName.match(/\.[^/.]+$/) || [''];
                            fileName = `${baseFileName} (Lap ${lapNumber})${extension[0]}`;
                            lapColor = generateLapColor(file.color, lapNumber, totalLapsForTrack);
                        }
                        
                        filesToAdd.push({
                            fileName: fileName,
                            gpxData: {
                                tracks: tracks,
                                routes: [],
                                waypoints: []
                            },
                            originalColor: lapColor,
                            wasVisible: file.visible,
                            originalFileId: fileId,
                            lapNumber: lapNumber,
                            originalTrackIndex: originalTrackIndex
                        });
                    });
                });
                
                croppedCount++;
            } else {
                filesWithoutIntersections.push(file.fileName);
            }
        }
    });
    
    // Remove original files
    filesToRemove.forEach(fileId => {
        removeGpxFile(fileId, map);
    });
    
    // Add cropped files
    filesToAdd.forEach(fileData => {
        const newFileId = addGpxFile(fileData.fileName, fileData.gpxData, map, fileData.originalColor);
        if (!fileData.wasVisible) {
            const file = gpxFiles.get(newFileId);
            if (file) {
                file.visible = false;
                file.layers.forEach(layer => map.removeLayer(layer));
            }
        }
    });
    
    return {
        success: true,
        croppedCount,
        lapsCreated: filesToAdd.length,
        filesWithoutIntersections
    };
}

/**
 * Group tracks by original track index and lap number
 * @param {Array} tracks - Array of cropped tracks
 * @returns {Map} Map of track groups
 */
function groupTracksByLap(tracks) {
    const lapGroups = new Map();
    
    tracks.forEach(track => {
        if (!lapGroups.has(track.originalTrackIndex)) {
            lapGroups.set(track.originalTrackIndex, new Map());
        }
        const trackLaps = lapGroups.get(track.originalTrackIndex);
        if (!trackLaps.has(track.lapNumber)) {
            trackLaps.set(track.lapNumber, []);
        }
        trackLaps.get(track.lapNumber).push(track);
    });
    
    return lapGroups;
}

/**
 * Create backup of current GPX files state
 */
function createBackup() {
    const backup = new Map();
    gpxFiles.forEach((file, fileId) => {
        backup.set(fileId, {
            data: JSON.parse(JSON.stringify(file.data)), // Deep copy
            visible: file.visible,
            color: file.color,
            fileName: file.fileName,
            totalPoints: file.totalPoints
        });
    });
    setBackup(backup);
}

/**
 * Restore GPX files from backup
 * @param {L.Map} map - Leaflet map instance
 * @returns {boolean} True if restore was successful
 */
export function undoCrop(map) {
    const backup = getBackup();
    if (!backup) {
        return false;
    }
    
    // Clear current files
    const currentFileIds = Array.from(gpxFiles.keys());
    currentFileIds.forEach(fileId => {
        removeGpxFile(fileId, map);
    });
    
    // Restore from backup
    backup.forEach((file, fileId) => {
        const newFileId = addGpxFile(file.fileName, file.data, map, file.color);
        if (!file.visible) {
            const restoredFile = gpxFiles.get(newFileId);
            if (restoredFile) {
                restoredFile.visible = false;
                restoredFile.layers.forEach(layer => map.removeLayer(layer));
            }
        }
    });
    
    // Clear backup
    clearBackup();
    
    return true;
}

/**
 * Check if backup exists
 * @returns {boolean} True if backup exists
 */
export function hasBackup() {
    return getBackup() !== null;
}
