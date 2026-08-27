import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { faqs, faqCategories, FaqItem } from '../data/faq';

export const FaqAccordion: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('gen-1');

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full max-w-[840px] mx-auto flex flex-col gap-10">
      {faqCategories.map((category) => {
        const categoryFaqs = faqs.filter((faq) => faq.category === category);

        if (categoryFaqs.length === 0) return null;

        return (
          <div key={category} className="flex flex-col gap-4">
            {/* Category Header Badge */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#2dd4bf]">
                {category}
              </span>
              <div className="flex-1 h-[1px] bg-white/10" />
            </div>

            {/* Accordion Group Items */}
            <div className="flex flex-col gap-3">
              {categoryFaqs.map((faq) => {
                const isOpen = openId === faq.id;

                return (
                  <div
                    key={faq.id}
                    className={`relative rounded-2xl overflow-hidden border transition-all duration-300 ${
                      isOpen
                        ? 'border-[#2dd4bf]/40 bg-[#101815]/80 shadow-[0_0_25px_rgba(45,212,191,0.1)]'
                        : 'border-[#2dd4bf]/15 bg-[#101815]/60 hover:border-[#2dd4bf]/30'
                    } backdrop-blur-md`}
                  >
                    {/* Collapsed/Expanded Question Tap Target */}
                    <button
                      type="button"
                      onClick={() => toggleItem(faq.id)}
                      className="w-full text-left p-5 sm:p-6 min-h-[56px] flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/50 rounded-2xl"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${faq.id}`}
                    >
                      <span className="font-sans text-base sm:text-lg font-semibold text-[#e2e8f0] leading-snug">
                        {faq.question}
                      </span>

                      {/* Animated Plus / Minus Chevron Icon */}
                      <span
                        className={`w-8 h-8 rounded-full border border-white/15 flex items-center justify-center shrink-0 transition-transform duration-300 ${
                          isOpen ? 'bg-[#2dd4bf] text-[#0a0f0d] rotate-180 border-[#2dd4bf]' : 'bg-white/5 text-[#2dd4bf]'
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {isOpen ? (
                            <line x1="5" y1="12" x2="19" y2="12" />
                          ) : (
                            <>
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </>
                          )}
                        </svg>
                      </span>
                    </button>

                    {/* Smooth Height Expansion Answer Block */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`faq-answer-${faq.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 sm:px-6 pb-6 pt-1 text-sm sm:text-base text-[#94a3b8] leading-relaxed border-t border-white/10">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
