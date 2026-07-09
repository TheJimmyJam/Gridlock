# Gridlock — One-Pager

## What it is

A browser city-builder where **factories, traffic, and city services all run on the same road network.** Think Builderment's production chains, Mini Motorways' congestion pressure, and original SimCity's services layer, fused by one rule: everything — freight trucks and commuters alike — shares the roads the player builds.

That's the whole design pillar. One overloaded intersection cascades through all three systems at once: **congestion → deliveries fail → production stalls AND commuters can't reach jobs → services degrade → happiness drops → tax income falls → the player can't expand.** Every feature either feeds that cascade or gets cut.

## What's built (Phases 0–6, in that order)

- **World & rendering.** Isometric 200×200 tile grid, pan/zoom camera, placeholder colored diamonds standing in for real art. Switched from the originally-planned flat top-down to isometric mid-project once real art direction was chosen — the simulation layer didn't need to change at all to support that, which is the payoff of keeping sim and rendering strictly separate.
- **Simulation core.** A pure, framework-free TypeScript module (`/src/sim`) with zero Phaser imports. Runs on a fixed 250ms tick, fully decoupled from render framerate — the same input always produces the same output, which is what makes save/load and testing possible at all.
- **Production chains.** Resource nodes (ore mine, forest) feed factories, which run recipes (`ore→widget`, `wood→plank`, `plank→food`) and ship finished goods onward. Goods route through *any* valid producer→consumer pair — factory-to-factory chains work, not just node-to-factory-to-house.
- **City & commuting.** Houses demand a finished good and send commuters to factories-as-jobs, over the *same* road network as freight. Happiness rises or falls based on whether demand and commutes are actually being met.
- **The cascade.** Roads have capacity; overloaded tiles slow shipments and eventually time them out entirely (failed deliveries, failed commutes). Pathfinding is congestion-aware, so widening a road or building a parallel route is a real lever, not decoration.
- **Economy.** Starting money, per-tile placement costs, tax income from happiness × population, and a soft fail (can't-afford placements are just rejected) instead of a hard game-over.
- **Persistence.** Email/password auth via Supabase, autosave every 15s, exact resume on login.
- **Early tech progression.** A second recipe (`makeFood`) starts locked and unlocks the first time a house's demand is fulfilled — the seed of a real progression system.

Everything above has been verified with actual simulated playthroughs (headless scripts driving hundreds of ticks), not just "it compiles."

## What's still ahead

- **Real art.** Placeholder diamonds are still the only visuals. An isometric asset pack is in progress (ChatGPT-generated, prompts tracked in `ART_PROMPTS.md`); a few pieces are approved, a couple need redoing. Once the pack is done, wiring in real sprites — including depth sorting for building height — is its own chunk of work, not a drop-in.
- **Remaining Phase 6 candidates** (spec calls for pulling these one at a time, not all at once):
  - A real service building with a coverage radius (completes the civic-services pillar; only recipes/tech progression has been tackled so far)
  - Factory blueprint copy/paste (placement QoL)
  - A second network layer (rail/highway) — a bigger architecture change, touches pathfinding, placement, and rendering
  - Leaderboard table
- **Balance tuning.** Costs, tax rate, happiness thresholds, road capacity — all placeholder values chosen to make the mechanics *demonstrable*, not to make the game *fun*. That tuning pass hasn't happened yet.
- **Real UI.** Right now tools are picked with number keys 1–5 and everything reads off a debug-style HUD line. No buttons, no tooltips, no onboarding.
- **Netlify auto-deploy.** Currently deploying via manual zip pushes; the GitHub App needs one interactive authorization click in the Netlify dashboard to make push-to-deploy actually work.

## Bottom line

The core cascade — the thing the whole concept lives or dies on — is built and proven to work end-to-end. What's left is mostly *making it good* rather than *making it exist*: real art, real UI, tuning, and picking which depth features earn their way in next.
