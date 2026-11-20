// Twitch Ad Shield: codec guard (runs in the page's MAIN world before engine/vaft.js).
//
// Why: on Twitch "Enhanced Broadcasting" streams (2K/4K, HEVC or AV1), the clean
// backup stream vaft swaps in during an ad break is H.264. Chrome's player can't
// switch codecs mid-stream and fails with "Error #4000" (or #3000 / endless
// spinner). Known upstream issue: pixeltris/TwitchAdSolutions#351, #352, #415.
//
// Fix: report HEVC and AV1 as unsupported, so Twitch's player only ever requests
// H.264 renditions (max 1080p). No codec switch during ads means no #4000.
// Trade-off: enhanced streams top out at 1080p. Toggle in the popup.
(() => {
  'use strict';
  if (window.__tasCodecGuard) return;
  window.__tasCodecGuard = true;

  // Matches codec strings like 'video/mp4; codecs="hev1.1.6.L150.B0"', 'hvc1…', 'av01…'.
  const BLOCKED = /(^|[^a-z0-9])(hev1|hvc1|av01)\b/i;
  const isBlocked = (type) => typeof type === 'string' && BLOCKED.test(type);

  function wrap(owner, name, makeReplacement) {
    if (!owner) return;
    const orig = owner[name];
    if (typeof orig !== 'function') return;
    const replacement = makeReplacement(orig);
    try {
      Object.defineProperty(owner, name, { value: replacement, configurable: true, writable: true });
    } catch (_) { /* leave it alone if not writable */ }
  }

  for (const MS of [window.MediaSource, window.ManagedMediaSource, window.WebKitMediaSource]) {
    wrap(MS, 'isTypeSupported', (orig) => function isTypeSupported(type) {
      return isBlocked(type) ? false : orig.apply(this, arguments);
    });
  }

  if (window.HTMLMediaElement) {
    wrap(HTMLMediaElement.prototype, 'canPlayType', (orig) => function canPlayType(type) {
      return isBlocked(type) ? '' : orig.apply(this, arguments);
    });
  }

  if (navigator.mediaCapabilities) {
    wrap(Object.getPrototypeOf(navigator.mediaCapabilities), 'decodingInfo', (orig) => function decodingInfo(config) {
      const ct = config && config.video && config.video.contentType;
      if (isBlocked(ct)) {
        return Promise.resolve({ supported: false, smooth: false, powerEfficient: false, configuration: config });
      }
      return orig.apply(this, arguments);
    });
  }
})();
