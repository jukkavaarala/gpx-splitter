// Ylläs ski resort coordinates (Finland)
const yllasCoordinates = [67.55855, 24.24288];

// Initialize the map
const map = L.map('map', {
    center: yllasCoordinates,
    zoom: 13,
    zoomControl: true,
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

L.control.layers(baseMaps).addTo(map);

// Add scale control
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
    
    let html = '';
    gpxFiles.forEach((file, fileId) => {
        const trackCount = file.data.tracks.length;
        const routeCount = file.data.routes.length;
        const waypointCount = file.data.waypoints.length;
        
        html += `
            <div class="file-item">
                <div class="file-color" style="background-color: ${file.color};"></div>
                <div class="file-info">
                    <div class="file-name" title="${file.fileName}">${file.fileName}</div>
                    <div class="file-stats">
                        ${trackCount} tracks, ${routeCount} routes, ${waypointCount} waypoints
                    </div>
                </div>
                <div class="file-actions">
                    <button class="file-btn toggle ${file.visible ? '' : 'hidden'}" 
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
        `;
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
    smoothInterpolation: true // Default to smooth playback
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
                    // Find track segment between start and finish lines
                    const segment = findTrackSegment(track, startLine, finishLine);
                    
                    const trackData = {
                        fileId: fileId,
                        fileName: file.fileName,
                        trackIndex: trackIndex,
                        trackName: track.name,
                        color: file.color,
                        points: track.points,
                        startIndex: segment.startIndex,
                        endIndex: segment.endIndex,
                        currentPointIndex: segment.startIndex,
                        marker: null,
                        isComplete: false,
                        hasStartLine: segment.hasStartLine,
                        hasFinishLine: segment.hasFinishLine,
                        segmentPoints: segment.totalPoints,
                        startTime: null, // Real playback start time
                        trackStartTime: null, // Track's first timestamp
                        pausedTime: 0, // Total time spent paused
                        interpolatedStart: segment.interpolatedStart,
                        interpolatedEnd: segment.interpolatedEnd,
                        usingInterpolatedStart: false, // Flag to track if we're using interpolated start
                        // Smooth interpolation properties
                        currentPosition: null, // Current interpolated position
                        targetPosition: null, // Target position to move towards
                        interpolationProgress: 0 // Progress between current and target (0-1)
                    };
                    
                    tracks.push(trackData);
                    maxPoints = Math.max(maxPoints, segment.totalPoints);
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
    
    // Calculate progress based on time elapsed vs total track duration
    let maxProgress = 0;
    let totalSegmentPoints = 0;
    let currentSegmentPoints = 0;
    
    playbackState.tracks.forEach(track => {
        const segmentProgress = track.segmentPoints > 0 ? 
            (track.currentPointIndex - track.startIndex) / (track.endIndex - track.startIndex) : 0;
        maxProgress = Math.max(maxProgress, segmentProgress);
        
        totalSegmentPoints += track.segmentPoints;
        currentSegmentPoints += Math.max(0, track.currentPointIndex - track.startIndex);
    });
    
    const progressPercent = maxProgress * 100;
    
    document.getElementById('progressFill').style.width = progressPercent + '%';
    document.getElementById('progressSlider').value = progressPercent;
    
    // Show timing information if available
    const hasTimingData = playbackState.tracks.some(track => 
        track.points[track.startIndex]?.time && track.points[track.endIndex]?.time
    );
    
    if (hasTimingData) {
        document.getElementById('progressText').textContent = 
            `${Math.round(progressPercent)}% (realtime playback - ${currentSegmentPoints} / ${totalSegmentPoints} points)`;
    } else {
        document.getElementById('progressText').textContent = 
            `${Math.round(progressPercent)}% (${currentSegmentPoints} / ${totalSegmentPoints} segment points)`;
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
                hasActiveMarkers = true;
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
                hasActiveMarkers = true;
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
                
                hasActiveMarkers = true;
                
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
                hasActiveMarkers = true;
            } else {
                hasActiveMarkers = true; // Still has points to process
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
    
    if (!hasActiveMarkers) {
        // All tracks completed
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
}

// Function to update map view to follow playback markers
function updateMapViewForPlayback() {
    if (playbackState.tracks.length === 0) return;
    
    // Get all active marker positions
    const activeMarkers = playbackState.tracks
        .filter(track => track.marker && !track.isComplete)
        .map(track => track.marker.getLatLng());
    
    if (activeMarkers.length === 0) return;
    
    // Calculate bounds of all active markers
    const bounds = L.latLngBounds(activeMarkers);
    
    // Get current map bounds
    const currentBounds = map.getBounds();
    
    // Check if all markers are already visible in current view
    const allMarkersVisible = activeMarkers.every(markerPos => 
        currentBounds.contains(markerPos)
    );
    
    if (allMarkersVisible) {
        // All markers are visible, just pan to center without changing zoom
        const center = bounds.getCenter();
        map.panTo(center, { animate: true, duration: 0.5 });
    } else {
        // Some markers are outside view, fit bounds with padding
        map.fitBounds(bounds, { 
            padding: [50, 50], 
            animate: true, 
            duration: 0.5 
        });
    }
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
    
    gpxFiles.forEach((file, fileId) => {
        if (file.data.tracks.length > 0) {
            const croppedGpxData = cropGpxData(file.data, file.fileName);
            if (croppedGpxData) {
                filesToRemove.push(fileId);
                filesToAdd.push({
                    fileName: file.fileName,
                    gpxData: croppedGpxData,
                    originalColor: file.color,
                    wasVisible: file.visible
                });
                croppedCount++;
            }
        }
    });
    
    if (croppedCount === 0) {
        alert('No tracks found that intersect with the defined lines.');
        return;
    }
    
    // Remove original files and add cropped versions
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
    
    // Show undo button
    document.getElementById('undoCrop').classList.remove('hidden');
    
    alert(`Successfully cropped ${croppedCount} GPX file(s). Use "Undo Crop" to restore original files.`);
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
    
    // Clear backup and hide undo button
    gpxFilesBackup = null;
    document.getElementById('undoCrop').classList.add('hidden');
    
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
            const segment = findTrackSegment(track, startLine, finishLine);
            
            // Only include tracks that have intersections with at least one line
            if (segment.hasStartLine || segment.hasFinishLine) {
                const croppedPoints = [];
                
                // Add interpolated start point if we have a start line intersection
                if (segment.interpolatedStart) {
                    croppedPoints.push({
                        lat: segment.interpolatedStart.lat,
                        lng: segment.interpolatedStart.lng,
                        elevation: track.points[segment.startIndex]?.elevation || null,
                        time: track.points[segment.startIndex]?.time || null
                    });
                }
                
                // Add the track points between start and end
                for (let i = segment.startIndex; i <= segment.endIndex; i++) {
                    croppedPoints.push(track.points[i]);
                }
                
                // Add interpolated end point if we have a finish line intersection
                if (segment.interpolatedEnd) {
                    croppedPoints.push({
                        lat: segment.interpolatedEnd.lat,
                        lng: segment.interpolatedEnd.lng,
                        elevation: track.points[segment.endIndex]?.elevation || null,
                        time: track.points[segment.endIndex]?.time || null
                    });
                }
                
                if (croppedPoints.length > 1) {
                    croppedTracks.push({
                        name: track.name,
                        segment: track.segment,
                        points: croppedPoints
                    });
                    hasValidTracks = true;
                }
            }
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


