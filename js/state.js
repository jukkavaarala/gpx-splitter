/**
 * Application State Management
 * Centralized state for the entire application
 */

/**
 * GPX file storage
 * Map<fileId, {data, layers, visible, color, fileName, totalPoints}>
 */
export const gpxFiles = new Map();

/**
 * Auto-incrementing file ID counter
 */
export let nextFileId = 1;

/**
 * Increment and return next file ID
 */
export function getNextFileId() {
    return nextFileId++;
}

/**
 * Reset file ID counter (for testing)
 */
export function resetFileIdCounter() {
    nextFileId = 1;
}

/**
 * Backup storage for undo functionality
 */
export let gpxFilesBackup = null;

/**
 * Set backup state
 */
export function setBackup(backup) {
    gpxFilesBackup = backup;
}

/**
 * Get backup state
 */
export function getBackup() {
    return gpxFilesBackup;
}

/**
 * Clear backup state
 */
export function clearBackup() {
    gpxFilesBackup = null;
}

/**
 * Baseline selection for analysis
 */
export let selectedBaselineFileId = null;
export let selectedBaselineTrackIndex = null;
export let selectedBaselineLapNumber = null;

/**
 * Set baseline for analysis
 */
export function setBaselineSelection(fileId, trackIndex = 0, lapNumber = null) {
    selectedBaselineFileId = fileId;
    selectedBaselineTrackIndex = trackIndex;
    selectedBaselineLapNumber = lapNumber;
}

/**
 * Get baseline selection
 */
export function getBaselineSelection() {
    return {
        fileId: selectedBaselineFileId,
        trackIndex: selectedBaselineTrackIndex,
        lapNumber: selectedBaselineLapNumber
    };
}

/**
 * Clear baseline selection
 */
export function clearBaselineSelection() {
    selectedBaselineFileId = null;
    selectedBaselineTrackIndex = null;
    selectedBaselineLapNumber = null;
}

/**
 * Analysis state
 */
export let analysisChart = null;
export let currentAnalysisResult = null;
export let isAnalysisVisible = false;

/**
 * Set analysis chart
 */
export function setAnalysisChart(chart) {
    analysisChart = chart;
}

/**
 * Get analysis chart
 */
export function getAnalysisChart() {
    return analysisChart;
}

/**
 * Set current analysis result
 */
export function setAnalysisResult(result) {
    currentAnalysisResult = result;
}

/**
 * Get current analysis result
 */
export function getAnalysisResult() {
    return currentAnalysisResult;
}

/**
 * Set analysis visibility
 */
export function setAnalysisVisible(visible) {
    isAnalysisVisible = visible;
}

/**
 * Get analysis visibility
 */
export function isAnalysisOpen() {
    return isAnalysisVisible;
}

/**
 * Playback state
 */
export const playbackState = {
    isPlaying: false,
    isPaused: false,
    tracks: [],
    animationId: null,
    speed: 1,
    lastUpdateTime: 0,
    maxPoints: 0,
    pauseStartTime: 0,
    smoothInterpolation: true,
    followLocation: true
};

/**
 * Reset playback state
 */
export function resetPlaybackState() {
    playbackState.isPlaying = false;
    playbackState.isPaused = false;
    playbackState.tracks = [];
    playbackState.animationId = null;
    playbackState.speed = 1;
    playbackState.lastUpdateTime = 0;
    playbackState.maxPoints = 0;
    playbackState.pauseStartTime = 0;
}

/**
 * Panel state (for draggable/resizable panels)
 */
export let currentZIndex = 1000;

/**
 * Get and increment z-index for panels
 */
export function getNextZIndex() {
    return ++currentZIndex;
}
