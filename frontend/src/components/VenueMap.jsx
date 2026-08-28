import { useEffect, useRef } from 'react';
import { AttributionControl, Map, Marker, NavigationControl, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function VenueMap({ latitude, longitude, directionsUrl }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const map = new Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          openstreetmap: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'openstreetmap', type: 'raster', source: 'openstreetmap' }],
      },
      center: [longitude, latitude],
      zoom: 15.2,
      pitch: 28,
      bearing: -10,
      cooperativeGestures: true,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'venue-map__marker';
    marker.setAttribute('aria-label', 'Velammal Engineering College location');
    marker.innerHTML = '<span><i></i></span>';

    const popupContent = document.createElement('div');
    popupContent.className = 'venue-map__popup';
    const popupTitle = document.createElement('strong');
    popupTitle.textContent = 'Velammal Engineering College';
    const popupText = document.createElement('span');
    popupText.textContent = 'Noctivus ’26 venue';
    const popupDirections = document.createElement('a');
    popupDirections.href = directionsUrl;
    popupDirections.textContent = 'Open directions →';
    popupDirections.className = 'venue-map__popup-link';
    popupContent.append(popupTitle, popupText, popupDirections);

    const popup = new Popup({ offset: 20, closeButton: false }).setDOMContent(popupContent);
    new Marker({ element: marker, anchor: 'bottom' }).setLngLat([longitude, latitude]).setPopup(popup).addTo(map);

    return () => map.remove();
  }, [latitude, longitude, directionsUrl]);

  return <div className="venue-map" ref={containerRef} aria-label="Interactive map showing Velammal Engineering College" />;
}
