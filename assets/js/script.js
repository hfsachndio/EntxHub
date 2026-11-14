'use strict';

/* Shared page behaviour: mobile menu, sticky header, go-to-top, search toggle and sliders.
   Every block checks that its elements exist, so the same file works on every page. */

(function () {
  const navOpenBtn = document.querySelector('[data-menu-open-btn]');
  const navCloseBtn = document.querySelector('[data-menu-close-btn]');
  const navbar = document.querySelector('[data-navbar]');
  const overlay = document.querySelector('[data-overlay]');

  if (navbar) {
    [navOpenBtn, navCloseBtn, overlay].forEach(function (el) {
      if (!el) return;
      el.addEventListener('click', function () {
        navbar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
        document.body.classList.toggle('active');
      });
    });
    // Close the mobile menu after picking a link
    navbar.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navbar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('active');
      });
    });
  }

  const header = document.querySelector('[data-header]');
  const goTopBtn = document.querySelector('[data-go-top]');
  window.addEventListener('scroll', function () {
    if (header) header.classList.toggle('active', window.scrollY >= 10);
    if (goTopBtn) goTopBtn.classList.toggle('active', window.scrollY >= 500);
  });

  // Search box toggle (the search itself lives in entx.js)
  const searchButton = document.getElementById('search-button') || document.querySelector('.search-btn');
  const searchBox = document.getElementById('search-box');
  if (searchButton && searchBox) {
    searchButton.addEventListener('click', function () {
      const open = searchBox.style.display === 'block';
      searchBox.style.display = open ? 'none' : 'block';
      if (!open) {
        const input = searchBox.querySelector('input');
        if (input) input.focus();
      }
    });
  }

  // Swiper sliders (only on pages that include Swiper)
  if (typeof window.Swiper === 'function') {
    if (document.querySelector('.main-slider')) {
      new window.Swiper('.main-slider', {
        loop: true,
        navigation: { nextEl: '.main-slider .swiper-button-next', prevEl: '.main-slider .swiper-button-prev' },
      });
    }
    if (document.querySelector('.thumbnail-slider')) {
      new window.Swiper('.thumbnail-slider', { spaceBetween: 10, slidesPerView: 3, slideToClickedSlide: true });
    }
  }

  // Hero slideshow with clickable controls (movie pages)
  const items = document.querySelectorAll('.slideshow-container .item');
  const controls = document.querySelectorAll('.slideshow-container .control');
  if (items.length && controls.length) {
    const headerItems = document.querySelectorAll('.slideshow-container .item-header');
    const descriptionItems = document.querySelectorAll('.slideshow-container .item-description');
    const activeDelay = 0.76;
    const interval = 5000;
    let current = 0;
    let timer;

    const reset = function () {
      items.forEach(function (i) { i.classList.remove('active'); });
      controls.forEach(function (c) { c.classList.remove('active'); });
    };
    const transitionDelay = function (list) {
      list.forEach(function (item) {
        const seconds = item.classList.value === 'item-header' ? 0.015 : 0.007;
        let count = 1;
        item.childNodes.forEach(function (child) {
          if (child.classList && child.firstElementChild) {
            const delay = item.parentNode.classList.contains('active') ? count * seconds + activeDelay : count * seconds;
            child.firstElementChild.style.transitionDelay = delay + 's';
            count++;
          }
        });
      });
    };
    const show = function (index) {
      reset();
      current = (index + items.length) % items.length;
      if (controls[current]) controls[current].classList.add('active');
      items[current].classList.add('active');
      transitionDelay(headerItems);
      transitionDelay(descriptionItems);
    };
    controls.forEach(function (control, i) {
      control.addEventListener('click', function () {
        clearInterval(timer);
        show(Number(control.dataset.index !== undefined ? control.dataset.index : i));
        timer = setInterval(function () { show(current + 1); }, interval);
      });
    });
    show(0);
    timer = setInterval(function () { show(current + 1); }, interval);
  }
})();
