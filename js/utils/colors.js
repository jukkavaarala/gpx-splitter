/**
 * Color Utilities
 * Functions for generating and manipulating colors
 */

import { COLOR_CONFIG } from '../config.js';

/**
 * Generate a distinct color based on index
 * @param {number} index - Index for color generation
 * @returns {string} HSL color string
 */
export function generateColor(index) {
    const hue = (index * COLOR_CONFIG.HUE_STEP) % 360;
    return `hsl(${hue}, ${COLOR_CONFIG.SATURATION}%, ${COLOR_CONFIG.LIGHTNESS}%)`;
}

/**
 * Generate lap-specific colors based on base color and lap number
 * @param {string} baseColor - Base HSL color
 * @param {number} lapNumber - Lap number
 * @param {number} totalLaps - Total number of laps
 * @returns {string} HSL color string
 */
export function generateLapColor(baseColor, lapNumber, totalLaps) {
    // If only one lap, use the original color
    if (totalLaps <= 1) {
        return baseColor;
    }
    
    // Extract HSL values from base color
    const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!hslMatch) {
        // Fallback if base color is not HSL format
        const baseHue = (lapNumber * 50) % 360;
        return `hsl(${baseHue}, 70%, 50%)`;
    }
    
    const [, baseHue, baseSat, baseLightness] = hslMatch.map(Number);
    
    // Create variations by adjusting hue and lightness
    const hueShift = (lapNumber - 1) * (60 / totalLaps);
    const newHue = (baseHue + hueShift) % 360;
    
    // Vary lightness to create additional distinction
    const lightnessVariation = 10 + (lapNumber % 3) * 15;
    const newLightness = Math.min(75, Math.max(35, baseLightness + lightnessVariation - 20));
    
    return `hsl(${newHue}, ${baseSat}%, ${newLightness}%)`;
}
