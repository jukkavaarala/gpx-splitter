/**
 * Event Handlers
 * Central coordination of all application events
 */

import { parseGPX } from '../gpx/parser.js';
import { addGpxFile, removeGpxFile, toggleGpxFileVisibility, getVisibleBounds } from '../gpx/fileManager.js';
import { cropAllGpxFiles, undoCrop, hasBackup } from '../gpx/cropper.js';
import { showFileInfo } from '../ui/fileInfo.js';
import { updateFileList, toggleFileListPanel, toggleFileGroup } from '../ui/fileList.js';
import { gpxFiles, setBaselineSelection, getBaselineSelection, playbackState, resetPlaybackState } from '../state.js';
import { calculateTrackAnalysis } from '../analysis/analyzer.js';
import { drawAnalysisChart, handleChartClick, drawPlaybackMarkers } from '../analysis/chartRenderer.js';
import { showAnalysisPanel, hideAnalysisPanel, updateAnalysisInfo, updateAnalysisStats, showAnalysisError } from '../analysis/analysisUI.js';
import { prepareTracksForPlayback, seekToPosition, seekPlaybackToDistance, getPlaybackStatusMessage, updateTrackPosition } from '../playback/playbackManager.js';
import { 
    createTrackPlaybackMarker, 
    updatePlaybackProgress, 
    updatePlaybackControls, 
    showPlaybackControls,
    updateTrackCountInfo,
    updateMapViewForPlayback,
    updatePlaybackMarkerVisibility
} from '../playback/playbackUI.js';

let map, lineManager, playbackLayer;
let currentAnalysisChart = null;

/**
 * Initialize event handlers
 * @param {L.Map} mapInstance - Leaflet map instance
 * @param {LineManager} lineManagerInstance - Line manager instance
 * @param {L.LayerGroup} playbackLayerInstance - Playback layer
 */
export function initializeEventHandlers(mapInstance, lineManagerInstance, playbackLayerInstance) {
    map = mapInstance;
    lineManager = lineManagerInstance;
    playbackLayer = playbackLayerInstance;
    
    setupFileUploadHandlers();
    setupLineDrawingHandlers();
    setupCropHandlers();
    setupFileListHandlers();
    setupPlaybackHandlers();
    setupAnalysisHandlers();
    setupKeyboardHandlers();
}

/**
 * Setup file upload event handlers
 */
function setupFileUploadHandlers() {
    document.getElementById('uploadGpx')?.addEventListener('click', function() {
        document.getElementById('gpxFileInput').click();
    });

    document.getElementById('gpxFileInput')?.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        let loadedCount = 0;
        
        files.forEach(file => {
            if (file && file.name.toLowerCase().endsWith('.gpx')) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const gpxContent = event.target.result;
                        const gpxData = parseGPX(gpxContent);
                        addGpxFile(file.name, gpxData, map);
                        
                        loadedCount++;
                        if (loadedCount === files.length) {
                            refreshUI();
                            
                            // Show file list if hidden
                            const fileList = document.getElementById('gpxFileList');
                            if (fileList?.classList.contains('hidden')) {
                                toggleFileListPanel();
                            }
                        }
                    } catch (error) {
                        alert(`Error parsing GPX file ${file.name}: ${error.message}`);
                        console.error('GPX parsing error:', error);
                    }
                };
                reader.readAsText(file);
            } else {
                alert(`Invalid file: ${file.name}. Please select GPX files only.`);
            }
        });
        
        this.value = ''; // Clear input
    });
}

/**
 * Setup line drawing event handlers
 */
function setupLineDrawingHandlers() {
    document.getElementById('addStartLine')?.addEventListener('click', function() {
        if (lineManager.isDrawingStartLine) {
            lineManager.resetDrawing();
            updateLineDrawingUI();
        } else {
            lineManager.startDrawingStartLine();
            this.classList.add('active');
            this.textContent = 'Click two points (Cancel)';
        }
    });

    document.getElementById('addFinishLine')?.addEventListener('click', function() {
        if (lineManager.isDrawingFinishLine) {
            lineManager.resetDrawing();
            updateLineDrawingUI();
        } else {
            lineManager.startDrawingFinishLine();
            this.classList.add('active');
            this.textContent = 'Click two points (Cancel)';
        }
    });

    document.getElementById('clearLines')?.addEventListener('click', function() {
        lineManager.clearAllLines();
    });

    // Map click handler for line drawing
    map.on('click', function(e) {
        if (lineManager.isDrawing()) {
            const complete = lineManager.handleClick(e.latlng);
            if (complete) {
                updateLineDrawingUI();
            } else if (lineManager.drawingPoints.length === 1) {
                // Update button text after first point
                const button = lineManager.isDrawingStartLine ? 
                    document.getElementById('addStartLine') : 
                    document.getElementById('addFinishLine');
                if (button) button.textContent = 'Click second point (Cancel)';
            }
        }
    });
}

/**
 * Update line drawing UI buttons
 */
function updateLineDrawingUI() {
    const startBtn = document.getElementById('addStartLine');
    const finishBtn = document.getElementById('addFinishLine');
    
    if (startBtn) {
        startBtn.classList.remove('active');
        startBtn.textContent = 'Add Start Line';
    }
    if (finishBtn) {
        finishBtn.classList.remove('active');
        finishBtn.textContent = 'Add Finish Line';
    }
}

/**
 * Setup crop/undo handlers
 */
function setupCropHandlers() {
    document.getElementById('cropGpxFiles')?.addEventListener('click', function() {
        const result = cropAllGpxFiles(lineManager.getStartLine(), lineManager.getFinishLine(), map);
        
        if (!result.success) {
            alert(result.message);
            return;
        }
        
        // Build message
        let message = `Successfully cropped ${result.croppedCount} GPX file(s) into ${result.lapsCreated} lap segments.`;
        
        if (result.filesWithoutIntersections.length > 0) {
            message += `\n\n${result.filesWithoutIntersections.length} file(s) were hidden because they don't intersect with the defined lines:\n`;
            message += result.filesWithoutIntersections.map(name => `• ${name}`).join('\n');
        }
        
        message += '\n\nUse "Undo Crop" to restore original files.';
        alert(message);
        
        refreshUI();
        updateCropButtonVisibility();
    });

    document.getElementById('undoCrop')?.addEventListener('click', function() {
        if (undoCrop(map)) {
            alert('Successfully restored original GPX files.');
            refreshUI();
            updateCropButtonVisibility();
        } else {
            alert('No backup available to restore.');
        }
    });
}

/**
 * Update crop/undo button visibility
 */
function updateCropButtonVisibility() {
    const cropBtn = document.getElementById('cropGpxFiles');
    const undoBtn = document.getElementById('undoCrop');
    
    if (hasBackup()) {
        cropBtn?.classList.add('hidden');
        undoBtn?.classList.remove('hidden');
    } else {
        cropBtn?.classList.remove('hidden');
        undoBtn?.classList.add('hidden');
    }
}

/**
 * Setup file list handlers
 */
function setupFileListHandlers() {
    document.getElementById('toggleFileList')?.addEventListener('click', toggleFileListPanel);
    
    document.getElementById('closeFileList')?.addEventListener('click', function() {
        const fileList = document.getElementById('gpxFileList');
        const button = document.getElementById('toggleFileList');
        fileList?.classList.add('hidden');
        if (button) button.textContent = 'Show Files';
    });
    
    // Make functions globally available for onclick handlers
    window.handleShowInfo = (fileId, lapNumber) => {
        showFileInfo(fileId, lapNumber, lineManager.getStartLine(), lineManager.getFinishLine());
    };
    
    window.handleSetBaseline = (fileId, trackIndex, lapNumber) => {
        setBaselineSelection(fileId, trackIndex, lapNumber);
        refreshUI();
    };
    
    window.handleToggleFile = (fileId) => {
        toggleGpxFileVisibility(fileId, map);
        refreshUI();
        updatePlaybackMarkerVisibility(playbackLayer);
    };
    
    window.handleRemoveFile = (fileId) => {
        removeGpxFile(fileId, map);
        refreshUI();
    };
    
    window.toggleFileGroup = toggleFileGroup;
}

/**
 * Setup playback event handlers
 */
function setupPlaybackHandlers() {
    window.handleStartPlayback = startPlayback;
    
    document.getElementById('playPauseBtn')?.addEventListener('click', function() {
        if (!playbackState.isPlaying) {
            startPlayback();
        } else if (playbackState.isPaused) {
            resumePlayback();
        } else {
            pausePlayback();
        }
    });

    document.getElementById('stopBtn')?.addEventListener('click', stopPlayback);
    
    document.getElementById('closePlayback')?.addEventListener('click', function() {
        stopPlayback();
        document.getElementById('playbackControls')?.classList.add('hidden');
    });

    document.getElementById('playbackSpeed')?.addEventListener('change', function() {
        const newSpeed = parseFloat(this.value);
        
        if (playbackState.isPlaying && !playbackState.isPaused) {
            const now = Date.now();
            playbackState.tracks.forEach(track => {
                if (track.startTime && track.trackStartTime) {
                    const currentRealElapsed = ((now - track.startTime) - track.pausedTime) * playbackState.speed;
                    track.startTime = now - (currentRealElapsed / newSpeed) - track.pausedTime;
                }
            });
        }
        
        playbackState.speed = newSpeed;
    });

    document.getElementById('smoothInterpolation')?.addEventListener('change', function() {
        playbackState.smoothInterpolation = this.checked;
        playbackState.tracks.forEach(track => {
            track.currentPosition = null;
            track.targetPosition = null;
            track.interpolationProgress = 0;
        });
    });

    document.getElementById('followLocation')?.addEventListener('change', function() {
        playbackState.followLocation = this.checked;
    });

    document.getElementById('progressSlider')?.addEventListener('input', function() {
        if (playbackState.tracks.length > 0) {
            seekToPosition(parseFloat(this.value));
            updatePlaybackProgress();
            
            if (currentAnalysisChart) {
                drawPlaybackMarkers(currentAnalysisChart);
            }
        }
    });
}

/**
 * Setup analysis event handlers
 */
function setupAnalysisHandlers() {
    document.getElementById('analyzeTracks')?.addEventListener('click', function() {
        const result = calculateTrackAnalysis(lineManager.getStartLine(), lineManager.getFinishLine());
        
        if (!result.success) {
            showAnalysisError(result.message);
            return;
        }
        
        showAnalysisPanel();
        updateAnalysisInfo(result);
        
        const canvas = document.getElementById('differenceChart');
        if (canvas) {
            currentAnalysisChart = drawAnalysisChart(result, canvas);
            
            // Add click handler for seeking
            if (!canvas.hasClickListener) {
                canvas.addEventListener('click', function(e) {
                    const distance = handleChartClick(e, currentAnalysisChart);
                    if (distance !== null) {
                        seekPlaybackToDistance(distance);
                        updatePlaybackProgress();
                        
                        if (currentAnalysisChart) {
                            drawPlaybackMarkers(currentAnalysisChart);
                        }
                    }
                });
                canvas.hasClickListener = true;
                canvas.style.cursor = 'pointer';
            }
        }
        
        updateAnalysisStats(result);
    });

    document.getElementById('closeAnalysis')?.addEventListener('click', hideAnalysisPanel);
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardHandlers() {
    document.addEventListener('keydown', function(e) {
        // Cancel line drawing with Escape
        if (e.key === 'Escape' && lineManager.isDrawing()) {
            lineManager.resetDrawing();
            updateLineDrawingUI();
            return;
        }
        
        // Playback shortcuts (only when not drawing)
        if (!lineManager.isDrawing()) {
            if (e.key === ' ') { // Spacebar for play/pause
                e.preventDefault();
                if (!playbackState.isPlaying) {
                    startPlayback();
                } else if (playbackState.isPaused) {
                    resumePlayback();
                } else {
                    pausePlayback();
                }
            } else if (e.key === 'Enter') { // Enter for stop
                e.preventDefault();
                stopPlayback();
            }
        }
    });
}

/**
 * Start playback
 */
function startPlayback() {
    const { tracks, maxPoints } = prepareTracksForPlayback(
        lineManager.getStartLine(), 
        lineManager.getFinishLine()
    );
    
    if (tracks.length === 0) {
        alert('No visible tracks available for playback. Please load and show some GPX files first.');
        return;
    }
    
    playbackState.tracks = tracks;
    playbackState.maxPoints = maxPoints;
    playbackState.isPlaying = true;
    playbackState.isPaused = false;
    playbackState.lastUpdateTime = Date.now();
    
    showPlaybackControls();
    updateTrackCountInfo(getPlaybackStatusMessage(lineManager.getStartLine(), lineManager.getFinishLine()));
    updatePlaybackControls('playing');
    
    animatePlayback();
}

/**
 * Pause playback
 */
function pausePlayback() {
    playbackState.isPaused = true;
    playbackState.pauseStartTime = Date.now();
    
    if (playbackState.animationId) {
        cancelAnimationFrame(playbackState.animationId);
        playbackState.animationId = null;
    }
    
    updatePlaybackControls('paused');
}

/**
 * Resume playback
 */
function resumePlayback() {
    const allComplete = playbackState.tracks.every(track => track.isComplete);
    
    if (allComplete) {
        stopPlayback();
        startPlayback();
        return;
    }
    
    if (playbackState.pauseStartTime > 0) {
        const pauseDuration = Date.now() - playbackState.pauseStartTime;
        playbackState.tracks.forEach(track => {
            track.pausedTime += pauseDuration;
        });
        playbackState.pauseStartTime = 0;
    }
    
    playbackState.isPaused = false;
    playbackState.lastUpdateTime = Date.now();
    updatePlaybackControls('playing');
    
    animatePlayback();
}

/**
 * Stop playback
 */
function stopPlayback() {
    playbackState.isPlaying = false;
    playbackState.isPaused = false;
    
    if (playbackState.animationId) {
        cancelAnimationFrame(playbackState.animationId);
        playbackState.animationId = null;
    }
    
    playbackState.tracks.forEach(track => {
        if (track.marker) {
            playbackLayer.removeLayer(track.marker);
            track.marker = null;
        }
    });
    
    resetPlaybackState();
    updatePlaybackControls('stopped');
    updatePlaybackProgress();
}

/**
 * Animate playback (main animation loop)
 */
function animatePlayback() {
    if (!playbackState.isPlaying || playbackState.isPaused) return;
    
    const now = Date.now();
    const deltaTime = now - playbackState.lastUpdateTime;
    
    // Update tracks based on realtime timestamps
    let hasActiveMarkers = false;
    
    playbackState.tracks.forEach(track => {
        const file = gpxFiles.get(track.fileId);
        const isTrackVisible = file && file.visible;
        
        if (!track.isComplete && track.currentPointIndex <= track.endIndex) {
            const currentPoint = track.points[track.currentPointIndex];
            const nextPoint = track.points[track.currentPointIndex + 1];
            
            // Check if it's time to advance to the next point
            let shouldAdvance = false;
            
            if (track.startTime === null) {
                // First point - initialize timing and position
                track.startTime = now;
                
                // Initialize position based on interpolation mode
                const position = updateTrackPosition(track);
                createTrackPlaybackMarker(track, position.lat, position.lng, playbackLayer);
                
                // Set flags based on start line
                if (track.interpolatedStart && track.hasStartLine) {
                    track.usingInterpolatedStart = true;
                } else {
                    track.usingInterpolatedStart = false;
                }
                
                track.trackStartTime = track.points[track.currentPointIndex].time ? 
                    new Date(track.points[track.currentPointIndex].time).getTime() : null;
                if (isTrackVisible) hasActiveMarkers = true;
            } else if (track.trackStartTime && currentPoint.time) {
                // Calculate elapsed time in track vs real playback time
                let targetTime;
                
                if (track.usingInterpolatedStart) {
                    // When using interpolated start, add a small delay before moving to first GPS point
                    const interpolatedDelay = 500; // 0.5 second delay at start line
                    const realElapsed = ((now - track.startTime) - track.pausedTime) * playbackState.speed;
                    
                    if (realElapsed >= interpolatedDelay) {
                        shouldAdvance = true;
                    } else {
                        hasActiveMarkers = true;
                    }
                } else if (nextPoint && nextPoint.time) {
                    // Normal advancement - use next point's time
                    targetTime = new Date(nextPoint.time).getTime();
                    const trackElapsed = targetTime - track.trackStartTime;
                    const realElapsed = ((now - track.startTime) - track.pausedTime) * playbackState.speed;
                    shouldAdvance = realElapsed >= trackElapsed;
                } else {
                    hasActiveMarkers = true;
                }
            } else {
                // No timestamp data, fall back to regular interval
                const interval = 1000 / playbackState.speed;
                shouldAdvance = deltaTime >= interval;
                if (isTrackVisible) hasActiveMarkers = true;
            }
            
            if (shouldAdvance && track.startTime !== null) {
                if (track.usingInterpolatedStart) {
                    // Transition from interpolated start to first actual GPS point
                    if (playbackState.smoothInterpolation) {
                        track.currentPosition = { ...track.interpolatedStart };
                        track.targetPosition = { lat: currentPoint.lat, lng: currentPoint.lng };
                        track.interpolationProgress = 0;
                    }
                    track.usingInterpolatedStart = false;
                } else {
                    // Normal advancement - move to the next point
                    track.currentPointIndex++;
                    if (track.currentPointIndex <= track.endIndex && track.currentPointIndex < track.points.length) {
                        const nextGpsPoint = track.points[track.currentPointIndex];
                        if (playbackState.smoothInterpolation && track.currentPosition) {
                            track.currentPosition = { ...track.targetPosition };
                            track.targetPosition = { lat: nextGpsPoint.lat, lng: nextGpsPoint.lng };
                            track.interpolationProgress = 0;
                        }
                    }
                }
                
                if (isTrackVisible) hasActiveMarkers = true;
                
                // Mark track as complete if we've reached the end
                if (track.currentPointIndex > track.endIndex) {
                    track.isComplete = true;
                }
            } else if (playbackState.smoothInterpolation && track.currentPosition && track.targetPosition) {
                // Update interpolation progress for smooth movement
                const frameTime = deltaTime / 1000;
                const interpolationSpeed = playbackState.speed;
                track.interpolationProgress = Math.min(1, track.interpolationProgress + frameTime * interpolationSpeed);
                if (isTrackVisible) hasActiveMarkers = true;
            } else {
                if (isTrackVisible) hasActiveMarkers = true;
            }
            
            // Update marker position
            if (track.currentPosition || !playbackState.smoothInterpolation) {
                const position = updateTrackPosition(track);
                if (position) {
                    createTrackPlaybackMarker(track, position.lat, position.lng, playbackLayer);
                }
            }
        }
    });
    
    updatePlaybackProgress();
    updateMapViewForPlayback(map);
    
    if (currentAnalysisChart) {
        drawPlaybackMarkers(currentAnalysisChart);
    }
    
    // Check if all tracks are complete
    if (!hasActiveMarkers) {
        const hasVisibleTracks = playbackState.tracks.some(track => {
            const file = gpxFiles.get(track.fileId);
            return file && file.visible;
        });
        
        if (!hasVisibleTracks) {
            console.log('No visible tracks - stopping playback');
        } else {
            console.log('All visible tracks completed - stopping playback');
        }
        stopPlayback();
        return;
    }
    
    playbackState.lastUpdateTime = now;
    playbackState.animationId = requestAnimationFrame(animatePlayback);
}

/**
 * Refresh all UI elements
 */
function refreshUI() {
    const baseline = getBaselineSelection();
    
    updateFileList({
        onShowInfo: window.handleShowInfo,
        onSetBaseline: window.handleSetBaseline,
        onToggleFile: window.handleToggleFile,
        onRemoveFile: window.handleRemoveFile
    }, baseline.fileId, baseline.lapNumber);
    
    const bounds = getVisibleBounds();
    if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
    }
}
