import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Device } from '../types';

interface MapPickerProps {
  lat: number;
  lng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  isMaximized?: boolean;
  devices?: Device[];
}

// Mapbox Configuration
const MAPBOX_TOKEN = "pk.eyJ1IjoiYmlsYWxhbXQiLCJhIjoiY21qcHdmNjd1M2ljMTNncXh4OG10bjM1ZSJ9.DdrBIWn_ukTldrDk0_7oWg";
const MAPBOX_STYLE = "mapbox/streets-v12"; 

// Drone SVG Icon Definition - Quadcopter Style
const getDroneSvg = (color: string) => `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow-${color.replace('#', '')}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <g filter="url(#glow-${color.replace('#', '')})">
    <!-- Center Body -->
    <path d="M40 40 h20 v20 h-20 z" fill="${color}" />
    
    <!-- Arms -->
    <path d="M40 40 L25 25" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    <path d="M60 40 L75 25" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    <path d="M40 60 L25 75" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    <path d="M60 60 L75 75" stroke="${color}" stroke-width="4" stroke-linecap="round" />
    
    <!-- Motors/Props -->
    <circle cx="25" cy="25" r="8" stroke="${color}" stroke-width="2" fill="none" />
    <circle cx="75" cy="25" r="8" stroke="${color}" stroke-width="2" fill="none" />
    <circle cx="25" cy="75" r="8" stroke="${color}" stroke-width="2" fill="none" />
    <circle cx="75" cy="75" r="8" stroke="${color}" stroke-width="2" fill="none" />
    
    <!-- Prop Blades -->
    <path d="M15 25 h20 M25 15 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    <path d="M65 25 h20 M75 15 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    <path d="M15 75 h20 M25 65 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    <path d="M65 75 h20 M75 65 v20" stroke="${color}" stroke-width="1" opacity="0.6" />
    
    <!-- Direction Indicator (Triangle at front) -->
    <path d="M45 35 L55 35 L50 25 Z" fill="${color}" />
  </g>
</svg>
`;

export const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, onLocationSelect, isMaximized, devices = [] }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const deviceLayerRef = useRef<L.LayerGroup | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const newLat = parseFloat(result.lat);
        const newLng = parseFloat(result.lon);
        onLocationSelect(newLat, newLng);
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: false 
    });
    
    mapInstanceRef.current = map;
    deviceLayerRef.current = L.layerGroup().addTo(map);

    // Mapbox Tile Layer (Streets/Light)
    L.tileLayer(`https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`, {
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 20
    }).addTo(map);

    // Custom Target Marker Icon (Red)
    const targetIcon = L.icon({
       iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
       shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
       iconSize: [25, 41],
       iconAnchor: [12, 41],
       popupAnchor: [1, -34],
       shadowSize: [41, 41]
    });

    // Create target marker
    const marker = L.marker([lat, lng], { icon: targetIcon, draggable: true }).addTo(map);
    marker.bindPopup("<b>Target Location</b><br>Incident Origin").openPopup();
    
    marker.on('dragend', (e) => {
      const marker = e.target;
      const position = marker.getLatLng();
      onLocationSelect(position.lat, position.lng);
    });

    targetMarkerRef.current = marker;

    // Handle Right Click (Context Menu)
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
       const { lat, lng } = e.latlng;
       const safeLat = Number(lat.toFixed(6));
       const safeLng = Number(lng.toFixed(6));
       onLocationSelect(safeLat, safeLng);
    });

    // Cleanup
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); 

  // Update Target Marker position
  useEffect(() => {
    if (mapInstanceRef.current && targetMarkerRef.current) {
        const currentLatLng = targetMarkerRef.current.getLatLng();
        if (currentLatLng.lat !== lat || currentLatLng.lng !== lng) {
            targetMarkerRef.current.setLatLng([lat, lng]);
            // Only fly to if distance is significant to avoid annoying pans
            if (mapInstanceRef.current.distance([lat, lng], currentLatLng) > 500) {
                mapInstanceRef.current.flyTo([lat, lng], mapInstanceRef.current.getZoom());
            }
        }
    }
  }, [lat, lng]);

  // Handle Resize for Maximize
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 300);
    }
  }, [isMaximized]);

  // Render Devices
  useEffect(() => {
    if (!mapInstanceRef.current || !deviceLayerRef.current) return;

    // Clear existing devices
    deviceLayerRef.current.clearLayers();

    const createDroneIcon = (heading: number, isOnline: boolean) => {
        // Green for Online (#4ade80), Red for Offline (#ef4444)
        const color = isOnline ? '#4ade80' : '#ef4444'; 
        const svgString = getDroneSvg(color);
        const encodedSvg = encodeURIComponent(svgString);
        
        return L.divIcon({
            className: 'custom-drone-icon',
            html: `
              <div style="
                transform: rotate(${heading}deg); 
                width: 48px; 
                height: 48px; 
                background-image: url('data:image/svg+xml;charset=utf-8,${encodedSvg}');
                background-repeat: no-repeat;
                background-position: center;
                background-size: contain;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
                opacity: ${isOnline ? 1 : 0.7};
              "></div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
        });
    };

    devices.forEach(device => {
        // Render if telemetry exists (which now includes offline position)
        if (device.telemetry && (device.telemetry.latitude !== 0 || device.telemetry.longitude !== 0)) {
            const lat = device.telemetry.latitude ?? 0;
            const lon = device.telemetry.longitude ?? 0;
            const speed = device.telemetry.speed ?? 0;
            const height = device.telemetry.height ?? 0;
            const batt = device.telemetry.battery_percent ?? 0;
            const yaw = device.telemetry.yaw ?? 0;
            const flightTime = device.telemetry.flight_time ?? 0;

            const marker = L.marker([lat, lon], { 
                icon: createDroneIcon(yaw, device.status),
                zIndexOffset: device.status ? 1000 : 500 // Online on top
            });

            // Format Flight Time
            const m = Math.floor(flightTime / 60);
            const s = flightTime % 60;
            
            const statusBadge = device.status 
                ? '<span class="text-green-500 font-bold text-[10px] uppercase">ONLINE</span>' 
                : '<span class="text-red-500 font-bold text-[10px] uppercase">OFFLINE</span>';

            const popupContent = `
                <div class="font-sans min-w-[180px]">
                    <div class="flex justify-between items-center border-b pb-1 mb-2">
                         <div class="flex flex-col">
                           <h3 class="font-bold text-slate-800 text-sm">${device.nickname}</h3>
                           <span class="text-[9px] text-slate-500 font-mono">${device.device_model}</span>
                         </div>
                    </div>
                    ${statusBadge}
                    <div class="grid grid-cols-2 gap-y-1 text-xs text-slate-600 mt-2">
                        <span class="font-semibold">Speed:</span>
                        <span>${speed.toFixed(1)} m/s</span>
                        
                        <span class="font-semibold">Height:</span>
                        <span>${height.toFixed(1)} m</span>
                        
                        <span class="font-semibold">Battery:</span>
                        <span class="${batt < 20 ? 'text-red-600 font-bold' : ''}">${batt}%</span>
                        
                        ${device.status ? `
                        <span class="font-semibold">Flight Time:</span>
                        <span>${m}m ${s}s</span>
                        ` : ''}
                    </div>
                    <div class="mt-2 pt-2 border-t text-[9px] text-slate-400 font-mono">SN: ${device.device_sn}</div>
                </div>
            `;

            marker.bindPopup(popupContent);
            deviceLayerRef.current?.addLayer(marker);
        }
    });

  }, [devices]);

  return (
    <div className="relative h-full w-full bg-slate-900 group">
      <div ref={mapContainerRef} className="h-full w-full z-0" />
      
      {/* Search Bar Overlay */}
      <form onSubmit={handleSearch} className="absolute top-4 left-4 z-[400] w-64 shadow-xl">
        <div className="relative flex items-center">
           <input 
              type="text" 
              placeholder="Search target location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 backdrop-blur text-slate-200 placeholder:text-slate-500 text-xs px-3 py-2 pr-8 rounded border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm"
           />
           <button 
              type="submit" 
              disabled={isSearching}
              className="absolute right-2 text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
           >
              {isSearching ? (
                 <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
           </button>
        </div>
      </form>
    </div>
  );
};