const toggle = document.getElementById('enabled');
const stateLabel = document.getElementById('state-label');
const hint = document.getElementById('hint');
const reloadBtn = document.getElementById('reload');
const engineEl = document.getElementById('engine');

function render(enabled) {
  toggle.checked = enabled;
  stateLabel.textContent = enabled ? 'Blocking on' : 'Blocking off';
}

const h264Toggle = document.getElementById('h264only');

chrome.storage.local.get({ enabled: true, h264Only: true }).then(({ enabled, h264Only }) => {
  render(enabled);
  h264Toggle.checked = h264Only;
});

function showReload() {
  hint.hidden = false;
  reloadBtn.hidden = false;
}

toggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: toggle.checked });
  render(toggle.checked);
  showReload();
});

h264Toggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ h264Only: h264Toggle.checked });
  showReload();
});

reloadBtn.addEventListener('click', async () => {
  reloadBtn.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: 'reload-twitch-tabs' });
  hint.textContent = res && !res.error
    ? `Reloaded ${res.reloaded} Twitch tab${res.reloaded === 1 ? '' : 's'}.`
    : `Couldn't reload: ${res && res.error}`;
  reloadBtn.hidden = true;
});

fetch(chrome.runtime.getURL('engine/engine.json'))
  .then((r) => r.json())
  .then((e) => {
    engineEl.textContent = `vaft ${e.version} (${e.commit.slice(0, 7)})`;
    engineEl.title = `${e.source} @ ${e.commit}`;
  })
  .catch(() => { engineEl.textContent = 'unknown'; });
