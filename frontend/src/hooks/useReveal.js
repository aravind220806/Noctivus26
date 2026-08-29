import { useEffect } from 'react';

export default function useReveal() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('reveal-ready');

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

    const register = (node) => {
      const revealNodes = [];
      if (node instanceof Element && node.matches('[data-reveal]')) revealNodes.push(node);
      if (node instanceof Element) revealNodes.push(...node.querySelectorAll('[data-reveal]'));
      revealNodes.forEach((revealNode) => {
        const rect = revealNode.getBoundingClientRect();
        const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (reducedMotion || alreadyVisible) revealNode.classList.add('is-visible');
        else revealObserver.observe(revealNode);
      });
    };

    register(document.body);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach(register));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.documentElement.classList.remove('reveal-ready');
      revealObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);
}
