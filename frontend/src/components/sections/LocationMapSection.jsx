import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { site } from '../../data/site.js';

const VenueMap = lazy(() => import('../VenueMap.jsx'));
const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=Velammal+Engineering+College%2C+Surapet%2C+Chennai+600066';

function DeferredVenueMap() {
  const [ready, setReady] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [deviceDirectionsUrl, setDeviceDirectionsUrl] = useState(directionsUrl);
  const shellRef = useRef(null);

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const constrained =
      connection?.saveData || window.matchMedia('(max-width: 700px)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    const appleMobile =
      /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(navigator.userAgent);
    if (appleMobile) setDeviceDirectionsUrl('https://maps.apple.com/?daddr=13.1483288,80.1916095&dirflg=d');
    else if (android) setDeviceDirectionsUrl('geo:0,0?q=13.1483288,80.1916095(Velammal%20Engineering%20College)');
    setMobilePreview(Boolean(constrained));
    if (constrained || !shellRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="venue-map-shell" ref={shellRef}>
      {ready ? (
        <Suspense fallback={<div className="venue-map__loading">Loading map…</div>}>
          <VenueMap latitude={site.coordinates.latitude} longitude={site.coordinates.longitude} directionsUrl={deviceDirectionsUrl} />
          <a className="venue-map__directions" href={deviceDirectionsUrl}>
            Get directions <Icon name="arrow" size={15} />
          </a>
        </Suspense>
      ) : mobilePreview ? (
        <div className="venue-map__preview venue-map__preview--real">
          <iframe
            title="Map of Velammal Engineering College"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=80.1836%2C13.1433%2C80.1996%2C13.1533&amp;layer=mapnik&amp;marker=13.1483288%2C80.1916095"
            tabIndex="-1"
          />
          <a className="venue-map__preview-link" href={deviceDirectionsUrl} aria-label="Open directions to Velammal Engineering College">
            <span className="venue-map__preview-action">
              <Icon name="pin" size={18} />
              <span>
                <strong>Get directions</strong>
                <small>Opens in your maps app</small>
              </span>
              <Icon name="arrow" size={16} />
            </span>
          </a>
          <small className="venue-map__attribution">© OpenStreetMap contributors</small>
        </div>
      ) : (
        <div className="venue-map__preview venue-map__preview--loading">
          <span className="venue-map__pin">
            <Icon name="pin" size={22} />
          </span>
          <div>
            <strong>Surapet, Chennai</strong>
            <small>Velammal Engineering College</small>
          </div>
        </div>
      )}
    </div>
  );
}

export function LocationMapSection() {
  return (
    <section className="section location-section" id="location">
      <div className="page-width footer-venue">
        <div className="footer-venue__copy">
          <span className="kicker">LOCATION / MAP</span>
          <h2>
            Velammal
            <br />
            Engineering College
          </h2>
          <address>{site.address}</address>
          <a className="button button-secondary" href={directionsUrl} target="_blank" rel="noopener noreferrer">
            Open directions <Icon name="external" />
          </a>
        </div>
        <DeferredVenueMap />
      </div>
    </section>
  );
}
