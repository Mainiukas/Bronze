# Bronze

**Bronze** is an original industrial-era strategy board game for 2–4 players.
Play against computer opponents or pass & play on one device.

## How the game works

2–4 players (each human or computer, Easy, Normal or Hard) build industries,
lay links and ship goods on **Wales & the West**. Each round, every player
takes a turn of two actions (or ends it early):

- **Build an industry** on a free slot in a town in your network: a Coal mine,
  Iron works, Cotton mill, Port or Shipyard (the only five). Your very first
  build can go anywhere; the rail-era places open in the rail era.
- **Build a link**: an unbuilt route of the current era touching your network.
  Canals £3, railways £5 + 1 coal; +1★ each.
- **Ship**: a mill's cotton to a hub that buys cotton or to any port, or all
  the coal or iron in your store (from one of your mines or works) to a hub
  that buys it, over built links. Hubs pay their price, which drops £1 per
  unit; ports pay £3. +1★ per unit, doubled over 2+ links. Opponents' links
  cost a £1 toll.
- **Raise funds**: +£3.

Missing coal and iron for a cost are bought automatically (£3 and £5). At the
end of each round industries produce, everyone gets £2 and hub prices recover.
The rail era begins half way, and every canal comes off the board. Final score:
★ + 1★ per £5 + 2★ per hub in your network.

The full rules are in the game (Rules, on the main menu and in a match), built
from the same numbers the engine uses: `src/game/rules.ts`, the modes and
`board.json`.

**Engine.** `src/game/engine.ts` is pure and deterministic: `applyAction(state,
action)` returns a new state or throws `IllegalActionError` with a message the
UI shows as a toast. `legalActions` is the only source of computer moves. The
match seed decides every computer choice, so a seed and the same seats replay
a match. The UI renders state and dispatches actions; it never offers an
illegal one (disabled buttons say why).

**Modes**: Normal (whole map, 10 rounds, £14, 120 s turns), Blitz (rings 1–2,
7 rounds, £16, 45 s) and Bullet (ring 1, 5 rounds, £18, 15 s). Places outside
the mode's rings are drawn faded and aren't in the match. Three drawn practice
maps (no eras; their market towns work like hubs) are still selectable.

**Online and friends** are marked "Coming soon": there is no account or game
server, so the friends drawer says so and there is no log-out. Locker, Shop and
Tournaments are "Coming soon" pages too.

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
| `npm test`             | Engine and board tests, plus 60 simulated four-computer matches (every mode × 20 seeds), which print the average score per AI level |
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
  Places reached only by rail have a locomotive badge until the rail era.
- **Cities**: 34-unit squares (a row for 1–2 slots, a triangle of 2 over 1 for
  3, 2 × 2 for 4) with the industry pictures, over a flat name plate in the
  region's colour. A built tile shows the owner's colour, the picture, its ★
  value and, on a mill, the cotton waiting as pips. **Stops**: silver plaques
  with two link hexagons. **Hubs**: two link hexagons over a medallion with the
  hub's photo, a ribbon, the live price on a square badge, and what they buy.
- **Routes** are curves (seeded bends of 8–15 %, or a spline through a link's
  `points`) measured with `getTotalLength()`/`getPointAtLength()` and drawn by
  laying the texture along them in pieces edge to edge: each piece is a quad
  between the route's normals, so pieces never overlap or gap and the last
  stops exactly at the end.
- **Links** without an owner show the connection bubble (52 × 21.7, turned to
  the route, never upside down), which pulses gold when you can build it; built
  links show the owner's token at the same size (a barge or a locomotive, per
  era). Player colours are the token colours (yellow, blue, purple, red,
  white); any other colour gets a drawn token with the barge or locomotive art.
- **Feedback**: the active player's network is ringed in their colour, legal
  targets glow, the last move flashes, and a shipment sends a dot along the
  links it used. Tooltips give names, slots and owners, connections, what a hub
  buys and its current price.
- **Layout**: plaques and tile groups are nudged apart (never the location
  points) until groups, link spaces and tokens are at least 8 units apart.
  Route ends fan out around each group (at least 14 apart), and bends are
  flipped or increased until no route runs over another route or a group; a
  group still in a route's way steps aside and the layout is redone. A
  location's `labelOffset` pins its group by hand. Labels are measured from a
  table of Cinzel Bold glyph widths, so the layout is identical in every
  browser and in the tests. Development builds log anything left over.

**Art** (in `assets/`, preloaded before the board first draws; anything
missing or failing is logged and drawn instead): `map.png` (else `map.webp`),
`icons/{loom,anchor,shipyard,iron,coal}.png` (the only industry icons in the
game), `textures/{rail,canal}.png`, `tokens/` (`link_space.png`, the
connection bubble; `hex_link.png`, the hexagon on stops and hubs;
`link_symbol.png`, used by the bubble's fallback; the tokens per colour; and
the barge and locomotive art) and `hubs/<hub id>.png`.

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
    engine.ts             Setup, legal moves, applying actions, production, eras, final scores, saves
    ai.ts                 Computer players: Easy, Normal, Hard (never throws)
    types.ts              GameState and action types
    engine.test.ts        The rules, case by case
    simulation.test.ts    Four computer players × every mode × 20 seeds, with state checks
  App.tsx                 Router, app-wide state (settings, saved match, stats, overlays)
  components/board/       Illustrated map board: IllustratedBoard (view), parts (SVG pieces),
                          layout (placement, route fan-out, collisions), geometry (curves,
                          texture pieces, hulls), sampling (getPointAtLength), measure (label
                          widths), assets (art files, preloading, fallbacks), style, icons,
                          BoardTooltip
  components/
    MatchSetupDialog.tsx  New game: mode, map, seats (human/AI, level, name, colour), seed
    InfoModals.tsx        Rules and Credits
    SettingsModal.tsx     Animation and computer speed, timer, log, colour-blind aid, sound
    FriendsPanel.tsx      Friends drawer ("Coming soon")
    game/                 Match screen: ActionBar, PlayersPanel, MarketPanel, GameLog, MoveTimer,
                          EraBanner, ResultsDialog, ZoomPan, GameBoard (practice maps), glyphs
    …                     Top bar, tabs, menu, dialogs, cards, toasts, artwork
  pages/
    MainMenu.tsx, Game.tsx, MapBoard.tsx, Achievements.tsx, Locker.tsx, Shop.tsx, Tournaments.tsx
  data/
    gameModes.ts          Game modes: rounds, starting money, board size, timer, computer pause
    maps.ts               Maps: the illustrated map plus the drawn practice maps
    board.json            Map board data: locations, slots, links (edit via #/board?edit=1)
    board.ts              Board types, validation, export formatting, era rules, network checks
    board.test.ts         Board data, the design checks, curves, texture pieces and layout
    achievements.ts       Achievements and lifetime stats
    navigation.ts         Tab list and route paths
    settings.ts           Settings shape, defaults and validation
  hooks/                  usePersistentState (localStorage-backed state), useToast
  lib/                    storage (safe localStorage), sound (Web Audio), random (new seeds)
```

## Extending

- **New game mode:** add an entry to `GAME_MODES` in `src/data/gameModes.ts`.
  To give it a new icon, add a name to `ModeIconName` and map it in `ModeCard.tsx`.
- **New map:** add a schematic entry to `MAPS` in `src/data/maps.ts`: towns
  with their building plots and ring (which modes include them), routes, and
  decoration, on a 160 × 100 grid. The lobby preview and the game board are both drawn from
  it, and `npm test` checks that every mode's cut of the map is connected and
  plays to the end.
- **Balance:** change the numbers in `src/game/rules.ts`, then run `npm test`:
  the simulation prints the average final score per AI level.
- **New tab:** add a path to `PATHS` and an entry to `NAV_TABS` in
  `src/data/navigation.ts`, then add a `<Route>` in `App.tsx`.
- **Re-theme:** change the color tokens in the `@theme` block at the top of
  `src/index.css`. Each token becomes a CSS variable (`--color-bronze-400`)
  and Tailwind utilities (`bg-bronze-400`, `text-bronze-400/60`, ...).

## Saved data

The selected mode and map, the settings, the last new-game seats, the match in
progress and your stats are saved to localStorage (`bronze.lobby.*`,
`bronze.settings`, `bronze.setup`, `bronze.match`, `bronze.stats`). The match
is saved after every action, so **Continue** on the main menu resumes exactly
where you left off. Saved values are validated when read; a match saved by an
older version (`GAME_VERSION` in `src/game/types.ts`) isn't resumed: the main
menu offers to start a new game instead. If storage isn't available, the app
keeps working with in-memory state.
