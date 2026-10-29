Build an endless neon racer in THIS folder: C:\xampp\htdocs\neon-racer

A recruiter-ready browser racer. Playable, polished, no backend.

## Game
- Call it "Volt Lane". Original cars, no licensed racing brands.
- Canvas or CSS 2D. Three-lane highway scrolling toward the player. Player car in one lane. Traffic cars spawn ahead and move down.
- Left/Right arrows, A/D, or tap/swipe the side of the road to change lane. Collision with traffic is game over. R restarts.
- Score is distance survived. Speed ramps up over time. Local best in localStorage.

## UI
- Night city highway, neon lane lines, glowing cars, large score. Not a default Vite page. No Vue logo.
- 390px phone and 1280px desktop.

## Tests
- Vitest (pure logic): changing lane left from lane 0 stays at 0; overlapping the player and a traffic car is a crash; surviving time/distance increases score.
- `npm test` and `npm run build` must pass.

## GitHub
- Repo: https://github.com/oscarmmi/neon-racer
- Pages: https://oscarmmi.github.io/neon-racer/
- vite base `/neon-racer/`
- Commit: feat: add neon racer
- First commit must `git add -A` so package.json, vite.config.ts, tsconfigs, src/main.ts, index.html, .gitignore, and .github/workflows/pages.yml ship with the game.
- gh repo edit --description "Volt Lane neon racer in Vue 3 + TypeScript, playable on GitHub Pages." --add-topic vue --add-topic typescript --add-topic game --add-topic racing --add-topic canvas
- Stop. Print the repo URL and Pages URL.
