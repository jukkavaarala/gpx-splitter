/**
 * Line Manager
 * Manages start and finish lines on the map
 */

import { START_LINE_STYLE, FINISH_LINE_STYLE } from '../config.js';

export class LineManager {
    constructor(map, linesGroup) {
        this.map = map;
        this.linesGroup = linesGroup;
        this.startLine = null;
        this.finishLine = null;
        this.isDrawingStartLine = false;
        this.isDrawingFinishLine = false;
        this.drawingPoints = [];
    }

    /**
     * Create a line between two points
     * @param {Object} point1 - First point {lat, lng}
     * @param {Object} point2 - Second point {lat, lng}
     * @param {Object} style - Line style
     * @param {string} label - Line label
     * @returns {Object} Line and marker objects
     */
    createLine(point1, point2, style, label) {
        const line = L.polyline([point1, point2], style).addTo(this.linesGroup);
        
        // Calculate line center and perpendicular offset for label
        const centerLat = (point1.lat + point2.lat) / 2;
        const centerLng = (point1.lng + point2.lng) / 2;
        
        const deltaLat = point2.lat - point1.lat;
        const deltaLng = point2.lng - point1.lng;
        const lineLength = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
        
        const offsetDistance = 0.0005;
        const perpLat = -deltaLng / lineLength * offsetDistance;
        const perpLng = deltaLat / lineLength * offsetDistance;
        
        const labelPosition = [centerLat + perpLat, centerLng + perpLng];
        
        const marker = L.marker(labelPosition, {
            icon: L.divIcon({
                className: 'line-label',
                html: `<div style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; border: 2px solid ${style.color}; color: ${style.color}; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${label}</div>`,
                iconSize: [60, 20],
                iconAnchor: [30, 10]
            })
        }).addTo(this.linesGroup);
        
        return { line, marker };
    }

    /**
     * Start drawing start line
     */
    startDrawingStartLine() {
        this.resetDrawing();
        this.isDrawingStartLine = true;
        this.drawingPoints = [];
        this.map.getContainer().style.cursor = 'crosshair';
    }

    /**
     * Start drawing finish line
     */
    startDrawingFinishLine() {
        this.resetDrawing();
        this.isDrawingFinishLine = true;
        this.drawingPoints = [];
        this.map.getContainer().style.cursor = 'crosshair';
    }

    /**
     * Handle map click for line drawing
     * @param {Object} latlng - Clicked position
     * @returns {boolean} True if drawing is complete
     */
    handleClick(latlng) {
        if (!this.isDrawingStartLine && !this.isDrawingFinishLine) {
            return false;
        }

        this.drawingPoints.push(latlng);
        
        if (this.drawingPoints.length === 2) {
            const point1 = this.drawingPoints[0];
            const point2 = this.drawingPoints[1];
            
            if (this.isDrawingStartLine) {
                if (this.startLine) {
                    this.linesGroup.removeLayer(this.startLine.line);
                    this.linesGroup.removeLayer(this.startLine.marker);
                }
                this.startLine = this.createLine(point1, point2, START_LINE_STYLE, 'START');
                console.log('Start line created');
            } else if (this.isDrawingFinishLine) {
                if (this.finishLine) {
                    this.linesGroup.removeLayer(this.finishLine.line);
                    this.linesGroup.removeLayer(this.finishLine.marker);
                }
                this.finishLine = this.createLine(point1, point2, FINISH_LINE_STYLE, 'FINISH');
                console.log('Finish line created');
            }
            
            this.resetDrawing();
            return true;
        }
        
        return false;
    }

    /**
     * Clear all lines
     */
    clearAllLines() {
        if (this.startLine) {
            this.linesGroup.removeLayer(this.startLine.line);
            this.linesGroup.removeLayer(this.startLine.marker);
            this.startLine = null;
        }
        
        if (this.finishLine) {
            this.linesGroup.removeLayer(this.finishLine.line);
            this.linesGroup.removeLayer(this.finishLine.marker);
            this.finishLine = null;
        }
        
        console.log('All lines cleared');
    }

    /**
     * Reset drawing state
     */
    resetDrawing() {
        this.isDrawingStartLine = false;
        this.isDrawingFinishLine = false;
        this.drawingPoints = [];
        this.map.getContainer().style.cursor = '';
    }

    /**
     * Get start line
     */
    getStartLine() {
        return this.startLine;
    }

    /**
     * Get finish line
     */
    getFinishLine() {
        return this.finishLine;
    }

    /**
     * Check if currently drawing
     */
    isDrawing() {
        return this.isDrawingStartLine || this.isDrawingFinishLine;
    }
}
