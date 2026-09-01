import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!swiperContainerRef.current) return;

    const canLoop = eventsData.length > 1;

    // Destroy existing instance before re-initializing to avoid stuck slides on filter changes
    if (swiperInstanceRef.current) {
      swiperInstanceRef.current.destroy(true, true);
    }

    const paginationEl = swiperContainerRef.current.querySelector('.swiper-pagination');

    // Initialize Swiper v11 instance with Pagination + Automatic Smooth Autoplay
    swiperInstanceRef.current = new Swiper(swiperContainerRef.current, {
      modules: [Pagination, Autoplay],
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

    return () => {
      if (swiperInstanceRef.current) {
        swiperInstanceRef.current.destroy(true, true);
      }
    };
  }, [eventsData]);

  return (
    <div className="cyber-hero-carousel-section">
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
