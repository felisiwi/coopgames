# How characters connect in the Realm of Thrones companion app

A summary of the system, written for reuse in a new game. The RoT specifics (Bannerlord saves, the game reader on the PC) are left out; what follows is the part that transfers: how people, places and time are linked, and how a read-only app draws those links.

## 1. The one idea

**Plain files are the database.** Every entity is a Markdown file with YAML frontmatter, or a row in a Markdown table. Links between entities are ids in those files. A build step (`node app/build.mjs`) reads the folder once, validates it, computes the derived relations, and writes a single `lore.js` the app loads. The app is a read-only viewer: it never writes, and it never invents a link that is not in a file or derivable from one.

Three consequences shape everything else:

- **Ids are the keys.** A character's id is its filename (`halvard.md` → `halvard`); a place id comes from a gazetteer; a pair id is the two character ids sorted and joined with `--` (`halvard--saga`). Ids are never guessed from a similar name: a link is either certain or absent.
- **Derived relations are computed, never stored.** Generations in the family tree, whether two lives overlapped, who appears in which scene, which news touches the player, where the route was on a given day: all computed at build time or in the app from the primary fields. One rule, one place.
- **Gaps are allowed and reported.** A missing portrait, an unplaced place, an unparseable date or a pair with no text produces a warning in a "Notes for the scribe" panel inside the app, never a crash and never a made-up value.

## 2. The entities and their keys

| Entity | Lives in | Key | Dated by |
|---|---|---|---|
| Character | `characters/<group>/<id>.md` | `id` | `born`, `died` (years), `first_met` (full date) |
| Bond (one pair) | `story/relationships/<a>--<b>.md` | sorted pair | items in its "How it was" timeline |
| Scene | `story/chapters/NN-slug.md`, `## Scene N: Title` | chapter slug + scene number | an italic dateline under the heading |
| Notice (world news) | one row of `game/news.md` | row index | `date` column |
| Route stop | one row of `game/path.md` | row index | `date` column |
| Place | `app/map/places.json` (gazetteer) + `aliases.json` | `place_id` | n/a |
| Conversation | `conversations/<file>.md` | filename | its own date; marked not canon |

`group` is just the subfolder: `family/`, `met/`, `company/`. The same frontmatter works for all three; the folder decides which views list the person.

A character file, trimmed:

```yaml
id: ferris
name: Ferris
role: man-at-arms in Saga's company
place: Saga's party            # met/company: where they were met or where they are
first_met: Spring 21, 299 AC   # met/company: full in-world date, sortable
house: Svale                   # family
relation: father               # family: relation to the player, shown verbatim
status: alive                  # alive | dead | left | gone
born: 270 AC
died:
parents: [halvard, maren]      # ids, kept consistent with the other side's children:
children: []
siblings: []
spouse: none                   # an id, "none", or {unknown: true} for a sealed "not yet written" node
shaped_by: [saga]              # ids: who formed this person
shapes: []                     # ids: whom this person forms
traits: [Duty-Freedom 3, Faith-Doubt 4, Lords-Kin 5, Caution-Daring 4, Silence-Speech 2]
tags: [Cog Water, Riverlands]
summary: one line
portrait: characters/portraits/ferris/ferris-portrait.png
```

Body sections have fixed headings the app recognises and styles (`## Story`, `## How they decide`, `## Shaped by / Shapes`, `## Fragments`); anything else becomes a plain fold. Facts from the game are prefixed `**(game)**`, invented lore `**(lore)**`, so the two are never confused later.

## 3. The seven ways two characters can be linked

1. **Blood and marriage** — `parents`, `children`, `siblings`, `spouse`. Ids on both sides, checked for consistency. The family tree is computed from `parents` alone: roots are generation 0, everyone else is 1 + the max of their parents. Spouses pair side by side; an unmarried parent sits beside the other parent joined by a dashed bar.
2. **Relation to the player** — `relation`, a free string ("father", "shipmate"), shown under the name. Cheap, and the thing people read first.
3. **Influence** — `shaped_by` / `shapes`, directional. The body's "Shaped by / Shapes" section carries one card per person; the label links to the card when it matches a listed id's name.
4. **A bond file** — one Markdown file per pair with `between: [a, b]`, a one-line `summary`, `tags`, and four optional sections: *How it is* (now), *How it was* (a dated timeline: `**279.** Saga born…`), *What sits between them* (the unresolved things, as labelled tiles), *Fragments* (short scenes). The app has a "Two of them" page for any pair; with a file it renders these sections, without one it says either *"Nothing is written of these two yet"* (lives overlapped) or *"Their lives never crossed"* (computed from `born`/`died`, inclusive years; a missing date never rules an overlap out). Every card lists its bonds under "Relationships". On the tree a toggle lets you tap two people to open their pair; people who have a file with the first pick get a small star.
5. **Mentions** — `[[id]]` or `[[id|shown text]]` anywhere in prose becomes a link to that card. Linked once or twice per text, not at every name.
6. **Co-appearance in the story** — computed: every scene whose text contains a character's full name is listed on the card as "In the story" (scene, title, dateline, a one-line excerpt), newest first, linking into the reader at that scene. Full-name matching only; ambiguous first names are reported, not guessed.
7. **Temperament** — five opposing pairs, the same five for everyone, each scored 1–5. Rendered as rails with a marker; because the axes are shared, two cards can be compared at a glance, and a bond page could overlay them.

Conversations (role-played transcripts) are a separate, non-canon layer: they attach to a character, show on the card, and a `promoted: [ids]` flag marks what was later lifted into the lore.

## 4. Characters and the map

Places are not character files; they are a **gazetteer** (`places.json`: id, name, kind, lon/lat on the basemap) plus a small hand-kept `aliases.json` for places the gazetteer lacks. Characters reach the map through two tables, both owned by whoever records the game, never by the story writer:

- **The route**: `date | place | place_id | kind | note | source`, oldest first, one row per stop or pass-by. `kind` is start | stop | pass | battle | camp. `place_id` only when certain; otherwise the place is described in words ("between Riverbend and Stone Hedge") and the row is drawn without a dot. The build records *how* each row was placed (`exact`, `parent` = nudged from its parent settlement, `alias`, or unplaced) so the map can say "position approximate".
- **The news**: `date | kind | text | concerns | source`, newest first. `concerns` is a comma list of tags and character ids (regions like `riverlands`, factions, or `saga`). Tags map to region polygons for a faint tint; a notice is pinned only when its *subject* is a place (rules: text starts with the name, "X is raided/besieged", "tournament at X"; never a name after "of", "from", "House"). A "Touches Saga" filter is just `concerns` containing the player's id or company.

A `place` field on a met/company character is free text for now ("Crown Stables, Darry's village"). In a new game I would make it a `place_id` from the start, so people can be drawn on the map and a place page can list who was met there.

## 5. Characters and the era

Everything is dated with **one in-world calendar in one string format** (`Spring 21, 299 AC`; ranges as `Spring 9–13, 299 AC`), and one parser turns it into a sortable key (year, season index, day). Because the same format is used for `first_met`, bond timelines, scene datelines, news and route rows, cross-referencing is string-equal or key-compare, nothing cleverer:

- `born` / `died` → lifetime overlap → which pairs *can* have a bond, and the "never crossed" message.
- `first_met` → People met and Company sort by date; a missing or odd date is reported and the row sorts last.
- Route date + news date → the map timeline: scrub to a row and the route is drawn only up to it, the player marker moves there, later stops hide, and only notices dated on or before it are shown. Playback is one row per 0.8 s with the map following.
- Scene datelines → the "In the story" rows on a card are ordered by scene, and a scene can be opened at the paragraph that names the person.
- A world clock rule: canon events are *rumour until the game shows them*, so the news table is the only source for "what has happened", and the lore never dates an event before a row exists.

Status changes are dated the same way: `died: Summer 3, 299 AC` or a `left:` date moves a company member to "Past members" with the fact shown as the row's end note.

## 6. What the links feed (views)

- **Card**: head (portrait, name, relation, status, dates, house), summary, tags, temperament, the body as layered sections, *Relationships* (bonds), *In the story* (scenes), *Conversations*, then the related people (parents, spouse, siblings, children; dangling ids shown as plain text).
- **Family tree**: `family` group only, computed layout, "Two of them" pick mode.
- **People met / Company**: list by name, role, place, first met, house; Company splits current and past members.
- **Two of them**: the pair page.
- **Chronicle**: chapters and scenes; the reader can be opened at a scene or a `###` part.
- **News**: the notices, filterable by kind, region, and "Touches Saga".
- **Map**: basemap, route with the player marker, news pins and region tint, and the timeline strip.
- **Notes for the scribe**: every validation warning, so a bad id or an unplaced place is visible where someone will fix it.

## 7. Rules that keep it honest

- One writer per folder (story, game records, conversations, app), so a link is only ever added by the party that can vouch for it.
- Never guess an id or a coordinate; an unmatched name stays text and raises a note.
- Derived facts are never written back into files; if a derivation changes, the whole app changes with it.
- A bad file is skipped with a warning; the build never fails on content.
- Game facts and lore are marked in the text, and the game record is never edited by the story writer.

## 8. If I built it again for a new game

Keep: file-per-entity with ids, sorted pair files for bonds, one calendar string and one parser, a gazetteer with provenance on every placement, the build-to-one-JSON step, and the in-app warnings.

Change three things:

1. **Give places files** (`places/<id>.md` with `kind`, `region`, `parent`, coordinates, prose), and make `place` on a character an id. Then a place page can list who lives, was met, or died there, and the map can draw people as well as a route.
2. **One event spine.** RoT keeps the route, the news and the scenes as three tables with their own dates, and the map and the cards join them by date at runtime. A single `events` table (`date | place_id | who (ids) | kind | text | source`) that route, news, scene datelines and bond timelines all point into would make "where was everyone on this day" one query, and let a timeline scrubber drive the map, the cards and the chronicle together.
3. **Explicit scene casts.** Name-matching scenes to characters works but is fragile (first names, titles). A `cast: [ids]` line under each scene heading, validated by the build, is cheaper than clever matching and never ambiguous.
