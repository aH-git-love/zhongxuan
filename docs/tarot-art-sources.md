# Rider–Waite–Smith tarot artwork sources

## Artwork and provenance

The 78 local images are scans of the classic Rider–Waite–Smith deck drawn by **Pamela Colman Smith**, from the original **Pam-A** artwork. They are not illustrations from a modern replacement deck. The source file descriptions identify the artwork as early twentieth-century Rider–Waite tarot cards (usually dated 1910), credit Pamela Colman Smith, and mark the work **Public domain**.

Primary collection: [Wikimedia Commons — Rider-Waite-Smith tarot deck (TaionWC)](https://commons.wikimedia.org/wiki/Category:Rider-Waite-Smith_tarot_deck_%28TaionWC%29).

The download helper reads the Commons category with the [MediaWiki categorymembers API](https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=Category%3ARider-Waite-Smith_tarot_deck_%28TaionWC%29&cmtype=file&cmlimit=500), then reads original image URLs, original dimensions, source credit, artist, and license through `prop=imageinfo&iiprop=url|extmetadata|size|sha1`. It checks that each of the 78 source files explicitly names Pamela Colman Smith and reports `LicenseShortName: Public domain` before accepting the artwork. Images are downloaded directly from Wikimedia: full-resolution originals use `upload.wikimedia.org`, and official 500-pixel-wide JPEG derivatives use `thumb.wikimedia.org`. Both retain the complete scan. No third-party image repository or modern copyrighted deck is used. During this collection, the original-image host repeatedly returned HTTP 429 despite honoring its 120-second `Retry-After`; after three such responses, the pending cards were obtained from the official Commons derivative endpoint instead. The manifest distinguishes the exact downloaded `sourceImage` from the full-resolution `sourceOriginalImage`.

Commons identifies the scans under the public-domain templates `PD-old-80-expired` / `CC-PD-Mark`. The corresponding [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/) describes their status, rather than applying a new copyright license to the original artwork. Source-specific license metadata is retained in the manifest. The original source credit is also retained exactly as plain text; many files credit `http://muzendo.jp/blog/` in their Commons description.

Representative primary source pages:

- [The Fool, 00](https://commons.wikimedia.org/wiki/File:RWS_Tarot_00_Fool.jpg)
- [The High Priestess, II](https://commons.wikimedia.org/wiki/File:RWS_Tarot_02_High_Priestess.jpg)
- [Strength, VIII](https://commons.wikimedia.org/wiki/File:RWS_Tarot_08_Strength.jpg)
- [Justice, XI](https://commons.wikimedia.org/wiki/File:RWS_Tarot_11_Justice.jpg)
- [Ace of Wands](https://commons.wikimedia.org/wiki/File:Wands01.jpg)
- [Nine of Wands](https://commons.wikimedia.org/wiki/File:Wands09.jpg)
- [Ace of Cups](https://commons.wikimedia.org/wiki/File:Cups01.jpg)
- [Queen of Swords](https://commons.wikimedia.org/wiki/File:Swords13.jpg)
- [Ace of Pentacles](https://commons.wikimedia.org/wiki/File:Pents01.jpg)

Every card's actual source page and original image URL are listed in `assets/tarot/rws/sources.json`.

## Verified delivery

- **78 actual WebP images**, with 78 distinct SHA-256 digests and no missing or extra card files.
- Every image is **420 pixels wide**, with original-proportion heights between **705 and 740 pixels**.
- Images: **5,796,062 bytes**. Source manifest: **103,388 bytes**. Delivered `assets/tarot/rws/` directory: **5,899,450 bytes** across **79 files**, below 6 MB in decimal units.
- Source delivery: **24 full-resolution Commons originals**, followed by **54 official Commons 500-pixel derivatives** after original-host throttling. The same public-domain scan family is used throughout.
- The bounded budget pass recompressed **53** of the local WebP files; the other 25 retain the first-pass encoding. Each affected manifest entry documents this explicitly.
- All 78 decoded files were also reviewed together as a temporary contact sheet; that proof sheet was removed from the delivered asset directory.

## Mapping to the application

The helper executes the existing CommonJS export through Node:

```js
const { TAROT } = require('./js/tarot.js');
const cards = TAROT.ALL;
```

It derives every local ID, Chinese name, suit, and rank from this export. It does not parse JavaScript with regular expressions or invent a second deck ordering.

| Application IDs | Commons file family | Rank mapping |
| --- | --- | --- |
| `M00`–`M21` | `RWS Tarot 00 Fool.jpg` through `RWS Tarot 21 World.jpg` | Original RWS numbering; Strength VIII = `M08`, Justice XI = `M11` |
| `W01`–`W14` | `Wands01.jpg`–`Wands14.jpg` | Ace, 2–10, Page, Knight, Queen, King |
| `C01`–`C14` | `Cups01.jpg`–`Cups14.jpg` | Ace, 2–10, Page, Knight, Queen, King |
| `S01`–`S14` | `Swords01.jpg`–`Swords14.jpg` | Ace, 2–10, Page, Knight, Queen, King |
| `P01`–`P14` | `Pents01.jpg`–`Pents14.jpg` | Ace, 2–10, Page, Knight, Queen, King |

The URL convention for application use is **`assets/tarot/rws/<CARD_ID>.webp`**. The application references these local card-image URLs using its existing `TAROT.ALL` IDs; the manifest supplies source attribution and integrity metadata for the asset layer.

## Local processing

- Actual downloaded JPEG scans (full-resolution originals or official Commons 500-pixel derivatives) are decoded using Pillow and converted to RGB WebP.
- Output width: **420 pixels**. Height follows the original scan proportions, so original border differences are retained rather than stretched to an identical rectangle.
- Resampling: Lanczos. First-pass WebP quality: **62**, method **6**. If the complete image payload exceeds **5,800,000 bytes**, the helper recompresses the largest WebP files at quality **54**, method **6**, until the budget is met. Affected records include `budgetRecompression` with the exact second-pass settings. This reserves space for the source manifest while keeping the delivered directory below 6,000,000 bytes.
- The complete original scan is retained: no cropping, illustration replacement, recoloring, text overlay, or generated artwork.
- Downloaded JPEGs are decoded in memory and are not shipped with the application.
- The manifest records the exact decoded dimensions, byte count, and SHA-256 digest for every output, as well as original image dimensions and Commons SHA-1.

## Manifest schema

`sources.json` is a **JSON object**, not a bare array:

```text
{
  schemaVersion: 1,
  deck: string,
  sourceCategory: URL,
  author: string,
  processing: { format, width, quality, method, imageBudgetBytes, budgetRecompressionQuality, resize },
  verifiedAt: UTC ISO-8601 timestamp,
  cards: [ /* exactly 78, in TAROT.ALL order */ ]
}
```

Each entry in `cards` contains:

```text
id, cardName, englishName, suit, number,
sourceFile, sourcePage, sourceImage, sourceOriginalImage,
downloadDimensions: { width, height },
license, licenseCode, licenseUrl, originalSourceAuthor,
sourceCredit, originalPublicationDate,
sourceDimensions: { width, height }, sourceSha1,
localImage,
dimensions: { width, height }, bytes, sha256
```

`englishName` is preserved from the application export; the minor cards currently have an empty exported English name. The local manifest does not silently replace application names. `verifiedAt` is filled only after the complete deck passes validation. `localImage` is project-relative and uses forward slashes.

## Reproduction and validation

Requirements: Python 3.10 or newer, Pillow with WebP support, and Node.js on `PATH`.

Run from the repository root:

```sh
python tools/fetch_tarot_art.py
python tools/fetch_tarot_art.py --verify
```

The default command resumes a partial download. Fresh metadata discovery prefers official 500-pixel Commons JPEG derivatives, then performs the final proportional resize locally. To refresh Commons metadata and redownload every scan:

```sh
python tools/fetch_tarot_art.py --force
```

For an older partial manifest that still points to a throttled original-image host, switch only pending downloads to official Commons derivatives and use a two-second pause:

```sh
python tools/fetch_tarot_art.py --commons-thumbnails --delay 2
```

The downloader requests metadata in controlled batches of at most 40 file titles, downloads images sequentially with a one-second default gap, and respects HTTP 429 / transient server failures using exponential backoff and `Retry-After`. Increase the pause if needed with `--delay 2`. It never starts parallel image requests. `sourceDimensions` and `sourceSha1` describe the full-resolution Commons original; `downloadDimensions` and `sourceImage` identify the image actually decoded for the local conversion.

Offline `--verify` re-reads `TAROT.ALL` through Node and verifies all 78 IDs, card names and paths, actual WebP decoding, 420-pixel widths, portrait proportions, manifest dimensions and byte counts, 78 distinct SHA-256 values, no missing or extra `.webp` files, source author and public-domain metadata, an image payload at or below 5,800,000 bytes, and images plus manifest below 6,000,000 bytes. A failed or interrupted download leaves `verifiedAt` unset until a complete successful run.
