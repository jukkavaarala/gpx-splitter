/**
 * File Information Modal
 * Displays detailed information about GPX files and laps
 */

import { gpxFiles } from '../state.js';
import { calculateTrackDistance } from '../utils/geometry.js';
import { formatDistance, formatDuration, calculateTrackDuration } from '../utils/formatters.js';
import { findTrackLaps } from '../gpx/intersection.js';

/**
 * Show information modal for a GPX file or lap
 * @param {number} fileId - File ID
 * @param {number|null} lapNumber - Lap number (null for entire file)
 * @param {Object} startLine - Start line object
 * @param {Object} finishLine - Finish line object
 */
export function showFileInfo(fileId, lapNumber, startLine, finishLine) {
    const file = gpxFiles.get(fileId);
    if (!file) {
        alert('File not found');
        return;
    }
    
    let trackData;
    let displayName;
    
    if (lapNumber !== null) {
        // Check if this is a standalone lap file
        const lapMatch = file.fileName.match(/^(.+) \(Lap (\d+)\)(.*)$/);
        if (lapMatch) {
            // Use all data from lap file
            const allPoints = [];
            file.data.tracks.forEach(track => {
                allPoints.push(...track.points);
            });
            trackData = { points: allPoints };
            displayName = file.fileName;
        } else {
            // Find specific lap within track
            const track = file.data.tracks[0];
            if (track) {
                const laps = findTrackLaps(track, startLine, finishLine);
                const lap = laps.find(l => l.lapNumber === lapNumber);
                if (lap) {
                    const lapPoints = track.points.slice(lap.startIndex, lap.endIndex + 1);
                    trackData = { points: lapPoints };
                    displayName = `${file.fileName} - Lap ${lapNumber}`;
                }
            }
        }
    } else {
        // Use all tracks from the file
        const allPoints = [];
        file.data.tracks.forEach(track => {
            allPoints.push(...track.points);
        });
        trackData = { points: allPoints };
        displayName = file.fileName;
    }
    
    if (!trackData || !trackData.points.length) {
        alert('No track data available');
        return;
    }
    
    // Calculate statistics
    const distance = calculateTrackDistance(trackData.points);
    const duration = calculateTrackDuration(trackData.points);
    const pointCount = trackData.points.length;
    
    const startTime = trackData.points[0].time ? 
        new Date(trackData.points[0].time).toLocaleString() : 'N/A';
    const endTime = trackData.points[trackData.points.length - 1].time ? 
        new Date(trackData.points[trackData.points.length - 1].time).toLocaleString() : 'N/A';
    
    // Calculate elevation info
    const elevationData = trackData.points
        .filter(p => p.elevation !== null)
        .map(p => p.elevation);
    
    let elevationInfo = '';
    if (elevationData.length > 0) {
        const minElevation = Math.min(...elevationData);
        const maxElevation = Math.max(...elevationData);
        const elevationGain = maxElevation - minElevation;
        elevationInfo = `
            <p><strong>Elevation:</strong> ${minElevation.toFixed(0)}m - ${maxElevation.toFixed(0)}m (${elevationGain.toFixed(0)}m gain)</p>
        `;
    }
    
    const infoContent = `
        <div style="max-width: 400px;">
            <h3>${displayName}</h3>
            <p><strong>Distance:</strong> ${formatDistance(distance)}</p>
            <p><strong>Duration:</strong> ${formatDuration(duration)}</p>
            <p><strong>Points:</strong> ${pointCount}</p>
            <p><strong>Start Time:</strong> ${startTime}</p>
            <p><strong>End Time:</strong> ${endTime}</p>
            ${elevationInfo}
            <p><strong>Tracks:</strong> ${file.data.tracks.length}</p>
            <p><strong>Routes:</strong> ${file.data.routes.length}</p>
            <p><strong>Waypoints:</strong> ${file.data.waypoints.length}</p>
        </div>
    `;
    
    // Create modal
    createModal(infoContent);
}

/**
 * Create and display a modal dialog
 * @param {string} content - HTML content for the modal
 */
function createModal(content) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
    `;
    
    modalContent.innerHTML = content + `
        <div style="text-align: right; margin-top: 20px;">
            <button id="closeInfoModal" 
                    style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close
            </button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close button handler
    document.getElementById('closeInfoModal').addEventListener('click', function() {
        modal.remove();
    });
    
    // Click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}
