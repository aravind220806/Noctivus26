import { useEffect, useMemo, useRef, useState } from 'react';
import CircularGallery from '../CircularGallery/CircularGallery.jsx';
import Icon from '../Icon.jsx';
import { SectionTitle } from './SectionTitle';
import { posters } from '../../data/site.js';

export function BrochureSection() {
  const [fullscreenPoster, setFullscreenPoster] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef(null);
  const posterItems = useMemo(() => posters.map((poster) => ({ ...poster, text: poster.title })), []);

  useEffect(() => {
    if (!downloadOpen) return undefined;
    const onPointerDown = (event) => {
      if (!downloadRef.current?.contains(event.target)) setDownloadOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDownloadOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [downloadOpen]);

  return (
    <section className="section brochure-section" id="brochure">
      <div className="brochure-full">
        <div className="page-width brochure-full__header">
          <SectionTitle
            kicker="BROCHURE"
            title="Posters and downloads."
            description="Open a poster panel to preview it, then download the poster."
          />
        </div>
        <div className="brochure-gallery-wrap" data-reveal>
          <CircularGallery
            items={posterItems}
            bend={2}
            textColor="#F4EFE4"
            borderRadius={0.05}
            scrollEase={0.03}
            font="600 20px var(--display-font)"
            autoScroll={true}
            autoScrollMs={2200}
            onPosterClick={setFullscreenPoster}
          />
        </div>
        <div className="poster-controls" data-reveal style={{ justifyContent: 'center' }}>
          <div className="poster-download-menu" ref={downloadRef}>
            <button
              className="button button-primary poster-download-menu__button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={downloadOpen}
              onClick={() => setDownloadOpen((open) => !open)}
            >
              Download Posters <span aria-hidden="true">▾</span>
            </button>
            {downloadOpen && (
              <div className="poster-download-menu__list" role="menu">
                {posters.map((poster) => (
                  <a href={poster.image} download role="menuitem" key={poster.image} onClick={() => setDownloadOpen(false)}>
                    {poster.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {fullscreenPoster && (
        <div
          className="poster-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label={fullscreenPoster.title}
          onMouseDown={(event) => event.target === event.currentTarget && setFullscreenPoster(null)}
        >
          <button
            className="icon-button poster-fullscreen__close"
            type="button"
            aria-label="Close poster preview"
            onClick={() => setFullscreenPoster(null)}
          >
            <Icon name="close" />
          </button>
          <img src={fullscreenPoster.image} alt={fullscreenPoster.alt || fullscreenPoster.title} />
          <a className="button button-primary poster-fullscreen__download" href={fullscreenPoster.image} download>
            Download <Icon name="external" />
          </a>
        </div>
      )}
    </section>
  );
}
