# Working on the video app

`apps/video` renders Fuse release videos with Remotion. It is private and never published. CI runs its type check, lint and browser suite; nothing here is bundled or rendered in CI.

## Before you run it

Build Fuse first (`pnpm exec turbo run build --filter=@elmeragroup/fuse`). `src/index.css` imports `themes.css` and `demo-stage-density.css` from Fuse's `dist`, as the docs app does. Set up the music as "Music" below describes, or the films play silent. Then run `pnpm --filter video studio`, or render a film by its composition id: `pnpm --filter video render BrandBook-en-US` writes `out/BrandBook-en-US.mp4`. Keep renders under `out/`, which git ignores; this repo is public.

A public render or upload needs the Remotion Company License. Local renders for review do not.

## Music

Every film plays "Edge of the World" by OceanKing, edited to its own scene grid. To set it up once per clone:

1. Download the MP3 from <https://pixabay.com/music/drum-n-bass-edge-of-the-world-219742/> and save it as `public/music/local/oceanking-edge-of-the-world-219742.mp3`.
2. Run `pnpm --filter video music:cut`. It decodes the track with the FFmpeg Remotion ships and writes each film's cut to its own file in `public/music/local/`, such as `fuse-release-cut.wav`.

Each film's `grid.ts` holds its music edit, `scripts/cut-music.ts` lists every edit, and `scripts/music-mix.ts` mixes them. Run `music:cut` again after any change to an edit or a film's scene grid. After a change to the mixer, compare every cut's SHA-256 with the one before. A cut whose edit did not change must stay byte-identical.

The mixer draws every splice and fade into the samples, because Remotion applies a `volume` callback once per video frame, and a fade drawn that way steps and clicks. Play each cut at constant volume.

The Pixabay Content License covers the track. It lets a video use the track but forbids distributing the file on its own, so the file stays out of this public repo and git ignores `public/music/local/`. Never stage or commit it. Every bundle and render carries a copy too, so git also ignores `out/` and `build/`; keep Remotion output in those folders or outside the repo.

Without its cut, a film plays silent and logs one warning. Each film's metadata function calls `findSoundtrack`, which sends a `HEAD` request for the cut before the film mounts its audio, because a render fails on an audio source that answers 404.

## Remotion version

The catalog pins Remotion to 4.0.535. The vendored skill in `.agents/skills/remotion-best-practices/` documents 4.0.536. Where it says `Interactive.create`, this version has `Interactive.withSchema({ wrapInSequence: true, layout })`. Upgrade every `@remotion/*` entry together.

## Motion

- `SeekCssAnimations` drives Fuse's own CSS motion. On each frame it pauses every Web Animation and seeks it to the frame's time.
- A frame must render the same whatever rendered before it: a fresh mount, forward playback, or a rewind as Studio scrubs back. Remotion renders frames out of order across tabs.
- Render an overlay inside `SeekedOverlay`, which hands it `open` and the `container` its content portals into. The container carries the time since `openAt`. When a render lands inside the opening, the component replays the closed state first, because Base UI animates only a change it sees. On a rewind into the opening it remounts the overlay, because a finished transition cannot be seeked back. A popup leaves focus where a fresh render of the frame leaves it, so its content passes `finalFocus={false}`, and `initialFocus={false}` too when the popup would take focus and nothing in the frame needs it.
- Render a toast with `FrameToast`. Its provider exists only from the toast's frame on, so a rewind removes it at once. Its timeout is `0`, so the video decides when it leaves.
- Animate everything else with `useCurrentFrame` and `interpolate`, on the curves in `src/motion/easing.ts`, so every motion follows the frame and none follows the wall clock.
- Measure layout with `useStagePoint`, `useStageBox` or `useAnchoredPoint` from `src/primitives/stage.tsx`. They read untransformed offsets once, on mount, so an animating scale or translate on an ancestor never moves the result. Call them from a component that `SceneFrame` renders, because the scene component around `SceneFrame` mounts before the font gate opens, when there is nothing to measure.
- Remotion captures a frame only after every `delayRender` hold continues. `ReadyFrame` mounts the seek helper inside the font gate with the content, and the gate opens only after that commit, so no frame is captured between the fonts loading and the motion settling.
- Lay out every line and panel from the scene's first frame and animate only what it shows. A `Sequence` that mounts a row on its beat makes a centred group reflow and moves text already on screen.

## Scenes and timing

- Each film lives in its own folder under `src/` and registers its compositions in `src/root.tsx`: `fuse-release/` is the release video, `brand-book/` the marketing intro and `claude-builds/` the developer intro.
- Every scene renders inside `SceneFrame`, so it plays the same opened alone in Studio and inside its film, with one seek helper per mounted scene. `index.css` bundles every face the films draw: Roboto, and JetBrains Mono, which it sets as Fuse's `--font-mono`. The font gate in `src/primitives/font-gate.tsx` waits for every face and weight, so a new face or weight goes in both files.
- Theme every scope with `SceneTheme`, which also stamps the variant's density on a demo stage, or the density it is given. Put a light scope beside a dark one, never inside it, because Fuse's dark rules match any `data-theme="dark"` ancestor and a nested light scope renders dark.
- Times come from the track's beat grid in `src/music/beat-grid.ts`: `bars(n)` and `beats(n)`. Scenes last whole bars and cuts land on beats. A scene reads its own length from `useVideoConfig().durationInFrames`.
- Each film's `grid.ts` lays its scenes end to end with `sceneGrid` and cuts the track on the grid's bar lines. It throws when its scenes move a splice off the track bar the edit needs. `scripts/cut-music.ts` loads these modules under Node's type stripping, so they import with explicit `.ts` extensions.
- The grid's tempo and first downbeat come from measuring the track. A new track needs both measured again and every cut re-run.

## Copy and data

- Every visible string lives in the typed catalogs under `src/copy/`, one per locale. Format numbers, dates and money with `Intl` for the video's locale; currency follows the brand's market in `src/brand/brand-market.ts`.
- Fit a headline to its slot with `FittedHeadline`, whose longest line sets one size for the block. It measures while it renders and Remotion caches each measurement, so render it inside `FontGate`, which every `SceneFrame` has, or a measurement taken with a fallback face sticks.
- After a copy change, check stills of the longest-text frames in every locale. The nb-NO and sv-SE catalogs are drafts until a native speaker reviews them.
- Read theme values from `@elmeragroup/fuse/theme-catalog`. Parse, convert and measure colours through `@elmeragroup/color`.
