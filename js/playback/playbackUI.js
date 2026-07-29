/**
 * Playback UI
 * Manages playback user interface and controls
 */

import { playbackState, gpxFiles } from '../state.js';
import { calculatePlaybackProgress } from './playbackManager.js';

/**
 * Create playback marker for a track
 * @param {Object} track - Track object
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {L.LayerGroup} playbackLayer - Leaflet layer group for markers
 * @returns {L.CircleMarker} Playback marker
 */
export function createTrackPlaybackMarker(track, lat, lng, playbackLayer) {
    // Check if file is visible
    const file = gpxFiles.get(track.fileId);
    if (!file || !file.visible) {
        if (track.marker) {
            playbackLayer.removeLayer(track.marker);
        }
        return null;
    }

    // Reuse the Leaflet layer; recreating it forces DOM/SVG work on every frame.
    if (track.marker) {
        track.marker.setLatLng([lat, lng]);
        if (!playbackLayer.hasLayer(track.marker)) {
            playbackLayer.addLayer(track.marker);
        }
        if (track.markerPointIndex === track.currentPointIndex) {
            return track.marker;
        }
    }
    
    // Create new marker
    if (!track.marker) {
        track.marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: track.color,
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9,
            className: 'playback-marker'
        }).addTo(playbackLayer);
    }
    
    // Add popup with current point info
    const point = track.points[track.currentPointIndex];
    const progressInSegment = track.currentPointIndex - track.startIndex + 1;
    
    let timingInfo = '';
    if (point.time && track.trackStartTime && track.startTime) {
        const pointTime = new Date(point.time);
        const elapsedSeconds = (pointTime.getTime() - track.trackStartTime) / 1000;
        const hours = Math.floor(elapsedSeconds / 3600);
        const minutes = Math.floor((elapsedSeconds % 3600) / 60);
        const seconds = Math.floor(elapsedSeconds % 60);
        const timeStr = hours > 0 ? 
            `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}` :
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timingInfo = `<p><strong>Track Time:</strong> ${timeStr}</p>`;
    }
    
    track.marker.bindPopup(`
        <div>
            <h4>${track.trackName}</h4>
            <p><strong>File:</strong> ${track.fileName}</p>
            <p><strong>Segment Progress:</strong> ${progressInSegment} / ${track.segmentPoints}</p>
            <p><strong>Total Point:</strong> ${track.currentPointIndex + 1} / ${track.points.length}</p>
            ${track.hasStartLine ? '<p><span style="color: #28a745;">⚑ Started from start line</span></p>' : ''}
            ${track.hasFinishLine ? '<p><span style="color: #dc3545;">🏁 Will stop at finish line</span></p>' : ''}
            ${timingInfo}
            ${point.elevation ? `<p><strong>Elevation:</strong> ${point.elevation}m</p>` : ''}
            ${point.time ? `<p><strong>Timestamp:</strong> ${new Date(point.time).toLocaleString()}</p>` : ''}
            <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
    `);
    track.markerPointIndex = track.currentPointIndex;
    
    return track.marker;
}

/**
 * Update playback progress display
 */
export function updatePlaybackProgress() {
    if (playbackState.tracks.length === 0) return;
    
    const progressPercent = calculatePlaybackProgress();
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    const progressSlider = document.getElementById('progressSlider');
    
    if (progressFill) progressFill.style.width = progressPercent + '%';
    if (progressSlider) progressSlider.value = progressPercent;
    
    // Calculate segment points
    let totalSegmentPoints = 0;
    let currentSegmentPoints = 0;
    let visibleTracksCount = 0;
    
    playbackState.tracks.forEach(track => {
        const file = gpxFiles.get(track.fileId);
        if (file && file.visible) {
            totalSegmentPoints += track.segmentPoints;
            currentSegmentPoints += Math.max(0, track.currentPointIndex - track.startIndex);
            visibleTracksCount++;
        }
    });
    
    // Update progress text
    const progressText = document.getElementById('progressText');
    if (progressText) {
        const hasTimingData = playbackState.tracks.some(track => {
            const file = gpxFiles.get(track.fileId);
            return file && file.visible && 
                   track.points[track.startIndex]?.time && track.points[track.endIndex]?.time;
        });
        
        if (hasTimingData) {
            progressText.textContent = 
                `${Math.round(progressPercent)}% (realtime playback - ${currentSegmentPoints} / ${totalSegmentPoints} points from ${visibleTracksCount} visible tracks)`;
        } else {
            progressText.textContent = 
                `${Math.round(progressPercent)}% (${currentSegmentPoints} / ${totalSegmentPoints} segment points from ${visibleTracksCount} visible tracks)`;
        }
    }
}

/**
 * Update playback controls UI
 * @param {string} state - Playback state: 'playing', 'paused', or 'stopped'
 */
export function updatePlaybackControls(state) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    
    if (!playPauseBtn) return;
    
    switch (state) {
        case 'playing':
            playPauseBtn.textContent = '⏸';
            playPauseBtn.className = 'playback-btn pause';
            playPauseBtn.title = 'Pause';
            break;
        case 'paused':
        case 'stopped':
            playPauseBtn.textContent = '▶';
            playPauseBtn.className = 'playback-btn play';
            playPauseBtn.title = 'Play';
            break;
    }
}

/**
 * Show playback controls panel
 */
export function showPlaybackControls() {
    const controls = document.getElementById('playbackControls');
    if (controls) {
        controls.classList.remove('hidden');
        const toggleButton = document.getElementById('togglePlayback');
        if (toggleButton) toggleButton.textContent = 'Playback';
    }
}

/**
 * Hide playback controls panel
 */
export function hidePlaybackControls() {
    const controls = document.getElementById('playbackControls');
    if (controls) {
        controls.classList.add('hidden');
        const toggleButton = document.getElementById('togglePlayback');
        if (toggleButton) toggleButton.textContent = 'Playback';
    }
}

/**
 * Update track count info
 * @param {string} message - Status message
 */
export function updateTrackCountInfo(message) {
    const trackCountInfo = document.getElementById('trackCountInfo');
    if (trackCountInfo) {
        trackCountInfo.textContent = message;
    }
}

/**
 * Update map view to follow playback markers
 * @param {L.Map} map - Leaflet map instance
 */
export function updateMapViewForPlayback(map) {
    if (!playbackState.followLocation || playbackState.tracks.length === 0) return;
    
    // Get all active marker positions from visible files
    const activeMarkers = playbackState.tracks
        .filter(track => {
            const file = gpxFiles.get(track.fileId);
            return track.marker && !track.isComplete && file && file.visible;
        })
        .map(track => track.marker.getLatLng());
    
    if (activeMarkers.length === 0) return;
    
    // Get current map bounds with buffer
    const currentBounds = map.getBounds();
    const buffer = 0.15; // 15% buffer from edges
    const latDiff = currentBounds.getNorth() - currentBounds.getSouth();
    const lngDiff = currentBounds.getEast() - currentBounds.getWest();
    
    const bufferedBounds = L.latLngBounds(
        [currentBounds.getSouth() + latDiff * buffer, currentBounds.getWest() + lngDiff * buffer],
        [currentBounds.getNorth() - latDiff * buffer, currentBounds.getEast() - lngDiff * buffer]
    );
    
    // Check if any markers are outside the buffered area
    const markersNearEdge = activeMarkers.some(markerPos => 
        !bufferedBounds.contains(markerPos)
    );
    
    // Only adjust map view if markers are approaching edges
    if (markersNearEdge) {
        const markerBounds = L.latLngBounds(activeMarkers);
        map.fitBounds(markerBounds, { 
            padding: [80, 80], 
            animate: true, 
            duration: 0.8,
            maxZoom: map.getZoom()
        });
    }
}

/**
 * Update playback marker visibility based on file visibility
 * @param {L.LayerGroup} playbackLayer - Playback layer group
 */
export function updatePlaybackMarkerVisibility(playbackLayer) {
    if (!playbackState.isPlaying || playbackState.tracks.length === 0) {
        return;
    }
    
    playbackState.tracks.forEach(track => {
        const file = gpxFiles.get(track.fileId);
        
        if (track.marker) {
            if (file && file.visible) {
                // Ensure marker is on the map
                if (!playbackLayer.hasLayer(track.marker)) {
                    playbackLayer.addLayer(track.marker);
                }
            } else {
                // Remove marker from map
                if (playbackLayer.hasLayer(track.marker)) {
                    playbackLayer.removeLayer(track.marker);
                }
            }
        }
    });
}
