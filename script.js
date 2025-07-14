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

// Function to create a line between two points
function createLine(point1, point2, style, label) {
    const line = L.polyline([point1, point2], style).addTo(linesGroup);
    
    // Add label at the center of the line
    const center = [(point1.lat + point2.lat) / 2, (point1.lng + point2.lng) / 2];
    const marker = L.marker(center, {
        icon: L.divIcon({
            className: 'line-label',
            html: `<div style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; border: 2px solid ${style.color}; color: ${style.color};">${label}</div>`,
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
    const fileId = nextFileId++;
    const color = generateColor(gpxFiles.size);
    const { layers, totalPoints } = createGpxLayers(gpxData, color, fileName);
    
    // Add layers to map
    layers.forEach(layer => layer.addTo(map));
    
    // Store file data
    gpxFiles.set(fileId, {
        data: gpxData,
        layers: layers,
        visible: true,
        color: color,
        fileName: fileName,
        totalPoints: totalPoints
    });
    
    updateFileList();
    updateMapBounds();
    
    console.log(`Added GPX file: ${fileName} (${totalPoints} points)`);
    return fileId;
}

// Function to remove GPX file
function removeGpxFile(fileId) {
    const file = gpxFiles.get(fileId);
    if (file) {
        // Remove layers from map
        file.layers.forEach(layer => map.removeLayer(layer));
        
        // Remove from storage
        gpxFiles.delete(fileId);
        
        updateFileList();
        console.log(`Removed GPX file: ${file.fileName}`);
    }
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
