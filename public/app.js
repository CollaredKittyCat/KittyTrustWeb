'use strict';

/* Star rating picker: highlights stars up to the selected/hovered value. */
document.querySelectorAll('.star-input').forEach(function (group) {
  var radios = Array.prototype.slice.call(group.querySelectorAll('input.star-radio'));

  function current() {
    var checked = group.querySelector('input:checked');
    return checked ? Number(checked.value) : 0;
  }

  function paint(n) {
    radios.forEach(function (radio) {
      var label = radio.nextElementSibling;
      if (label) label.classList.toggle('on', Number(radio.value) <= n);
    });
  }

  paint(current());

  radios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      paint(current());
    });
  });

  group.addEventListener('mouseover', function (event) {
    if (event.target.tagName === 'LABEL') {
      var forId = event.target.getAttribute('for');
      var hovered = group.querySelector('input#' + CSS.escape(forId));
      if (hovered) paint(Number(hovered.value));
    }
  });

  group.addEventListener('mouseleave', function () {
    paint(current());
  });
});

/* Live banner preview on the review form. */
(function () {
  var input = document.getElementById('banner_url');
  var box = document.getElementById('banner-preview');
  if (!input || !box) return;
  var img = box.querySelector('img');

  function refresh() {
    var url = input.value.trim();
    // Only point the preview at a complete URL — partial input like "ht" would
    // otherwise resolve relative to the current page and 404.
    if (!/^https?:\/\/\S+$/i.test(url)) {
      box.hidden = true;
      img.removeAttribute('src');
      return;
    }
    box.hidden = false;
    img.src = url;
  }

  img.addEventListener('error', function () {
    box.classList.add('bad');
  });
  img.addEventListener('load', function () {
    box.classList.remove('bad');
  });

  input.addEventListener('input', refresh);
  refresh();
})();

/* Confirm destructive submits. */
document.querySelectorAll('[data-confirm]').forEach(function (el) {
  el.addEventListener('submit', function (event) {
    if (!window.confirm(el.getAttribute('data-confirm'))) event.preventDefault();
  });
});
