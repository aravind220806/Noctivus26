import React, { useEffect, useRef } from 'react';
import Swiper from 'swiper';
import { Pagination, Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { events as defaultEvents } from '../../data/site.js';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import './CyberHeroSwiper.css';

export function CyberHeroSwiper({ eventsData = defaultEvents, onSelect, onRegister }) {
  const swiperContainerRef = useRef(null);
  const swiperInstanceRef = useRef(null);
  const prevBtnRef = useRef(null);
  const nextBtnRef = useRef(null);

  useEffect(() => {
    if (!swiperContainerRef.current) return;

    // Destroy existing instance before re-initializing to avoid stuck slides on filter changes
    if (swiperInstanceRef.current) {
      swiperInstanceRef.current.destroy(true, true);
      swiperInstanceRef.current = null;
    }

    if (!eventsData || eventsData.length === 0) return;

    const canLoop = eventsData.length > 1;
    const paginationEl = swiperContainerRef.current.querySelector('.swiper-pagination');

    // Initialize Swiper v11 instance starting at initialSlide 0
    const instance = new Swiper(swiperContainerRef.current, {
      modules: [Pagination, Autoplay, Navigation],
      initialSlide: 0,
      slidesPerView: canLoop ? 1.25 : 1,
      centeredSlides: true,
      loop: canLoop,
      spaceBetween: 20,
      speed: 800,
      observer: true,
      observeParents: true,
      autoplay: canLoop
        ? {
            delay: 3500,
            disableOnInteraction: false,
            pauseOnMouseEnter: false,
          }
        : false,
      pagination: {
        el: paginationEl,
        clickable: true,
      },
      navigation: {
        prevEl: prevBtnRef.current,
        nextEl: nextBtnRef.current,
      },
      breakpoints: {
        320: {
          slidesPerView: 1,
          spaceBetween: 10,
        },
        901: {
          slidesPerView: canLoop ? 1.25 : 1,
          spaceBetween: 20,
        },
      },
    });

    swiperInstanceRef.current = instance;

    return () => {
      if (swiperInstanceRef.current) {
        swiperInstanceRef.current.destroy(true, true);
        swiperInstanceRef.current = null;
      }
    };
  }, [eventsData]);

  const carouselKey = eventsData.map((e) => e.id).join('_');

  return (
    <div className="cyber-hero-carousel-section" key={carouselKey}>
      {/* Navigation Buttons (Semi-transparent HUD chevrons) */}
      <button
        ref={prevBtnRef}
        type="button"
        className="cyber-swiper-nav-btn cyber-swiper-prev"
        aria-label="Previous Event"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        ref={nextBtnRef}
        type="button"
        className="cyber-swiper-nav-btn cyber-swiper-next"
        aria-label="Next Event"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

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

        {/* Pagination Dots */}
        <div className="swiper-pagination"></div>
      </div>
    </div>
  );
}

export default CyberHeroSwiper;
