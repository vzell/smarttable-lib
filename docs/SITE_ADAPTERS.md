# Site Adapter Reference

Detailed DOM analysis for every target site. Each section documents:
- What the page actually renders (verified from live HTML)
- Exactly which elements to select and how to parse them
- The `columnDefs` and `extract()` contract for the adapter
- Where to inject the trigger button

---

## Table of contents

1. [jungleland.it — Bootleg list](#1-junglelandit--bootleg-list)
2. [brucespringsteen.it — Unofficial + Official releases](#2-brucespringsteenitdb--unofficial--official-releases)
3. [archive.org — Bootleg search](#3-archiveorg--bootleg-search-by-year)
4. [brucebase.wikidot.com — Events by year](#4-brucebasewikidotcom--events-by-year)

---

## 1. jungleland.it — Bootleg list

**URL:** `https://www.jungleland.it/html/list.htm`

### Page structure

Late-1990s static HTML. No CSS classes on content elements. No `<table>`.

```
<body background="sfondo.jpg">
  <!-- Year-jump dropdown -->
  <form name="theForm">
    <select name="theMenu" onChange="goThere()">
      <option value="#1966">1966</option>
      ...
    </select>
  </form>

  <!-- Year anchor + heading -->
  <a NAME="1966">
  <b>&nbsp;<font face="Arial">1966&nbsp;</font></b>
  <a href="#TOP">

  <!-- One entry per bootleg -->
  <p align="center">
    <font face="Arial">
      <a target="inferioredx1" href="19660101.htm">
        The Castiles 1966-1967(1966-01-01)
      </a>
    </font>
  </p>

  <!-- Multiple versions of the same date -->
  <p align="center">
    <font face="Arial">
      <a target="inferioredx1" href="19700113.htm">
        Live At The Matrix(1970-01-13)
      </a>
    </font>
  </p>
  <p align="center">
    <font face="Arial">
      <a target="inferioredx1" href="19700113_3.htm">
        Live at the Matrix vol 1(picture disc)(living legend records) (Version 3)(1970-01-13)
      </a>
    </font>
  </p>
```

### Entry text format

```
TITLE[(EXTRA_INFO...)](YYYY-MM-DD)
```

- Date is **always the last parenthesised group** at the end of the text.
- `EXTRA_INFO` groups (optional) appear before the date: `(picture disc)`, `(living legend records)`.
- Version number is in the filename suffix: `19700113_3.htm` → version 3; no suffix → version 1.
- The `target="inferioredx1"` attribute is present on every bootleg link (use it as a reliable selector).

### DOM selectors

| Purpose | Selector |
|---------|----------|
| All bootleg links | `a[target="inferioredx1"]` |
| Year heading anchors | `a[NAME]` (capital NAME attribute) |
| Trigger injection point | `form[name="theForm"]` |

### Data fields & extraction

```
identifier  — href basename without extension: "19700113_3"
date        — from text: last (YYYY-MM-DD) group
title       — text before the last parenthesised date group
version     — numeric suffix from href ("_N"), defaults to 1
label       — optional: last parenthesised group before date that is not a known descriptor
href        — absolute URL: "https://www.jungleland.it/html/" + el.getAttribute("href")
year        — derived from date (YYYY)
month       — derived from date (MM)
day         — derived from date (DD)
```

**Extraction pseudocode:**

```js
extract() {
    const DATE_RE = /\((\d{4}-\d{2}-\d{2})\)$/;
    const VER_RE  = /_(\d+)\.htm$/i;

    return [...document.querySelectorAll('a[target="inferioredx1"]')]
        .filter(a => /\d{8}/.test(a.getAttribute('href') ?? ''))
        .map(a => {
            const text    = a.textContent.trim();
            const href    = a.getAttribute('href');
            const dateM   = DATE_RE.exec(text);
            const date    = dateM ? dateM[1] : '';
            const title   = date ? text.slice(0, text.lastIndexOf(`(${date})`)).trim() : text;
            const verM    = VER_RE.exec(href);
            const version = verM ? verM[1] : '1';

            return {
                date,
                title,
                version,
                href: new URL(href, 'https://www.jungleland.it/html/').href,
            };
        });
}
```

### Proposed columnDefs

```js
columnDefs: [
    { key: 'date',    label: 'Date',    type: 'date',   width: '100px' },
    { key: 'year',    label: 'Year',    type: 'number', width: '60px',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'title',   label: 'Title',   type: 'string' },
    { key: 'version', label: 'Ver',     type: 'number', width: '45px', filterable: false },
    { key: 'href',    label: 'Link',    type: 'string', sortable: false },
]
```

### Notes

- The page uses a frameset on some browser profiles; the list page itself (`list.htm`) loads standalone too.
- ~2 000+ entries total, no pagination.
- Multiple versions of the same date → separate rows with the same `date` but different `title` and `version`.

---

## 2. brucespringsteen.it/DB — Unofficial + Official releases

**URLs:**
- Unofficial: `https://www.brucespringsteen.it/DB/records.aspx?tipe=-1,0,...&sort=0&addon=0`
- Official:   `https://www.brucespringsteen.it/DB/records.aspx?tipe=-2,0,...&sort=0&addon=0`

Both use **identical HTML structure**. One adapter handles both; the adapter detects which mode
it is in by inspecting `window.location.href` for the presence of `tipe=-2` (official) or
`tipe=-1` (unofficial).

### Page structure

```
<body onLoad="setup('...',0,0)">
  <form name="mio">
    <!-- Navigation dropdown, media-type checkboxes, sort controls -->
    <table border="1">
      <tr><td><input type="checkbox" name="C0" value="0">Album</td>...</tr>
    </table>
    <a onclick="calc();return true">Filter and sort</a>
  </form>

  <!-- Alphabetical section separator -->
  <hr>
  <center><b><u>A</u></b></center>
  <hr>

  <!-- One <p><b> block per record -->
  <p><b>
    2 CD (Crystal Cat) <br>
    <a href="detrec.aspx?code=CDABBN1">A BIG BIG NIGHT</a><br>
    Mx:CC 479/480
  </b><br></p>

  <!-- With optional notes -->
  <p><b>
    1 7 in. (Holland) <br>
    <a href="detrec.aspx?code=CBS39402">10TH AVENUE FREEZE OUT / SHE'S THE ONE</a><br>
    Catalogue : CBS 3940
  </b><br>
  <i><u>Orange label, large hole</u></i><br>
  </p>

  <!-- Promo records have yellow highlight -->
  <p><b>
    1 7 in. (Germany) <span style="background-color: #FFFF00">PROMO</span><br>
    <a href="detrec.aspx?code=CBS39404">10TH AVENUE FREEZE OUT / SHE'S THE ONE</a><br>
    Catalogue : CBS 3940
  </b><br></p>
```

### Record block anatomy

First text node inside `<b>` before the `<br>`:

```
{QTY} {FORMAT} ({LABEL}) [{COUNTRY}] [PROMO]
```

Examples:
- Unofficial: `2 CD (Crystal Cat)` → qty=2, format=CD, label=Crystal Cat
- Official:   `1 7 in. (USA)` → qty=1, format=7 in., country=USA
- Official:   `1 7 in. (Germany) PROMO` → qty=1, format=7 in., country=Germany, promo=true

Catalogue/matrix line differs between modes:
- Unofficial: `Mx:CC 479/480` or `Mx : CC 479/480`
- Official:   `Catalogue : COL 3-10274` or `Catalogue:CBS 3940`

### DOM selectors

| Purpose | Selector |
|---------|----------|
| All record blocks | `p > b:has(a[href^="detrec.aspx"])` |
| Record link | `a[href^="detrec.aspx"]` (within the `<b>`) |
| Section letter divider | `center > b > u` |
| Trigger injection point | `form[name="mio"]` |

> **Note:** `:has()` is supported in all modern browsers. For a polyfill-free fallback,
> iterate all `<a>` elements whose `href` starts with `"detrec.aspx"` and climb to
> the enclosing `<b>` via `el.closest('b')`.

### Data fields & extraction

```
code      — querystring "code" param from href: "detrec.aspx?code=CDABBN1" → "CDABBN1"
title     — link text content
qty       — leading number from first text node: "2 CD..." → 2
format    — word(s) after qty and before first "(" : "CD", "LP", "DVD", "7 in.", "CD-R"
label     — text inside first parentheses group (unofficial) or country (official)
country   — text inside first parentheses group (official only)
isPromo   — true if <span style="background-color: #FFFF00"> exists in the block
catalogue — text after "Mx:" or "Catalogue :" (trimmed)
notes     — text content of <i><u> element if present, else ''
detailUrl — absolute URL: "https://www.brucespringsteen.it/DB/" + href
```

**Extraction pseudocode:**

```js
extract() {
    const isOfficial = /tipe=-2/.test(window.location.href);
    const FIRST_LINE_RE = /^(\d+)\s+([^(]+?)\s*\(([^)]+)\)/;
    const MATRIX_RE     = /(?:Mx\s*:|Catalogue\s*:)\s*(.+)/i;

    return [...document.querySelectorAll('a[href^="detrec.aspx"]')].map(a => {
        const b         = a.closest('b');
        if (!b) return null;
        const raw       = b.firstChild?.textContent?.trim() ?? '';
        const m         = FIRST_LINE_RE.exec(raw);
        const allText   = b.textContent;
        const matrixM   = MATRIX_RE.exec(allText);
        const notesEl   = b.parentElement?.querySelector('i > u');
        const promoEl   = b.querySelector('span[style*="FFFF00"]');
        const params    = new URLSearchParams(a.getAttribute('href').split('?')[1]);

        return {
            code:      params.get('code') ?? '',
            title:     a.textContent.trim(),
            qty:       m ? m[1] : '',
            format:    m ? m[2].trim() : '',
            label:     (!isOfficial && m) ? m[3] : '',
            country:   (isOfficial  && m) ? m[3] : '',
            isPromo:   !!promoEl,
            catalogue: matrixM ? matrixM[1].trim() : '',
            notes:     notesEl?.textContent.trim() ?? '',
            detailUrl: 'https://www.brucespringsteen.it/DB/' + a.getAttribute('href'),
        };
    }).filter(Boolean);
}
```

### Proposed columnDefs — Unofficial

```js
columnDefs: [
    { key: 'title',     label: 'Title',     type: 'string' },
    { key: 'format',    label: 'Format',    type: 'string', width: '80px' },
    { key: 'qty',       label: 'Qty',       type: 'number', width: '40px' },
    { key: 'label',     label: 'Label',     type: 'string', width: '140px' },
    { key: 'catalogue', label: 'Matrix',    type: 'string', width: '120px' },
    { key: 'isPromo',   label: 'Promo',     type: 'string', width: '55px', filterable: true },
    { key: 'notes',     label: 'Notes',     type: 'string' },
    { key: 'detailUrl', label: 'Link',      type: 'string', sortable: false },
]
```

### Proposed columnDefs — Official

```js
columnDefs: [
    { key: 'title',     label: 'Title',     type: 'string' },
    { key: 'format',    label: 'Format',    type: 'string', width: '80px' },
    { key: 'qty',       label: 'Qty',       type: 'number', width: '40px' },
    { key: 'country',   label: 'Country',   type: 'string', width: '100px' },
    { key: 'catalogue', label: 'Catalogue', type: 'string', width: '140px' },
    { key: 'isPromo',   label: 'Promo',     type: 'string', width: '55px' },
    { key: 'notes',     label: 'Notes',     type: 'string' },
    { key: 'detailUrl', label: 'Link',      type: 'string', sortable: false },
]
```

### Notes

- ~5 000–10 000 records total on the unofficial page; no pagination.
- Section headings (`<hr><center><b><u>A</u></b></center><hr>`) are only visual
  separators — they carry no data and can be ignored during extraction.
- `isPromo` should be rendered as `'Yes'`/`''` rather than `true`/`false` for the filter
  dropdown to show useful labels.

---

## 3. archive.org — Bootleg search by year

**URL pattern:** `https://archive.org/search?query=subject%3A%22Bruce+Springsteen%22&sort=title&and%5B%5D=year%3A%221976%22`

### Page structure — why DOM scraping does not work

The archive.org search results page is rendered by a **React SPA**. The raw HTML served by the
server contains only the skeleton (`<div id="root">`); result items are injected by JavaScript
after load. Tampermonkey's `@run-at document-idle` fires before the React tree is ready, and
`MutationObserver` polling would be fragile given archive.org's frequent UI changes.

**Solution: use the JSON API directly.**

```
GET https://archive.org/advancedsearch.php
  ?q=subject%3A%22Bruce+Springsteen%22+AND+year%3A{YEAR}+AND+mediatype%3Aaudio
  &fl[]=identifier,title,date,description,subject,downloads,addeddate
  &sort[]=title+asc
  &rows=500
  &page=1
  &output=json
```

The API is public, requires no authentication, and returns JSON directly. Tested response time
< 200 ms for 48 results.

### API response shape

```json
{
  "response": {
    "numFound": 48,
    "start": 0,
    "docs": [
      {
        "identifier":  "bs1976-03-28.aud.gr811-12.flac16",
        "title":       "Bruce Springsteen - 1976-03-28, Cameron Indoor Stadium, Duke University, Durham",
        "date":        "1976-03-28T00:00:00Z",
        "description": "Run South, Young Man ... 101 - Night 102 - Tenth Avenue Freeze Out ...",
        "subject":     ["Bootleg", "Bruce Springsteen", "Audience"],
        "downloads":   325,
        "addeddate":   "2024-05-13T19:02:49Z"
      }
    ]
  }
}
```

### Data fields & extraction

```
identifier  — string, unique archive.org item ID
date        — ISO date string from "date" field, or parsed from identifier
title       — full title string; venue is the text after "YYYY-MM-DD, "
venue       — parsed from title: after the first ", " following the date portion
recType     — from subject[]: "Audience" | "Soundboard" | "FM" | "Video" | unknown
downloads   — number
addeddate   — ISO datetime string
url         — "https://archive.org/details/" + identifier
thumbnail   — "https://archive.org/services/img/" + identifier
```

**Identifier date parsing:**
Most identifiers follow the pattern `bs{YYYY-MM-DD}.{source}.{format}`.
The date can also be read directly from the `date` field.

**recType detection** (from `subject` array):
```js
const TYPES = ['Soundboard', 'FM', 'Video', 'Audience'];
const recType = TYPES.find(t => subjects.includes(t)) ?? 'Unknown';
```

**extract() is async** — it must call the API before returning rows:

```js
async extract() {
    const year  = new URLSearchParams(window.location.search)
        .get('and[]')?.match(/year[^"]*"(\d{4})"/)?.[1]
        ?? new Date().getFullYear();

    const url = `https://archive.org/advancedsearch.php`
        + `?q=subject%3A%22Bruce+Springsteen%22+AND+year%3A${year}+AND+mediatype%3Aaudio`
        + `&fl[]=identifier,title,date,description,subject,downloads,addeddate`
        + `&sort[]=title+asc&rows=500&page=1&output=json`;

    const resp = await fetch(url);
    const json = await resp.json();

    return json.response.docs.map(doc => {
        const subjects   = Array.isArray(doc.subject) ? doc.subject : [doc.subject];
        const TYPES      = ['Soundboard', 'FM', 'Video', 'Audience'];
        const recType    = TYPES.find(t => subjects.includes(t)) ?? 'Unknown';
        const dateStr    = (doc.date ?? '').slice(0, 10);
        const titleRest  = doc.title.replace(/^Bruce Springsteen\s*[-–]\s*\d{4}-\d{2}-\d{2},?\s*/, '');

        return {
            identifier: doc.identifier,
            date:       dateStr,
            venue:      titleRest.trim(),
            recType,
            downloads:  String(doc.downloads ?? ''),
            addeddate:  (doc.addeddate ?? '').slice(0, 10),
            url:        `https://archive.org/details/${doc.identifier}`,
            thumbnail:  `https://archive.org/services/img/${doc.identifier}`,
        };
    });
}
```

> **Important:** `SmartTable.render()` is synchronous today. For archive.org the adapter
> calls `extract()` asynchronously and then calls `SmartTable.render()` from the `.then()`
> callback. The userscript glue code must handle this:
>
> ```js
> ArchiveOrgAdapter.extract().then(rows => {
>     SmartTable.render({ columns: ArchiveOrgAdapter.columnDefs, rows, container });
> });
> ```

### Trigger injection point

The React app mounts into `#root`. The search bar is rendered inside `#search-wrapper`
(a server-rendered skeleton that persists). Inject the trigger button as a sibling of
`#search-wrapper`, or use `document.body.prepend()` as a safe fallback.

```js
triggerSelector: '#search-wrapper',
```

### Proposed columnDefs

```js
columnDefs: [
    { key: 'date',      label: 'Date',      type: 'date',   width: '100px' },
    { key: 'year',      label: 'Year',      type: 'number', width: '55px',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'month',     label: 'Month',     type: 'number', width: '60px',
      derivedFrom: 'date', derive: v => v.slice(5, 7) },
    { key: 'venue',     label: 'Venue',     type: 'string' },
    { key: 'recType',   label: 'Type',      type: 'string', width: '100px' },
    { key: 'downloads', label: 'Downloads', type: 'number', width: '90px' },
    { key: 'addeddate', label: 'Added',     type: 'date',   width: '100px' },
    { key: 'url',       label: 'Link',      type: 'string', sortable: false, filterable: false },
]
```

### Notes

- `@grant GM_xmlhttpRequest` can replace `fetch()` if cross-origin restrictions apply.
- Pagination: the API returns `numFound`; if > 500, add a second page request. In practice
  any single year has < 200 results.
- The thumbnail URL pattern `https://archive.org/services/img/{identifier}` always resolves
  (returns a placeholder image if no artwork exists).

---

## 4. brucebase.wikidot.com — Events by year

**URL pattern:** `http://brucebase.wikidot.com/{YYYY}`  (e.g. `/2026`)

### Page structure

Wikidot-hosted wiki page. All event content lives in:

```
#content-wrap > #main-content > #page-content
```

The page begins with a legend table (icon key), a year heading, and a "Jump to most recent" note.
Events then follow as `<hr />`-separated blocks.

### Event block structure

```html
<hr />
<p>
  <a name="170126"></a>          <!-- anchor: DDMMYY format -->
  <br />
  <strong>
    <a href="/gig:2026-01-17-hackensack-meridian-health-theatre-red-bank-n">
      2026-01-17 - HACKENSACK MERIDIAN HEALTH THEATRE, RED BANK, NJ
    </a>
  </strong>
</p>
<p>with Willie Nile: ONE GUITAR (with James Maddock) / ...</p>

<!-- Optional description block -->
<div class="list-pages-box">
  <div class="list-pages-item">
    <p>Bruce makes a surprise appearance at …</p>
  </div>
</div>

<!-- Resource icons -->
<img src=".../00Photo-32.png"   title="Photo"    …>
<img src=".../00Setlist-32.png" title="Setlist"  …>
<img src=".../00News-32.png"    title="News"     …>
<img src=".../00Bootleg-32.png" title="Bootleg"  …>
<img src=".../00Video-32.png"   title="Video"    …>
...
<hr />
```

### Href prefix → event type

| Prefix | Meaning |
|--------|---------|
| `/gig:` | Actual concert |
| `/recording:` | Studio or rehearsal recording session |
| `/nogig:` | Cancelled or postponed show |
| `/rehearsal:` | Rehearsal (no audience) |

### Anchor format

`DDMMYY` — two-digit day, two-digit month, two-digit year.
Example: `170126` = 17 Jan 2026.

### DOM selectors

| Purpose | Selector |
|---------|----------|
| Event list container | `#page-content` |
| All event anchors | `#page-content a[name]` (within `<p>`) |
| Strong link per event | `a[name] ~ strong a` (sibling strong after anchor) |
| Resource icons | `img[src*="00"]` siblings after the strong |
| Trigger injection point | `#page-title` |

### Data fields & extraction

```
date        — from link text: leading "YYYY-MM-DD"
venue       — from link text: text after "YYYY-MM-DD - "
eventType   — from href prefix: "gig" | "recording" | "nogig" | "rehearsal"
url         — absolute: "http://brucebase.wikidot.com" + href
setlist     — text of next <p> after the strong (first paragraph only)
description — text inside .list-pages-item > p (if present)
resources   — comma-joined titles of all icon <img> elements after the strong
hasBootleg  — derived: "Bootleg" in resources
hasSetlist  — derived: "Setlist" in resources
year        — derived from date
month       — derived from date
```

**Extraction pseudocode:**

```js
extract() {
    const content   = document.querySelector('#page-content');
    if (!content) return [];
    const TYPE_RE   = /^\/(\w+):/;
    const DATE_RE   = /^(\d{4}-\d{2}-\d{2})\s*-\s*(.*)/;
    const rows      = [];
    const pEls      = [...content.querySelectorAll('p')];

    for (const p of pEls) {
        const anchor = p.querySelector('a[name]');
        if (!anchor) continue;

        const strong = p.querySelector('strong');
        const link   = strong?.querySelector('a[href]');
        if (!link) continue;

        const href       = link.getAttribute('href') ?? '';
        const typeM      = TYPE_RE.exec(href);
        const eventType  = typeM ? typeM[1] : 'gig';
        const textM      = DATE_RE.exec(link.textContent.trim());
        if (!textM) continue;

        const date   = textM[1];
        const venue  = textM[2].trim();

        // Next sibling <p> = setlist
        let next = p.nextElementSibling;
        const setlist = (next?.tagName === 'P' && !next.querySelector('a[name]'))
            ? next.textContent.trim()
            : '';

        // Resource icons
        const icons = [...content.querySelectorAll(`img[src*="00"]`)]
            .filter(img => {
                const pos = img.compareDocumentPosition(p);
                return pos & Node.DOCUMENT_POSITION_PRECEDING;
            });
        // Actually collect icons that follow this <p> up to the next <hr>
        const resources = _iconsAfter(p);

        rows.push({
            date,
            venue,
            eventType,
            url:         'http://brucebase.wikidot.com' + href,
            setlist,
            resources,
            hasBootleg:  resources.includes('Bootleg') ? 'Yes' : '',
            hasSetlist:  resources.includes('Setlist') ? 'Yes' : '',
        });
    }
    return rows;
}

// Helper: collect img title values between this <p> and the next <hr />
function _iconsAfter(pEl) {
    const titles = [];
    let el = pEl.nextElementSibling;
    while (el && el.tagName !== 'HR') {
        if (el.tagName === 'IMG' && el.title) {
            titles.push(el.title);
        } else {
            for (const img of el.querySelectorAll('img[title]')) {
                titles.push(img.title);
            }
        }
        el = el.nextElementSibling;
    }
    return titles.join(', ');
}
```

### Proposed columnDefs

```js
columnDefs: [
    { key: 'date',       label: 'Date',      type: 'date',   width: '100px' },
    { key: 'year',       label: 'Year',      type: 'number', width: '55px',
      derivedFrom: 'date', derive: v => v.slice(0, 4) },
    { key: 'month',      label: 'Month',     type: 'number', width: '60px',
      derivedFrom: 'date', derive: v => v.slice(5, 7) },
    { key: 'venue',      label: 'Venue',     type: 'string' },
    { key: 'eventType',  label: 'Type',      type: 'string', width: '100px' },
    { key: 'setlist',    label: 'Setlist',   type: 'string', collapsible: true, peekRows: 1 },
    { key: 'hasBootleg', label: 'Bootleg',   type: 'string', width: '70px' },
    { key: 'hasSetlist', label: 'Setlist?',  type: 'string', width: '70px' },
    { key: 'resources',  label: 'Resources', type: 'string', width: '150px' },
    { key: 'url',        label: 'Link',      type: 'string', sortable: false, filterable: false },
]
```

### Notes

- The URL uses plain `http://` — the site does not redirect to HTTPS.
- Year navigation: change the URL path from `/2026` to `/2025`, etc.
- The "legend" table at the top of `#page-content` and the `<div style="text-align: center">`
  year heading are not event blocks; they contain no `<a name>` anchor and are skipped by
  the selector above.
- Some blocks have `<a href="/nogig:...">` or `<a href="/rehearsal:...">` inside `<strong>`
  without being wrapped in a `<a name>` anchor in all years — the `a[name]` check handles
  this correctly since it only processes paragraphs that have both.
- The setlist text is often a single long line of `SONG / SONG / SONG` — store as a
  single string or split on ` / ` for a collapsible multi-row cell.
- Resource icons available: Photo, Ticket, Setlist, Storyteller, News, Memorabilia,
  Eyewitness Reports, Video, Audio, Bootleg, Official Live Download, Official Retail, Featured.

---

## Cross-adapter patterns

### Derived date columns (always add these to date-bearing adapters)

```js
{ key: 'year',  label: 'Year',  type: 'number', width: '55px',
  derivedFrom: 'date', derive: v => v.slice(0, 4) },
{ key: 'month', label: 'Month', type: 'number', width: '60px',
  derivedFrom: 'date', derive: v => v.slice(5, 7) },
{ key: 'day',   label: 'Day',   type: 'number', width: '50px',
  derivedFrom: 'date', derive: v => v.slice(8, 10) },
```

### Boolean-as-string convention

Columns that hold boolean flags should store `'Yes'` or `''` (empty string) rather than
`true`/`false`. This makes the filter dropdown show `Yes` as the only non-empty option,
and the sort places flagged rows first when sorted descending.

### Link columns

Columns holding raw URLs (`url`, `href`, `detailUrl`) should have `sortable: false` and
`filterable: false`. They are typically rendered as clickable `<a>` tags by a custom cell
renderer — or left as plain text and relied on being clickable inside the `<a>` that wraps
the cell content.

---

## Adapter file checklist

Each `adapters/*.js` file must export a default object with exactly:

```js
export default {
    triggerSelector: '…',      // where to inject the trigger button
    columnDefs:      [ … ],    // ColumnDef[]
    extract()        { … },    // returns NormalizedRow[] (or Promise<NormalizedRow[]>)
};
```

Files to create:

| File | Site |
|------|------|
| `adapters/jungleland.js` | jungleland.it/html/list.htm |
| `adapters/brucespringsteen-it.js` | brucespringsteen.it/DB/records.aspx |
| `adapters/archive-org.js` | archive.org/search (uses JSON API) |
| `adapters/brucebase.js` | brucebase.wikidot.com/YYYY |
