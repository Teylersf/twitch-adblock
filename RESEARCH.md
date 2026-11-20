# Twitch ad blocking: survey of existing approaches (Nov 2026)

Checked on GitHub on 2026-11-19 (repo metadata, READMEs, recent issues and commits).

## Why Twitch ads are hard to block

Twitch uses **server-side ad insertion (SSAI)**: the ad video segments are stitched into the
same HLS media playlist (`*.m3u8` from `usher.ttvnw.net` / `video-weaver.*.hls.ttvnw.net`) as
the stream itself, served from the same CDN. A normal URL-blocking ad blocker can't tell the
segments apart, and blocking them just freezes the player. Twitch also mixes in some
**client-side ads (CSAI)** fetched from `edge.ads.twitch.tv`, plus display and banner ads on the page.

Every working approach does one of three things:

1. **Get a playlist without ads** by asking for the stream again in a way that Twitch doesn't
   attach ads to: a different `playerType` on the access token (`popout`, `embed`,
   `mobile_web`, `autoplay`, `picture-by-picture`…), or a request from a country with no ads (via a proxy).
2. **Edit the playlist** to drop the ad segments (the stream pauses on the last frame until the ad pod ends).
3. **Hide or mute** the ad while it plays (doesn't save time).

Any in-page approach has to run **before Twitch's player starts**, because the player fetches
playlists from inside a Web Worker. So these scripts replace `window.Worker` at
`document_start` and inject their own `fetch` hook into the worker.

## Projects

| Project | Approach | State (Nov 2026) | Trade-offs |
| --- | --- | --- | --- |
| **pixeltris/TwitchAdSolutions** (11.3k★): `vaft`, `video-swap-new`, `strip` scripts | Worker hook. On ad detection, fetch backup access tokens under other player types and swap in the first clean playlist; else strip ad segments | **Archived 2026-03-05**; the author quit. Don't use the original any more | Was the reference implementation for years |
| **ryanbr/TwitchAdSolutions** (fork, 1.2k★): `vaft` v68.x | Same as above, much hardened: backup-type pinning, early reload, buffer and freeze recovery, CSAI request stubbing, HEVC/AV1 handling, opt-in ad-beacon spoofing | **Actively maintained** (last vaft release 2026-08-27, issues triaged into Nov). Open issues: audio desync on some ads, PiP glitches, stalls in background tabs | Clean backups now often come back only at **360p** (`autoplay`) during breaks, so quality drops briefly. Sometimes a few seconds of frozen frame. Shipped as a userscript or uBO resource, not an extension |
| **arthurbolsoni/Purple-adblock** (510★) | Same family as vaft (worker hook + backup player types, segment-level splicing by `PROGRAM-DATE-TIME`, empty answers for ad segments, DNR block of `edge.ads.twitch.tv`). Has MV3 Chromium build | **Actively maintained** (pushed 2026-11-09). Rewritten and well-documented; the "ads getting through" thread is open | Credits vaft for its core ideas. Open audio-desync and HEVC black-screen bugs. Live only, no VODs |
| **younesaassila/ttv-lol-pro** (1.9k★) | **Proxy**: routes only the playlist/token requests through HTTP proxies in no-ad countries; video segments still come direct from Twitch | **Actively maintained** (pushed 2026-11-11). Recommended as "most reliable" by the TwitchAdSolutions README | Depends on volunteer proxy servers: downtime means ads or error 2000; distant proxies cause buffering at high quality; you send your Twitch playlist requests (including the channel you watch) through someone else's server. No VODs. Needs `proxy` permission |
| **AdGuard Extra** | Fork of vaft inside AdGuard's extension | Maintained by AdGuard | Same behaviour as vaft; closed-ish packaging |
| **Alternate Player for Twitch.tv** | Replaces the whole player; strips ad segments, can drop to low res during midrolls | Store extension | Different player UI; pauses during ads |
| **uBlock Origin / uAssets** | Stock lists only hide ad UI and block `amazon-adsystem` on Twitch. The old `twitch-videoad` scriptlet was removed long ago; there's an *experimental* `replace=` filter that strips ad DATERANGE markers | Maintained | Doesn't remove SSAI ads by itself. `replace=` needs response-body filtering (Firefox only). On Chrome, MV2 uBO is gone and **uBO Lite (MV3) can't load custom scriptlets**, so the "vaft via uBO userResourcesLocation" recipe no longer works in Chrome |
| **TTV Ad Mute**, Greasyfork "mute ads" scripts | Detect the ad overlay, mute or black out the tab | Small, some maintained | You still sit through the ad, just without the noise |
| cleanlock/VideoAdBlockForTwitch, ttv_adEraser, TTV LOL (original), ttv-tools | Older variants of the above | **Unmaintained** | Skip |

## Recommendation

**In-page worker hook with backup player types (the vaft approach), packaged as an MV3
extension.**

- It's what everything that still works today uses, apart from the proxy route.
- It needs no third-party servers: every request goes to Twitch's own endpoints, so there's
  nothing to go down and nothing logging your viewing.
- MV3 supports it cleanly: a content script with `world: "MAIN"` at `document_start` runs
  before Twitch's scripts, and `declarativeNetRequest` covers the CSAI and ad-SDK requests.

Rather than reimplementing ~3,000 lines of hard-won edge-case handling, this extension
**vendors the maintained `vaft` engine from ryanbr/TwitchAdSolutions (MIT), pinned to a
reviewed commit**, and adds the Chrome-specific parts around it: dynamic MAIN-world
registration with an on/off switch, DNR rules, cosmetic hiding, and an update script that
diffs and sanity-checks new engine versions before swapping them in.

If the in-page approach stops working for you, the next thing to try is **TTV LOL PRO**
(proxy), not stacking more scripts. Don't run two Twitch-specific blockers at once: they
both replace the player's worker and break each other.
