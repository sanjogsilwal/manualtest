// Scroll-speed-aware reveal — elements animate in as they enter the viewport.
// Fast scrolling = quick snappy reveal; slow scrolling = graceful ease-in.

const TARGETS = [
  '.manual-card',
  '.feature-box',
  '.research-card',
  '.submit-card',
  '.dash-stat',
  '.list-card',
  '.about-content',
  '.section-bar',
].join(',');

const OFFSET_Y = 34; // initial hidden translateY in px

// ── Scroll velocity tracking ─────────────────────────────────────────────
let velocity = 0;
let prevY = 0;
let prevT = 0;
let velRaf = null;

function trackVelocity() {
  if (velRaf) return;
  velRaf = requestAnimationFrame(() => {
    const y = window.scrollY;
    const t = performance.now();
    const dt = t - prevT;
    if (dt > 0) velocity = Math.abs(y - prevY) / dt; // px per ms
    prevY = y;
    prevT = t;
    velRaf = null;
  });
}

// Maps velocity (px/ms) → reveal duration in seconds.
// Slow scroll (0 px/ms) → 0.65s; fast scroll (2+ px/ms) → 0.27s
function revealDuration() {
  const v = Math.min(velocity / 2.5, 1);
  return parseFloat((0.65 - v * 0.38).toFixed(3));
}

// Maps velocity → per-item stagger delay in ms.
// Slow scroll → 55ms stagger; fast scroll → ~10ms (almost simultaneous)
function staggerMs(index) {
  const v = Math.min(velocity / 2.5, 1);
  const step = 55 * (1 - v * 0.82);
  return index * step;
}

// ── Element reveal ───────────────────────────────────────────────────────
function revealElement(el, delay, dur) {
  setTimeout(() => {
    // Temporarily inject the reveal transition as inline style.
    // This overrides any existing transition just for this animation.
    el.style.transition = `opacity ${dur}s ease, transform ${dur}s cubic-bezier(.22, 1, .36, 1)`;

    // Force reflow so the browser registers the starting hidden state
    // before applying the end state (without this, the transition skips).
    void el.getBoundingClientRect();

    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    el.classList.add('sr-in');

    // Once the reveal finishes, strip all inline styles so the element's
    // normal CSS (including hover transitions) takes over cleanly.
    const cleanup = () => {
      el.style.transition = '';
      el.style.opacity = '';
      el.style.transform = '';
    };
    el.addEventListener('transitionend', cleanup, { once: true });
    // Safety timeout if transitionend never fires (display:none, etc.)
    setTimeout(cleanup, (dur + 0.15) * 1000);
  }, delay);
}

// ── Intersection observer ────────────────────────────────────────────────
// Batch entries that arrive in the same frame so we can stagger them.
let pendingBatch = [];
let batchRaf = null;

function flushBatch() {
  const items = pendingBatch.splice(0);
  const dur = revealDuration();
  items.forEach(({ el }, i) => revealElement(el, staggerMs(i), dur));
  batchRaf = null;
}

const io = new IntersectionObserver(
  (entries) => {
    let hasNew = false;
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        pendingBatch.push({ el: entry.target });
        io.unobserve(entry.target);
        hasNew = true;
      }
    });
    if (hasNew && !batchRaf) {
      batchRaf = requestAnimationFrame(flushBatch);
    }
  },
  { threshold: 0.07, rootMargin: '0px 0px -20px 0px' }
);

// ── DOM scanner ──────────────────────────────────────────────────────────
// Runs after each React render (via MutationObserver) to pick up new elements.
let scanRaf = null;

function scan() {
  document.querySelectorAll(TARGETS + ':not(.sr-obs)').forEach((el) => {
    el.classList.add('sr-obs');
    // Set the hidden starting state via inline style (not CSS class) so that
    // the element is invisible without requiring a CSS class on <html>.
    el.style.opacity = '0';
    el.style.transform = `translateY(${OFFSET_Y}px)`;
    io.observe(el);
  });
}

const mo = new MutationObserver(() => {
  if (scanRaf) return;
  // Defer to next frame so React finishes painting before we scan
  scanRaf = requestAnimationFrame(() => {
    scan();
    scanRaf = null;
  });
});

// ── Public API ───────────────────────────────────────────────────────────
export function init() {
  prevY = window.scrollY;
  prevT = performance.now();
  window.addEventListener('scroll', trackVelocity, { passive: true });
  scan();
  mo.observe(document.body, { childList: true, subtree: true });
}

export function destroy() {
  window.removeEventListener('scroll', trackVelocity);
  io.disconnect();
  mo.disconnect();
  if (velRaf) { cancelAnimationFrame(velRaf); velRaf = null; }
  if (batchRaf) { cancelAnimationFrame(batchRaf); batchRaf = null; }
  if (scanRaf) { cancelAnimationFrame(scanRaf); scanRaf = null; }
}
