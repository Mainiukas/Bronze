# Bronze

**Bronze** is an original industrial-era strategy board game for 2–4 players.
Play against computer opponents or pass & play on one device.

## How the game works

Each round, every player takes a turn of two actions:

- **Build an industry** in a town in your network: a Colliery (coal), Ironworks
  (iron), Mill (goods) or Engine Works (prestige every round). Your first build
  can go anywhere.
- **Build a link**: a canal or railway on a route touching your network.
- **Ship goods** from a mill to a market town over built links (anyone's).
  Money and +1★ per goods, doubled over 2+ links. Using an opponent's link
  pays them a toll.
- **Raise funds.**

Missing coal and iron are bought automatically. At the end of each round,
industries produce and everyone collects income. After the last round, money
and market towns in your network add bonus prestige. Most prestige wins.

Modes change the board size (outer towns are dropped), the number of rounds and
the move timer. The full rules are in the game under ☰ → How to Play, and every
number lives in `src/game/rules.ts`.

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

## Project structure

```
src/
  game/                   The game itself, independent of React
    rules.ts              Every rule number: costs, prices, income, scoring
    engine.ts             Setup, legal moves, applying actions, production, final scores
    ai.ts                 Computer player (plans both actions of its turn)
    types.ts              GameState and action types
    engine.test.ts        Rules tests and simulated matches
  App.tsx                 Router, layout, app-wide state (selection, settings, saved match, stats)
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
    MainMenu.tsx, Game.tsx, Achievements.tsx, Locker.tsx, Shop.tsx, Tournaments.tsx
  data/
    gameModes.ts          Game modes: rounds, starting money, board size, timer
    maps.ts               Maps: towns, building plots, routes, decoration
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
- **New map:** add an entry to `MAPS` in `src/data/maps.ts`: towns with their
  building plots and ring (which modes include them), routes, and decoration,
  on a 160 × 100 grid. The lobby preview and the game board are both drawn from
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
