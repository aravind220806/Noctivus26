import React, { useEffect, useRef, useCallback } from 'react';
import Swiper from 'swiper';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { events as defaultEvents } from '../../data/site.js';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import './CyberHeroSwiper.css';

export function CyberHeroSwiper({ eventsData = defaultEvents, onSelect, onRegister }) {
  const swiperContainerRef = useRef(null);
  const swiperInstanceRef = useRef(null);

  const handlePrev = useCallback(() => {
    swiperInstanceRef.current?.slidePrev(800);
  }, []);

  const handleNext = useCallback(() => {
    swiperInstanceRef.current?.slideNext(800);
  }, []);

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

    if (!eventsData || eventsData.length === 0) return;

    const hasMultiple = eventsData.length > 1;
    const paginationEl = swiperContainerRef.current?.closest('.cyber-hero-carousel-section')?.querySelector('.swiper-pagination');

    // Initialize Swiper instance with initialSlide 0 and continuous rewind loop
    const instance = new Swiper(swiperContainerRef.current, {
      modules: [Pagination, Autoplay],
      initialSlide: 0,
      slidesPerView: hasMultiple ? 1.25 : 1,
      centeredSlides: true,
      rewind: false,
      loop: hasMultiple,
      spaceBetween: 20,
      speed: 800,
      observer: true,
      observeParents: true,
      autoplay: hasMultiple
        ? {
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: false,
          }
        : false,
      pagination: {
        el: paginationEl,
        clickable: true,
      },
      breakpoints: {
        320: {
          slidesPerView: 1,
          spaceBetween: 10,
        },
        901: {
          slidesPerView: hasMultiple ? 1.25 : 1,
          spaceBetween: 20,
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
  }, [eventsData]);

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

  const carouselKey = eventsData.map((e) => e.id).join('_');

  return (
    <div className="cyber-hero-carousel-section" key={carouselKey}>
      <div className="swiper" ref={swiperContainerRef}>
        <div className="swiper-wrapper">
          {eventsData.map((slide, index) => {
            const heading = slide.heading || slide.name || "WHAT'S NEW";
            const description = slide.description || slide.format || '';
            const accent = slide.accent || 'cyan';

            return (
              <div
                className="swiper-slide"
                data-swiper-slide-index={index}
                key={slide.id || index}
              >
                <div className="item">
                  <img src={slide.image} alt={heading} />
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
                        onClick={() => onRegister?.(slide.id)}
                      >
                        REGISTER NOW
                      </NotchedButton>
                      <NotchedButton
                        variant="ghost"
                        accent={accent}
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

          <div className="swiper-pagination"></div>

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
