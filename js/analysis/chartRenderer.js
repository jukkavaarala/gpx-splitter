/**
 * Chart Renderer
 * Renders analysis charts on canvas
 */

import { playbackState, gpxFiles } from '../state.js';
import { calculateCumulativeDistances } from '../utils/geometry.js';

const cumulativeDistanceCache = new WeakMap();

/**
 * Draw analysis chart
 * @param {Object} analysisResult - Analysis result object
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} Chart metadata for interactions
 */
export function drawAnalysisChart(analysisResult, canvas) {
    const ctx = canvas.getContext('2d');
    
    // Chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;
    
    // Find data ranges
    const allDistances = analysisResult.comparisons.flatMap(comp => 
        comp.timeDifferences.map(d => d.distance)
    );
    const allTimeDiffs = analysisResult.comparisons.flatMap(comp => 
        comp.timeDifferences.map(d => d.timeDifference)
    );
    
    const maxDistance = Math.max(...allDistances) / 1000; // Convert to km
    const maxTimeDiff = Math.max(...allTimeDiffs.map(Math.abs));
    const zeroY = canvas.height - padding - (maxTimeDiff > 0 ? (chartHeight / 2) : 0);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw axes and grid
    drawAxes(ctx, canvas, padding, chartWidth, chartHeight, zeroY);
    drawGrid(ctx, padding, chartWidth, chartHeight);
    drawLabels(ctx, canvas, padding, chartWidth, chartHeight, maxDistance, maxTimeDiff, zeroY);
    
    // Draw data lines
    drawDataLines(ctx, analysisResult, padding, chartWidth, chartHeight, maxDistance, maxTimeDiff, zeroY);
    
    // Return chart metadata
    return {
        canvas,
        ctx,
        analysisResult,
        padding,
        chartWidth,
        chartHeight,
        maxDistance,
        maxTimeDiff,
        zeroY,
        baseImage: ctx.getImageData(0, 0, canvas.width, canvas.height),
        trackLookup: new Map([
            [`${analysisResult.baseline.fileId}:${analysisResult.baseline.trackIndex}`, analysisResult.baseline],
            ...analysisResult.comparisons.map(comparison => [
                `${comparison.fileId}:${comparison.trackIndex}`, comparison
            ])
        ])
    };
}

/**
 * Draw chart axes
 */
function drawAxes(ctx, canvas, padding, chartWidth, chartHeight, zeroY) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw zero line
    ctx.strokeStyle = '#999';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, zeroY);
    ctx.lineTo(canvas.width - padding, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
}

/**
 * Draw grid lines
 */
function drawGrid(ctx, padding, chartWidth, chartHeight) {
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    
    for (let i = 1; i < 5; i++) {
        const x = padding + (i / 5) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, chartHeight + padding);
        ctx.stroke();
    }
}

/**
 * Draw axis labels and scale
 */
function drawLabels(ctx, canvas, padding, chartWidth, chartHeight, maxDistance, maxTimeDiff, zeroY) {
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X-axis label
    ctx.fillText('Distance (km)', canvas.width / 2, canvas.height - 5);
    
    // Y-axis label
    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Time Difference (seconds)', 0, 0);
    ctx.restore();
    
    // Distance scale (X-axis)
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
        const x = padding + (i / 5) * chartWidth;
        const distance = (i / 5) * maxDistance;
        ctx.fillText(distance.toFixed(1), x, canvas.height - padding + 15);
    }
    
    // Time scale (Y-axis)
    ctx.textAlign = 'right';
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const y = zeroY - (i / 2) * (chartHeight / 2);
        const timeValue = (i / 2) * maxTimeDiff;
        if (y > padding && y < canvas.height - padding) {
            ctx.fillText(timeValue.toFixed(0) + 's', padding - 5, y + 3);
        }
    }
}

/**
 * Draw data lines for each comparison track
 */
function drawDataLines(ctx, analysisResult, padding, chartWidth, chartHeight, maxDistance, maxTimeDiff, zeroY) {
    analysisResult.comparisons.forEach((comparison) => {
        if (comparison.timeDifferences.length === 0) return;
        
        ctx.strokeStyle = comparison.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        comparison.timeDifferences.forEach((point, pointIndex) => {
            const x = padding + (point.distance / 1000 / maxDistance) * chartWidth;
            const y = zeroY - (point.timeDifference / maxTimeDiff) * (chartHeight / 2);
            
            if (pointIndex === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    });
}

/**
 * Draw playback position markers on chart
 */
export function drawPlaybackMarkers(chartData) {
    if (!chartData || playbackState.tracks.length === 0) return;
    
    const { ctx, canvas, padding, chartWidth, chartHeight, maxDistance, analysisResult, zeroY, maxTimeDiff } = chartData;
    
    // Restore the static chart instead of redrawing every line, label, and legend.
    ctx.putImageData(chartData.baseImage, 0, 0);
    
    // Now draw the playback markers on top
    playbackState.tracks.forEach(track => {
        if (track.currentPointIndex < track.startIndex || track.currentPointIndex > track.endIndex) return;
        
        const matchingTrack = chartData.trackLookup.get(`${track.fileId}:${track.trackIndex}`);
        
        if (!matchingTrack) return;
        
        // Calculate current distance
        let cumulativeDistances = cumulativeDistanceCache.get(track.points);
        if (!cumulativeDistances) {
            cumulativeDistances = calculateCumulativeDistances(track.points);
            cumulativeDistanceCache.set(track.points, cumulativeDistances);
        }
        const currentDistance = cumulativeDistances[track.currentPointIndex] -
            cumulativeDistances[track.startIndex];
        const distanceKm = currentDistance / 1000;

        if (matchingTrack !== analysisResult.baseline && matchingTrack.timeDifferences?.length > 0) {
            const closestDiff = matchingTrack.timeDifferences.reduce((closest, difference) =>
                Math.abs(difference.distance - currentDistance) <
                    Math.abs(closest.distance - currentDistance) ? difference : closest
            );
            updateLegendDelta(matchingTrack, closestDiff.timeDifference);
        }
        
        // Draw vertical marker line
        const x = padding + (distanceKm / maxDistance) * chartWidth;
        
        ctx.strokeStyle = matchingTrack.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, canvas.height - padding);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw marker dot at zero line
        ctx.fillStyle = matchingTrack.color;
        ctx.beginPath();
        ctx.arc(x, zeroY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw time difference text for comparison tracks
        if (matchingTrack !== analysisResult.baseline && matchingTrack.timeDifferences) {
            const closestDiff = matchingTrack.timeDifferences.reduce((closest, difference) =>
                Math.abs(difference.distance - distanceKm * 1000) <
                    Math.abs(closest.distance - distanceKm * 1000) ? difference : closest
            );
            if (closestDiff) {
                ctx.fillStyle = matchingTrack.color;
                ctx.font = '9px Arial';
                ctx.textAlign = 'center';
                const timeText = (closestDiff.timeDifference >= 0 ? '+' : '') + 
                               closestDiff.timeDifference.toFixed(1) + 's';
                ctx.fillText(timeText, x, padding - 5);
            }
        }
    });
}

function updateLegendDelta(track, timeDifference) {
    const selector = `.analysis-legend-delta[data-file-id="${track.fileId}"][data-track-index="${track.trackIndex}"][data-lap-number="${track.lapNumber ?? ''}"]`;
    const deltaElement = document.querySelector(selector);
    if (deltaElement) {
        deltaElement.textContent = `${timeDifference >= 0 ? '+' : ''}${timeDifference.toFixed(1)}s`;
    }
}

/**
 * Handle chart click for seeking playback
 * @param {MouseEvent} event - Click event
 * @param {Object} chartData - Chart metadata
 * @returns {number|null} Clicked distance in meters or null
 */
export function handleChartClick(event, chartData) {
    if (!chartData) return null;
    
    const { canvas, padding, chartWidth, maxDistance } = chartData;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if click is within chart area
    if (x < padding || x > canvas.width - padding ||
        y < padding || y > canvas.height - padding) {
        return null;
    }
    
    // Calculate distance from click position
    const relativeX = (x - padding) / chartWidth;
    const clickedDistance = relativeX * maxDistance * 1000; // Convert to meters
    
    return clickedDistance;
}
