# Bronze

Front-end shell for **Bronze**, an original industrial-era strategy board game.
This build covers the lobby only: main menu, navigation, and game-mode and map
selection. There's no gameplay yet.

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
  App.tsx                 Router, layout shell, app-wide state (selection, settings, open overlay)
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
  pages/
    MainMenu.tsx, Locker.tsx, Shop.tsx, Achievements.tsx, Tournaments.tsx
  data/
    gameModes.ts          Game modes (Normal, Blitz, Bullet)
    maps.ts               Maps, including preview geometry
    navigation.ts         Tab list and route paths
    settings.ts           Settings shape, defaults and validation
  hooks/
    usePersistentState.ts useState backed by localStorage
    useToast.ts           Toast context and hook
  lib/
    storage.ts            Safe localStorage access (all calls wrapped in try/catch)
```

## Extending

- **New game mode:** add an entry to `GAME_MODES` in `src/data/gameModes.ts`.
  To give it a new icon, add a name to `ModeIconName` and map it in `ModeCard.tsx`.
- **New map:** add an entry to `MAPS` in `src/data/maps.ts`. Its preview is
  drawn from the `preview` data (towns, links, water, hills, landmarks) on a
  160 × 100 grid, so it doesn't need an image.
- **New tab:** add a path to `PATHS` and an entry to `NAV_TABS` in
  `src/data/navigation.ts`, then add a `<Route>` in `App.tsx`.
- **Re-theme:** change the color tokens in the `@theme` block at the top of
  `src/index.css`. Each token becomes a CSS variable (`--color-bronze-400`)
  and Tailwind utilities (`bg-bronze-400`, `text-bronze-400/60`, ...).

## Saved data

The selected mode, the selected map and the settings are saved to
localStorage under `bronze.lobby.gameMode`, `bronze.lobby.map` and
`bronze.settings`. Saved values are validated when read. If storage isn't
available, the app keeps working with in-memory state.
