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
let isUpdatingAnalysis = false;
let playbackMetrics = null;

function startPlaybackMetrics(tracks) {
    playbackMetrics = {
        startedAt: performance.now(),
        frames: 0,
        frameTime: 0,
        markerTime: 0,
        progressTime: 0,
        mapTime: 0,
        chartTime: 0,
        sourcePoints: tracks.reduce((total, track) => total + track.sourcePointCount, 0),
        playbackPoints: tracks.reduce((total, track) => total + track.playbackPointCount, 0)
    };
}

function reportPlaybackMetrics() {
    if (!playbackMetrics || playbackMetrics.frames === 0) return;

    const metrics = playbackMetrics;
    const elapsed = performance.now() - metrics.startedAt;
    console.table({
        'Playback duration (s)': (elapsed / 1000).toFixed(1),
        'Frames': metrics.frames,
        'Average frame (ms)': (metrics.frameTime / metrics.frames).toFixed(2),
        'Markers (ms/frame)': (metrics.markerTime / metrics.frames).toFixed(2),
        'Chart (ms/frame)': (metrics.chartTime / metrics.frames).toFixed(2),
        'Map follow (ms/frame)': (metrics.mapTime / metrics.frames).toFixed(2),
        'Progress UI (ms/frame)': (metrics.progressTime / metrics.frames).toFixed(2),
        'Source points': metrics.sourcePoints,
        'Playback points held': metrics.playbackPoints,
        'Smoothing multiplier': (metrics.playbackPoints / Math.max(1, metrics.sourcePoints)).toFixed(2)
    });
    playbackMetrics = null;
}

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
    setupHelpHandlers();
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
 * Setup help window handlers
 */
function setupHelpHandlers() {
    document.getElementById('toggleHelp')?.addEventListener('click', function() {
        const help = document.getElementById('helpControls');
        if (!help) return;

        const isHidden = help.classList.toggle('hidden');
        this.textContent = isHidden ? 'Show Help' : 'Hide Help';
    });

    document.getElementById('closeHelp')?.addEventListener('click', function() {
        document.getElementById('helpControls')?.classList.add('hidden');
        const toggleButton = document.getElementById('toggleHelp');
        if (toggleButton) toggleButton.textContent = 'Show Help';
    });
}

/**
 * Setup playback event handlers
 */
function setupPlaybackHandlers() {
    window.handleStartPlayback = startPlayback;

    document.getElementById('togglePlayback')?.addEventListener('click', function() {
        const controls = document.getElementById('playbackControls');
        if (!controls) return;

        const isHidden = controls.classList.toggle('hidden');
        this.textContent = isHidden ? 'Show Playback' : 'Hide Playback';
    });
    
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
        const toggleButton = document.getElementById('togglePlayback');
        if (toggleButton) toggleButton.textContent = 'Show Playback';
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
        
        // When enabling smooth interpolation during playback, don't reset positions
        // Let it naturally transition to smooth mode at the next point advancement
        // When disabling smooth interpolation, clear the interpolation data immediately
        if (!this.checked && playbackState.tracks) {
            playbackState.tracks.forEach(track => {
                track.currentPosition = null;
                track.targetPosition = null;
                track.interpolationProgress = 0;
            });
        }
        // When enabling smooth mode, don't touch the positions - they'll be set up
        // naturally when the next point is reached in the animation loop
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
        updateTrackAnalysis();
    });

    const chartContainer = document.getElementById('analysisChart');
    if (chartContainer && typeof ResizeObserver !== 'undefined') {
        const chartResizeObserver = new ResizeObserver(() => resizeAnalysisChart());
        chartResizeObserver.observe(chartContainer);
    }

    document.getElementById('closeAnalysis')?.addEventListener('click', hideAnalysisPanel);
}

/**
 * Resize and redraw the analysis chart at the container's native resolution
 */
function resizeAnalysisChart() {
    const canvas = document.getElementById('differenceChart');
    const chartContainer = document.getElementById('analysisChart');
    if (!canvas || !chartContainer || !currentAnalysisChart) return;

    const width = Math.max(400, Math.floor(chartContainer.clientWidth - 24));
    const height = Math.max(200, Math.round(width / 2));
    if (canvas.width === width && canvas.height === height) return;

    canvas.width = width;
    canvas.height = height;
    currentAnalysisChart = drawAnalysisChart(currentAnalysisChart.analysisResult, canvas);

    if (playbackState.tracks.length > 0) {
        drawPlaybackMarkers(currentAnalysisChart);
    }
}

/**
 * Recalculate and render the track analysis
 */
function updateTrackAnalysis() {
    if (isUpdatingAnalysis) return;
    isUpdatingAnalysis = true;

    const result = calculateTrackAnalysis(lineManager.getStartLine(), lineManager.getFinishLine());

    if (!result.success) {
        showAnalysisError(result.message);
        isUpdatingAnalysis = false;
        return;
    }

    const baselineLapNumber = result.baseline.lapNumber ?? null;
    setBaselineSelection(
        result.baseline.fileId,
        result.baseline.trackIndex,
        baselineLapNumber
    );
    refreshUI();

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

    if (currentAnalysisChart && playbackState.tracks.length > 0) {
        drawPlaybackMarkers(currentAnalysisChart);
    }

    isUpdatingAnalysis = false;
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
    startPlaybackMetrics(tracks);
    const smoothInterpolation = document.getElementById('smoothInterpolation');
    if (smoothInterpolation) smoothInterpolation.disabled = true;
    
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
    reportPlaybackMetrics();
    playbackState.isPlaying = false;
    playbackState.isPaused = false;
    const smoothInterpolation = document.getElementById('smoothInterpolation');
    if (smoothInterpolation) smoothInterpolation.disabled = false;
    
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
    
    const frameStart = performance.now();
    const now = Date.now();
    const deltaTime = now - playbackState.lastUpdateTime;
    
    // Update tracks based on realtime timestamps
    let hasActiveMarkers = false;
    
    const markerStart = performance.now();
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
                
                track.usingInterpolatedStart = !!(track.interpolatedStart && track.hasStartLine);
                const position = updateTrackPosition(track);
                createTrackPlaybackMarker(track, position.lat, position.lng, playbackLayer);
                
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
                    track.usingInterpolatedStart = false;
                } else {
                    track.currentPointIndex++;
                }
                
                if (isTrackVisible) hasActiveMarkers = true;
                
                // Mark track as complete if we've reached the end
                if (track.currentPointIndex > track.endIndex) {
                    track.isComplete = true;
                }
            } else {
                if (isTrackVisible) hasActiveMarkers = true;
            }
            
            // Update marker position
            const position = updateTrackPosition(track);
            
            if (position && isTrackVisible) {
                createTrackPlaybackMarker(track, position.lat, position.lng, playbackLayer);
            }
        }
    });
    if (playbackMetrics) playbackMetrics.markerTime += performance.now() - markerStart;
    
    const progressStart = performance.now();
    updatePlaybackProgress();
    if (playbackMetrics) playbackMetrics.progressTime += performance.now() - progressStart;
    const mapStart = performance.now();
    updateMapViewForPlayback(map);
    if (playbackMetrics) playbackMetrics.mapTime += performance.now() - mapStart;
    
    if (currentAnalysisChart) {
        const chartStart = performance.now();
        drawPlaybackMarkers(currentAnalysisChart);
        if (playbackMetrics) playbackMetrics.chartTime += performance.now() - chartStart;
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
    if (playbackMetrics) {
        playbackMetrics.frames++;
        playbackMetrics.frameTime += performance.now() - frameStart;
    }
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

    if (!isUpdatingAnalysis && !document.getElementById('analysisControls')?.classList.contains('hidden')) {
        updateTrackAnalysis();
    }
}
