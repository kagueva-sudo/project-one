/**
 * Vanilla SplitText — адаптация React-компонента для статического HTML.
 * Разбивает текст на символы и анимирует через GSAP.
 */
(function () {
  'use strict';

  function waitForFonts() {
    if (document.fonts && document.fonts.status === 'loaded') {
      return Promise.resolve();
    }
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready;
    }
    return Promise.resolve();
  }

  function splitToChars(element) {
    const chars = [];

    function appendWord(parent, word, fragment) {
      const wordWrap = document.createElement('span');
      wordWrap.className = 'split-word';

      [...word].forEach((char) => {
        const span = document.createElement('span');
        span.className = 'split-char';
        span.textContent = char;
        wordWrap.appendChild(span);
        chars.push(span);
      });

      fragment.appendChild(wordWrap);
    }

    function appendSpace(fragment) {
      const space = document.createElement('span');
      space.className = 'split-char split-char--space';
      space.textContent = '\u00A0';
      fragment.appendChild(space);
      chars.push(space);
    }

    function processTextNode(textNode) {
      let normalized = textNode.textContent.replace(/\s+/g, ' ');
      normalized = normalized.replace(/^\s+/, '');

      const hasTrailingSpace = /\s$/.test(normalized);
      normalized = normalized.replace(/\s+$/, '');

      const parent = textNode.parentNode;
      const fragment = document.createDocumentFragment();

      if (!normalized && !hasTrailingSpace) {
        parent.removeChild(textNode);
        return;
      }

      const parts = normalized.split(' ').filter(Boolean);

      parts.forEach((word, index) => {
        if (index > 0) appendSpace(fragment);
        appendWord(parent, word, fragment);
      });

      if (hasTrailingSpace && textNode.nextSibling?.nodeType === Node.ELEMENT_NODE) {
        appendSpace(fragment);
      }

      if (
        textNode.previousSibling?.nodeType === Node.ELEMENT_NODE &&
        fragment.firstChild &&
        !fragment.firstChild.classList.contains('split-char--space')
      ) {
        const leadingSpace = document.createElement('span');
        leadingSpace.className = 'split-char split-char--space';
        leadingSpace.textContent = '\u00A0';
        fragment.insertBefore(leadingSpace, fragment.firstChild);
        chars.push(leadingSpace);
      }

      parent.replaceChild(fragment, textNode);
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node);
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        [...node.childNodes].forEach(walk);
      }
    }

    walk(element);
    element.classList.add('split-parent', 'is-split');
    return chars;
  }

  function parseOptions(element) {
    return {
      delay: Number(element.dataset.splitDelay) || 50,
      duration: Number(element.dataset.splitDuration) || 1.25,
      ease: element.dataset.splitEase || 'power3.out',
      from: { opacity: 0, y: 40 },
      to: { opacity: 1, y: 0 },
      immediate: element.dataset.splitTrigger !== 'scroll',
      onComplete: null,
    };
  }

  function initSplitText(element, options) {
    if (!element || element.dataset.splitInitialized === 'true') return Promise.resolve();

    const config = { ...parseOptions(element), ...options };
    element.dataset.splitInitialized = 'true';

    const finish = () => {
      element.classList.add('split-ready', 'split-done');
      config.onComplete?.();
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || typeof gsap === 'undefined') {
      finish();
      return Promise.resolve();
    }

    return waitForFonts().then(() => {
      const chars = splitToChars(element);
      element.classList.add('split-ready');

      gsap.set(chars, config.from);

      const runAnimation = () => {
        return gsap.to(chars, {
          ...config.to,
          duration: config.duration,
          ease: config.ease,
          stagger: config.delay / 1000,
          onComplete: () => {
            element.classList.add('split-done');
            config.onComplete?.();
          },
          willChange: 'transform, opacity',
          force3D: true,
        });
      };

      if (config.immediate) {
        return runAnimation();
      }

      /* Scroll-режим требует GSAP ScrollTrigger (Club plugin) */
      return runAnimation();
    });
  }

  function initHeroSplit() {
    const heroTitle = document.getElementById('hero-title');
    if (!heroTitle) return;

    initSplitText(heroTitle, {
      delay: 35,
      duration: 1.1,
      ease: 'power3.out',
      from: { opacity: 0, y: 40 },
      to: { opacity: 1, y: 0 },
      onComplete: () => {
        document.querySelector('.hero__subtitle')?.classList.add('is-visible');
        document.querySelector('.hero__actions')?.classList.add('is-visible');
        document.querySelector('.hero__scroll')?.classList.add('is-visible');
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeroSplit();

    document.querySelectorAll('[data-split-text]:not(#hero-title)').forEach((el) => {
      initSplitText(el);
    });
  });

  window.initSplitText = initSplitText;
})();
