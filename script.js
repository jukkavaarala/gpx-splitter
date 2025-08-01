﻿// Ylläs ski resort coordinates (Finland)
const yllasCoordinates = [67.55855, 24.24288];

// Initialize the map
const map = L.map('map', {
    center: yllasCoordinates,
    zoom: 13,
    zoomControl: false, // Disable default zoom control to reposition it
    attributionControl: true
});

// Add tile layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
}).addTo(map);

// Add satellite imagery option
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
});

// Layer control
const baseMaps = {
    "Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }),
    "Satellite": satelliteLayer
};

// Add zoom control to top right
const zoomControl = L.control.zoom({
    position: 'topright'
}).addTo(map);

// Add layer control to top right, positioned next to zoom control
const layerControl = L.control.layers(baseMaps, null, {
    position: 'topright'
}).addTo(map);

// Position controls side-by-side by adjusting the layer control margin
setTimeout(() => {
    const zoomElement = zoomControl.getContainer();
    const layerElement = layerControl.getContainer();
    
    if (zoomElement && layerElement) {
        // Add custom styling to position controls side-by-side
        zoomElement.style.marginRight = '10px';
        layerElement.style.clear = 'none';
        layerElement.style.marginTop = '0';
        
        // Create a container for both controls
        const controlsContainer = document.createElement('div');
        controlsContainer.style.display = 'flex';
        controlsContainer.style.alignItems = 'flex-start';
        controlsContainer.style.gap = '10px';
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.top = '10px';
        controlsContainer.style.right = '10px';
        controlsContainer.style.zIndex = '1000';
        
        // Move both controls to the new container
        const mapContainer = map.getContainer();
        mapContainer.appendChild(controlsContainer);
        controlsContainer.appendChild(layerElement);
        controlsContainer.appendChild(zoomElement);
    }
}, 100);

// Add scale control to bottom right
L.control.scale({
    position: 'bottomright',
    metric: true,
    imperial: false
}).addTo(map);

// Variables for start and finish lines
let startLine = null;
let finishLine = null;
let isDrawingStartLine = false;
let isDrawingFinishLine = false;
let drawingPoints = [];

// Create layer groups
const linesGroup = L.layerGroup().addTo(map);

// Multi-GPX data storage
let gpxFiles = new Map(); // Map<fileId, {data, layers, visible, color, fileName}>
let nextFileId = 1;

// Backup storage for undo functionality
let gpxFilesBackup = null;

// Baseline selection for analysis
let selectedBaselineFileId = null;
let selectedBaselineTrackIndex = null;
let selectedBaselineLapNumber = null;

// Function to update crop/undo button visibility based on backup state
function updateCropButtonVisibility() {
    const cropBtn = document.getElementById('cropGpxFiles');
    const undoBtn = document.getElementById('undoCrop');
    
    if (gpxFilesBackup) {
        // Backup exists - show undo, hide crop
        cropBtn.classList.add('hidden');
        undoBtn.classList.remove('hidden');
    } else {
        // No backup - show crop, hide undo
        cropBtn.classList.remove('hidden');
        undoBtn.classList.add('hidden');
    }
}

// Function to set baseline for analysis
function setBaseline(fileId, trackIndex = 0, lapNumber = null) {
    selectedBaselineFileId = fileId;
    selectedBaselineTrackIndex = trackIndex;
    selectedBaselineLapNumber = lapNumber;
    
    const file = gpxFiles.get(fileId);
    const baselineName = lapNumber ? `${file.fileName} (Lap ${lapNumber})` : file.fileName;
    console.log(`Set baseline to: ${baselineName}`);
    
    // Update file list to show current baseline selection
    updateFileList();
    
    // If analysis is currently visible, refresh it with new baseline
    if (isAnalysisVisible) {
        console.log('Analysis is visible - refreshing analysis');
        const result = calculateTrackAnalysis();
        if (result.success) {
            console.log('Analysis successful - updating display');
            // Store current analysis result for interactive features
            currentAnalysisResult = result;
            
            // Update analysis info
            const analysisInfoElement = document.getElementById('analysisInfo');
            if (analysisInfoElement) {
                analysisInfoElement.textContent = 
                    `Baseline: ${result.baseline.fileName} | Comparing ${result.comparisons.length} track(s) | Click graph to seek playback`;
                console.log('Analysis info updated');
            } else {
                console.error('analysisInfo element not found!');
            }
            
            // Draw the chart
            try {
                drawAnalysisChart(result);
                console.log('Chart drawn');
            } catch (error) {
                console.error('Error drawing chart:', error);
            }
            
            // Update stats
            try {
                updateAnalysisStats(result);
                console.log('Stats updated');
            } catch (error) {
                console.error('Error updating stats:', error);
            }
        } else {
            console.log('Analysis failed:', result.message);
        }
    } else {
        console.log('Analysis is not visible - skipping refresh');
    }
}

// Line styles
const startLineStyle = {
    color: '#28a745',
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 5'
};

const finishLineStyle = {
    color: '#dc3545',
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 5'
};

// GPX styles
const gpxTrackStyle = {
    weight: 4,
    opacity: 0.8
};

const gpxWaypointStyle = {
    radius: 6,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.7
};

// Generate distinct colors for GPX files
function generateColor(index) {
    const hue = (index * 137.5) % 360; // Golden angle for even distribution
    return `hsl(${hue}, 70%, 50%)`;
}

// Generate lap-specific colors based on base color and lap number
function generateLapColor(baseColor, lapNumber, totalLaps) {
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
    const hueShift = (lapNumber - 1) * (60 / totalLaps); // Spread across color spectrum
    const newHue = (baseHue + hueShift) % 360;
    
    // Vary lightness to create additional distinction
    const lightnessVariation = 10 + (lapNumber % 3) * 15; // 10%, 25%, 40% variation
    const newLightness = Math.min(75, Math.max(35, baseLightness + lightnessVariation - 20));
    
    return `hsl(${newHue}, ${baseSat}%, ${newLightness}%)`;
}

// Helper functions for track information
function calculateTrackDistance(points) {
    if (!points || points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        // Haversine formula for distance calculation
        const R = 6371; // Earth's radius in kilometers
        const dLat = (curr.lat - prev.lat) * Math.PI / 180;
        const dLng = (curr.lng - prev.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistance += R * c;
    }
    
    return totalDistance;
}

function calculateTrackDuration(points) {
    if (!points || points.length < 2) return null;
    
    const startTime = points[0].time;
    const endTime = points[points.length - 1].time;
    
    if (!startTime || !endTime) return null;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return end.getTime() - start.getTime(); // Duration in milliseconds
}

function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    } else {
        return `${distanceKm.toFixed(2)}km`;
    }
}

function formatDuration(durationMs) {
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

function showFileInfo(fileId, lapNumber = null) {
    const file = gpxFiles.get(fileId);
    if (!file) return;
    
    let trackData;
    let displayName;
    
    if (lapNumber !== null) {
        // Check if this file already has a lap number in its filename
        const lapMatch = file.fileName.match(/^(.+) \(Lap (\d+)\)(.*)$/);
        if (lapMatch) {
            // This is a standalone lap file - use all its data
            const allPoints = [];
            file.data.tracks.forEach(track => {
                allPoints.push(...track.points);
            });
            trackData = { points: allPoints };
            displayName = file.fileName;
        } else {
            // Find the specific lap within a track that has been split by start/finish lines
            const track = file.data.tracks[0]; // Assuming single track per file
            if (track) {
                const laps = findTrackLaps(track, startLine, finishLine);
                const lap = laps.find(l => l.lapNumber === lapNumber);
                if (lap) {
                    const lapPoints = track.points.slice(lap.startIndex, lap.endIndex + 1);
                    trackData = { points: lapPoints };
                    displayName = `${file.fileName} - Lap ${lapNumber}`;
                }
            }
        }
    } else {
        // Use all tracks from the file
        const allPoints = [];
        file.data.tracks.forEach(track => {
            allPoints.push(...track.points);
        });
        trackData = { points: allPoints };
        displayName = file.fileName;
    }
    
    if (!trackData || !trackData.points.length) {
        alert('No track data available');
        return;
    }
    
    const distance = calculateTrackDistance(trackData.points);
    const duration = calculateTrackDuration(trackData.points);
    const pointCount = trackData.points.length;
    
    const startTime = trackData.points[0].time ? new Date(trackData.points[0].time).toLocaleString() : 'N/A';
    const endTime = trackData.points[trackData.points.length - 1].time ? 
        new Date(trackData.points[trackData.points.length - 1].time).toLocaleString() : 'N/A';
    
    const elevationData = trackData.points.filter(p => p.elevation !== null).map(p => p.elevation);
    let elevationInfo = '';
    if (elevationData.length > 0) {
        const minElevation = Math.min(...elevationData);
        const maxElevation = Math.max(...elevationData);
        const elevationGain = maxElevation - minElevation;
        elevationInfo = `
            <p><strong>Elevation:</strong> ${minElevation.toFixed(0)}m - ${maxElevation.toFixed(0)}m (${elevationGain.toFixed(0)}m gain)</p>
        `;
    }
    
    const infoContent = `
        <div style="max-width: 400px;">
            <h3>${displayName}</h3>
            <p><strong>Distance:</strong> ${formatDistance(distance)}</p>
            <p><strong>Duration:</strong> ${formatDuration(duration)}</p>
            <p><strong>Points:</strong> ${pointCount}</p>
            <p><strong>Start Time:</strong> ${startTime}</p>
            <p><strong>End Time:</strong> ${endTime}</p>
            ${elevationInfo}
            <p><strong>Tracks:</strong> ${file.data.tracks.length}</p>
            <p><strong>Routes:</strong> ${file.data.routes.length}</p>
            <p><strong>Waypoints:</strong> ${file.data.waypoints.length}</p>
        </div>
    `;
    
    // Create a simple modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
    `;
    
    modalContent.innerHTML = infoContent + `
        <div style="text-align: right; margin-top: 20px;">
            <button id="closeInfoModal" 
                    style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close
            </button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add click event listener to close button
    document.getElementById('closeInfoModal').addEventListener('click', function() {
        modal.remove();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Geometric utility functions for line intersection calculations
function distanceToLineSegment(point, line1, line2) {
    const A = point.lng - line1.lng;
    const B = point.lat - line1.lat;
    const C = line2.lng - line1.lng;
    const D = line2.lat - line1.lat;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = line1.lng;
        yy = line1.lat;
    } else if (param > 1) {
        xx = line2.lng;
        yy = line2.lat;
    } else {
        xx = line1.lng + param * C;
        yy = line1.lat + param * D;
    }

    const dx = point.lng - xx;
    const dy = point.lat - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function checkLineIntersection(track, line) {
    if (!line || !track.points || track.points.length < 2) {
        return null;
    }

    const lineLatLngs = line.line.getLatLngs();
    const lineStart = lineLatLngs[0];
    const lineEnd = lineLatLngs[1];
    
    // Threshold for intersection detection (in degrees, roughly 10 meters)
    const intersectionThreshold = 0.0001;
    
    for (let i = 0; i < track.points.length; i++) {
        const point = track.points[i];
        const distance = distanceToLineSegment(point, lineStart, lineEnd);
        
        if (distance < intersectionThreshold) {
            return {
                pointIndex: i,
                point: point,
                distance: distance
            };
        }
    }
    
    return null;
}

function findAllLineIntersections(track, line) {
    if (!line || !track.points || track.points.length < 2) {
        return [];
    }

    const lineLatLngs = line.line.getLatLngs();
    const lineStart = lineLatLngs[0];
    const lineEnd = lineLatLngs[1];
    
    // Threshold for intersection detection (in degrees, roughly 10 meters)
    const intersectionThreshold = 0.0001;
    const allIntersections = [];
    
    // Find all points within threshold
    for (let i = 0; i < track.points.length; i++) {
        const point = track.points[i];
        const distance = distanceToLineSegment(point, lineStart, lineEnd);
        
        if (distance < intersectionThreshold) {
            allIntersections.push({
                pointIndex: i,
                point: point,
                distance: distance
            });
        }
    }
    
    // Group consecutive intersections and return only one per crossing
    const intersections = [];
    let currentGroup = [];
    
    for (let i = 0; i < allIntersections.length; i++) {
        const intersection = allIntersections[i];
        
        if (currentGroup.length === 0 || 
            intersection.pointIndex === currentGroup[currentGroup.length - 1].pointIndex + 1) {
            // This point is consecutive to the current group
            currentGroup.push(intersection);
        } else {
            // Gap found, process the current group and start a new one
            if (currentGroup.length > 0) {
                // Find the point with minimum distance in this group
                const bestIntersection = currentGroup.reduce((best, current) => 
                    current.distance < best.distance ? current : best
                );
                intersections.push(bestIntersection);
            }
            currentGroup = [intersection];
        }
    }
    
    // Process the last group
    if (currentGroup.length > 0) {
        const bestIntersection = currentGroup.reduce((best, current) => 
            current.distance < best.distance ? current : best
        );
        intersections.push(bestIntersection);
    }
    
    return intersections;
}

// Function to calculate precise intersection point between track and line
function calculateLineIntersectionPoint(track, line, nearestPointIndex) {
    if (!line || !track.points || nearestPointIndex >= track.points.length) {
        return null;
    }

    const lineLatLngs = line.line.getLatLngs();
    const lineStart = lineLatLngs[0];
    const lineEnd = lineLatLngs[1];
    
    // Get the nearest point and adjacent points for interpolation
    const point = track.points[nearestPointIndex];
    
    // Try to find a better intersection by checking adjacent segments
    let bestIntersection = { lat: point.lat, lng: point.lng };
    let bestDistance = distanceToLineSegment(point, lineStart, lineEnd);
    
    // Check previous segment
    if (nearestPointIndex > 0) {
        const prevPoint = track.points[nearestPointIndex - 1];
        const intersection = lineSegmentIntersection(
            prevPoint, point,
            lineStart, lineEnd
        );
        if (intersection) {
            const distance = distanceToLineSegment(intersection, lineStart, lineEnd);
            if (distance < bestDistance) {
                bestIntersection = intersection;
                bestDistance = distance;
            }
        }
    }
    
    // Check next segment
    if (nearestPointIndex < track.points.length - 1) {
        const nextPoint = track.points[nearestPointIndex + 1];
        const intersection = lineSegmentIntersection(
            point, nextPoint,
            lineStart, lineEnd
        );
        if (intersection) {
            const distance = distanceToLineSegment(intersection, lineStart, lineEnd);
            if (distance < bestDistance) {
                bestIntersection = intersection;
                bestDistance = distance;
            }
        }
    }
    
    return bestIntersection;
}

// Function to find intersection between two line segments
function lineSegmentIntersection(p1, p2, p3, p4) {
    const x1 = p1.lng, y1 = p1.lat;
    const x2 = p2.lng, y2 = p2.lat;
    const x3 = p3.lng, y3 = p3.lat;
    const x4 = p4.lng, y4 = p4.lat;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // Lines are parallel
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            lat: y1 + t * (y2 - y1),
            lng: x1 + t * (x2 - x1)
        };
    }
    
    return null;
}

function findTrackSegment(track, startLine, finishLine) {
    const startIntersection = startLine ? checkLineIntersection(track, startLine) : null;
    const finishIntersection = finishLine ? checkLineIntersection(track, finishLine) : null;
    
    let startIndex = 0;
    let endIndex = track.points.length - 1;
    let interpolatedStart = null;
    let interpolatedEnd = null;
    
    if (startIntersection) {
        startIndex = startIntersection.pointIndex;
        // Calculate interpolated position on the start line
        interpolatedStart = calculateLineIntersectionPoint(track, startLine, startIntersection.pointIndex);
    }
    
    if (finishIntersection) {
        endIndex = finishIntersection.pointIndex;
        // Calculate interpolated position on the finish line
        interpolatedEnd = calculateLineIntersectionPoint(track, finishLine, finishIntersection.pointIndex);
    }
    
    // Ensure start comes before finish
    if (startIndex >= endIndex) {
        if (startIntersection && finishIntersection) {
            // If both lines intersect but start is after finish, swap them
            const temp = startIndex;
            startIndex = endIndex;
            endIndex = temp;
            const tempInterpolated = interpolatedStart;
            interpolatedStart = interpolatedEnd;
            interpolatedEnd = tempInterpolated;
        }
    }
    
    return {
        startIndex: startIndex,
        endIndex: endIndex,
        hasStartLine: !!startIntersection,
        hasFinishLine: !!finishIntersection,
        totalPoints: endIndex - startIndex + 1,
        interpolatedStart: interpolatedStart,
        interpolatedEnd: interpolatedEnd
    };
}

function findTrackLaps(track, startLine, finishLine) {
    // Find all intersections with start and finish lines
    const startIntersections = startLine ? findAllLineIntersections(track, startLine) : [];
    const finishIntersections = finishLine ? findAllLineIntersections(track, finishLine) : [];
    
    // Debug logging
    console.log(`Track analysis: Found ${startIntersections.length} start intersections and ${finishIntersections.length} finish intersections`);
    if (startIntersections.length > 0) {
        console.log('Start intersections at points:', startIntersections.map(s => s.pointIndex));
    }
    if (finishIntersections.length > 0) {
        console.log('Finish intersections at points:', finishIntersections.map(f => f.pointIndex));
    }
    
    const laps = [];
    
    // If we have both start and finish lines, find complete laps
    if (startIntersections.length > 0 && finishIntersections.length > 0) {
        // Create laps by properly sequencing start->finish->start->finish...
        let lapNumber = 1;
        let lastFinishIndex = -1;
        
        for (let i = 0; i < startIntersections.length; i++) {
            const startPoint = startIntersections[i];
            
            // Only consider starts that come after the last used finish line
            if (startPoint.pointIndex > lastFinishIndex) {
                // Find the next finish line after this start
                const finishPoint = finishIntersections.find(f => f.pointIndex > startPoint.pointIndex);
                
                if (finishPoint) {
                    const interpolatedStart = calculateLineIntersectionPoint(track, startLine, startPoint.pointIndex);
                    const interpolatedEnd = calculateLineIntersectionPoint(track, finishLine, finishPoint.pointIndex);
                    
                    laps.push({
                        startIndex: startPoint.pointIndex,
                        endIndex: finishPoint.pointIndex,
                        hasStartLine: true,
                        hasFinishLine: true,
                        totalPoints: finishPoint.pointIndex - startPoint.pointIndex + 1,
                        interpolatedStart: interpolatedStart,
                        interpolatedEnd: interpolatedEnd,
                        lapNumber: lapNumber
                    });
                    
                    // Update the last used finish index to prevent overlapping laps
                    lastFinishIndex = finishPoint.pointIndex;
                    lapNumber++;
                }
            }
        }
    } else if (startIntersections.length > 0) {
        // Only start line exists - create segments from each start to the next start (or end)
        for (let i = 0; i < startIntersections.length; i++) {
            const startPoint = startIntersections[i];
            const nextStartPoint = startIntersections[i + 1];
            const endIndex = nextStartPoint ? nextStartPoint.pointIndex : track.points.length - 1;
            
            const interpolatedStart = calculateLineIntersectionPoint(track, startLine, startPoint.pointIndex);
            
            laps.push({
                startIndex: startPoint.pointIndex,
                endIndex: endIndex,
                hasStartLine: true,
                hasFinishLine: false,
                totalPoints: endIndex - startPoint.pointIndex + 1,
                interpolatedStart: interpolatedStart,
                interpolatedEnd: null,
                lapNumber: i + 1
            });
        }
    } else if (finishIntersections.length > 0) {
        // Only finish line exists - create segments from start (or previous finish) to each finish
        for (let i = 0; i < finishIntersections.length; i++) {
            const finishPoint = finishIntersections[i];
            const prevFinishPoint = finishIntersections[i - 1];
            const startIndex = prevFinishPoint ? prevFinishPoint.pointIndex : 0;
            
            const interpolatedEnd = calculateLineIntersectionPoint(track, finishLine, finishPoint.pointIndex);
            
            laps.push({
                startIndex: startIndex,
                endIndex: finishPoint.pointIndex,
                hasStartLine: false,
                hasFinishLine: true,
                totalPoints: finishPoint.pointIndex - startIndex + 1,
                interpolatedStart: null,
                interpolatedEnd: interpolatedEnd,
                lapNumber: i + 1
            });
        }
    }
    
    // If no intersections found, return the original single segment behavior
    if (laps.length === 0) {
        const segment = findTrackSegment(track, startLine, finishLine);
        segment.lapNumber = 1; // Add lap number for consistency
        console.log('No intersections found, returning single segment:', segment);
        return [segment];
    }
    
    console.log(`Created ${laps.length} laps:`, laps.map(lap => `Lap ${lap.lapNumber}: points ${lap.startIndex}-${lap.endIndex}`));
    return laps;
}

// Function to create a line between two points
function createLine(point1, point2, style, label) {
    const line = L.polyline([point1, point2], style).addTo(linesGroup);
    
    // Calculate line center and perpendicular offset
    const centerLat = (point1.lat + point2.lat) / 2;
    const centerLng = (point1.lng + point2.lng) / 2;
    
    // Calculate perpendicular direction to offset the label
    const deltaLat = point2.lat - point1.lat;
    const deltaLng = point2.lng - point1.lng;
    const lineLength = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
    
    // Normalize perpendicular vector and apply offset
    const offsetDistance = 0.0005; // Adjust this value to change offset distance
    const perpLat = -deltaLng / lineLength * offsetDistance;
    const perpLng = deltaLat / lineLength * offsetDistance;
    
    // Position label offset from line center
    const labelPosition = [centerLat + perpLat, centerLng + perpLng];
    
    const marker = L.marker(labelPosition, {
        icon: L.divIcon({
            className: 'line-label',
            html: `<div style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; border: 2px solid ${style.color}; color: ${style.color}; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${label}</div>`,
            iconSize: [60, 20],
            iconAnchor: [30, 10]
        })
    }).addTo(linesGroup);
    
    return { line, marker };
}

// GPX parsing function
function parseGPX(gpxContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, "text/xml");
    
    const tracks = [];
    const routes = [];
    const waypoints = [];
    
    // Parse tracks
    const trkElements = xmlDoc.getElementsByTagName('trk');
    for (let i = 0; i < trkElements.length; i++) {
        const track = trkElements[i];
        const trackName = track.getElementsByTagName('name')[0]?.textContent || `Track ${i + 1}`;
        const segments = track.getElementsByTagName('trkseg');
        
        for (let j = 0; j < segments.length; j++) {
            const segment = segments[j];
            const points = segment.getElementsByTagName('trkpt');
            const trackPoints = [];
            
            for (let k = 0; k < points.length; k++) {
                const point = points[k];
                const lat = parseFloat(point.getAttribute('lat'));
                const lng = parseFloat(point.getAttribute('lon'));
                const ele = point.getElementsByTagName('ele')[0]?.textContent;
                const time = point.getElementsByTagName('time')[0]?.textContent;
                
                trackPoints.push({
                    lat: lat,
                    lng: lng,
                    elevation: ele ? parseFloat(ele) : null,
                    time: time
                });
            }
            
            if (trackPoints.length > 0) {
                tracks.push({
                    name: trackName,
                    segment: j,
                    points: trackPoints
                });
            }
        }
    }
    
    // Parse routes
    const rteElements = xmlDoc.getElementsByTagName('rte');
    for (let i = 0; i < rteElements.length; i++) {
        const route = rteElements[i];
        const routeName = route.getElementsByTagName('name')[0]?.textContent || `Route ${i + 1}`;
        const points = route.getElementsByTagName('rtept');
        const routePoints = [];
        
        for (let j = 0; j < points.length; j++) {
            const point = points[j];
            const lat = parseFloat(point.getAttribute('lat'));
            const lng = parseFloat(point.getAttribute('lon'));
            
            routePoints.push({ lat: lat, lng: lng });
        }
        
        if (routePoints.length > 0) {
            routes.push({
                name: routeName,
                points: routePoints
            });
        }
    }
    
    // Parse waypoints
    const wptElements = xmlDoc.getElementsByTagName('wpt');
    for (let i = 0; i < wptElements.length; i++) {
        const waypoint = wptElements[i];
        const lat = parseFloat(waypoint.getAttribute('lat'));
        const lng = parseFloat(waypoint.getAttribute('lon'));
        const name = waypoint.getElementsByTagName('name')[0]?.textContent || `Waypoint ${i + 1}`;
        const desc = waypoint.getElementsByTagName('desc')[0]?.textContent || '';
        
        waypoints.push({
            lat: lat,
            lng: lng,
            name: name,
            description: desc
        });
    }
    
    return { tracks, routes, waypoints };
}

// Function to create GPX layers
function createGpxLayers(gpxData, color, fileName) {
    const layers = [];
    let totalPoints = 0;
    
    // Create tracks
    gpxData.tracks.forEach((track, index) => {
        const latLngs = track.points.map(point => [point.lat, point.lng]);
        totalPoints += track.points.length;
        
        if (latLngs.length > 0) {
            const polyline = L.polyline(latLngs, {
                ...gpxTrackStyle,
                color: color
            });
            
            // Add popup with track info
            const popupContent = `
                <div>
                    <h4>${track.name}</h4>
                    <p><strong>File:</strong> ${fileName}</p>
                    <p><strong>Points:</strong> ${track.points.length}</p>
                    <p><strong>Segment:</strong> ${track.segment + 1}</p>
                    ${track.points[0].elevation ? `<p><strong>Start Elevation:</strong> ${track.points[0].elevation}m</p>` : ''}
                </div>
            `;
            polyline.bindPopup(popupContent);
            
            layers.push(polyline);
        }
    });
    
    // Create routes
    gpxData.routes.forEach((route, index) => {
        const latLngs = route.points.map(point => [point.lat, point.lng]);
        totalPoints += route.points.length;
        
        if (latLngs.length > 0) {
            const polyline = L.polyline(latLngs, {
                ...gpxTrackStyle,
                color: color,
                dashArray: '5, 5'
            });
            
            polyline.bindPopup(`
                <div>
                    <h4>${route.name}</h4>
                    <p><strong>File:</strong> ${fileName}</p>
                    <p><strong>Route Points:</strong> ${route.points.length}</p>
                    <p><em>Route (planned path)</em></p>
                </div>
            `);
            
            layers.push(polyline);
        }
    });
    
    // Create waypoints
    gpxData.waypoints.forEach(waypoint => {
        const marker = L.circleMarker([waypoint.lat, waypoint.lng], {
            ...gpxWaypointStyle,
            fillColor: color
        });
        
        marker.bindPopup(`
            <div>
                <h4>${waypoint.name}</h4>
                <p><strong>File:</strong> ${fileName}</p>
                ${waypoint.description ? `<p>${waypoint.description}</p>` : ''}
                <p><strong>Coordinates:</strong> ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}</p>
            </div>
        `);
        
        layers.push(marker);
        totalPoints++;
    });
    
    return { layers, totalPoints };
}

// Function to add GPX file
function addGpxFile(fileName, gpxData) {
    return addGpxFileInternal(fileName, gpxData);
}

// Function to remove GPX file
function removeGpxFile(fileId) {
    removeGpxFileInternal(fileId);
    updateFileList();
    console.log(`Removed GPX file with ID: ${fileId}`);
}

// Function to toggle GPX file visibility
function toggleGpxFile(fileId) {
    const file = gpxFiles.get(fileId);
    if (file) {
        file.visible = !file.visible;
        
        if (file.visible) {
            file.layers.forEach(layer => layer.addTo(map));
        } else {
            file.layers.forEach(layer => map.removeLayer(layer));
        }
        
        // Update playback marker visibility if playback is active
        updatePlaybackMarkerVisibility();
        
        updateFileList();
        console.log(`Toggled GPX file: ${file.fileName} (${file.visible ? 'visible' : 'hidden'})`);
    }
}

// Function to update map bounds to show all visible GPX files
function updateMapBounds() {
    let bounds = L.latLngBounds();
    let hasVisibleData = false;
    
    gpxFiles.forEach(file => {
        if (file.visible) {
            file.data.tracks.forEach(track => {
                track.points.forEach(point => {
                    bounds.extend([point.lat, point.lng]);
                    hasVisibleData = true;
                });
            });
            
            file.data.routes.forEach(route => {
                route.points.forEach(point => {
                    bounds.extend([point.lat, point.lng]);
                    hasVisibleData = true;
                });
            });
            
            file.data.waypoints.forEach(waypoint => {
                bounds.extend([waypoint.lat, waypoint.lng]);
                hasVisibleData = true;
            });
        }
    });
    
    if (hasVisibleData) {
        map.fitBounds(bounds, { padding: [20, 20] });
    }
}

// Function to update file list UI
function updateFileList() {
    const content = document.getElementById('fileListContent');
    
    if (gpxFiles.size === 0) {
        content.innerHTML = '<p class="no-files">No GPX files loaded</p>';
        return;
    }

    // Group files by base name to show laps as sub-items
    const fileGroups = new Map(); // Map<baseName, Array<{fileId, file, lapInfo}>>
    
    gpxFiles.forEach((file, fileId) => {
        // Check if this is a lap file by looking for " (Lap " in the filename
        const lapMatch = file.fileName.match(/^(.+) \(Lap (\d+)\)(.*)$/);
        
        if (lapMatch) {
            // This is a lap file
            const [, baseName, lapNumber, extension] = lapMatch;
            const fullBaseName = baseName + extension;
            
            if (!fileGroups.has(fullBaseName)) {
                fileGroups.set(fullBaseName, []);
            }
            fileGroups.get(fullBaseName).push({
                fileId: fileId,
                file: file,
                lapNumber: parseInt(lapNumber),
                isLap: true
            });
        } else {
            // This is a regular file
            if (!fileGroups.has(file.fileName)) {
                fileGroups.set(file.fileName, []);
            }
            fileGroups.get(file.fileName).push({
                fileId: fileId,
                file: file,
                lapNumber: 0,
                isLap: false
            });
        }
    });
    
    let html = '';
    fileGroups.forEach((files, baseName) => {
        // Sort files by lap number
        files.sort((a, b) => a.lapNumber - b.lapNumber);
        
        if (files.length === 1 && !files[0].isLap) {
            // Single file that is not a lap - display normally
            const { fileId, file } = files[0];
            
            html += `
                <div class="file-item">
                    <div class="file-color" style="background-color: ${file.color};"></div>
                    <div class="file-info">
                        <div class="file-name" title="${file.fileName}">${file.fileName}</div>
                        <div class="file-actions">
                            <button class="file-btn info" 
                                    onclick="showFileInfo(${fileId})" 
                                    title="Show file information">
                                ℹ️
                            </button>
                            <button class="file-btn baseline ${selectedBaselineFileId === fileId && selectedBaselineLapNumber === null ? 'active' : ''}" 
                                    onclick="setBaseline(${fileId}, 0, null)" 
                                    title="Set as baseline for analysis">
                                📊
                            </button>
                            <button class="file-btn toggle ${file.visible ? '' : 'inactive'}" 
                                    onclick="toggleGpxFile(${fileId})" 
                                    title="${file.visible ? 'Hide' : 'Show'} file">
                                ${file.visible ? '👁️' : '👁️‍🗨️'}
                            </button>
                            <button class="file-btn remove" 
                                    onclick="removeGpxFile(${fileId})" 
                                    title="Remove file">
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Multiple files or any lap files (including single lap files) - group them
            html += `
                <div class="file-group">
                    <div class="file-item group-header">
                        <div class="file-color" style="background-color: ${files[0].file.color};"></div>
                        <div class="file-info">
                            <div class="file-name" title="${baseName}">${baseName}</div>
                            <div class="file-stats">
                                ${files.length} lap${files.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="file-btn group-toggle" 
                                    onclick="toggleFileGroup('${baseName}')" 
                                    title="Expand/Collapse laps">
                                ▼
                            </button>
                        </div>
                    </div>
                    <div class="lap-list" id="laps-${baseName.replace(/[^a-zA-Z0-9]/g, '_')}">
            `;
            
            files.forEach(({ fileId, file, lapNumber, isLap }) => {
                const displayName = isLap ? `Lap ${lapNumber}` : file.fileName;
                
                html += `
                    <div class="file-item lap-item">
                        <div class="file-color" style="background-color: ${file.color};"></div>
                        <div class="file-info">
                            <div class="file-name" title="${file.fileName}">${displayName}</div>
                            <div class="file-actions">
                                <button class="file-btn info" 
                                        onclick="showFileInfo(${fileId}, ${isLap ? lapNumber : 'null'})" 
                                        title="Show ${isLap ? 'lap' : 'file'} information">
                                    ℹ️
                                </button>
                                <button class="file-btn baseline ${selectedBaselineFileId === fileId && (isLap ? selectedBaselineLapNumber === lapNumber : selectedBaselineLapNumber === null) ? 'active' : ''}" 
                                        onclick="setBaseline(${fileId}, 0, ${isLap ? lapNumber : 'null'})" 
                                        title="Set as baseline for analysis">
                                    📊
                                </button>
                                <button class="file-btn toggle ${file.visible ? '' : 'inactive'}" 
                                        onclick="toggleGpxFile(${fileId})" 
                                        title="${file.visible ? 'Hide' : 'Show'} file">
                                    ${file.visible ? '👁️' : '👁️‍🗨️'}
                                </button>
                                <button class="file-btn remove" 
                                        onclick="removeGpxFile(${fileId})" 
                                        title="Remove file">
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    });
    
    // Add global playback button
    if (gpxFiles.size > 0) {
        html += `
            <div class="file-item" style="border-top: 2px solid #dee2e6; margin-top: 8px; padding-top: 12px;">
                <div class="file-info">
                    <div class="file-name">Track Playback</div>
                    <div class="file-stats">Animate visible tracks</div>
                </div>
                <div class="file-actions">
                    <button class="file-btn" onclick="startPlayback()" title="Start playback">
                        ▶
                    </button>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

// Function to toggle file group expand/collapse
function toggleFileGroup(baseName) {
    const lapList = document.getElementById(`laps-${baseName.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const button = event.target;
    
    if (lapList.style.display === 'none') {
        lapList.style.display = 'block';
        button.textContent = '▼';
    } else {
        lapList.style.display = 'none';
        button.textContent = '▶';
    }
}

// Function to reset drawing state
function resetDrawing() {
    isDrawingStartLine = false;
    isDrawingFinishLine = false;
    drawingPoints = [];
    map.getContainer().style.cursor = '';
    
    // Reset button states
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

// File upload handlers
document.getElementById('uploadGpx').addEventListener('click', function() {
    document.getElementById('gpxFileInput').click();
});

document.getElementById('gpxFileInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    let loadedCount = 0;
    
    files.forEach(file => {
        if (file && file.name.toLowerCase().endsWith('.gpx')) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const gpxContent = event.target.result;
                    const gpxData = parseGPX(gpxContent);
                    addGpxFile(file.name, gpxData);
                    
                    loadedCount++;
                    if (loadedCount === files.length) {
                        // Show file list if it was hidden
                        const fileList = document.getElementById('gpxFileList');
                        if (fileList.classList.contains('hidden')) {
                            toggleFileList();
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
    
    // Clear the input so the same files can be selected again
    this.value = '';
});

// File list controls
function toggleFileList() {
    const fileList = document.getElementById('gpxFileList');
    const button = document.getElementById('toggleFileList');
    
    fileList.classList.toggle('hidden');
    button.textContent = fileList.classList.contains('hidden') ? 'Show Files' : 'Hide Files';
}

document.getElementById('toggleFileList').addEventListener('click', toggleFileList);

document.getElementById('closeFileList').addEventListener('click', function () {
    const fileList = document.getElementById('gpxFileList');
    const button = document.getElementById('toggleFileList');
    fileList.classList.add('hidden');
    button.textContent = 'Show Files';
});

// Function to clear all lines
function clearAllLines() {
    if (startLine) {
        linesGroup.removeLayer(startLine.line);
        linesGroup.removeLayer(startLine.marker);
        startLine = null;
    }
    
    if (finishLine) {
        linesGroup.removeLayer(finishLine.line);
        linesGroup.removeLayer(finishLine.marker);
        finishLine = null;
    }
    
    resetDrawing();
    console.log('All lines cleared');
}

// Add event listeners for line drawing buttons
document.getElementById('addStartLine').addEventListener('click', function() {
    if (isDrawingStartLine) {
        // Cancel drawing
        resetDrawing();
    } else {
        // Start drawing start line
        resetDrawing(); // Reset any other drawing states
        isDrawingStartLine = true;
        drawingPoints = [];
        
        this.classList.add('active');
        this.textContent = 'Click two points (Cancel)';
        map.getContainer().style.cursor = 'crosshair';
        
        console.log('Start line drawing mode activated');
    }
});

document.getElementById('addFinishLine').addEventListener('click', function() {
    if (isDrawingFinishLine) {
        // Cancel drawing
        resetDrawing();
    } else {
        // Start drawing finish line
        resetDrawing(); // Reset any other drawing states
        isDrawingFinishLine = true;
        drawingPoints = [];
        
        this.classList.add('active');
        this.textContent = 'Click two points (Cancel)';
        map.getContainer().style.cursor = 'crosshair';
        
        console.log('Finish line drawing mode activated');
    }
});

document.getElementById('clearLines').addEventListener('click', function() {
    clearAllLines();
});

document.getElementById('cropGpxFiles').addEventListener('click', function() {
    cropAllGpxFiles();
});

document.getElementById('undoCrop').addEventListener('click', function() {
    undoCrop();
});

// Map click handler for drawing lines
map.on('click', function(e) {
    if (isDrawingStartLine || isDrawingFinishLine) {
        drawingPoints.push(e.latlng);
        
        if (drawingPoints.length === 1) {
            // First point clicked, update button text
            const button = isDrawingStartLine ? 
                document.getElementById('addStartLine') : 
                document.getElementById('addFinishLine');
            button.textContent = 'Click second point (Cancel)';
            
            console.log('First point selected:', e.latlng);
        } else if (drawingPoints.length === 2) {
            // Second point clicked, create the line
            const point1 = drawingPoints[0];
            const point2 = drawingPoints[1];
            
            if (isDrawingStartLine) {
                // Remove existing start line if any
                if (startLine) {
                    linesGroup.removeLayer(startLine.line);
                    linesGroup.removeLayer(startLine.marker);
                }
                
                // Create new start line
                startLine = createLine(point1, point2, startLineStyle, 'START');
                console.log('Start line created between:', point1, point2);
            } else if (isDrawingFinishLine) {
                // Remove existing finish line if any
                if (finishLine) {
                    linesGroup.removeLayer(finishLine.line);
                    linesGroup.removeLayer(finishLine.marker);
                }
                
                // Create new finish line
                finishLine = createLine(point1, point2, finishLineStyle, 'FINISH');
                console.log('Finish line created between:', point1, point2);
            }
            
            // Reset drawing state
            resetDrawing();
        }
    }
});

// Add keyboard escape handler to cancel drawing
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && (isDrawingStartLine || isDrawingFinishLine)) {
        resetDrawing();
        console.log('Line drawing cancelled with Escape key');
    }
});

// Playback functionality - restructured for simultaneous track animation with start/finish line support
let playbackState = {
    isPlaying: false,
    isPaused: false,
    tracks: [], // Array of track objects with their own progress
    animationId: null,
    speed: 1,
    lastUpdateTime: 0,
    maxPoints: 0, // Maximum points across all tracks
    pauseStartTime: 0, // When pause was initiated
    smoothInterpolation: true, // Default to smooth playback
    followLocation: true // Whether to follow the playback markers on the map
};

const playbackLayer = L.layerGroup().addTo(map);

// Function to prepare tracks for simultaneous playback with start/finish line detection
function prepareTracksForPlayback() {
    const tracks = [];
    let maxPoints = 0;
    
    gpxFiles.forEach((file, fileId) => {
        if (file.visible && file.data.tracks.length > 0) {
            file.data.tracks.forEach((track, trackIndex) => {
                if (track.points.length > 0) {
                    // Use the new lap detection for better playback
                    const laps = findTrackLaps(track, startLine, finishLine);
                    
                    // For playback, include all laps as separate tracks
                    laps.forEach((lap, lapIndex) => {
                        // Create track name with lap number if multiple laps exist
                        let trackDisplayName = file.fileName;
                        if (laps.length > 1) {
                            trackDisplayName += ` (Lap ${lap.lapNumber})`;
                        }
                        
                        const trackData = {
                            fileId: fileId,
                            fileName: file.fileName,
                            trackIndex: trackIndex,
                            trackName: track.name,
                            displayName: trackDisplayName,
                            color: file.color,
                            points: track.points,
                            startIndex: lap.startIndex,
                            endIndex: lap.endIndex,
                            currentPointIndex: lap.startIndex,
                            marker: null,
                            isComplete: false,
                            hasStartLine: lap.hasStartLine,
                            hasFinishLine: lap.hasFinishLine,
                            segmentPoints: lap.totalPoints,
                            startTime: null, // Real playback start time
                            trackStartTime: null, // Track's first timestamp
                            pausedTime: 0, // Total time spent paused
                            interpolatedStart: lap.interpolatedStart,
                            interpolatedEnd: lap.interpolatedEnd,
                            usingInterpolatedStart: false, // Flag to track if we're using interpolated start
                            lapNumber: lap.lapNumber,
                            totalLaps: laps.length,
                            // Smooth interpolation properties
                            currentPosition: null, // Current interpolated position
                            targetPosition: null, // Target position to move towards
                            interpolationProgress: 0 // Progress between current and target (0-1)
                        };
                        
                        tracks.push(trackData);
                        maxPoints = Math.max(maxPoints, lap.totalPoints);
                    });
                }
            });
        }
    });
    
    return { tracks, maxPoints };
}

// Function to create playback marker for a specific track
function createTrackPlaybackMarker(track, lat, lng) {
    // Remove existing marker for this track
    if (track.marker) {
        playbackLayer.removeLayer(track.marker);
    }
    
    // Check if the file is visible before creating marker
    const file = gpxFiles.get(track.fileId);
    if (!file || !file.visible) {
        // File is hidden, don't create/show marker
        track.marker = null;
        return null;
    }
    
    // Create new marker with track's color
    track.marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: track.color,
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
        className: 'playback-marker'
    }).addTo(playbackLayer);
    
    // Add popup with current point info
    const point = track.points[track.currentPointIndex];
    const progressInSegment = track.currentPointIndex - track.startIndex + 1;
    
    // Calculate timing information if available
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
    
    return track.marker;
}

// Function to interpolate between two geographic points
function interpolatePosition(pos1, pos2, progress) {
    if (!pos1 || !pos2) return pos1 || pos2;
    
    // Linear interpolation between two lat/lng points
    return {
        lat: pos1.lat + (pos2.lat - pos1.lat) * progress,
        lng: pos1.lng + (pos2.lng - pos1.lng) * progress
    };
}

// Function to update track position with smooth interpolation
function updateTrackPosition(track) {
    if (!playbackState.smoothInterpolation) {
        // Jump mode - use exact GPS point positions
        const currentPoint = track.points[track.currentPointIndex];
        if (track.usingInterpolatedStart && track.interpolatedStart) {
            return track.interpolatedStart;
        }
        return { lat: currentPoint.lat, lng: currentPoint.lng };
    }
    
    // Smooth interpolation mode
    if (!track.currentPosition) {
        // Initialize position
        const currentPoint = track.points[track.currentPointIndex];
        if (track.usingInterpolatedStart && track.interpolatedStart) {
            track.currentPosition = { ...track.interpolatedStart };
            track.targetPosition = { lat: currentPoint.lat, lng: currentPoint.lng };
        } else {
            track.currentPosition = { lat: currentPoint.lat, lng: currentPoint.lng };
            const nextPoint = track.points[track.currentPointIndex + 1];
            if (nextPoint) {
                track.targetPosition = { lat: nextPoint.lat, lng: nextPoint.lng };
            }
        }
        track.interpolationProgress = 0;
        return track.currentPosition;
    }
    
    // Return interpolated position
    return interpolatePosition(track.currentPosition, track.targetPosition, track.interpolationProgress);
}

// Function to update playback progress based on realtime progress
function updatePlaybackProgress() {
    if (playbackState.tracks.length === 0) return;
    
    // Calculate progress based on time elapsed vs total track duration (only for visible tracks)
    let maxProgress = 0;
    let totalSegmentPoints = 0;
    let currentSegmentPoints = 0;
    let visibleTracksCount = 0;
    
    playbackState.tracks.forEach(track => {
        const file = gpxFiles.get(track.fileId);
        if (file && file.visible) {
            const segmentProgress = track.segmentPoints > 0 ? 
                (track.currentPointIndex - track.startIndex) / (track.endIndex - track.startIndex) : 0;
            maxProgress = Math.max(maxProgress, segmentProgress);
            
            totalSegmentPoints += track.segmentPoints;
            currentSegmentPoints += Math.max(0, track.currentPointIndex - track.startIndex);
            visibleTracksCount++;
        }
    });
    
    const progressPercent = maxProgress * 100;
    
    document.getElementById('progressFill').style.width = progressPercent + '%';
    document.getElementById('progressSlider').value = progressPercent;
    
    // Show timing information if available (only for visible tracks)
    const hasTimingData = playbackState.tracks.some(track => {
        const file = gpxFiles.get(track.fileId);
        return file && file.visible && 
               track.points[track.startIndex]?.time && track.points[track.endIndex]?.time;
    });
    
    if (hasTimingData) {
        document.getElementById('progressText').textContent = 
            `${Math.round(progressPercent)}% (realtime playback - ${currentSegmentPoints} / ${totalSegmentPoints} points from ${visibleTracksCount} visible tracks)`;
    } else {
        document.getElementById('progressText').textContent = 
            `${Math.round(progressPercent)}% (${currentSegmentPoints} / ${totalSegmentPoints} segment points from ${visibleTracksCount} visible tracks)`;
    }
}

// Animation function for realtime simultaneous playback
function animateSimultaneousPlayback() {
    if (!playbackState.isPlaying || playbackState.isPaused) {
        return;
    }
    
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
                createTrackPlaybackMarker(track, position.lat, position.lng);
                
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
                    // This ensures the interpolated position is visible for a moment
                    const interpolatedDelay = 500; // 0.5 second delay at start line
                    const realElapsed = ((now - track.startTime) - track.pausedTime) * playbackState.speed;
                    
                    if (realElapsed >= interpolatedDelay) {
                        // After delay, transition to first GPS point
                        shouldAdvance = true;
                    } else {
                        // Still showing interpolated start
                        hasActiveMarkers = true;
                    }
                } else if (nextPoint && nextPoint.time) {
                    // Normal advancement - use next point's time
                    targetTime = new Date(nextPoint.time).getTime();
                    const trackElapsed = targetTime - track.trackStartTime;
                    const realElapsed = ((now - track.startTime) - track.pausedTime) * playbackState.speed;
                    shouldAdvance = realElapsed >= trackElapsed;
                } else {
                    // No next point timing available, don't advance yet
                    hasActiveMarkers = true;
                }
            } else {
                // No timestamp data, fall back to regular interval
                const interval = 1000 / playbackState.speed; // 1 second intervals
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
                            // Update interpolation targets
                            track.currentPosition = { ...track.targetPosition };
                            track.targetPosition = { lat: nextGpsPoint.lat, lng: nextGpsPoint.lng };
                            track.interpolationProgress = 0;
                        }
                    }
                }
                
                if (isTrackVisible) hasActiveMarkers = true;
                
                // Mark track as complete if we've reached the end of the segment
                if (track.currentPointIndex > track.endIndex) {
                    track.isComplete = true;
                    console.log(`Track ${track.trackName} completed at point ${track.currentPointIndex}`);
                }
            } else if (playbackState.smoothInterpolation && track.currentPosition && track.targetPosition) {
                // Update interpolation progress for smooth movement
                const frameTime = deltaTime / 1000; // Convert to seconds
                const interpolationSpeed = playbackState.speed; // Adjust for smooth movement
                track.interpolationProgress = Math.min(1, track.interpolationProgress + frameTime * interpolationSpeed);
                if (isTrackVisible) hasActiveMarkers = true;
            } else {
                if (isTrackVisible) hasActiveMarkers = true; // Still has points to process
            }
            
            // Update marker position
            if (track.currentPosition || !playbackState.smoothInterpolation) {
                const position = updateTrackPosition(track);
                if (position) {
                    createTrackPlaybackMarker(track, position.lat, position.lng);
                }
            }
        }
    });
    
    updatePlaybackProgress();
    updateMapViewForPlayback(); // Follow the playback markers
    
    // Update analysis chart if visible
    if (isAnalysisVisible && analysisChart && currentAnalysisResult) {
        drawPlaybackMarkers();
    }
    
    if (!hasActiveMarkers) {
        // All visible tracks completed or no visible tracks
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
    playbackState.animationId = requestAnimationFrame(animateSimultaneousPlayback);
}

// Function to start simultaneous playback
function startPlayback() {
    const { tracks, maxPoints } = prepareTracksForPlayback();
    
    if (tracks.length === 0) {
        alert('No visible tracks available for playback. Please load and show some GPX files first.');
        return;
    }
    
    // Check if start/finish lines are defined
    let statusMessage = `Playing ${tracks.length} track${tracks.length !== 1 ? 's' : ''} simultaneously`;
    let hasStartOrFinish = false;
    
    // Check if start/finish lines are defined and add that info
    if (startLine || finishLine) {
        let lineInfo = [];
        if (startLine) {
            lineInfo.push('start line');
            hasStartOrFinish = true;
        }
        if (finishLine) {
            lineInfo.push('finish line');
            hasStartOrFinish = true;
        }
        statusMessage += ` + ${lineInfo.join(' and ')}`;
    }
    
    // Check if tracks have timing data
    const hasTimingData = tracks.some(track => 
        track.points[track.startIndex]?.time && track.points[track.endIndex]?.time
    );
    
    if (hasTimingData) {
        statusMessage += ' (realtime timing)';
        console.log('Realtime playback enabled - using GPX timestamps');
    } else {
        statusMessage += ' (no timing data - using intervals)';
        console.log('No timing data available - using interval-based playback');
    }
    
    // Reset all tracks to their start positions
    tracks.forEach(track => {
        track.currentPointIndex = track.startIndex;
        track.isComplete = false;
        track.marker = null;
        track.startTime = null;
        track.trackStartTime = null;
        track.pausedTime = 0;
        track.usingInterpolatedStart = false;
        // Reset interpolation state
        track.currentPosition = null;
        track.targetPosition = null;
        track.interpolationProgress = 0;
    });
    
    playbackState.tracks = tracks;
    playbackState.maxPoints = maxPoints;
    playbackState.isPlaying = true;
    playbackState.isPaused = false;
    playbackState.lastUpdateTime = Date.now();
    
    // Show playback controls
    document.getElementById('playbackControls').classList.remove('hidden');
    
    // Update track count info
    document.getElementById('trackCountInfo').textContent = statusMessage;
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '⏸';
    playPauseBtn.className = 'playback-btn pause';
    playPauseBtn.title = 'Pause';
    
    // Start animation
    animateSimultaneousPlayback();
    
    console.log(`Started simultaneous playback with ${tracks.length} tracks`);
    if (hasStartOrFinish) {
        console.log('Playback will respect start/finish line boundaries');
        tracks.forEach(track => {
            if (track.hasStartLine || track.hasFinishLine) {
                console.log(`Track ${track.trackName}: segment from point ${track.startIndex} to ${track.endIndex} (${track.segmentPoints} points)`);
            }
        });
    }
}

// Function to pause playback
function pausePlayback() {
    playbackState.isPaused = true;
    playbackState.pauseStartTime = Date.now();
    
    if (playbackState.animationId) {
        cancelAnimationFrame(playbackState.animationId);
        playbackState.animationId = null;
    }
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '▶';
    playPauseBtn.className = 'playback-btn play';
    playPauseBtn.title = 'Play';
    
    console.log('Playback paused');
}

// Function to resume playback
function resumePlayback() {
    // Check if all tracks are complete
    const allComplete = playbackState.tracks.every(track => track.isComplete);
    
    if (allComplete) {
        // If all tracks are complete, restart from beginning
        stopPlayback();
        startPlayback();
        return;
    }
    
    // Add the paused time to all tracks
    if (playbackState.pauseStartTime > 0) {
        const pauseDuration = Date.now() - playbackState.pauseStartTime;
        playbackState.tracks.forEach(track => {
            track.pausedTime += pauseDuration;
        });
        playbackState.pauseStartTime = 0;
    }
    
    playbackState.isPaused = false;
    playbackState.lastUpdateTime = Date.now();
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '⏸';
    playPauseBtn.className = 'playback-btn pause';
    playPauseBtn.title = 'Pause';
    
    // Resume animation
    animateSimultaneousPlayback();
    
    console.log('Playback resumed');
}

// Function to stop playback
function stopPlayback() {
    playbackState.isPlaying = false;
    playbackState.isPaused = false;
    
    if (playbackState.animationId) {
        cancelAnimationFrame(playbackState.animationId);
        playbackState.animationId = null;
    }
    
    // Remove all track markers
    playbackState.tracks.forEach(track => {
        if (track.marker) {
            playbackLayer.removeLayer(track.marker);
            track.marker = null;
        }
    track.currentPointIndex = track.startIndex;
    track.isComplete = false;
    track.startTime = null;
    track.trackStartTime = null;
    track.pausedTime = 0;
    track.usingInterpolatedStart = false;
    // Reset interpolation state
    track.currentPosition = null;
    track.targetPosition = null;
    track.interpolationProgress = 0;
        // Reset interpolation state
        track.currentPosition = null;
        track.targetPosition = null;
        track.interpolationProgress = 0;
    });
    
    playbackState.pauseStartTime = 0;
    
    // Reset track count info
    let statusMessage = 'Simultaneous playback ready';
    if (startLine || finishLine) {
        statusMessage += ' (start/finish lines detected)';
    }
    document.getElementById('trackCountInfo').textContent = statusMessage;
    
    // Update UI
    const playPauseBtn = document.getElementById('playPauseBtn');
    playPauseBtn.textContent = '▶';
    playPauseBtn.className = 'playback-btn play';
    playPauseBtn.title = 'Play';
    
    updatePlaybackProgress();
    
    console.log('Playback stopped');
}

// Function to seek to specific position (affects all tracks proportionally within their segments)
function seekToPosition(percent) {
    if (playbackState.tracks.length === 0) return;
    
    playbackState.tracks.forEach(track => {
        const segmentLength = track.endIndex - track.startIndex;
        const targetOffset = Math.floor((percent / 100) * segmentLength);
        const targetIndex = track.startIndex + targetOffset;
        
        track.currentPointIndex = Math.max(track.startIndex, Math.min(targetIndex, track.endIndex));
        track.isComplete = track.currentPointIndex >= track.endIndex;
        
        // Reset timing when seeking
        track.startTime = null;
        track.trackStartTime = null;
        track.pausedTime = 0;
        track.usingInterpolatedStart = false;
        
        // Update marker position if track has points
        if (track.points.length > 0 && track.currentPointIndex < track.points.length) {
            // Use interpolated start position if seeking to the beginning and start line exists
            if (percent === 0 && track.interpolatedStart && track.hasStartLine) {
                createTrackPlaybackMarker(track, track.interpolatedStart.lat, track.interpolatedStart.lng);
                track.usingInterpolatedStart = true; // Set this flag when showing interpolated start
            } else {
                const point = track.points[track.currentPointIndex];
                createTrackPlaybackMarker(track, point.lat, point.lng);
            }
        }
    });
    
    updatePlaybackProgress();
    
    // Update analysis chart if visible
    if (isAnalysisVisible && analysisChart && currentAnalysisResult) {
        drawPlaybackMarkers();
    }
}

// Function to update map view to follow playback markers
function updateMapViewForPlayback() {
    // Only follow if the setting is enabled
    if (!playbackState.followLocation || playbackState.tracks.length === 0) return;
    
    // Get all active marker positions from visible files only
    const activeMarkers = playbackState.tracks
        .filter(track => {
            const file = gpxFiles.get(track.fileId);
            return track.marker && !track.isComplete && file && file.visible;
        })
        .map(track => track.marker.getLatLng());
    
    if (activeMarkers.length === 0) return;
    
    // Get current map bounds with a buffer zone
    const currentBounds = map.getBounds();
    
    // Create a smaller buffer zone inside the current view to check if markers are getting close to edges
    const buffer = 0.15; // 15% buffer from edges
    const latDiff = currentBounds.getNorth() - currentBounds.getSouth();
    const lngDiff = currentBounds.getEast() - currentBounds.getWest();
    
    const bufferedBounds = L.latLngBounds(
        [currentBounds.getSouth() + latDiff * buffer, currentBounds.getWest() + lngDiff * buffer],
        [currentBounds.getNorth() - latDiff * buffer, currentBounds.getEast() - lngDiff * buffer]
    );
    
    // Check if any markers are outside the buffered area (approaching edges)
    const markersNearEdge = activeMarkers.some(markerPos => 
        !bufferedBounds.contains(markerPos)
    );
    
    // Only adjust map view if markers are approaching the edges or already outside
    if (markersNearEdge) {
        // Calculate bounds of all active markers
        const markerBounds = L.latLngBounds(activeMarkers);
        
        // Fit bounds with generous padding to avoid frequent adjustments
        map.fitBounds(markerBounds, { 
            padding: [80, 80], 
            animate: true, 
            duration: 0.8,
            maxZoom: map.getZoom() // Don't zoom in more than current level
        });
    }
}

// Function to update playback marker visibility based on file visibility
function updatePlaybackMarkerVisibility() {
    if (!playbackState.isPlaying || playbackState.tracks.length === 0) {
        return;
    }
    
    playbackState.tracks.forEach(track => {
        const file = gpxFiles.get(track.fileId);
        
        if (track.marker) {
            if (file && file.visible) {
                // File is visible - ensure marker is on the map
                if (!map.hasLayer(track.marker)) {
                    playbackLayer.addLayer(track.marker);
                }
            } else {
                // File is hidden - remove marker from the map
                if (map.hasLayer(track.marker)) {
                    playbackLayer.removeLayer(track.marker);
                }
            }
        }
    });
}

// Event listeners for playback controls
document.getElementById('playPauseBtn').addEventListener('click', function() {
    if (!playbackState.isPlaying) {
        startPlayback();
    } else if (playbackState.isPaused) {
        resumePlayback();
    } else {
        pausePlayback();
    }
});

document.getElementById('stopBtn').addEventListener('click', function() {
    stopPlayback();
});

document.getElementById('closePlayback').addEventListener('click', function() {
    stopPlayback();
    document.getElementById('playbackControls').classList.add('hidden');
});

document.getElementById('playbackSpeed').addEventListener('change', function() {
    const newSpeed = parseFloat(this.value);
    
    // If playback is active, adjust timing to maintain current position
    if (playbackState.isPlaying && !playbackState.isPaused && playbackState.tracks.length > 0) {
        const now = Date.now();
        
        playbackState.tracks.forEach(track => {
            if (track.startTime && track.trackStartTime) {
                // Calculate current progress with old speed
                const currentRealElapsed = ((now - track.startTime) - track.pausedTime) * playbackState.speed;
                
                // Adjust start time to maintain the same progress with new speed
                const newStartTime = now - (currentRealElapsed / newSpeed) - track.pausedTime;
                track.startTime = newStartTime;
            }
        });
    }
    
    playbackState.speed = newSpeed;
    console.log(`Playback speed changed to ${playbackState.speed}x`);
});

// Add event listener for smooth interpolation checkbox
document.getElementById('smoothInterpolation').addEventListener('change', function() {
    playbackState.smoothInterpolation = this.checked;
    
    // Reset all track interpolation states when changing modes
    if (playbackState.tracks) {
        playbackState.tracks.forEach(track => {
            track.currentPosition = null;
            track.targetPosition = null;
            track.interpolationProgress = 0;
        });
    }
});

// Add event listener for follow location checkbox
document.getElementById('followLocation').addEventListener('change', function() {
    playbackState.followLocation = this.checked;
    console.log(`Map following ${playbackState.followLocation ? 'enabled' : 'disabled'}`);
});

document.getElementById('progressSlider').addEventListener('input', function() {
    if (playbackState.tracks.length > 0) {
        seekToPosition(parseFloat(this.value));
    }
});

// Add keyboard shortcuts for playback
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && (isDrawingStartLine || isDrawingFinishLine)) {
        resetDrawing();
        console.log('Line drawing cancelled with Escape key');
    }
    
    // Playback keyboard shortcuts (only when not drawing lines)
    if (!isDrawingStartLine && !isDrawingFinishLine) {
        switch(e.key) {
            case ' ': // Spacebar for play/pause
                e.preventDefault();
                if (!playbackState.isPlaying) {
                    startPlayback();
                } else if (playbackState.isPaused) {
                    resumePlayback();
                } else {
                    pausePlayback();
                }
                break;
            case 'Enter': // Enter for stop
                e.preventDefault();
                stopPlayback();
                break;
        }
    }
});

// Function to crop all GPX files
function cropAllGpxFiles() {
    if (!startLine && !finishLine) {
        alert('Please set at least one line (start or finish) before cropping.');
        return;
    }
    
    if (gpxFiles.size === 0) {
        alert('No GPX files to crop. Please load some GPX files first.');
        return;
    }
    
    // Create backup before cropping
    createBackup();
    
    let croppedCount = 0;
    const filesToRemove = [];
    const filesToAdd = [];
    const filesWithoutIntersections = []; // Track files that don't intersect
    
    gpxFiles.forEach((file, fileId) => {
        if (file.data.tracks.length > 0) {
            const croppedGpxData = cropGpxData(file.data, file.fileName);
            
            // Always mark the original file for removal since we're cropping
            filesToRemove.push(fileId);
            
            if (croppedGpxData && croppedGpxData.tracks.length > 0) {
                // File has tracks that intersect with lines
                
                // Group tracks by original track and lap number to create separate files for each lap
                const lapGroups = new Map(); // Map<originalTrackIndex, Map<lapNumber, tracks>>
                
                croppedGpxData.tracks.forEach(track => {
                    if (!lapGroups.has(track.originalTrackIndex)) {
                        lapGroups.set(track.originalTrackIndex, new Map());
                    }
                    const trackLaps = lapGroups.get(track.originalTrackIndex);
                    if (!trackLaps.has(track.lapNumber)) {
                        trackLaps.set(track.lapNumber, []);
                    }
                    trackLaps.get(track.lapNumber).push(track);
                });
                
                // Create a separate file entry for each lap if multiple laps exist
                lapGroups.forEach((lapMap, originalTrackIndex) => {
                    const totalLapsForTrack = lapMap.size;
                    lapMap.forEach((tracks, lapNumber) => {
                        let fileName = file.fileName;
                        let lapColor = file.color; // Default to original color
                        
                        if (lapGroups.size > 1 || lapMap.size > 1) {
                            // Add lap suffix only if there are multiple tracks or multiple laps
                            const baseFileName = file.fileName.replace(/\.[^/.]+$/, ''); // Remove extension
                            const extension = file.fileName.match(/\.[^/.]+$/) || [''];
                            fileName = `${baseFileName} (Lap ${lapNumber})${extension[0]}`;
                            
                            // Generate unique color for this lap
                            lapColor = generateLapColor(file.color, lapNumber, totalLapsForTrack);
                        }
                        
                        filesToAdd.push({
                            fileName: fileName,
                            gpxData: {
                                tracks: tracks,
                                routes: [],
                                waypoints: []
                            },
                            originalColor: lapColor, // Use lap-specific color
                            wasVisible: file.visible,
                            originalFileId: fileId,
                            lapNumber: lapNumber,
                            originalTrackIndex: originalTrackIndex
                        });
                    });
                });
                
                croppedCount++;
            } else {
                // File has no tracks that intersect with lines - track it for reporting
                filesWithoutIntersections.push(file.fileName);
            }
        }
    });
    
    if (filesToRemove.length === 0) {
        alert('No GPX files to process.');
        return;
    }
    
    // Remove original files (both those with and without intersections)
    filesToRemove.forEach(fileId => {
        removeGpxFileInternal(fileId);
    });
    
    // Add cropped files with original colors and visibility
    filesToAdd.forEach(fileData => {
        const newFileId = addGpxFileInternal(fileData.fileName, fileData.gpxData, fileData.originalColor);
        if (!fileData.wasVisible) {
            toggleGpxFile(newFileId);
        }
    });
    
    // Show undo button and hide crop button
    updateCropButtonVisibility();
    
    // Create detailed success message
    let message = '';
    if (croppedCount > 0) {
        message += `Successfully cropped ${croppedCount} GPX file(s) into ${filesToAdd.length} lap segments.`;
    }
    if (filesWithoutIntersections.length > 0) {
        if (message) message += '\n\n';
        message += `${filesWithoutIntersections.length} file(s) were hidden because they don't intersect with the defined lines:\n`;
        message += filesWithoutIntersections.map(name => `• ${name}`).join('\n');
    }
    if (message) {
        message += '\n\nUse "Undo Crop" to restore original files.';
        alert(message);
    } else {
        alert('No tracks found that intersect with the defined lines. All files have been hidden.');
    }
}

// Function to create backup of current state
function createBackup() {
    gpxFilesBackup = new Map();
    gpxFiles.forEach((file, fileId) => {
        gpxFilesBackup.set(fileId, {
            data: JSON.parse(JSON.stringify(file.data)), // Deep copy
            visible: file.visible,
            color: file.color,
            fileName: file.fileName,
            totalPoints: file.totalPoints
        });
    });
}

// Function to undo crop
function undoCrop() {
    if (!gpxFilesBackup) {
        alert('No backup available to restore.');
        return;
    }
    
    // Clear current files
    const currentFileIds = Array.from(gpxFiles.keys());
    currentFileIds.forEach(fileId => {
        removeGpxFileInternal(fileId);
    });
    
    // Restore from backup
    gpxFilesBackup.forEach((file, fileId) => {
        const newFileId = addGpxFileInternal(file.fileName, file.data, file.color);
        if (!file.visible) {
            toggleGpxFile(newFileId);
        }
    });
    
    // Clear backup and update button visibility
    gpxFilesBackup = null;
    updateCropButtonVisibility();
    
    alert('Successfully restored original GPX files.');
}

// Internal function to remove GPX file without updating UI multiple times
function removeGpxFileInternal(fileId) {
    const file = gpxFiles.get(fileId);
    if (file) {
        // Remove layers from map
        file.layers.forEach(layer => map.removeLayer(layer));
        
        // Remove from storage
        gpxFiles.delete(fileId);
    }
}

// Internal function to add GPX file with specified color
function addGpxFileInternal(fileName, gpxData, color = null) {
    const fileId = nextFileId++;
    const fileColor = color || generateColor(gpxFiles.size);
    const { layers, totalPoints } = createGpxLayers(gpxData, fileColor, fileName);
    
    // Add layers to map
    layers.forEach(layer => layer.addTo(map));
    
    // Store file data
    gpxFiles.set(fileId, {
        data: gpxData,
        layers: layers,
        visible: true,
        color: fileColor,
        fileName: fileName,
        totalPoints: totalPoints
    });
    
    updateFileList();
    updateMapBounds();
    
    console.log(`Added GPX file: ${fileName} (${totalPoints} points)`);
    return fileId;
}

// Function to crop GPX data based on start and finish lines
function cropGpxData(gpxData, fileName) {
    const croppedTracks = [];
    let hasValidTracks = false;
    
    gpxData.tracks.forEach((track, trackIndex) => {
        if (track.points.length > 0) {
            const laps = findTrackLaps(track, startLine, finishLine);
            
            // Process each lap as a separate track
            laps.forEach((lap, lapIndex) => {
                // Only include laps that have intersections with at least one line
                if (lap.hasStartLine || lap.hasFinishLine) {
                    const croppedPoints = [];
                    
                    // Add interpolated start point if we have a start line intersection
                    if (lap.interpolatedStart) {
                        croppedPoints.push({
                            lat: lap.interpolatedStart.lat,
                            lng: lap.interpolatedStart.lng,
                            elevation: track.points[lap.startIndex]?.elevation || null,
                            time: track.points[lap.startIndex]?.time || null
                        });
                    }
                    
                    // Add the track points between start and end
                    for (let i = lap.startIndex; i <= lap.endIndex; i++) {
                        croppedPoints.push(track.points[i]);
                    }
                    
                    // Add interpolated end point if we have a finish line intersection
                    if (lap.interpolatedEnd) {
                        croppedPoints.push({
                            lat: lap.interpolatedEnd.lat,
                            lng: lap.interpolatedEnd.lng,
                            elevation: track.points[lap.endIndex]?.elevation || null,
                            time: track.points[lap.endIndex]?.time || null
                        });
                    }
                    
                    if (croppedPoints.length > 1) {
                        // Create track name with lap number if multiple laps exist
                        let trackName = track.name || `Track ${trackIndex + 1}`;
                        if (laps.length > 1) {
                            trackName += ` (Lap ${lap.lapNumber})`;
                        }
                        
                        croppedTracks.push({
                            name: trackName,
                            segment: track.segment,
                            points: croppedPoints,
                            originalTrackIndex: trackIndex,
                            lapNumber: lap.lapNumber,
                            totalLaps: laps.length
                        });
                        hasValidTracks = true;
                    }
                }
            });
        }
    });
    
    if (!hasValidTracks) {
        return null;
    }
    
    return {
        tracks: croppedTracks,
        routes: [], // Don't include routes in cropped files
        waypoints: [] // Don't include waypoints in cropped files
    };
}

// Track Analysis Functionality
let analysisChart = null;
let currentAnalysisResult = null;
let isAnalysisVisible = false;

function calculateTrackAnalysis() {
    const visibleTracks = [];
    
    // Get all visible tracks
    gpxFiles.forEach((file, fileId) => {
        if (file.visible && file.data.tracks.length > 0) {
            file.data.tracks.forEach((track, trackIndex) => {
                if (track.points.length > 0) {
                    // Check if this is already a cropped lap file
                    const lapMatch = file.fileName.match(/^(.+) \(Lap (\d+)\)(.*)$/);
                    
                    if (lapMatch) {
                        // This is already a cropped lap file - use it as-is
                        const [, baseName, lapNumber, extension] = lapMatch;
                        visibleTracks.push({
                            fileId: fileId,
                            fileName: file.fileName,
                            trackIndex: trackIndex,
                            lapNumber: parseInt(lapNumber),
                            points: track.points,
                            color: file.color
                        });
                    } else {
                        // This is an original file - check for multiple laps
                        const laps = findTrackLaps(track, startLine, finishLine);
                        
                        // For analysis, include all laps as separate tracks
                        laps.forEach((lap, lapIndex) => {
                            // Get the actual track points for analysis
                            let trackPoints = [];
                            for (let i = lap.startIndex; i <= lap.endIndex; i++) {
                                if (track.points[i]) {
                                    trackPoints.push({
                                        ...track.points[i],
                                        originalIndex: i
                                    });
                                }
                            }
                            
                            if (trackPoints.length > 1) {
                                // Create proper track name that matches the cropped file naming
                                let trackName = file.fileName;
                                if (laps.length > 1) {
                                    // Extract base filename and add lap info
                                    const baseFileName = file.fileName.replace(/\.[^/.]+$/, ''); // Remove extension
                                    const extension = file.fileName.match(/\.[^/.]+$/) || [''];
                                    trackName = `${baseFileName} (Lap ${lap.lapNumber})${extension[0]}`;
                                }
                                
                                visibleTracks.push({
                                    fileId: fileId,
                                    fileName: trackName,
                                    trackIndex: trackIndex,
                                    lapNumber: lap.lapNumber || 1,
                                    points: trackPoints,
                                    color: file.color,
                                    segment: lap
                                });
                            }
                        });
                    }
                }
            });
        }
    });
    
    if (visibleTracks.length < 2) {
        return {
            success: false,
            message: 'Need at least 2 visible tracks for analysis'
        };
    }
    
    // Find the selected baseline track
    let baselineTrack = null;
    let baselineIndex = -1;
    
    console.log(`Looking for baseline: fileId=${selectedBaselineFileId}, lapNumber=${selectedBaselineLapNumber}`);
    
    if (selectedBaselineFileId !== null) {
        // Look for the specifically selected baseline
        for (let i = 0; i < visibleTracks.length; i++) {
            const track = visibleTracks[i];
            console.log(`Track ${i}: fileId=${track.fileId}, lapNumber=${track.lapNumber}, fileName=${track.fileName}`);
            
            if (track.fileId === selectedBaselineFileId) {
                console.log('FileId matches! Checking lap number...');
                console.log(`Selected lap: ${selectedBaselineLapNumber}, Track lap: ${track.lapNumber}`);
                
                // Check if lap number matches (or both are null for non-lap tracks)
                if ((selectedBaselineLapNumber === null && track.lapNumber === undefined) ||
                    (selectedBaselineLapNumber !== null && track.lapNumber === selectedBaselineLapNumber)) {
                    baselineTrack = track;
                    baselineIndex = i;
                    console.log(`✓ Found baseline track: ${track.fileName}`);
                    break;
                } else {
                    console.log(`✗ Lap number mismatch: selected=${selectedBaselineLapNumber} (${typeof selectedBaselineLapNumber}), track=${track.lapNumber} (${typeof track.lapNumber})`);
                }
            }
        }
    }
    
    // If no baseline is selected or baseline is not visible, use first track
    if (!baselineTrack) {
        console.log('No selected baseline found, using first track');
        baselineTrack = visibleTracks[0];
        baselineIndex = 0;
    }
    
    // Get comparison tracks (all tracks except baseline)
    const comparisonTracks = visibleTracks.filter((_, index) => index !== baselineIndex);
    
    // Calculate cumulative distances for baseline track
    const baselineDistances = calculateCumulativeDistances(baselineTrack.points);
    
    // Analyze each comparison track against baseline
    const analysisResults = comparisonTracks.map(track => {
        const trackDistances = calculateCumulativeDistances(track.points);
        const timeDifferences = calculateTimeDifferences(baselineTrack, track, baselineDistances, trackDistances);
        
        return {
            fileName: track.fileName,
            color: track.color,
            distances: trackDistances,
            timeDifferences: timeDifferences,
            stats: calculateTrackStats(timeDifferences),
            fileId: track.fileId,
            trackIndex: track.trackIndex,
            lapNumber: track.lapNumber,
            points: track.points
        };
    });
    
    return {
        success: true,
        baseline: {
            fileName: baselineTrack.fileName,
            color: baselineTrack.color,
            distances: baselineDistances,
            fileId: baselineTrack.fileId,
            trackIndex: baselineTrack.trackIndex,
            lapNumber: baselineTrack.lapNumber,
            points: baselineTrack.points
        },
        comparisons: analysisResults
    };
}

function calculateCumulativeDistances(points) {
    const distances = [0];
    let totalDistance = 0;
    
    for (let i = 1; i < points.length; i++) {
        const dist = calculateHaversineDistance(
            points[i-1].lat, points[i-1].lng,
            points[i].lat, points[i].lng
        );
        totalDistance += dist;
        distances.push(totalDistance);
    }
    
    return distances;
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateTimeDifferences(baselineTrack, comparisonTrack, baselineDistances, comparisonDistances) {
    const differences = [];
    const maxDistance = Math.min(
        baselineDistances[baselineDistances.length - 1],
        comparisonDistances[comparisonDistances.length - 1]
    );
    
    // Sample at regular distance intervals
    const sampleInterval = maxDistance / 100; // 100 sample points
    
    let initialTimeDifference = null;
    
    for (let dist = 0; dist <= maxDistance; dist += sampleInterval) {
        const baselineTime = interpolateTimeAtDistance(baselineTrack.points, baselineDistances, dist);
        const comparisonTime = interpolateTimeAtDistance(comparisonTrack.points, comparisonDistances, dist);
        
        if (baselineTime !== null && comparisonTime !== null) {
            const timeDiff = (comparisonTime - baselineTime) / 1000; // Convert to seconds
            
            // Store the initial time difference to normalize all differences
            if (initialTimeDifference === null) {
                initialTimeDifference = timeDiff;
            }
            
            // Normalize the time difference so it starts at 0
            const normalizedTimeDiff = timeDiff - initialTimeDifference;
            
            differences.push({
                distance: dist,
                timeDifference: normalizedTimeDiff
            });
        }
    }
    
    return differences;
}

function interpolateTimeAtDistance(points, distances, targetDistance) {
    if (targetDistance <= 0) return points[0].time ? new Date(points[0].time).getTime() : null;
    
    for (let i = 1; i < distances.length; i++) {
        if (distances[i] >= targetDistance) {
            const t = (targetDistance - distances[i-1]) / (distances[i] - distances[i-1]);
            
            const time1 = points[i-1].time ? new Date(points[i-1].time).getTime() : null;
            const time2 = points[i].time ? new Date(points[i].time).getTime() : null;
            
            if (time1 !== null && time2 !== null) {
                return time1 + t * (time2 - time1);
            }
        }
    }
    
    const lastPoint = points[points.length - 1];
    return lastPoint.time ? new Date(lastPoint.time).getTime() : null;
}

function calculateTrackStats(timeDifferences) {
    if (timeDifferences.length === 0) return null;
    
    const times = timeDifferences.map(d => d.timeDifference);
    const avgDiff = times.reduce((a, b) => a + b, 0) / times.length;
    const maxDiff = Math.max(...times);
    const minDiff = Math.min(...times);
    
    return {
        average: avgDiff,
        maximum: maxDiff,
        minimum: minDiff,
        finalDifference: times[times.length - 1]
    };
}

function showAnalysis() {
    const analysisResult = calculateTrackAnalysis();
    
    if (!analysisResult.success) {
        alert(analysisResult.message);
        return;
    }
    
    // Store current analysis result for interactive features
    currentAnalysisResult = analysisResult;
    isAnalysisVisible = true;
    
    // Show the analysis controls
    document.getElementById('analysisControls').classList.remove('hidden');
    
    // Update analysis info
    document.getElementById('analysisInfo').textContent = 
        `Baseline: ${analysisResult.baseline.fileName} | Comparing ${analysisResult.comparisons.length} track(s) | Click graph to seek playback`;
    
    // Draw the chart
    drawAnalysisChart(analysisResult);
    
    // Update stats
    updateAnalysisStats(analysisResult);
}

function drawAnalysisChart(analysisResult) {
    const canvas = document.getElementById('differenceChart');
    const ctx = canvas.getContext('2d');
    
    // Store chart data for interactive features
    analysisChart = {
        canvas: canvas,
        ctx: ctx,
        analysisResult: analysisResult,
        padding: 40,
        chartWidth: canvas.width - 80,
        chartHeight: canvas.height - 80
    };
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up chart dimensions
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
    
    // Store chart scaling for interactive features
    analysisChart.maxDistance = maxDistance;
    analysisChart.maxTimeDiff = maxTimeDiff;
    analysisChart.zeroY = canvas.height - padding - (maxTimeDiff > 0 ? (chartHeight / 2) : 0);
    
    // Draw axes
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
    ctx.moveTo(padding, analysisChart.zeroY);
    ctx.lineTo(canvas.width - padding, analysisChart.zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw grid lines
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
        const x = padding + (i / 5) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, canvas.height - padding);
        ctx.stroke();
    }
    
    // Draw labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Distance (km)', canvas.width / 2, canvas.height - 5);
    
    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Time Difference (seconds)', 0, 0);
    ctx.restore();
    
    // Draw distance scale
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
        const x = padding + (i / 5) * chartWidth;
        const distance = (i / 5) * maxDistance;
        ctx.fillText(distance.toFixed(1), x, canvas.height - padding + 15);
    }
    
    // Draw time scale
    ctx.textAlign = 'right';
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue; // Skip zero line
        const y = analysisChart.zeroY - (i / 2) * (chartHeight / 2);
        const timeValue = (i / 2) * maxTimeDiff;
        if (y > padding && y < canvas.height - padding) {
            ctx.fillText(timeValue.toFixed(0) + 's', padding - 5, y + 3);
        }
    }
    
    // Draw data lines
    analysisResult.comparisons.forEach((comparison, index) => {
        if (comparison.timeDifferences.length === 0) return;
        
        ctx.strokeStyle = comparison.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        comparison.timeDifferences.forEach((point, pointIndex) => {
            const x = padding + (point.distance / 1000 / maxDistance) * chartWidth;
            const y = analysisChart.zeroY - (point.timeDifference / maxTimeDiff) * (chartHeight / 2);
            
            if (pointIndex === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    });
    
    // Draw legend
    let legendY = padding + 10;
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Baseline: ' + analysisResult.baseline.fileName, canvas.width - padding - 120, legendY);
    legendY += 12;
    
    analysisResult.comparisons.forEach((comparison, index) => {
        ctx.fillStyle = comparison.color;
        ctx.fillRect(canvas.width - padding - 120, legendY, 8, 8);
        ctx.fillStyle = '#333';
        ctx.fillText(comparison.fileName, canvas.width - padding - 108, legendY + 7);
        legendY += 12;
    });
    
    // Add click event listener for interactive seeking
    if (!canvas.hasAnalysisClickListener) {
        canvas.addEventListener('click', handleChartClick);
        canvas.hasAnalysisClickListener = true;
        canvas.style.cursor = 'pointer';
    }
    
    // Draw current playback positions if playback is active
    drawCurrentPlaybackMarkers(ctx, padding, chartWidth, chartHeight, maxDistance, analysisResult);
}

function drawCurrentPlaybackMarkers(ctx, padding, chartWidth, chartHeight, maxDistance, analysisResult) {
    if (playbackState.tracks.length === 0) return;
    
    // Draw vertical lines for current playback positions
    playbackState.tracks.forEach(track => {
        if (track.currentPointIndex < track.startIndex || track.currentPointIndex > track.endIndex) return;
        
        // Find matching track in analysis result
        let matchingTrack = null;
        if (track.fileId === analysisResult.baseline.fileId && 
            track.trackIndex === analysisResult.baseline.trackIndex) {
            matchingTrack = analysisResult.baseline;
        } else {
            matchingTrack = analysisResult.comparisons.find(comp => 
                comp.fileId === track.fileId && comp.trackIndex === track.trackIndex
            );
        }
        
        if (!matchingTrack) return;
        
        // Calculate current distance for this track
        const segmentPoints = track.points.slice(track.startIndex, track.currentPointIndex + 1);
        const currentDistance = calculateCumulativeDistances(segmentPoints);
        const distanceKm = currentDistance[currentDistance.length - 1] / 1000;
        
        // Draw vertical marker line
        const x = padding + (distanceKm / maxDistance) * chartWidth;
        
        ctx.strokeStyle = matchingTrack.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, analysisChart.canvas.height - padding);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw marker dot at zero line
        ctx.fillStyle = matchingTrack.color;
        ctx.beginPath();
        ctx.arc(x, analysisChart.zeroY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw small text showing current time difference if comparison track
        if (matchingTrack !== analysisResult.baseline) {
            // Find closest time difference point
            const closestDiff = matchingTrack.timeDifferences.find(d => 
                Math.abs(d.distance - distanceKm * 1000) < 50
            );
            if (closestDiff) {
                ctx.fillStyle = matchingTrack.color;
                ctx.font = '9px Arial';
                ctx.textAlign = 'center';
                const timeText = (closestDiff.timeDifference >= 0 ? '+' : '') + closestDiff.timeDifference.toFixed(1) + 's';
                ctx.fillText(timeText, x, padding - 5);
            }
        }
    });
}

function updateAnalysisStats(analysisResult) {
    const statsContainer = document.getElementById('analysisStats');
    
    // Calculate baseline distance and duration
    const baselineDistance = calculateTrackDistance(analysisResult.baseline.points);
    const baselineDuration = calculateTrackDuration(analysisResult.baseline.points);
    
    let statsHtml = `
        <div style="margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
            <strong>Baseline:</strong> ${analysisResult.baseline.fileName}<br>
            <strong>Distance:</strong> ${formatDistance(baselineDistance)}<br>
            <strong>Duration:</strong> ${formatDuration(baselineDuration)}
        </div>
    `;
    
    analysisResult.comparisons.forEach((comparison, index) => {
        const stats = comparison.stats;
        if (stats) {
            // Calculate distance and duration for this comparison track
            const comparisonDistance = calculateTrackDistance(comparison.points);
            const comparisonDuration = calculateTrackDuration(comparison.points);
            const distanceDiff = comparisonDistance - baselineDistance;
            const durationDiff = comparisonDuration ? (baselineDuration ? comparisonDuration - baselineDuration : null) : null;
            
            statsHtml += `
                <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${comparison.color}; background-color: #f8f9fa;">
                    <div style="color: ${comparison.color}; font-weight: bold; margin-bottom: 5px;">${comparison.fileName}:</div>
                    <strong>Distance:</strong> ${formatDistance(comparisonDistance)}`;
            
            if (Math.abs(distanceDiff) > 0.001) { // Only show difference if significant (> 1m)
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

function closeAnalysis() {
    document.getElementById('analysisControls').classList.add('hidden');
    isAnalysisVisible = false;
    currentAnalysisResult = null;
    analysisChart = null;
}

function handleChartClick(event) {
    if (!analysisChart || !currentAnalysisResult) return;
    
    const rect = analysisChart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if click is within chart area
    if (x < analysisChart.padding || x > analysisChart.canvas.width - analysisChart.padding ||
        y < analysisChart.padding || y > analysisChart.canvas.height - analysisChart.padding) {
        return;
    }
    
    // Calculate distance from click position
    const relativeX = (x - analysisChart.padding) / analysisChart.chartWidth;
    const clickedDistance = relativeX * analysisChart.maxDistance * 1000; // Convert back to meters
    
    // Start playback and seek to this distance
    seekPlaybackToDistance(clickedDistance);
}

function seekPlaybackToDistance(targetDistance) {
    // Prepare tracks for playback if not already done
    if (playbackState.tracks.length === 0) {
        prepareTracksForPlayback();
    }
    
    // Find corresponding point indices for each track
    playbackState.tracks.forEach(track => {
        if (track.points.length === 0) return;
        
        // Calculate cumulative distances for this track
        const distances = calculateCumulativeDistances(track.points.slice(track.startIndex, track.endIndex + 1));
        
        // Find the point index closest to target distance
        let closestIndex = 0;
        let minDiff = Math.abs(distances[0] - targetDistance);
        
        for (let i = 1; i < distances.length; i++) {
            const diff = Math.abs(distances[i] - targetDistance);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        // Update track position
        track.currentPointIndex = track.startIndex + closestIndex;
        track.isComplete = track.currentPointIndex >= track.endIndex;
        
        // Reset timing when seeking
        track.startTime = null;
        track.trackStartTime = null;
        track.pausedTime = 0;
        track.usingInterpolatedStart = false;
        
        // Update marker position
        if (track.currentPointIndex < track.points.length) {
            const point = track.points[track.currentPointIndex];
            createTrackPlaybackMarker(track, point.lat, point.lng);
        }
    });
    
    // Show playback controls if hidden
    if (document.getElementById('playbackControls').classList.contains('hidden')) {
        document.getElementById('playbackControls').classList.remove('hidden');
    }
    
    // Update progress display
    updatePlaybackProgress();
    
    // Redraw chart with markers
    if (isAnalysisVisible && analysisChart) {
        drawPlaybackMarkers();
    }
}

function drawPlaybackMarkers() {
    if (!analysisChart || !currentAnalysisResult || playbackState.tracks.length === 0) return;
    
    // Redraw the entire chart to clear old markers
    const canvas = analysisChart.canvas;
    const ctx = analysisChart.ctx;
    
    // Save current chart state and redraw base chart
    drawAnalysisChart(currentAnalysisResult);
}

// Update the existing updatePlaybackProgress function to redraw chart markers
function updatePlaybackProgressWithChart() {
    updatePlaybackProgress();
    
    // Redraw chart markers if analysis is visible
    if (isAnalysisVisible && analysisChart && currentAnalysisResult) {
        // Redraw the entire chart to clear old markers
        drawAnalysisChart(currentAnalysisResult);
    }
}

// Event listeners for analysis
document.getElementById('analyzeTracks').addEventListener('click', function() {
    showAnalysis();
});

document.getElementById('closeAnalysis').addEventListener('click', function() {
    closeAnalysis();
});

// Initialize button visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    updateCropButtonVisibility();
    initializePanelDragAndResize();
});

// Panel Drag and Resize Functionality
let currentZIndex = 1000; // Starting z-index for panels

function initializePanelDragAndResize() {
    const panels = document.querySelectorAll('.resizable-panel');
    
    panels.forEach(panel => {
        const header = panel.querySelector('.panel-header');
        const resizeHandle = panel.querySelector('.resize-handle');
        
        // Add click handler to bring panel to front
        panel.addEventListener('mousedown', () => bringToFront(panel));
        
        // Make panel draggable
        if (header) {
            makeDraggable(panel, header);
        }
        
        // Make panel resizable
        if (resizeHandle) {
            makeResizable(panel, resizeHandle);
        }
    });
}

function bringToFront(panel) {
    currentZIndex++;
    panel.style.zIndex = currentZIndex;
}

function makeDraggable(panel, dragHandle) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    function dragStart(e) {
        // Don't drag if clicking on close button or other interactive elements
        if (e.target.classList.contains('close-btn') || 
            e.target.tagName === 'BUTTON' || 
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'SELECT') {
            return;
        }
        
        // Bring panel to front when starting to drag
        bringToFront(panel);
        
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
        
        if (e.target === dragHandle || dragHandle.contains(e.target)) {
            isDragging = true;
            panel.classList.add('dragging');
            
            // Get current position
            const rect = panel.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
    }
    
    function dragEnd(e) {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            panel.classList.remove('dragging');
        }
    }
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            
            xOffset = currentX;
            yOffset = currentY;
            
            // Constrain to viewport
            const rect = panel.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            
            currentX = Math.max(0, Math.min(currentX, maxX));
            currentY = Math.max(0, Math.min(currentY, maxY));
            
            panel.style.left = currentX + 'px';
            panel.style.top = currentY + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }
    }
    
    dragHandle.addEventListener('mousedown', dragStart, false);
    document.addEventListener('mouseup', dragEnd, false);
    document.addEventListener('mousemove', drag, false);
    
    // Touch events
    dragHandle.addEventListener('touchstart', dragStart, false);
    document.addEventListener('touchend', dragEnd, false);
    document.addEventListener('touchmove', drag, false);
}

function makeResizable(panel, resizeHandle) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    function initResize(e) {
        isResizing = true;
        panel.classList.add('resizing');
        
        // Bring panel to front when starting to resize
        bringToFront(panel);
        
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(window.getComputedStyle(panel).width, 10);
        startHeight = parseInt(window.getComputedStyle(panel).height, 10);
        
        document.addEventListener('mousemove', doResize, false);
        document.addEventListener('mouseup', stopResize, false);
        
        e.preventDefault();
    }
    
    function doResize(e) {
        if (!isResizing) return;
        
        const newWidth = startWidth + e.clientX - startX;
        const newHeight = startHeight + e.clientY - startY;
        
        // Apply minimum constraints
        const minWidth = parseInt(getComputedStyle(panel).minWidth) || 200;
        const minHeight = parseInt(getComputedStyle(panel).minHeight) || 150;
        
        // Apply maximum constraints (viewport size)
        const maxWidth = window.innerWidth - panel.offsetLeft - 20;
        const maxHeight = window.innerHeight - panel.offsetTop - 20;
        
        panel.style.width = Math.max(minWidth, Math.min(newWidth, maxWidth)) + 'px';
        panel.style.height = Math.max(minHeight, Math.min(newHeight, maxHeight)) + 'px';
        
        // Trigger resize event for charts if this is analysis panel
        if (panel.id === 'analysisControls' && window.analysisChart) {
            // Redraw analysis chart with new dimensions
            setTimeout(() => {
                const canvas = document.getElementById('differenceChart');
                if (canvas && currentAnalysisResult) {
                    canvas.width = Math.max(300, newWidth - 100);
                    canvas.height = Math.max(150, Math.min(300, newHeight * 0.4));
                    drawAnalysisChart(currentAnalysisResult);
                }
            }, 10);
        }
    }
    
    function stopResize() {
        isResizing = false;
        panel.classList.remove('resizing');
        document.removeEventListener('mousemove', doResize, false);
        document.removeEventListener('mouseup', stopResize, false);
    }
    
    resizeHandle.addEventListener('mousedown', initResize, false);
}

// Save panel positions and sizes to localStorage
function savePanelStates() {
    const panels = ['playbackControls', 'analysisControls', 'gpxFileList'];
    const states = {};
    
    panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            const rect = panel.getBoundingClientRect();
            states[panelId] = {
                left: panel.style.left || null,
                top: panel.style.top || null,
                right: panel.style.right || null,
                bottom: panel.style.bottom || null,
                width: panel.style.width || null,
                height: panel.style.height || null,
                zIndex: panel.style.zIndex || null
            };
        }
    });
    
    // Also save the current z-index counter
    states._currentZIndex = currentZIndex;
    
    localStorage.setItem('gpxSplitterPanelStates', JSON.stringify(states));
}

// Restore panel positions and sizes from localStorage
function restorePanelStates() {
    const savedStates = localStorage.getItem('gpxSplitterPanelStates');
    if (!savedStates) return;
    
    try {
        const states = JSON.parse(savedStates);
        
        // Restore the z-index counter
        if (states._currentZIndex) {
            currentZIndex = states._currentZIndex;
        }
        
        Object.keys(states).forEach(panelId => {
            if (panelId === '_currentZIndex') return; // Skip the z-index counter
            
            const panel = document.getElementById(panelId);
            const state = states[panelId];
            
            if (panel && state) {
                if (state.left) panel.style.left = state.left;
                if (state.top) panel.style.top = state.top;
                if (state.right) panel.style.right = state.right;
                if (state.bottom) panel.style.bottom = state.bottom;
                if (state.width) panel.style.width = state.width;
                if (state.height) panel.style.height = state.height;
                if (state.zIndex) panel.style.zIndex = state.zIndex;
            }
        });
    } catch (error) {
        console.warn('Failed to restore panel states:', error);
    }
}

// Save states when panels are moved or resized
window.addEventListener('beforeunload', savePanelStates);

// Restore states on page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(restorePanelStates, 100); // Small delay to ensure elements are ready
});


