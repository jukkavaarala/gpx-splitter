/**
 * Analysis UI
 * Manages the analysis panel and statistics display
 */

import { setAnalysisVisible, setAnalysisChart, setAnalysisResult } from '../state.js';
import { calculateTrackDistance } from '../utils/geometry.js';
import { formatDistance, formatDuration, calculateTrackDuration } from '../utils/formatters.js';

/**
 * Show analysis panel
 */
export function showAnalysisPanel() {
    const controls = document.getElementById('analysisControls');
    if (controls) {
        controls.classList.remove('hidden');
        setAnalysisVisible(true);
    }
}

/**
 * Hide analysis panel
 */
export function hideAnalysisPanel() {
    const controls = document.getElementById('analysisControls');
    if (controls) {
        controls.classList.add('hidden');
        setAnalysisVisible(false);
        setAnalysisChart(null);
        setAnalysisResult(null);
    }
}

/**
 * Update analysis info text
 * @param {Object} analysisResult - Analysis result
 */
export function updateAnalysisInfo(analysisResult) {
    const analysisInfo = document.getElementById('analysisInfo');
    if (analysisInfo) {
        analysisInfo.textContent = 
            `Baseline: ${analysisResult.baseline.fileName} | Comparing ${analysisResult.comparisons.length} track(s) | Click graph to seek playback`;
    }
}

/**
 * Update analysis statistics display
 * @param {Object} analysisResult - Analysis result
 */
export function updateAnalysisStats(analysisResult) {
    const statsContainer = document.getElementById('analysisStats');
    if (!statsContainer) return;
    const statsPanel = statsContainer.closest('.analysis-stats');
    if (statsPanel && analysisResult?.baseline?.color) {
        statsPanel.style.setProperty(
            'border-left',
            `4px solid ${analysisResult.baseline.color}`,
            'important'
        );
    }
    
    // Calculate baseline statistics
    const baselineDistance = calculateTrackDistance(analysisResult.baseline.points);
    const baselineDuration = calculateTrackDuration(analysisResult.baseline.points);
    
    let statsHtml = `
        <div style="margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
            <strong>Baseline:</strong> ${analysisResult.baseline.fileName}<br>
            <strong>Distance:</strong> ${formatDistance(baselineDistance)}<br>
            <strong>Duration:</strong> ${formatDuration(baselineDuration)}
        </div>
    `;
    
    // Add comparison track statistics
    analysisResult.comparisons.forEach((comparison) => {
        const stats = comparison.stats;
        if (stats) {
            const comparisonDistance = calculateTrackDistance(comparison.points);
            const comparisonDuration = calculateTrackDuration(comparison.points);
            const distanceDiff = comparisonDistance - baselineDistance;
            const durationDiff = comparisonDuration && baselineDuration ? 
                                comparisonDuration - baselineDuration : null;
            
            statsHtml += `
                <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${comparison.color}; background-color: #f8f9fa;">
                    <div style="color: ${comparison.color}; font-weight: bold; margin-bottom: 5px;">${comparison.fileName}:</div>
                    <strong>Distance:</strong> ${formatDistance(comparisonDistance)}`;
            
            if (Math.abs(distanceDiff) > 0.001) {
                statsHtml += ` (${distanceDiff >= 0 ? '+' : ''}${formatDistance(Math.abs(distanceDiff))})`;
            }
            
            statsHtml += `<br><strong>Duration:</strong> ${formatDuration(comparisonDuration)}`;
            
            if (durationDiff !== null) {
                const durationDiffSeconds = durationDiff / 1000;
                statsHtml += ` (${durationDiffSeconds >= 0 ? '+' : ''}${durationDiffSeconds.toFixed(1)}s)`;
            }
            
            statsHtml += `<br>
                    <strong>Time Analysis:</strong><br>
                    &nbsp;&nbsp;Average: ${stats.average >= 0 ? '+' : ''}${stats.average.toFixed(1)}s<br>
                    &nbsp;&nbsp;Final: ${stats.finalDifference >= 0 ? '+' : ''}${stats.finalDifference.toFixed(1)}s<br>
                    &nbsp;&nbsp;Range: ${stats.minimum.toFixed(1)}s to ${stats.maximum.toFixed(1)}s
                </div>
            `;
        }
    });
    
    statsContainer.innerHTML = statsHtml;
}

/**
 * Show analysis error message
 * @param {string} message - Error message
 */
export function showAnalysisError(message) {
    alert(message);
}
