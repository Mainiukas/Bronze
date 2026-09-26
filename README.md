# Bronze

**Bronze** is an original industrial-era strategy board game for 2–4 players.
Play against computer opponents or pass & play on one device.

## How the game works

Each round, every player takes a turn of two actions:

- **Build an industry** in a town in your network: a Cotton mill (makes the
  goods), a Port, a Shipyard, an Iron works or a Coal mine. These five are
  the only industries. Your first build can go anywhere.
- **Build a link**: a canal or railway on a route touching your network.
- **Ship goods** to a market that buys them, over built links (anyone's).
  Money and +1★ per goods, doubled over 2+ links. Using an opponent's link
  pays them a toll.
- **Raise funds.**

Missing coal and iron are bought automatically. At the end of each round,
industries produce and everyone collects income. After the last round, money
and market towns in your network add bonus prestige. Most prestige wins.

Modes change the board size (outer towns are dropped), the number of rounds and
the move timer. The full rules are in the game under ☰ → How to Play, and every
number lives in `src/game/rules.ts`.

### Wales & the West

The default map is played on the illustrated board (`assets/map.webp`), with a
few extra rules:

- **Eras.** The match starts in the canal era; the rail era begins half way
  (round 6 of 10 in Normal). Only the current era's links are on the board:
  canals, then railways. A link marked for both is a canal in the canal era
  and a railway in the rail era. Railways cost £5 plus 1 coal. When the rail
  era begins, every canal link comes off the board, as in Brass.
- **Trade hubs** (The North, London, West Wales) are the markets. Cotton is
  the goods you ship; a hub's price drops as goods are sold. The pictures
  under each ribbon (`buys` in `board.json`) are what the hub trades in; only
  cotton is shipped in matches.
- **Ports** buy any goods at £3 each and pay £1 a round. Shipping to someone
  else's port pays them £1 per goods.
- **Stops** (Brecon, Reading, Taunton) have no slots, but routes pass through them.
- **Rail-era places** (The North, Plymouth and Taunton, `"era": "rail"`) can
  only be reached by rail; nothing can be built in Plymouth before the rail
  era. Plymouth has the only shipyard.
- **Smaller modes** use the heart of the map: 13 locations in Bullet, 20 in
  Blitz and all 25 in Normal (the `ring` field in `board.json`).

Build, ship and link by clicking the board: legal slots, markets and links
light up for the action you picked.

Built with React 19, TypeScript, Vite, Tailwind CSS v4 and React Router.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run build`        | Type-check (`tsc -b`) and build to `dist/`                |
| `npm run build:single` | Type-check and build one self-contained `dist-single/index.html` (JS, CSS and fonts inlined) |
| `npm test`             | Engine unit tests plus a full computer-vs-computer match on every map, mode and player count |
| `npm run preview`      | Serve the production build                                |
| `npm run lint`         | Lint with oxlint                                          |

## Putting it on the web

The build is a static site, so any static host works with no server setup:

- Routing uses hash URLs (`#/shop`), so no rewrite rules are needed.
- Asset paths are relative (`base: './'`), so it works from a sub-path such as
  `https://<user>.github.io/Bronze/`.

Upload the contents of `dist/` to GitHub Pages, Netlify, Cloudflare Pages, an
S3 bucket or similar. For hosts or embeds that take a single file, use
`dist-single/index.html`. It also opens straight from disk.

## Map board

`#/board` (☰ → Map board) shows the illustrated board: the painted map with an
SVG overlay (viewBox 0 0 1000 1000) drawn from `src/data/board.json`. It is a
pure view (`src/components/board/IllustratedBoard.tsx`): the era, what's built
and the selection come in as props, and clicks come out through
`onSelectLocation`, `onSelectSlot` and `onSelectLink`. The page adds an era
toggle and a sandbox for placing tiles. Matches on Wales & the West use the
same component, with `targets`, `prices`, `closed` and `recent` props.

Layers, bottom to top: map, route shadows, route textures, link spaces, link
tokens, plaques and tiles, badges, hover/selection, tooltips.

- **Only the era's links are drawn**: canal and "both" links (as a canal) in
  the canal era, rail and "both" links (as a railway) in the rail era.
  Places reached only by rail keep a locomotive badge.
- **Cities**: 34-unit squares (a row, or 2 × 2 for four slots) with the
  industry pictures, over a flat name plate in the region's colour. Built
  tiles show the owner's colour, the picture and the level. **Stops**: silver
  plaques with two emblems. **Hubs**: two merchant spaces, a medallion with the
  hub's photo, a ribbon, the number and bonus badges, and what they buy.
- **Routes** are curves (seeded bends of 8–15 %, or a spline through a link's
  `points`) measured with `getTotalLength()`/`getPointAtLength()` and drawn by
  laying the texture along them in pieces edge to edge: each piece is a quad
  between the route's normals, so pieces never overlap or gap and the last
  stops exactly at the end.
- **Link spaces** are flat hexagons with the link symbol; built links show the
  owner's token (a barge or a locomotive, per era). Player colours are the
  token colours (yellow, blue, purple, red, white); any other colour gets a
  drawn token with the barge or locomotive art.
- **Layout**: plaques and tile groups are nudged apart (never the location
  points) until groups, link spaces and tokens are at least 8 units apart.
  Route ends fan out around each group (at least 14 apart), and bends are
  flipped or increased until no route runs over another route or a group; a
  group still in a route's way steps aside and the layout is redone. A
  location's `labelOffset` pins its group by hand. Development builds log
  anything left over.

**Art** (in `assets/`, preloaded before the board first draws; anything
missing or failing is logged and drawn instead): `map.png` (else `map.webp`),
`icons/{loom,anchor,shipyard,iron,coal}.png` (the only industry icons in the
game), `textures/{rail,canal}.png`, `tokens/` (link symbol, merchant, the
tokens per colour, and the barge and locomotive art) and `hubs/<hub id>.png`.

Coordinates in `board.json` are percentages of the image (0–100), so the
overlay stays aligned at any size. The network is held to its design by
`designProblems`: from Birmingham, canal and "both" links reach everything but
the rail-era places; rail and "both" links reach everything; degrees add up to
78 (16 both, 6 canal, 17 rail links); and 2, 4, 10 and 3 cities have 4, 3, 2
and 1 tiles. Development builds refuse to start if it breaks; `npm test`
checks it too, along with the layout.

**Calibrating** (edit mode):

1. Open `#/board?edit=1`. In `npm run dev` you can also press **E** on the page.
2. Drag a crosshair to move a location. Drag a plaque or tile group to place it
   by hand (double-click it to go back to automatic). Drag a link's "+" to add
   a bend point (up to 3); drag the squares to move them, double-click to
   remove. Arrow keys nudge the last one by 0.1 % (Shift: 1 %). Drags preview
   as you move and the board is laid out again when you let go. Use the era
   switch beside the board to check both eras' links.
3. Click **Export** (or **Download**) and paste it over `src/data/board.json`.
   `npm test` checks the file stays valid.

Edits are kept in this browser until you press **Reset**, so a reload doesn't
lose them. While a draft is saved, matches in the same browser draw the board
from it, so you can check a calibration in a real game before exporting.

## Project structure

```
src/
  game/                   The game itself, independent of React
    rules.ts              Every rule number: costs, prices, income, scoring
    engine.ts             Setup, legal moves, applying actions, production, final scores
    ai.ts                 Computer player (plans both actions of its turn)
    types.ts              GameState and action types
    engine.test.ts        Rules tests and simulated matches
    illustrated.test.ts   Wales & the West rules: eras, stops, hubs, ports, rail-era places
  App.tsx                 Router, layout, app-wide state (selection, settings, saved match, stats)
  components/board/       Illustrated map board: IllustratedBoard (view), parts (SVG pieces),
                          layout (placement, route fan-out, collisions), geometry (curves,
                          texture pieces, hulls), sampling (getPointAtLength), assets
                          (art files, preloading, fallbacks), style, icons, BoardTooltip
  main.tsx                Entry point; loads the bundled fonts
  index.css               Theme tokens (colors, fonts, animations) and shared component classes
  components/
    TopBar.tsx            Friends button · tab bar · menu button
    TabNav.tsx            Tab bar (scrolls sideways on mobile)
    FriendsPanel.tsx      Slide-in friends drawer (placeholder)
    MoreMenu.tsx          ☰ dropdown: Settings, How to Play, Credits, Log out
    SettingsModal.tsx     Volume sliders, language, move-timer toggle
    InfoModals.tsx        How to Play and Credits dialogs
    ModeCard.tsx          Selectable game-mode card
    MapCard.tsx           Selectable map card
    MapPreview.tsx        SVG map schematic drawn from map data
    PlayButton.tsx        The big PLAY button
    Dialog.tsx            Native <dialog> wrapper (modal or drawer)
    ModalFrame.tsx        Standard modal layout (header, body, footer)
    ToastProvider.tsx     Toast messages (see hooks/useToast.ts)
    ComingSoon.tsx        Shared placeholder page layout
    SceneBackground.tsx   Decorative backdrop: glow, gears, smoke, embers
    Gear.tsx, icons.tsx   Original SVG artwork
    MatchSetupDialog.tsx  Player count and who plays each seat
    game/                 Match screen parts: GameBoard, TurnPanel, PlayersPanel,
                          GameLog, MoveTimer, ResultsDialog, industry glyphs
  pages/
    MainMenu.tsx, Game.tsx, MapBoard.tsx, Achievements.tsx, Locker.tsx, Shop.tsx, Tournaments.tsx
  data/
    gameModes.ts          Game modes: rounds, starting money, board size, timer
    maps.ts               Maps: the illustrated map plus schematic maps (towns, plots, routes, decoration)
    board.json            Map board data: locations, slots, links (edit via #/board?edit=1)
    board.ts              Board types, validation, export formatting, era rules, network checks
    board.test.ts         Board data, the design checks, curves, texture pieces and layout
    achievements.ts       Achievements and lifetime stats
    navigation.ts         Tab list and route paths
    settings.ts           Settings shape, defaults and validation
  hooks/
    usePersistentState.ts useState backed by localStorage
    useToast.ts           Toast context and hook
  lib/
    storage.ts            Safe localStorage access (all calls wrapped in try/catch)
    sound.ts              Synthesised sound effects and ambient music (Web Audio)
```

## Extending

- **New game mode:** add an entry to `GAME_MODES` in `src/data/gameModes.ts`.
  To give it a new icon, add a name to `ModeIconName` and map it in `ModeCard.tsx`.
- **New map:** add a schematic entry to `MAPS` in `src/data/maps.ts`: towns
  with their building plots and ring (which modes include them), routes, and
  decoration, on a 160 × 100 grid. The lobby preview and the game board are both drawn from
  it, and `npm test` checks that every mode's cut of the map is connected and
  plays to the end.
- **Balance:** change the numbers in `src/game/rules.ts`, then run
  `SIM=1 npm test` to print scores from simulated matches.
- **New tab:** add a path to `PATHS` and an entry to `NAV_TABS` in
  `src/data/navigation.ts`, then add a `<Route>` in `App.tsx`.
- **Re-theme:** change the color tokens in the `@theme` block at the top of
  `src/index.css`. Each token becomes a CSS variable (`--color-bronze-400`)
  and Tailwind utilities (`bg-bronze-400`, `text-bronze-400/60`, ...).

## Saved data

The selected mode and map, the settings, the match in progress and your
stats are saved to localStorage (`bronze.lobby.*`, `bronze.settings`,
`bronze.match`, `bronze.stats`). Saved values are validated when read. Close
the tab mid-match and you can resume it from the main menu. If storage isn't
available, the app keeps working with in-memory state.
