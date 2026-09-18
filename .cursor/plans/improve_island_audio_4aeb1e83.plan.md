---
name: Improve Island Audio
overview: Enhance the island sound system by adjusting hearing distances, balancing volumes, and adding wildlife sounds for visible animals (fox, deer, sheep, llama, fish).
todos:
  - id: list-sounds
    content: Document current sound system (distances, volumes, sources)
    status: pending
  - id: adjust-distances
    content: Update LANDMARK_HEAR constant and hearing distances
    status: pending
  - id: balance-volumes
    content: Adjust environment sound volumes for better balance
    status: pending
  - id: wildlife-buffers
    content: Generate procedural wildlife sound buffers in audio.ts
    status: pending
  - id: attach-wildlife
    content: Attach sounds to spawned animals in wildlife.ts
    status: pending
  - id: wire-audio
    content: Connect wildlife audio between setupIslandAudio and spawnWildlife
    status: pending
  - id: test-audio
    content: Test audio balance and performance in-game
    status: pending
isProject: false
---

# Improve Island Audio System

## Current State Summary

The game uses a 3D positional audio system with the following environment sounds:

**Current Hearing Distances:**
- Ocean waves: 42 meters (OCEAN_HEAR)
- All landmarks (wreck, hut, boat, pond): 20 meters (LANDMARK_HEAR)
- Reference distance (attenuation start): 3 meters (REF_DISTANCE)

**Active Environment Sounds:**
1. Ocean waves (continuous, volume 0.5, 42m) - tracks nearest coast
2. Wreck: creaking (0.55 vol, 20m), seagulls (0.28 vol, 20m)
3. Hut: cloth rustling (0.42 vol, 20m), birds (0.22 vol, 20m), pig oinks (0.26 vol, 20m)
4. Boat: chopping (0.32 vol, 20m), seagulls (0.2 vol, 20m)
5. Pond: water bed (0.22 vol, 20m), frogs (0.48 vol, 20m), splashes (0.3 vol, 20m)

**Missing:**
- No sounds for visible wildlife (fox, deer, sheep, llama, fish swimming)
- Wildlife models are spawned in [`web/src/wildlife.ts`](web/src/wildlife.ts) but produce no audio

## Proposed Improvements

### 1. Add Wildlife Sounds

Generate procedural sounds for visible animals and attach them to spawned critters:

**In [`web/src/wildlife.ts`](web/src/wildlife.ts):**
- Add sound generation functions (similar to existing `makeOinkBuffer`, `makeFrogBuffer`):
  - `makeFoxYipBuffer()` - short, high-pitched bark
  - `makeDeerCallBuffer()` - low grunt/snort
  - `makeSheepBleatingBuffer()` - classic "baa" sound
  - `makeLlamaHumBuffer()` - deep humming sound
  - `makeFishBubbleBuffer()` - gentle underwater bubbles

- Modify `spawn()` function to accept optional audio parameters
- Add sound attachments in `spawnWildlife()` after creating each critter:
  - Fox: 12-20 second gaps, volume 0.24, 18m range
  - Deer: 18-30 second gaps, volume 0.20, 16m range
  - Sheep: 10-18 second gaps, volume 0.28, 15m range
  - Llama: 20-35 second gaps, volume 0.22, 14m range
  - Fish (pond only): continuous subtle bubbles, volume 0.12, 8m range

- Update `Critter` type to include optional `sound: THREE.PositionalAudio | null`
- In the update loop, call `applySpatial()` for each critter's sound to keep position synced

### 2. Adjust Hearing Distances

**In [`web/src/audio.ts`](web/src/audio.ts):**
- Increase `LANDMARK_HEAR` from 20 to 28 cells (meters) for better landmark discoverability
- Keep `OCEAN_HEAR` at 42 (ocean should remain the most audible)
- Keep `REF_DISTANCE` at 3 (good close-up attenuation start)

This creates three tiers:
- Close sounds (wildlife): 8-18m
- Landmark sounds: 28m
- Ocean: 42m

### 3. Balance Volumes

**In [`web/src/audio.ts`](web/src/audio.ts) `setupIslandAudio()`:**
- Reduce ocean volume from 0.5 to 0.42 (less overwhelming)
- Increase pond bed from 0.22 to 0.28 (more noticeable)
- Increase frogs from 0.48 to 0.52 (signature pond sound)
- Reduce wreck creaking from 0.55 to 0.48 (less jarring)
- Leave other volumes as-is (already well-balanced)

### 4. Technical Implementation Notes

**Audio Context Setup:**
- Wildlife sounds should be generated in `setupIslandAudio()` after `listener.context.resume()`
- Pass the generated buffers to `spawnWildlife()` via a new parameter
- Use `attachRandomOneShots()` helper (already exists) for animal calls

**Performance:**
- Wildlife sounds should only play when animals are spawned
- Total sound count: ~9 critters × 1-2 sounds each = ~15 additional sources
- Well within Web Audio API limits (typical max is 32+ simultaneous sources)

**Integration Points:**
1. [`web/src/audio.ts`](web/src/audio.ts) - Generate wildlife sound buffers, export interface
2. [`web/src/wildlife.ts`](web/src/wildlife.ts) - Accept audio buffers, attach to critters, update positions
3. [`web/src/main.ts`](web/src/main.ts) - Pass wildlife audio from `setupIslandAudio()` to `spawnWildlife()`

## Files to Modify

- [`web/src/audio.ts`](web/src/audio.ts) - Constants, volume adjustments, wildlife sound generation
- [`web/src/wildlife.ts`](web/src/wildlife.ts) - Sound attachment to critters, position updates
- [`web/src/main.ts`](web/src/main.ts) - Wire wildlife audio between modules

## Testing Checklist

- Ocean is audible from shore but not overwhelming
- Each landmark sound is clearly audible at 28m
- Wildlife sounds play at appropriate intervals
- Animal sounds follow moving animals correctly
- Multiple overlapping sounds don't clip or distort
- Performance remains smooth with additional audio sources
