/**
 * Configuration and Constants
 * Contains all application configuration values and constants
 */

// Default map center (Ylläs ski resort, Finland)
export const DEFAULT_MAP_CENTER = [67.55855, 24.24288];
export const DEFAULT_MAP_ZOOM = 13;

// Line detection threshold (in degrees, roughly 10 meters)
export const INTERSECTION_THRESHOLD = 0.0001;

// Playback configuration
export const PLAYBACK_CONFIG = {
    DEFAULT_SPEED: 1,
    SAMPLE_POINTS: 100, // Number of sample points for analysis
    INTERPOLATED_START_DELAY: 500, // Delay in ms at start line
    SMOOTHING_SUBDIVISIONS: 4, // Precomputed playback points per GPS segment
    SMOOTH_INTERPOLATION: true,
    FOLLOW_LOCATION: true
};

// Earth's radius for distance calculations
export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_M = 6371000;

// Line styles
export const START_LINE_STYLE = {
    color: '#28a745',
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 5'
};

export const FINISH_LINE_STYLE = {
    color: '#dc3545',
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 5'
};

// GPX track styles
export const GPX_TRACK_STYLE = {
    weight: 4,
    opacity: 0.8
};

export const GPX_WAYPOINT_STYLE = {
    radius: 6,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.7
};

// Color generation
export const COLOR_CONFIG = {
    HUE_STEP: 137.5, // Golden angle for even distribution
    SATURATION: 70,
    LIGHTNESS: 50
};
