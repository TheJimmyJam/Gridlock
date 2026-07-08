# Gridlocked — Individual Asset Prompts

The reference sheets in `assets-logos/artwork/` are mockup posters — multiple
items composited onto one page for pitching the style. What the game needs
is one transparent PNG per asset. This doc breaks that down into individual
ChatGPT prompts, grouped into stages, meant to be run **one at a time, in
order, in the same ChatGPT conversation** so the style stays consistent
across the whole set.

## How to use this doc

1. Start a fresh ChatGPT conversation for the whole asset pack (don't mix
   with other projects — style drift happens fast).
2. Paste the **Style Anchor** prompt below first. Save that first output too
   — it's a useful visual reference even though it's not a game asset.
3. Work through the stages in order. Paste one prompt, generate, save the
   result as the exact filename listed, then move to the next prompt in the
   same thread (so ChatGPT keeps referencing the established style).
4. If a result drifts off-style, regenerate in the same thread rather than
   starting over — reference the earlier images ("match the style of the
   factory and house you made earlier") if needed.
5. Drop finished PNGs into `assets-logos/artwork/final/<category>/` using
   the filenames given — that'll make wiring them into Phaser later a
   find-and-replace exercise instead of a scavenger hunt.

**Technical requirements for every prompt (already baked in below, don't
drop these when customizing):**
- Isometric (dimetric), 2:1 projection — matches the game's actual tile math
  (128px tile width : 64px tile height diamond footprint).
- Transparent background. No ground shadow plane, no drop shadow baked into
  a background layer — Phaser will place these on its own tile diamonds.
- Light source from the upper-left, consistent across every asset.
- Flat-ish, clean cel-shaded coloring with bold silhouettes — readable at
  small size on a game canvas, not a painterly poster illustration. This is
  the one place we're intentionally simplifying vs. the reference sheets,
  which lean more painterly/soft than what stays readable zoomed out.
- Generate large (1024×1024 or similar) and downscale later — easier to
  clean up edges that way than to upscale a small generation.

---

## Style Anchor (run first, before Stage 1)

```
Establish a visual style for a browser-based isometric city-builder game
called "Gridlocked." I'll be generating dozens of individual game assets
in this same conversation and need them all to match this exact style.

Style: flat-shaded isometric (2:1 dimetric projection), clean bold
outlines, warm saturated color palette, simple cel-shading with a single
consistent light source from the upper-left. Chunky, friendly, readable
proportions — think mobile city-builder (Township, SimCity BuildIt) but
flatter and simpler, not painterly or photorealistic. No gradients beyond
basic cel-shading bands. No background — every future asset in this
conversation will need a transparent background.

Generate a single reference image: a small isometric town intersection
with one house, one road segment, and one tree, all in this style, on a
transparent background, to lock in the palette and shading approach
before I ask for individual assets one at a time.
```

---

## Stage 1 — Terrain tiles

Ground tiles that other assets sit on top of. Build these first since
everything else is judged against them.

**`terrain_grass.png`**
```
In the established Gridlocked style: a single isometric grass ground
tile, 2:1 dimetric projection, diamond-shaped footprint, transparent
background. Default buildable terrain — light green grass with a couple
of small texture details (a few blades, tiny flowers), nothing busy.
No border, no shadow.
```

**`terrain_water.png`**
```
In the established Gridlocked style: a single isometric water ground
tile, diamond-shaped footprint, transparent background. Calm blue water
with simple flat-shaded ripple highlights. Edges should tile cleanly
against a grass tile.
```

**`terrain_dirt.png`**
```
In the established Gridlocked style: a single isometric dirt/empty
ground tile, diamond-shaped footprint, transparent background. Bare
brown dirt for construction sites, a couple of small pebbles, flat
cel-shading.
```

**`terrain_cloud.png`**
```
In the established Gridlocked style: a single decorative cloud sprite,
soft white, flat cel-shaded, transparent background, no ground tile
underneath it — this floats above the map as a parallax/atmosphere
element, not a placeable tile.
```

**`terrain_tree_cluster.png`**
```
In the established Gridlocked style: a small cluster of 2-3 pine/round
trees on a single isometric grass tile footprint, transparent
background. Used as a decorative filler prop, not a placeable building.
```

**`terrain_rock_cluster.png`**
```
In the established Gridlocked style: a small cluster of grey rocks on a
single isometric tile footprint, transparent background. Natural
obstacle/decorative prop, flat cel-shaded stone with simple highlight
bands.
```

---

## Stage 2 — Road kit

All road pieces need to align edge-to-edge at the same diamond footprint
as the terrain tiles, so the road surface width/angle must match Stage 1
exactly.

**`road_straight.png`**
```
In the established Gridlocked style: a single straight isometric road
segment, one tile footprint, transparent background. Asphalt grey with
dashed white centerline, simple curb detail on both edges. Must align
edge-to-edge with other road tiles at the same 2:1 projection.
```

**`road_corner.png`**
```
In the established Gridlocked style: a 90-degree corner isometric road
tile, one tile footprint, transparent background, matching
road_straight.png in color/scale/line style exactly.
```

**`road_tjunction.png`**
```
In the established Gridlocked style: a T-junction isometric road tile
(connects three road segments), one tile footprint, transparent
background, matching road_straight.png in color/scale/line style.
```

**`road_4way.png`**
```
In the established Gridlocked style: a 4-way isometric road
intersection tile, one tile footprint, transparent background, matching
road_straight.png in color/scale/line style.
```

**`road_endcap.png`**
```
In the established Gridlocked style: an isometric road end-cap tile
that cleanly terminates a road segment, one tile footprint, transparent
background, matching road_straight.png in color/scale/line style.
```

**`road_crosswalk.png`**
```
In the established Gridlocked style: a straight isometric road segment
with a pedestrian crosswalk painted across it, one tile footprint,
transparent background, matching road_straight.png in color/scale/line
style.
```

**`road_bridge.png`**
```
In the established Gridlocked style: an isometric bridge road segment
that spans over water (wooden or concrete piers visible underneath,
water_terrain.png style water beneath), one tile footprint, transparent
background, matching road_straight.png in color/scale/line style.
```

---

## Stage 3 — Residential buildings

**`building_house_lvl1.png`**
```
In the established Gridlocked style: a small single-family house, level
1 (starter tier), isometric, 1x1 tile footprint, transparent background.
Warm terracotta or red roof, small yard, simple fence. Base of the
building should sit flush at the bottom of the canvas for easy tile
alignment.
```

**`building_house_lvl2.png`**
```
In the established Gridlocked style: a slightly larger, nicer house,
level 2, isometric, 2x2 tile footprint, transparent background. Blue
roof, small garden/hedges, a bit more detail than house_lvl1 to read as
an upgrade. Base flush at bottom of canvas.
```

**`building_apartment.png`**
```
In the established Gridlocked style: a mid-rise apartment block, 3-4
stories, isometric, 2x2 tile footprint, transparent background. Yellow
and blue paneling, visible windows/balconies, denser housing than the
houses. Base flush at bottom of canvas.
```

---

## Stage 4 — Industrial buildings

**`building_factory_small.png`**
```
In the established Gridlocked style: a small factory building with two
smokestacks, isometric, 2x2 tile footprint, transparent background.
Blue-grey industrial building, white/red striped smokestacks. Base flush
at bottom of canvas.
```

**`building_factory_large.png`**
```
In the established Gridlocked style: a larger factory complex with
three or four smokestacks and visible pipework, isometric, 3x3 tile
footprint, transparent background. Same color language as
factory_small.png but bigger and more complex. Base flush at bottom of
canvas.
```

**`building_mine_node.png`**
```
In the established Gridlocked style: a resource node — a small open-pit
mine with mining equipment and exposed rock/ore, isometric, 2x2 tile
footprint, transparent background. Yellow mining machinery accent color
against grey rock. Base flush at bottom of canvas.
```

**`building_forest_node.png`**
```
In the established Gridlocked style: a resource node — a small cluster
of harvestable forest with cut logs stacked nearby, isometric, 2x2 tile
footprint, transparent background. Denser/darker greens than the
decorative tree_cluster prop, to read as a functional resource building.
Base flush at bottom of canvas.
```

---

## Stage 5 — Commercial & civic buildings

**`building_shop.png`**
```
In the established Gridlocked style: a small storefront/shop with an
awning, isometric, 2x2 tile footprint, transparent background. Warm
inviting colors (orange/cream awning), a sign, a display window. Base
flush at bottom of canvas.
```

**`building_service_depot.png`**
```
In the established Gridlocked style: a service depot / maintenance
garage building with a large wrench sign, isometric, 2x2 tile footprint,
transparent background, parked service vehicles implied but not
required. Base flush at bottom of canvas.
```

**`building_clinic.png`**
```
In the established Gridlocked style: a small medical clinic, isometric,
2x2 tile footprint, transparent background. White building with a red
cross sign, clean civic color palette (white/light blue). Base flush at
bottom of canvas.
```

**`building_police.png`**
```
In the established Gridlocked style: a police / civic services
building, isometric, 2x2 tile footprint, transparent background. Navy
and gold color scheme, a star/shield sign. Base flush at bottom of
canvas.
```

**`building_park_plaza.png`**
```
In the established Gridlocked style: a small park plaza with a
fountain, benches, and trees, isometric, 2x2 tile footprint, transparent
background. Greens and stone-grey paths, welcoming civic green space.
Base flush at bottom of canvas.
```

---

## Stage 6 — Vehicles

Small enough to read clearly on a road tile; three-quarter iso angle
matching the road kit's perspective.

**`vehicle_commuter_car.png`**
```
In the established Gridlocked style: a small commuter car, isometric,
sized to sit on a single road tile, transparent background, simple
bright color (red), no plate detail needed at this scale.
```

**`vehicle_cargo_truck.png`**
```
In the established Gridlocked style: a cargo/freight truck, isometric,
sized to sit on a single road tile, transparent background, yellow cab
and trailer, used for factory-to-shop deliveries.
```

**`vehicle_delivery_van.png`**
```
In the established Gridlocked style: a small delivery van, isometric,
sized to sit on a single road tile, transparent background, plain white
body with room to add a logo later.
```

**`vehicle_service_truck.png`**
```
In the established Gridlocked style: a utility/service truck with a
small ladder rack, isometric, sized to sit on a single road tile,
transparent background, white and blue color scheme.
```

**`vehicle_garbage_truck.png`**
```
In the established Gridlocked style: a garbage truck, isometric, sized
to sit on a single road tile, transparent background, green body.
```

**`vehicle_emergency_van.png`**
```
In the established Gridlocked style: an ambulance/emergency response
van, isometric, sized to sit on a single road tile, transparent
background, white body with a red cross and light bar.
```

---

## Stage 7 — Citizens & workers

Small standing character sprites, isometric or gentle three-quarter
view, simple enough to read at tiny scale.

**`citizen_resident.png`**
```
In the established Gridlocked style: a simple standing citizen
character, casual clothing, isometric/three-quarter view, transparent
background, flat cel-shaded, chunky friendly proportions matching a
mobile city-builder's citizen sprites.
```

**`citizen_student.png`**
```
Same style and proportions as citizen_resident.png: a student character
with a backpack, transparent background.
```

**`citizen_office_worker.png`**
```
Same style and proportions as citizen_resident.png: an office worker in
business casual with a briefcase, transparent background.
```

**`citizen_engineer.png`**
```
Same style and proportions as citizen_resident.png: an engineer wearing
a hard hat and safety vest holding a clipboard, transparent background.
```

**`citizen_factory_worker.png`**
```
Same style and proportions as citizen_resident.png: a factory worker in
blue coveralls with a cap, transparent background.
```

**`citizen_truck_driver.png`**
```
Same style and proportions as citizen_resident.png: a truck driver in a
jacket, transparent background.
```

**`citizen_courier.png`**
```
Same style and proportions as citizen_resident.png: a courier holding a
delivery box, transparent background.
```

**`citizen_police_officer.png`**
```
Same style and proportions as citizen_resident.png: a police officer in
uniform with a cap, transparent background.
```

**`citizen_medic.png`**
```
Same style and proportions as citizen_resident.png: a medic in teal
scrubs carrying a medical bag, transparent background.
```

---

## Stage 8 — Resource & UI icons

Flat icon style (not isometric like the tiles/buildings) — these render
in the HUD and inventory UI, not on the game grid.

**`resource_ore.png`**
```
In the established Gridlocked color palette but as a flat UI icon (not
isometric): a small crate/pile of raw ore chunks, square canvas,
transparent background, bold clean silhouette readable at 24px.
```

**`resource_plank.png`**
```
Same flat icon treatment as resource_ore.png: a small stack of wooden
planks, transparent background.
```

**`resource_widget.png`**
```
Same flat icon treatment as resource_ore.png: a crate of small
mechanical gear/widget parts, transparent background.
```

**`resource_food.png`**
```
Same flat icon treatment as resource_ore.png: a crate of produce
(vegetables/fruit), transparent background.
```

**`ui_money.png`**
```
Same flat icon treatment as resource_ore.png: a stack of cash/bills,
green, transparent background.
```

**`ui_happiness.png`**
```
Same flat icon treatment as resource_ore.png: a simple yellow smiley
face icon, transparent background.
```

**`ui_congestion.png`**
```
Same flat icon treatment as resource_ore.png: a red diamond warning
icon with a small car/traffic silhouette inside, transparent
background.
```

---

## Stage 9 — Gameplay state overlays

Small badge/overlay icons that stack on top of buildings and roads to
communicate sim state at a glance (matches page 5 of the reference pack).
Flat icon style, square canvas, transparent background, designed to be
overlaid at small size in a corner of a building or road tile.

**`state_road_normal.png`** / **`state_road_congested.png`** / **`state_road_gridlocked.png`**
```
Generate three small flat status badge icons for road congestion levels
— normal (no badge/green check), congested (yellow warning triangle),
gridlocked (red warning triangle with an exclamation mark) — as three
separate transparent-background icons in the same flat UI style as
ui_congestion.png. Generate one at a time if needed, keeping the same
badge shape/size across all three so they're interchangeable in the UI.
```

**`state_factory_working.png`** / **`state_factory_stalled.png`** / **`state_factory_output_full.png`**
```
Generate three small flat status badge icons for factory state —
working (green checkmark), stalled/no input (red warning triangle),
output buffer full (orange warning triangle with a box icon) — as three
separate transparent-background icons, same badge shape/size as the
road state badges above so they're visually consistent.
```

**`state_house_happy.png`** / **`state_house_neutral.png`** / **`state_house_unhappy.png`**
```
Generate three small flat face-icon badges for house happiness state —
happy (green smiley), neutral (yellow neutral face), unhappy (red frown)
— as three separate transparent-background icons, same badge shape/size
as the other status badges.
```

**`state_failed_delivery.png`**
```
Same flat badge style as the other state icons: a red circle with a
white X, transparent background, for a delivery that failed to reach
its destination.
```

---

## Stage 10 — Branding

**`brand_wordmark.png`**
```
A bold condensed wordmark logo reading "GRIDLOCKED" in the established
Gridlocked color palette (navy background elements optional, but the
wordmark itself should work on a transparent background), thick
lettering with a small road/hazard-stripe accent underneath, matching
the energy of a road-sign/traffic theme.
```

**`brand_app_icon.png`**
```
A square app icon for "Gridlocked": a simplified isometric mini skyline
(2-3 buildings and a smokestack) with a small car in front, in the
established color palette, rounded-square icon format, works at small
sizes (favicon scale).
```

**`brand_title_screen.png`**
```
A title screen background for "Gridlocked": a wide isometric town scene
in the established style (houses, a factory, roads, a couple of
vehicles) with clean empty space reserved in the lower third for UI
buttons to be added later, transparent-friendly or a simple sky
background, not busy enough to fight with UI text.
```

---

## After the art exists

Once files land in `assets-logos/artwork/final/`, integrating them into
Phaser (loading spritesheets, replacing the placeholder diamonds in
`GridScene.ts`, sprite anchoring/depth-sorting for building height) is a
separate follow-up — flagging that now so it doesn't get assumed as part
of "just drop the PNGs in."
