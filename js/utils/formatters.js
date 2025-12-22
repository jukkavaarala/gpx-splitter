/**
 * Formatting Utilities
 * Functions for formatting distances, durations, and other data for display
 */

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    } else {
        return `${distanceKm.toFixed(2)}km`;
    }
}

/**
 * Format duration for display
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(durationMs) {
    if (!durationMs) return 'N/A';
    
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

/**
 * Calculate track duration from points
 * @param {Array} points - Array of track points with time property
 * @returns {number|null} Duration in milliseconds or null if no timing data
 */
export function calculateTrackDuration(points) {
    if (!points || points.length < 2) return null;
    
    const startTime = points[0].time;
    const endTime = points[points.length - 1].time;
    
    if (!startTime || !endTime) return null;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return end.getTime() - start.getTime();
}
