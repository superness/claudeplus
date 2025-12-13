# Progression Design Document: Cosmic Tic-Tac-Toe - The Eternal Grid

## Overview

This document defines the character advancement systems for Cosmic Tic-Tac-Toe. Given the game's elegant simplicity, progression focuses on **cosmetic mastery**, **skill recognition**, and **collection completion** rather than power-based advancement. Every match contributes to meaningful progress, and the system celebrates both casual engagement and dedicated mastery.

---

## 1. Leveling System

### 1.1 Cosmic Attunement (Account Level)

**XP Currency:** Cosmic Resonance (CR)
**Level Cap:** 100 (with Prestige system beyond)

**XP Sources:**

| Activity | Cosmic Resonance Earned |
|----------|------------------------|
| Victory | 100 CR |
| Draw | 75 CR |
| Defeat | 50 CR |
| First Match of Day | +50 CR bonus |
| Daily Challenge Completion | +25 CR per challenge |
| Weekly Challenge Completion | +100 CR per challenge |
| Achievement Unlock | +50-500 CR (varies by tier) |

### 1.2 XP Curve

The leveling curve uses a **gentle exponential** formula that front-loads early progress while creating meaningful milestones later:

```
XP_Required(Level) = 100 × Level^1.3

Level 1→2:   100 CR (~1 match)
Level 5→6:   287 CR (~3 matches)
Level 10→11: 500 CR (~5 matches)
Level 25→26: 1,072 CR (~11 matches)
Level 50→51: 1,917 CR (~19 matches)
Level 75→76: 2,708 CR (~27 matches)
Level 99→100: 3,511 CR (~35 matches)
```

**Total XP to Max Level:** ~89,000 CR (~890 matches, or ~4 months of daily play at 10 matches/day)

### 1.3 Level Rewards

| Level | Reward | Unlock |
|-------|--------|--------|
| 1 | 500 Essence | Welcome bonus |
| 5 | Common Symbol Trail | Basic trail effect |
| 10 | 1 Void Fragment | First rare currency |
| 15 | Echoing Acolyte AI | Tier 2 opponent |
| 20 | Profile Frame: "Initiate" | First frame |
| 25 | 2 Void Fragments + 500 Essence | Milestone burst |
| 30 | Grid Walker AI | Tier 3 opponent |
| 35 | 1 Alignment Crystal | First epic currency |
| 40 | Uncommon Victory Effect | Visual upgrade |
| 45 | 3 Void Fragments | Resource burst |
| 50 | Force Adept AI + Title "Adept" | Tier 4 opponent + title |
| 60 | 2 Alignment Crystals | Epic currency burst |
| 70 | Rare Grid Skin | Significant cosmetic |
| 75 | The Eternal AI | Tier 5 (final) opponent |
| 80 | Epic Cell Animation | High-tier cosmetic |
| 90 | 5 Alignment Crystals | Pre-cap burst |
| 100 | 1 Primordial Spark + Title "Cosmic Master" | Max level celebration |

### 1.4 Prestige System (Beyond Level 100)

After reaching level 100, players can choose to **Prestige**, which:

**Prestige Requirements:**
- Must be Level 100
- Must own at least 25 cosmetic items
- Must have won 100+ matches

**Prestige Effects:**
- Account level resets to 1
- Gain Prestige Star (displayed on profile, max 10 stars)
- Unlock Prestige-exclusive cosmetic tier
- Retain all owned cosmetics, currencies, and achievements
- +5% permanent XP bonus (stacks, max +50% at Prestige 10)

**Prestige Rewards:**

| Prestige | Reward |
|----------|--------|
| 1 | Prestige Frame: Bronze Star |
| 2 | Prestige Symbol Trail (both O and X) |
| 3 | Prestige Frame: Silver Star |
| 4 | Prestige Cell Animation |
| 5 | Prestige Frame: Gold Star + 1 Primordial Spark |
| 6 | Prestige Victory Effect |
| 7 | Prestige Grid Skin |
| 8 | Prestige Frame: Platinum Star |
| 9 | Prestige Avatar Border |
| 10 | Ultimate Prestige Set + Title "Eternal One" + 2 Primordial Sparks |

---

## 2. Skill Tree System

### 2.1 Dual Path Design

Rather than a single skill tree, Cosmic Tic-Tac-Toe offers two parallel cosmetic mastery paths that mirror the cultural divide:

**Path of Orbis** (The Circle)
- Focus: Defensive aesthetics, flowing animations, orbital effects
- Currency: Starlight Orbs

**Path of Crucia** (The Cross)
- Focus: Aggressive aesthetics, sharp animations, impact effects
- Currency: Shadow Shards

### 2.2 Orbis Skill Tree

```
                    [ORBIS MASTERY]
                          |
           ┌──────────────┼──────────────┐
           |              |              |
     [ORBIT BRANCH]  [HARMONY BRANCH]  [CELESTIAL BRANCH]
           |              |              |
        Tier 1         Tier 1          Tier 1
     Azure Glow      Calm Pulse       Star Field
      (50 Orbs)       (50 Orbs)        (50 Orbs)
           |              |              |
        Tier 2         Tier 2          Tier 2
     Orbital Ring    Flowing Aura     Moon Phase
      (100 Orbs)      (100 Orbs)       (100 Orbs)
           |              |              |
        Tier 3         Tier 3          Tier 3
    Double Orbit    Balance Wave    Planet Corona
      (200 Orbs)      (200 Orbs)       (200 Orbs)
           |              |              |
        Tier 4         Tier 4          Tier 4
   Triple Ring       Serenity        Solar System
      (350 Orbs)      (350 Orbs)       (350 Orbs)
           |              |              |
           └──────────────┼──────────────┘
                          |
                  [ORBIS MASTERY]
                  Complete all 3 branches
                  Reward: "Circler" Title
                  + Legendary Orbis Effect
                  (Requires 2,100 total Orbs invested)
```

**Orbis Branch Details:**

**Orbit Branch** (Symbol Enhancement)
| Node | Cost | Prerequisite | Effect |
|------|------|--------------|--------|
| Azure Glow | 50 Orbs | None | O symbols have soft azure glow |
| Orbital Ring | 100 Orbs | Azure Glow | Single ring orbits placed O |
| Double Orbit | 200 Orbs | Orbital Ring | Two intersecting orbital rings |
| Triple Ring | 350 Orbs | Double Orbit | Planetary ring system on O symbols |

**Harmony Branch** (Grid Enhancement)
| Node | Cost | Prerequisite | Effect |
|------|------|--------------|--------|
| Calm Pulse | 50 Orbs | None | Grid cells pulse gently when hovering |
| Flowing Aura | 100 Orbs | Calm Pulse | Energy flows between O symbols |
| Balance Wave | 200 Orbs | Flowing Aura | Wave ripples across grid on placement |
| Serenity | 350 Orbs | Balance Wave | Entire grid breathes with placement timing |

**Celestial Branch** (Victory Enhancement)
| Node | Cost | Prerequisite | Effect |
|------|------|--------------|--------|
| Star Field | 50 Orbs | None | Stars appear in background during play |
| Moon Phase | 100 Orbs | Star Field | Moon cycles through phases each turn |
| Planet Corona | 200 Orbs | Moon Phase | Victory creates planetary explosion |
| Solar System | 350 Orbs | Planet Corona | Full solar system celebration on win |

### 2.3 Crucia Skill Tree

```
                    [CRUCIA MASTERY]
                          |
           ┌──────────────┼──────────────┐
           |              |              |
     [STRIKE BRANCH]  [EDGE BRANCH]   [FLAME BRANCH]
           |              |              |
        Tier 1         Tier 1          Tier 1
     Crimson Glow    Sharp Lines      Ember Trail
      (50 Shards)     (50 Shards)      (50 Shards)
           |              |              |
        Tier 2         Tier 2          Tier 2
     Impact Flash    Blade Edge       Fire Wake
      (100 Shards)    (100 Shards)     (100 Shards)
           |              |              |
        Tier 3         Tier 3          Tier 3
     Strike Burst    Razor Grid       Inferno Pulse
      (200 Shards)    (200 Shards)     (200 Shards)
           |              |              |
        Tier 4         Tier 4          Tier 4
    Thunder Cross    Void Slash       Apocalypse
      (350 Shards)    (350 Shards)     (350 Shards)
           |              |              |
           └──────────────┼──────────────┘
                          |
                  [CRUCIA MASTERY]
                  Complete all 3 branches
                  Reward: "Marker" Title
                  + Legendary Crucia Effect
                  (Requires 2,100 total Shards invested)
```

**Crucia Branch Details:**

**Strike Branch** (Symbol Enhancement)
| Node | Cost | Prerequisite | Effect |
|------|------|--------------|--------|
| Crimson Glow | 50 Shards | None | X symbols radiate crimson energy |
| Impact Flash | 100 Shards | Crimson Glow | Flash of light on X placement |
| Strike Burst | 200 Shards | Impact Flash | Energy explosion on placement |
| Thunder Cross | 350 Shards | Strike Burst | Lightning strikes form X shape |

**Edge Branch** (Grid Enhancement)
| Node | Cost | Prerequisite | Effect |
|------|------|--------------|--------|
| Sharp Lines | 50 Shards | None | Grid lines become sharp/angular |
| Blade Edge | 100 Shards | Sharp Lines | Grid lines pulse with energy |
| Razor Grid | 200 Shards | Blade Edge | Grid cells have razor-edge effects |
| Void Slash | 350 Shards | Razor Grid | Placement cuts through reality |

**Flame Branch** (Victory Enhancement)
| Node | Cost | Prerequisite | Effect |
|------|------|--------------|--------|
| Ember Trail | 50 Shards | None | Embers follow cursor movement |
| Fire Wake | 100 Shards | Ember Trail | Fire spreads from placed X symbols |
| Inferno Pulse | 200 Shards | Fire Wake | Victory creates ring of fire |
| Apocalypse | 350 Shards | Inferno Pulse | Cataclysmic victory explosion |

### 2.4 Awakened Path (Dual Mastery)

Players who complete BOTH faction skill trees unlock the **Awakened Path**:

**Requirements:**
- Orbis Mastery complete (2,100 Orbs invested)
- Crucia Mastery complete (2,100 Shards invested)
- 50+ wins as each symbol

**Awakened Tree:**

```
              [AWAKENED PATH]
                    |
           ┌───────┼───────┐
           |               |
     [BALANCE NODE]   [UNITY NODE]
     Cost: 5 AC        Cost: 5 AC
           |               |
     [DUALITY NODE]   [TRANSCEND NODE]
     Cost: 8 AC        Cost: 8 AC
           |               |
           └───────┬───────┘
                   |
           [PRIMORDIAL NODE]
           Cost: 1 Primordial Spark
           Effect: Ultimate dual-force aesthetics
           Title: "The Awakened"
```

---

## 3. Gear Progression (Cosmetic Tiers)

### 3.1 Symbol Evolution System

Both O and X symbols progress through five visual tiers:

**O Symbol Tiers:**

| Tier | Name | Cost | Visual Description |
|------|------|------|-------------------|
| 1 | Basic | Free | Simple azure circle |
| 2 | Empowered | 100 Orbs | Circle with spinning inner ring |
| 3 | Radiant | 300 Orbs | Double-ring with particle corona |
| 4 | Celestial | 500 Orbs | Triple-ring system with orbiting satellites |
| 5 | Legendary | 1,000 Orbs + 1 VF | Full planetary system with moons |

**X Symbol Tiers:**

| Tier | Name | Cost | Visual Description |
|------|------|------|-------------------|
| 1 | Basic | Free | Simple crimson cross |
| 2 | Empowered | 100 Shards | Cross with energy vein effects |
| 3 | Radiant | 300 Shards | Pulsing cross with spark discharge |
| 4 | Celestial | 500 Shards | Multi-layered cross with flame effect |
| 5 | Legendary | 1,000 Shards + 1 VF | Burning cruciform with ember trails |

### 3.2 Grid Skin Tiers

| Tier | Example | Cost | Source |
|------|---------|------|--------|
| Common | Void Standard | Free | Default |
| Common | Nebula Background | 1,500 Essence | Shop |
| Uncommon | Azure Depths | 60 Orbs | Orbis Vendor |
| Uncommon | Crimson Forge | 60 Shards | Crucia Vendor |
| Rare | Dark Matter Field | 20 VF | Shop |
| Rare | Starfield Arena | 15 VF | Achievement |
| Epic | Balance Chamber | 12 AC | Awakened Sanctum |
| Legendary | Primordial Nexus | 3 PS | Legendary Vault |

### 3.3 Victory Effect Tiers

| Tier | Effect | Cost | Unlock Method |
|------|--------|------|---------------|
| Common | Simple Glow | Free | Default |
| Uncommon | Particle Burst | 50 Orbs/Shards | Shop |
| Rare | Shockwave | 15 VF | Shop |
| Epic | Reality Tear | 10 AC | Achievement |
| Legendary | Universe Birth | 3 PS | 500+ wins |

### 3.4 Profile Customization Tiers

**Titles:**

| Tier | Title | Unlock Condition |
|------|-------|------------------|
| Free | Initiate | Start playing |
| Common | Challenger | 10 wins |
| Uncommon | Strategist | 50 wins |
| Rare | Tactician | 100 wins |
| Epic | Champion | 250 wins |
| Legendary | Eternal | 500 wins |
| Prestige | Cosmic Master | Level 100 |
| Prestige | The Awakened | Complete Awakened Path |
| Prestige | Eternal One | Prestige 10 |

**Frames:**

| Tier | Frame | Cost/Unlock |
|------|-------|-------------|
| Common | Simple Border | Free |
| Uncommon | Faction Frame | 30 Orbs/Shards |
| Rare | Void Border | 5 VF |
| Epic | Awakened Frame | 5 AC |
| Legendary | Primordial Frame | 2 PS |
| Prestige | Star Frames (1-10) | Prestige levels |

---

## 4. Unlock Timeline

### 4.1 Feature Unlocks by Match Count

| Matches | Feature Unlocked |
|---------|-----------------|
| 1 | Basic gameplay, default cosmetics |
| 5 | Daily challenges system |
| 10 | Skill tree access (both factions) |
| 15 | First AI upgrade (Echoing Acolyte) |
| 25 | Win streak tracking begins |
| 30 | Grid Walker AI |
| 50 | Trading system + Awakened Sanctum access |
| 75 | Weekly challenges system |
| 100 | Force Adept AI + Faction Prestige tiers |
| 150 | Seasonal achievements |
| 200 | The Eternal AI |
| 250 | Event participation unlocks |
| 500 | Prestige Workshop access |

### 4.2 Content Gating Philosophy

**Immediate Access (Match 1):**
- Core gameplay
- Basic cosmetics
- Void Novice AI
- Resource earning

**Early Unlock (Matches 5-25):**
- Challenge systems
- Skill trees
- First AI tiers
- Basic progression rewards

**Mid-Game (Matches 50-150):**
- Trading
- Awakened content
- Weekly systems
- Higher AI tiers

**Late Game (Matches 200+):**
- Final AI opponents
- Prestige systems
- Event content
- Legendary unlocks

---

## 5. Progression Milestones

### 5.1 Match Milestones

| Milestone | Reward | Celebration |
|-----------|--------|-------------|
| First Match | 100 Essence | Tutorial completion |
| 10 Matches | 500 Essence + Common Trail | "Getting Started" badge |
| 25 Matches | 1,000 Essence | "Regular" badge |
| 50 Matches | 2 VF + Trading unlock | Major milestone screen |
| 100 Matches | 1 AC + Faction title eligible | Special celebration |
| 250 Matches | 3 VF + 2 AC | "Dedicated" badge |
| 500 Matches | 1 PS + Prestige eligible | Legendary milestone |
| 1,000 Matches | 2 PS + Exclusive frame | "Eternal Player" badge |

### 5.2 Win Milestones

| Wins | Reward | Title Unlocked |
|------|--------|----------------|
| 1 | 100 Essence | None |
| 10 | 300 Essence | "Challenger" |
| 25 | 500 Essence + 1 VF | None |
| 50 | 1,000 Essence | "Strategist" |
| 100 | 1 PS | "Tactician" |
| 250 | 2 AC + Rare effect | "Champion" |
| 500 | 2 PS + Epic effect | "Eternal" |
| 1,000 | Exclusive legendary set | "Transcendent" |

### 5.3 Streak Milestones

| Streak | Reward | Visual Badge |
|--------|--------|--------------|
| 3 wins | 1 VF | Bronze streak badge |
| 5 wins | 3 VF total | Silver streak badge |
| 7 wins | 5 VF total | Gold streak badge |
| 10 wins | 10 VF + 1 AC | Platinum streak badge |
| 15 wins | 15 VF + 1 PS | Diamond streak badge |
| 20 wins | 20 VF + Exclusive trail | Legendary streak badge |

### 5.4 Collection Milestones

| Collection | Reward |
|------------|--------|
| Own 10 cosmetics | 500 Essence |
| Own 25 cosmetics | 1 VF |
| Own 50 cosmetics | 1 AC |
| Complete Common tier | 2,000 Essence |
| Complete Uncommon tier | 5 VF |
| Complete Rare tier | 3 AC |
| Complete Epic tier | 1 PS |
| Complete Legendary tier | 3 PS + Title "Collector" |
| Own ALL cosmetics | Exclusive "Completionist" frame |

---

## 6. Integration with Combat and Economy

### 6.1 Combat XP Integration

**XP from Combat Performance:**

| Combat Action | XP Bonus |
|---------------|----------|
| Victory | 100 CR base |
| Swift Victory (5 moves) | +50 CR |
| Fork Victory | +25 CR |
| Comeback Victory | +35 CR |
| Perfect Game | +40 CR |
| Draw | 75 CR base |
| Draw vs The Eternal | +50 CR |
| Defeat | 50 CR base |
| Learning defeat (tried new strategy) | +10 CR |

**Impact Score XP Bonus:**
- Impact Score multiplies base XP by 1.0-1.5×
- Higher-tier cosmetics increase Impact Score
- Strategic play creates both visual spectacle AND progression reward

### 6.2 Economy Cost Integration

**Skill Tree Investment Requirements:**

| Path | Total Currency Needed | Matches to Earn (dedicated) |
|------|----------------------|----------------------------|
| Orbis Complete | 2,100 Orbs | ~105 O-wins |
| Crucia Complete | 2,100 Shards | ~105 X-wins |
| Awakened Path | 26 AC + 1 PS | ~30-40 days of balanced play |

**Cosmetic Progression Cost Summary:**

| Tier | Average Cost | Days to Unlock (10 matches/day) |
|------|--------------|--------------------------------|
| Common | 500-1,500 Essence | 1-2 days |
| Uncommon | 30-80 Orbs/Shards | 2-4 days |
| Rare | 5-25 VF | 3-10 days |
| Epic | 5-15 AC | 7-20 days |
| Legendary | 2-4 PS | 2-6 weeks |

### 6.3 Resource Flow into Progression

```
[MATCH PLAYED]
      │
      ├──→ Cosmic Resonance (XP) ──→ Account Level ──→ Level Rewards
      │
      ├──→ Cosmic Essence ──→ Common Purchases + Conversions
      │
      ├──→ Orbs/Shards ──→ Skill Tree Nodes + Faction Items
      │
      └──→ Higher Currencies ──→ Rare+ Tier Unlocks
```

---

## 7. Endgame Progression Systems

### 7.1 Post-Max Level Progression

**Active Endgame Loops:**

1. **Prestige Cycling** (10 times through level 100)
   - Each prestige unlocks exclusive cosmetics
   - Cumulative XP bonuses make subsequent prestiges faster
   - Estimated total: ~500-600 hours of play for max prestige

2. **Collection Completion**
   - Track percentage of all cosmetics owned
   - Pursue limited-time and seasonal items
   - Complete faction collections for exclusive rewards

3. **Mastery Achievements**
   - Perfect game tracking (games won with no opponent 2-in-row)
   - Faction balance tracking (equal wins as O and X)
   - AI mastery (drawing against The Eternal consistently)

### 7.2 Seasonal Progression

**Season Duration:** 3 months

**Season Pass Tiers:** 50 levels

| Season Level | Free Reward | Premium Reward |
|--------------|-------------|----------------|
| 1-10 | Essence (5k total) | + Common seasonal cosmetic |
| 11-20 | Orbs/Shards (200 each) | + Uncommon seasonal cosmetic |
| 21-30 | VF (10 total) | + Rare seasonal cosmetic |
| 31-40 | AC (5 total) | + Epic seasonal cosmetic |
| 41-50 | 1 PS | + Legendary seasonal cosmetic |

**Season XP:** Separate from account XP
- Same earning rates
- Season challenges provide bonus Season XP
- Season pass expires but earned rewards remain

### 7.3 Long-Term Goals

**1-Month Goals (New Player):**
- Reach Level 25
- Complete one skill tree branch
- Own 15+ cosmetics
- Achieve first 5-win streak

**3-Month Goals (Regular Player):**
- Reach Level 50-60
- Complete one full faction skill tree
- Own 40+ cosmetics
- Achieve 10-win streak
- First Epic cosmetic

**6-Month Goals (Dedicated Player):**
- Reach Level 100
- Complete both faction skill trees
- Begin Awakened Path
- First Legendary cosmetic
- First Prestige

**1-Year Goals (Veteran):**
- Prestige 3-5
- Complete Awakened Path
- 80%+ collection
- Multiple Legendary items
- Compete in seasonal rankings

---

## 8. Progression Philosophy

### 8.1 Design Principles

1. **Every Match Matters:** No wasted games—XP, resources, and progress flow from every match
2. **Horizontal Over Vertical:** Power never increases; only visual expression grows
3. **Meaningful Choices:** Skill trees offer real customization paths, not linear unlocks
4. **Respect Player Time:** Casual players progress; dedicated players progress faster
5. **Celebrate Achievement:** Major milestones get major celebrations
6. **Cultural Integration:** Progression reinforces Orbis/Crucia identity
7. **Endless Aspiration:** Prestige and collection systems ensure there's always more

### 8.2 Anti-Frustration Measures

- XP from defeats ensures progress even during losing streaks
- Multiple parallel progression paths (level, skill trees, collections)
- No time-gated daily XP caps
- Catch-up mechanics in seasonal content
- Prestige doesn't remove owned content

### 8.3 Reward Density Guidelines

**Ideal Session (10 matches, ~30 minutes):**
- 1 level gained OR significant progress toward next
- 1-2 skill tree nodes affordable
- Visible collection progress
- At least one "ding" moment (achievement, milestone, or unlock)

---

## Summary

The progression system for Cosmic Tic-Tac-Toe creates satisfying advancement without compromising the game's elegant simplicity:

**Leveling:** 100 levels with Prestige beyond, driven by match performance XP

**Skill Trees:** Dual faction paths (Orbis/Crucia) with meaningful cosmetic choices, culminating in Awakened mastery

**Gear Progression:** Five-tier symbol evolution plus grid skins, victory effects, and profile items

**Unlock Timeline:** Gradual feature access from match 1 through match 500+

**Milestones:** Regular celebration moments across matches, wins, streaks, and collections

**Integration:** Tight coupling with combat (XP sources) and economy (upgrade costs)

**Endgame:** Prestige cycling, collection completion, seasonal content, and mastery achievements

The system transforms a simple game into a journey of cosmic mastery, where every move brings players closer to expressing their unique identity in the eternal battle between Circle and Cross.

---

DECISION: progression_complete
