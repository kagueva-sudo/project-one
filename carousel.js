/**
 * Carousel — vanilla-адаптация React Bits для статического HTML.
 * Drag, loop, autoplay, 3D rotateY, индикаторы.
 */
(function () {
  'use strict';

  const GAP = 16;
  const PADDING = 16;
  const DRAG_BUFFER = 0;
  const VELOCITY_THRESHOLD = 500;
  const SPRING = { duration: 0.55, ease: 'power3.out' };

  const TESTIMONIALS = [
    {
      id: 1,
      icon: '✦',
      title: 'Анна К.',
      role: 'Эксперт, личный бренд',
      description:
        'Сайт получился не шаблонным — сразу чувствуется характер. Быстро, стильно и без лишней воды в процессе.',
    },
    {
      id: 2,
      icon: '◈',
      title: 'Михаил Р.',
      role: 'Основатель digital-продукта',
      description:
        'Собрал сильный первый экран и логику блоков так, что продукт стал выглядеть дороже, чем был на старте.',
    },
    {
      id: 3,
      icon: '◎',
      title: 'Креативная студия Loop',
      role: 'Партнёрский проект',
      description:
        'Нужен был визуальный концепт под кейс — получили подачу, которую не стыдно показать клиенту и в портфолио.',
    },
    {
      id: 4,
      icon: '✺',
      title: 'Дарья В.',
      role: 'AI-creator',
      description:
        'Понял задачу с полуслова: трендовый вайб, чистая структура и ощущение, что страницу хочется переслать.',
    },
    {
      id: 5,
      icon: '❋',
      title: 'Игорь С.',
      role: 'Предприниматель',
      description:
        'От идеи до рабочей версии — быстро. Главное — не просто сверстал, а собрал цельное впечатление от проекта.',
    },
  ];

  function lerpMap(value, inMin, inMid, inMax, outA, outB, outC) {
    if (value <= inMid) {
      const t = inMid === inMin ? 0 : (value - inMin) / (inMid - inMin);
      return outA + (outB - outA) * t;
    }
    const t = inMax === inMid ? 0 : (value - inMid) / (inMax - inMid);
    return outB + (outC - outB) * t;
  }

  class Carousel {
    constructor(container, options = {}) {
      this.container = container;
      this.track = container.querySelector('[data-carousel-track]');
      this.indicatorsEl = container.querySelector('[data-carousel-indicators]');
      this.items = options.items || TESTIMONIALS;
      this.autoplay = options.autoplay ?? true;
      this.autoplayDelay = options.autoplayDelay ?? 3000;
      this.pauseOnHover = options.pauseOnHover ?? true;
      this.loop = options.loop ?? true;

      this.baseWidth = 380;
      this.itemWidth = 0;
      this.trackItemOffset = 0;
      this.position = this.loop ? 1 : 0;
      this.currentX = 0;
      this.isDragging = false;
      this.isJumping = false;
      this.isAnimating = false;
      this.isHovered = false;
      this.dragStartX = 0;
      this.dragStartTranslate = 0;
      this.lastMoveX = 0;
      this.lastMoveTime = 0;
      this.velocityX = 0;
      this.autoplayTimer = null;
      this.itemEls = [];

      this.itemsForRender = this.loop && this.items.length
        ? [this.items[this.items.length - 1], ...this.items, this.items[0]]
        : [...this.items];

      this.render();
      this.bindEvents();
      this.onResize();
      this.goTo(this.position, false);
      this.startAutoplay();
    }

    get activeIndex() {
      if (!this.items.length) return 0;
      if (!this.loop) return Math.min(this.position, this.items.length - 1);
      return (this.position - 1 + this.items.length) % this.items.length;
    }

    render() {
      this.track.innerHTML = '';
      this.indicatorsEl.innerHTML = '';

      this.itemsForRender.forEach((item, index) => {
        const el = document.createElement('article');
        el.className = 'carousel-item';
        el.dataset.index = String(index);
        el.innerHTML = `
          <div class="carousel-item-header">
            <span class="carousel-icon-container" aria-hidden="true">${item.icon}</span>
          </div>
          <div class="carousel-item-content">
            <div class="carousel-item-title">${item.title}</div>
            <div class="carousel-item-role">${item.role}</div>
            <p class="carousel-item-description">${item.description}</p>
          </div>
        `;
        this.track.appendChild(el);
        this.itemEls.push(el);
      });

      this.items.forEach((_, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'carousel-indicator';
        btn.setAttribute('aria-label', `Отзыв ${index + 1}`);
        btn.addEventListener('click', () => {
          this.goTo(this.loop ? index + 1 : index);
          this.resetAutoplay();
        });
        this.indicatorsEl.appendChild(btn);
      });
    }

    onResize() {
      const wrap = this.container.parentElement;
      this.baseWidth = Math.min(380, (wrap?.offsetWidth || 380) - 8);
      this.container.style.setProperty('--carousel-width', `${this.baseWidth}px`);
      this.itemWidth = this.baseWidth - PADDING * 2;
      this.trackItemOffset = this.itemWidth + GAP;

      this.itemEls.forEach((el) => {
        el.style.width = `${this.itemWidth}px`;
      });

      this.applyTranslate(-this.position * this.trackItemOffset);
      this.updateIndicators();
    }

    applyTranslate(x) {
      this.currentX = x;
      if (typeof gsap !== 'undefined') {
        gsap.set(this.track, { x });
      } else {
        this.track.style.transform = `translate3d(${x}px, 0, 0)`;
      }
      this.updateRotations();
      this.updateActiveItem();
    }

    setTranslate(x, animate = true) {
      this.currentX = x;

      if (animate && typeof gsap !== 'undefined') {
        this.isAnimating = true;
        gsap.to(this.track, {
          x,
          ...SPRING,
          onComplete: () => this.onAnimationComplete(),
        });
      } else {
        this.applyTranslate(x);
      }

      if (animate) {
        this.updateRotations();
        this.updateActiveItem();
      }
    }

    updateRotations() {
      this.itemEls.forEach((el, index) => {
        const rangeA = -(index + 1) * this.trackItemOffset;
        const rangeB = -index * this.trackItemOffset;
        const rangeC = -(index - 1) * this.trackItemOffset;
        const rotateY = lerpMap(this.currentX, rangeA, rangeB, rangeC, 90, 0, -90);
        el.style.transform = `rotateY(${rotateY}deg)`;
      });
    }

    updateActiveItem() {
      this.itemEls.forEach((el, index) => {
        el.classList.toggle('is-active', index === this.position);
      });
      this.updateIndicators();
    }

    updateIndicators() {
      const buttons = this.indicatorsEl.querySelectorAll('.carousel-indicator');
      buttons.forEach((btn, index) => {
        const isActive = index === this.activeIndex;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('inactive', !isActive);
        btn.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    }

    goTo(nextPosition, animate = true) {
      const max = this.itemsForRender.length - 1;
      this.position = Math.max(0, Math.min(nextPosition, max));
      this.isJumping = !animate;
      this.setTranslate(-this.position * this.trackItemOffset, animate);
    }

    onAnimationComplete() {
      if (!this.loop || this.itemsForRender.length <= 1) {
        this.isAnimating = false;
        this.isJumping = false;
        return;
      }

      const lastCloneIndex = this.itemsForRender.length - 1;

      if (this.position === lastCloneIndex) {
        this.position = 1;
        this.isJumping = true;
        this.applyTranslate(-this.position * this.trackItemOffset);
        this.isAnimating = false;
        requestAnimationFrame(() => { this.isJumping = false; });
        return;
      }

      if (this.position === 0) {
        this.position = this.items.length;
        this.isJumping = true;
        this.applyTranslate(-this.position * this.trackItemOffset);
        this.isAnimating = false;
        requestAnimationFrame(() => { this.isJumping = false; });
        return;
      }

      this.isAnimating = false;
      this.isJumping = false;
    }

    onDragEnd() {
      this.isDragging = false;
      this.track.classList.remove('is-dragging');

      const offset = this.currentX - (-this.position * this.trackItemOffset);
      let direction = 0;

      if (offset < -DRAG_BUFFER || this.velocityX < -VELOCITY_THRESHOLD) direction = 1;
      else if (offset > DRAG_BUFFER || this.velocityX > VELOCITY_THRESHOLD) direction = -1;

      if (direction !== 0) {
        this.goTo(this.position + direction);
      } else {
        this.goTo(this.position);
      }

      this.resetAutoplay();
    }

    bindEvents() {
      const onPointerDown = (e) => {
        if (this.isAnimating && !this.isJumping) return;
        this.isDragging = true;
        this.track.classList.add('is-dragging');
        this.dragStartX = e.clientX;
        this.dragStartTranslate = this.currentX;
        this.lastMoveX = e.clientX;
        this.lastMoveTime = Date.now();
        this.velocityX = 0;
        if (typeof gsap !== 'undefined') gsap.killTweensOf(this.track);
        this.track.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e) => {
        if (!this.isDragging) return;
        const now = Date.now();
        const dt = now - this.lastMoveTime;
        if (dt > 0) {
          this.velocityX = ((e.clientX - this.lastMoveX) / dt) * 1000;
        }
        this.lastMoveX = e.clientX;
        this.lastMoveTime = now;

        let nextX = this.dragStartTranslate + (e.clientX - this.dragStartX);
        if (!this.loop) {
          const minX = -this.trackItemOffset * (this.itemsForRender.length - 1);
          nextX = Math.max(minX, Math.min(0, nextX));
        }
        this.currentX = nextX;
        if (typeof gsap !== 'undefined') {
          gsap.set(this.track, { x: nextX });
        } else {
          this.track.style.transform = `translate3d(${nextX}px, 0, 0)`;
        }
        this.updateRotations();
        this.updateActiveItem();
      };

      const onPointerUp = (e) => {
        if (!this.isDragging) return;
        try { this.track.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        this.onDragEnd();
      };

      this.track.addEventListener('pointerdown', onPointerDown);
      this.track.addEventListener('pointermove', onPointerMove);
      this.track.addEventListener('pointerup', onPointerUp);
      this.track.addEventListener('pointercancel', onPointerUp);

      if (this.pauseOnHover) {
        this.container.addEventListener('mouseenter', () => {
          this.isHovered = true;
          this.stopAutoplay();
        });
        this.container.addEventListener('mouseleave', () => {
          this.isHovered = false;
          this.startAutoplay();
        });
      }

      window.addEventListener('resize', () => this.onResize());
    }

    startAutoplay() {
      this.stopAutoplay();
      if (!this.autoplay || this.itemsForRender.length <= 1) return;
      if (this.pauseOnHover && this.isHovered) return;

      this.autoplayTimer = setInterval(() => {
        if (this.isDragging || this.isAnimating) return;
        this.goTo(this.position + 1);
      }, this.autoplayDelay);
    }

    stopAutoplay() {
      if (this.autoplayTimer) {
        clearInterval(this.autoplayTimer);
        this.autoplayTimer = null;
      }
    }

    resetAutoplay() {
      this.stopAutoplay();
      this.startAutoplay();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('testimonials-carousel');
    if (!el) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    new Carousel(el, {
      autoplay: !reducedMotion,
      autoplayDelay: 3000,
      pauseOnHover: true,
      loop: true,
    });
  });
})();
