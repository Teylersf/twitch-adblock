// Twitch Ad Shield: service worker.
//
// The actual ad blocking happens in engine/vaft.js, which has to run in the
// page's own JavaScript world (world: "MAIN") at document_start so it can wrap
// window.Worker and fetch before Twitch's player creates its worker. Content
// scripts are registered dynamically (rather than listed in manifest.json) so
// the popup's on/off switch can add and remove them.

const MATCHES = ['*://*.twitch.tv/*'];
const RULESET_ID = 'twitch_ad_requests';
const SCRIPT_IDS = ['tas-codec-guard', 'tas-engine', 'tas-cosmetic'];

// Registered first (scripts at the same run_at run in registration order) so the
// player never sees HEVC/AV1 as decodable. See codec-guard.js for why.
const CODEC_GUARD = {
  id: 'tas-codec-guard',
  js: ['codec-guard.js'],
  matches: MATCHES,
  runAt: 'document_start',
  world: 'MAIN',
  allFrames: true,
  persistAcrossSessions: true,
};

const SCRIPTS = [
  {
    id: 'tas-engine',
    js: ['engine/vaft.js'],
    matches: MATCHES,
    runAt: 'document_start',
    world: 'MAIN',
    // vaft itself skips nested frames that aren't Twitch embeds, so allFrames
    // only matters for player.twitch.tv embeds on other sites' pages.
    allFrames: true,
    persistAcrossSessions: true,
  },
  {
    id: 'tas-cosmetic',
    css: ['cosmetic.css'],
    matches: MATCHES,
    runAt: 'document_start',
    allFrames: false,
    persistAcrossSessions: true,
  },
];

const DEFAULTS = { enabled: true, h264Only: true };

async function apply() {
  const { enabled, h264Only } = await chrome.storage.local.get(DEFAULTS);

  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: SCRIPT_IDS });
  if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: registered.map((s) => s.id) });
  }
  if (enabled) {
    await chrome.scripting.registerContentScripts(h264Only ? [CODEC_GUARD, ...SCRIPTS] : SCRIPTS);
  }

  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled ? { enableRulesetIds: [RULESET_ID] } : { disableRulesetIds: [RULESET_ID] }
  );

  await chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  await chrome.action.setBadgeBackgroundColor({ color: '#6b6b6b' });
}

// Serialize apply() calls so overlapping events don't race on register/unregister.
let chain = Promise.resolve();
function queueApply() {
  chain = chain.then(apply).catch((err) => console.error('[Twitch Ad Shield] apply failed:', err));
  return chain;
}

chrome.runtime.onInstalled.addListener(queueApply);
chrome.runtime.onStartup.addListener(queueApply);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ('enabled' in changes || 'h264Only' in changes)) queueApply();
});

// Popup asks for this after toggling: reload open Twitch tabs so the change
// takes effect (the engine must be present before the player starts).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'reload-twitch-tabs') {
    chain
      .then(() => chrome.tabs.query({ url: MATCHES }))
      .then((tabs) => Promise.all(tabs.map((t) => chrome.tabs.reload(t.id))))
      .then((r) => sendResponse({ reloaded: r.length }))
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }
  return false;
});
