import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Swiper from 'swiper';
import { Autoplay } from 'swiper/modules';
import 'swiper/css';
import { events as defaultEvents } from '../../data/site.js';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import './CyberHeroSwiper.css';

export function CyberHeroSwiper({ eventsData = defaultEvents, onSelect, onRegister }) {
  const swiperContainerRef = useRef(null);
  const swiperInstanceRef = useRef(null);
  const [activeBulletIndex, setActiveBulletIndex] = useState(0);

  // Swiper's loop mode with slidesPerView: 'auto' and centeredSlides requires
  // enough slides in the DOM to seamlessly populate both sides and loop buffers.
  // When there are few items (e.g. 3 non-tech, 5 tech), Swiper runs out of slides
  // and teleports DOM elements, causing vanishing cards, jumping, and glitching.
  // Repeating items until count >= 9 provides ample buffer slides for infinite looping.
  const slides = useMemo(() => {
    if (!eventsData || eventsData.length === 0) return [];
    if (eventsData.length === 1) {
      return eventsData.map((event) => ({
        ...event,
        _uniqueKey: `${event.id}-single`,
        _originalIndex: 0,
      }));
    }

    const minSlides = 9;
    const repeatCount = Math.ceil(minSlides / eventsData.length);
    const result = [];
    for (let r = 0; r < repeatCount; r++) {
      for (let i = 0; i < eventsData.length; i++) {
        result.push({
          ...eventsData[i],
          _uniqueKey: `${eventsData[i].id}-rep-${r}-${i}`,
          _originalIndex: i,
        });
      }
    }
    return result;
  }, [eventsData]);

  // Reset active bullet to first item when category/events change
  useEffect(() => {
    setActiveBulletIndex(0);
  }, [eventsData]);

  const handlePrev = useCallback(() => {
    swiperInstanceRef.current?.slidePrev(600);
  }, []);

  const handleNext = useCallback(() => {
    swiperInstanceRef.current?.slideNext(600);
  }, []);

  const handleBulletClick = useCallback((targetIndex) => {
    const swiper = swiperInstanceRef.current;
    if (!swiper || swiper.destroyed || eventsData.length <= 1) return;

    const currentEventIndex = swiper.realIndex % eventsData.length;
    const diff = targetIndex - currentEventIndex;
    if (diff === 0) return;

    let step = diff;
    const half = eventsData.length / 2;
    if (step > half) {
      step -= eventsData.length;
    } else if (step < -half) {
      step += eventsData.length;
    }

    if (step === 1) {
      swiper.slideNext(600);
    } else if (step === -1) {
      swiper.slidePrev(600);
    } else {
      swiper.slideTo(swiper.activeIndex + step, 600);
    }
  }, [eventsData.length]);

  useEffect(() => {
    if (!swiperContainerRef.current) return;

    // Destroy existing instance before re-initializing to avoid stuck slides on filter changes
    if (swiperInstanceRef.current) {
      try {
        swiperInstanceRef.current.destroy(true, true);
      } catch {
        // ignore cleanup error
      }
      swiperInstanceRef.current = null;
    }

    if (!slides || slides.length === 0) return;

    const hasMultiple = slides.length > 1;

    // Initialize Swiper instance with true seamless infinite loop
    const instance = new Swiper(swiperContainerRef.current, {
      modules: [Autoplay],
      initialSlide: 0,
      slidesPerView: 'auto',
      centeredSlides: true,
      loop: hasMultiple,
      loopAdditionalSlides: hasMultiple ? 2 : 0,
      rewind: false,
      spaceBetween: 16,
      speed: 600,
      watchSlidesProgress: true,
      observer: true,
      observeParents: true,
      autoplay: hasMultiple
        ? {
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }
        : false,
      breakpoints: {
        901: {
          slidesPerView: 'auto',
          spaceBetween: 28,
          centeredSlides: true,
        },
      },
      on: {
        slideChange: (swiper) => {
          if (eventsData.length > 0) {
            setActiveBulletIndex(swiper.realIndex % eventsData.length);
          }
        },
      },
    });

    swiperInstanceRef.current = instance;

    return () => {
      if (swiperInstanceRef.current) {
        try {
          swiperInstanceRef.current.destroy(true, true);
        } catch {
          // ignore
        }
        swiperInstanceRef.current = null;
      }
    };
  }, [slides, eventsData.length]);

  // Keyboard arrow keys navigation when events section is in viewport
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (eventsData.length <= 1) return;
      const section = swiperContainerRef.current?.closest('.events-section');
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.75 && rect.bottom > window.innerHeight * 0.25;
      if (!inView) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [eventsData.length, handlePrev, handleNext]);

  // Click delegation handler to support clicks on slides and duplicate slides
  const handleSwiperClick = (e) => {
    const regBtn = e.target.closest('[data-action="register"]');
    if (regBtn) {
      e.preventDefault();
      const eventId = regBtn.getAttribute('data-event-id');
      if (eventId && onRegister) {
        onRegister(eventId);
      }
      return;
    }

    const viewBtn = e.target.closest('[data-action="select"]');
    if (viewBtn) {
      e.preventDefault();
      const eventId = viewBtn.getAttribute('data-event-id');
      const selected = eventsData.find((item) => String(item.id) === String(eventId));
      if (selected && onSelect) {
        onSelect(selected);
      }
      return;
    }

    // Clicking an adjacent peek slide smoothly slides it into center
    const slideEl = e.target.closest('.swiper-slide');
    if (slideEl && !slideEl.classList.contains('swiper-slide-active')) {
      const swiper = swiperInstanceRef.current;
      if (swiper && !swiper.destroyed) {
        const slideIndex = swiper.slides.indexOf(slideEl);
        if (slideIndex !== -1) {
          swiper.slideTo(slideIndex, 600);
        }
      }
    }
  };

  const carouselKey = eventsData.map((e) => e.id).join('_');

  if (!eventsData || eventsData.length === 0) {
    return (
      <div className="cyber-hero-carousel-section">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          No events found in this category.
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-hero-carousel-section" key={carouselKey}>
      <div 
        className="swiper" 
        key={carouselKey} 
        ref={swiperContainerRef}
        onClick={handleSwiperClick}
      >
        <div className="swiper-wrapper">
          {slides.map((slide) => {
            const heading = slide.heading || slide.name || "WHAT'S NEW";
            const description = slide.description || slide.format || '';
            const accent = slide.accent || 'cyan';

            return (
              <div
                className="swiper-slide"
                key={slide._uniqueKey}
              >
                <div className="item">
                  <img
                    src={slide.image}
                    alt={heading}
                    style={slide.imagePosition ? { objectPosition: slide.imagePosition } : undefined}
                    loading="lazy"
                  />
                  <div className="item-content">
                    {slide.category && (
                      <span className="item-category-tag" data-category={slide.category}>
                        {slide.category}
                      </span>
                    )}
                    <h3>{heading}</h3>
                    <p>{description}</p>

                    {slide.fee !== undefined && (
                      <div className="item-fee-tag">
                        FEE: {slide.fee === 0 ? 'FREE' : `₹${slide.fee}`}
                      </div>
                    )}

                    <div className="item-actions">
                      <NotchedButton
                        variant="primary"
                        accent={accent}
                        data-action="register"
                        data-event-id={slide.id}
                        onClick={() => onRegister?.(slide.id)}
                      >
                        REGISTER NOW
                      </NotchedButton>
                      <NotchedButton
                        variant="ghost"
                        accent={accent}
                        data-action="select"
                        data-event-id={slide.id}
                        onClick={() => onSelect?.(slide)}
                      >
                        VIEW DETAILS
                      </NotchedButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom controls: prev / pagination / next */}
      {eventsData.length > 1 && (
        <div className="cyber-swiper-bottom-bar">
          <button
            type="button"
            className="cyber-swiper-nav-btn cyber-swiper-prev"
            onClick={handlePrev}
            aria-label="Previous Event"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="swiper-pagination" role="tablist" aria-label="Event slides">
            {eventsData.map((item, i) => (
              <button
                key={item.id || i}
                type="button"
                className={`swiper-pagination-bullet ${i === activeBulletIndex ? 'swiper-pagination-bullet-active' : ''}`}
                onClick={() => handleBulletClick(i)}
                aria-label={`Go to ${item.name || `event ${i + 1}`}`}
                aria-selected={i === activeBulletIndex}
                role="tab"
              />
            ))}
          </div>

          <button
            type="button"
            className="cyber-swiper-nav-btn cyber-swiper-next"
            onClick={handleNext}
            aria-label="Next Event"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default CyberHeroSwiper;
