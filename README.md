# Twitch Ad Shield (personal)

An unpacked Chrome extension (Manifest V3) that removes pre-roll and mid-roll ads from Twitch
**live streams**. It doesn't use proxies or any third-party servers.

For the survey of existing projects and why this approach was picked, see
[RESEARCH.md](RESEARCH.md).

## Load it in Chrome

1. Get the files: `git clone https://github.com/Teylersf/twitch-adblock.git`, or click
   **Code → Download ZIP** on GitHub and unzip it.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `twitch-adblock` folder (the one with `manifest.json`).
5. Optional: pin it from the puzzle-piece menu so the on/off popup is one click away.
6. **Reload any Twitch tabs that are already open.** The engine has to be in the page before
   Twitch's player starts, so a tab opened before install isn't protected.

**Turn off any other Twitch-specific ad blocker** first: vaft or Purple userscripts in
Tampermonkey/Violentmonkey, Purple Adblock, TTV LOL PRO, AdGuard Extra. They all hook the same
player worker and break each other. A general blocker like uBlock Origin Lite is fine to keep.

To remove it, click **Remove** on its card in `chrome://extensions`.

## Using it

- Click the toolbar icon to switch blocking on or off. When it's off, the badge shows `OFF`.
  After switching, press **Reload Twitch tabs** in the popup.
- In DevTools on a Twitch tab, the console shows `[AD DEBUG] …` lines from the engine. You'll
  see `TwitchAdSolutions vaft v93 loading`, `Worker intercepted`, and during a break lines about
  detected ads and which backup player type was used.

## How it works

Twitch stitches ads into the stream's HLS playlist on the server side, so ad segments come from
the same CDN as the stream and can't just be URL-blocked. The extension has three parts:

1. **Engine: [`engine/vaft.js`](engine/vaft.js).** This is the `vaft` script from
   [ryanbr/TwitchAdSolutions](https://github.com/ryanbr/TwitchAdSolutions) (MIT, the maintained
   fork of pixeltris's archived project), vendored unchanged and pinned to the commit in
   [`engine/engine.json`](engine/engine.json). [`background.js`](background.js) registers it as a
   content script in the page's own JS world (`world: "MAIN"`) at `document_start` on
   `*.twitch.tv`. There it:
   - wraps `window.Worker` so its own `fetch` hook runs inside Twitch's video worker;
   - watches each media playlist for ad markers (`stitched-ad` DATERANGEs, CUE-OUT, known ad
     segment URL patterns);
   - when a break starts, requests fresh access tokens for the same channel under other
     player types (`site`, `popout`, `mobile_web`, `embed`, and as a last resort `autoplay`)
     from Twitch's own GQL and usher endpoints, and gives the player the first playlist
     without ads;
   - if every backup has ads too, strips the ad segments (the picture holds until the
     break ends), then reloads the player once the break is over so it gets back to full
     quality and the live edge;
   - stubs Twitch's client-side ad requests and runs buffer/freeze recovery.
2. **Codec guard: [`codec-guard.js`](codec-guard.js)** (on by default; popup toggle "H.264 only").
   Runs just before the engine and reports HEVC and AV1 as unsupported, so Twitch only serves
   H.264. Without it, on 2K/4K "Enhanced Broadcasting" streams, the H.264 backup swapped in during
   an ad can make Chrome's player fail with **Error #4000** (upstream issues
   pixeltris/TwitchAdSolutions#351/#352/#415). Many 1440p streams also have an H.264 1440p
   rendition (verified on one channel: `avc1.640033`), so you often keep full resolution. Streams
   that only offer 2K/4K in HEVC/AV1 drop to their best H.264 rendition.
3. **Network rules: [`rules/ad-requests.json`](rules/ad-requests.json).** `declarativeNetRequest`
   blocks client-side ad and ad-SDK requests started from twitch.tv (`edge.ads.twitch.tv`,
   `amazon-adsystem.com`, Google IMA and DoubleClick), including ones from workers that the page
   hook can't see.
4. **Cosmetics: [`cosmetic.css`](cosmetic.css).** Hides leftover ad labels and countdowns, and the
   display-ad video boxes beside the player and chat. The selectors are adapted from uBlock
   Origin's filters.

The on/off switch unregisters the scripts and disables the ruleset, so when it's off the
extension does nothing.

Permissions: `scripting` (to register the content scripts), `declarativeNetRequest`, `storage`
(the on/off setting), and host access to `*.twitch.tv` only. The engine only talks to Twitch's
own hosts (`gql.twitch.tv`, `usher.ttvnw.net`, the video CDN).

## Updating the engine

Twitch changes things regularly, and vaft gets updated in response. To pull a newer version:

```bash
./scripts/update-engine.sh
```

The script resolves the latest commit that touched `vaft/vaft.user.js`, shows the version and a
compare link, checks that the new file parses, is still `@grant none`, and doesn't reference any
new hosts, then asks before replacing anything. Afterwards, click the reload icon on the
extension's card in `chrome://extensions` and reload your Twitch tabs. To pin a specific commit,
pass its SHA as the first argument.

## Limits

- **Live streams only.** VOD ads aren't removed by vaft (or Purple, or TTV LOL PRO). The network
  rules may stop some client-side VOD pre-rolls, but that's unverified and you shouldn't rely on it.
- **Quality dips during breaks.** Twitch often attaches ads to every full-quality backup too, so
  during a mid-roll you may see a few seconds of **360p** (the `autoplay` backup) or a frozen frame
  while ad segments are stripped. The player reloads after the break, which shows as a brief
  black flash.
- **HEVC/AV1 renditions are skipped** while "H.264 only" is on. Streams that only offer 2K/4K in
  those codecs play at their best H.264 quality. Turning it off restores them, but brings back the
  risk of Error #4000 when an ad break hits those streams.
- **Known open bugs upstream:** audio desync on some ads, picture-in-picture glitches, and
  occasional stalls in background tabs. See the
  [ryanbr/TwitchAdSolutions issues](https://github.com/ryanbr/TwitchAdSolutions/issues).
- **It's an arms race.** When Twitch changes its playlists or tokens, ads come back until vaft is
  updated. Run the update script when that happens. If the in-page approach stops working for
  you entirely, the proxy-based [TTV LOL PRO](https://github.com/younesaassila/ttv-lol-pro) is the
  usual fallback; uninstall this extension first.
- **Not covered:** clips and the clip editor (skipped on purpose), Twitch on other devices or in
  the desktop or mobile apps, and anything outside `*.twitch.tv`.
- **No upstream auto-update.** This is an unpacked personal extension, not a store listing, so it
  only changes when you run the update script.
- Blocking ads means the streamer doesn't get ad revenue for your view. Twitch Turbo or a
  subscription is the supported way to get no ads.

## Files

```
manifest.json            MV3 manifest
background.js            registers the engine and CSS, handles the on/off switch, DNR toggling
codec-guard.js           hides HEVC/AV1 support so Twitch serves H.264 (prevents Error #4000)
engine/vaft.js           vendored vaft engine (MIT, unmodified)
engine/engine.json       which upstream commit is vendored
engine/LICENSE-TwitchAdSolutions
rules/ad-requests.json   declarativeNetRequest block rules
cosmetic.css             hides ad UI
popup/                   on/off popup
icons/                   toolbar icons
scripts/update-engine.sh pulls and checks a newer engine
RESEARCH.md              survey of existing approaches
```

## Credits and license

This extension's own code is MIT licensed (see `LICENSE`). The ad-blocking engine is the work of the TwitchAdSolutions contributors (pixeltris, ryanbr, and
the VideoAdBlockForTwitch authors) under the MIT License; see `engine/LICENSE-TwitchAdSolutions`.
Cosmetic selectors are adapted from uBlock Origin's uAssets filter lists.
