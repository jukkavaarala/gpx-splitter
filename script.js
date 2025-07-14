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

// Add smooth zoom animation
map.on('zoomstart', function() {
    map.getContainer().style.cursor = 'wait';
});

map.on('zoomend', function() {
    map.getContainer().style.cursor = '';
});

// Add click event to show coordinates (useful for development)
map.on('click', function(e) {
    console.log(`Clicked at: ${e.latlng.lat}, ${e.latlng.lng}`);
});

// Add some interactivity - highlight on hover
let originalStyle = {
    color: '#3498db',
    fillColor: '#3498db',
    fillOpacity: 0.1
};

let highlightStyle = {
    color: '#e74c3c',
    fillColor: '#e74c3c',
    fillOpacity: 0.3
};

