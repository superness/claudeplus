# Resource Design Document: Celestial Grid - The Eternal Game

## Overview

This document defines the complete resource system for Celestial Grid, establishing the currencies, materials, and collectibles that drive player progression and unlock the spectacular visual content. All resources are thematically tied to the cosmic lore, emerging from the eternal conflict between Luminara and Voidborn.

---

## 1. Resource Taxonomy

### 1.1 Primary Currencies

| Currency | Faction | Visual | Acquisition | Primary Use |
|----------|---------|--------|-------------|-------------|
| **Lumens** | Luminara | Golden crystalline motes | Wins as Luminara, daily login | Luminara cosmetics, upgrades |
| **Essence** | Voidborn | Purple-black swirling orbs | Wins as Voidborn, daily login | Voidborn cosmetics, upgrades |
| **Stardust** | Neutral | Silver iridescent particles | Draws, achievements, milestones | Universal shop, rare items |
| **Nexus Shards** | Arbiter | Prismatic glass fragments | Special events, challenges | Premium/legendary items |

### 1.2 Resource Tiers

```
TIER 1 - COMMON (Abundant)
├── Spark Fragments (Luminara)
├── Shadow Wisps (Voidborn)
└── Grid Dust (Neutral)

TIER 2 - UNCOMMON (Regular)
├── Dawn Crystals (Luminara)
├── Void Crystals (Voidborn)
└── Balance Stones (Neutral)

TIER 3 - RARE (Scarce)
├── Herald's Light (Luminara)
├── Eclipser's Darkness (Voidborn)
└── Arbiter's Seal (Neutral)

TIER 4 - EPIC (Very Rare)
├── Archon Essence (Luminara)
├── Nullifier Essence (Voidborn)
└── Convergence Core (Neutral)

TIER 5 - LEGENDARY (Extremely Rare)
├── Primordial Light (Luminara)
├── Primordial Void (Voidborn)
└── Grid Heart (Neutral)
```

---

## 2. Acquisition Methods

### 2.1 Match Rewards (Primary Source)

| Outcome | Base Rewards | Streak Bonus |
|---------|--------------|--------------|
| **Victory (Luminara)** | 100 Lumens + 2 Spark Fragments | +10% per consecutive win (max 50%) |
| **Victory (Voidborn)** | 100 Essence + 2 Shadow Wisps | +10% per consecutive win (max 50%) |
| **Draw (Cat's Game)** | 50 Stardust + 1 Balance Stone | +25% if achieved with full board |
| **Loss** | 25 of losing faction currency | None |

**Bonus Conditions:**
- Perfect Victory (no opponent 2-in-a-row): +50% rewards + 1 extra Tier 2 material
- Quick Victory (5 moves or fewer): +25% rewards
- Epic Comeback (won after opponent had 2-in-a-row): +1 Tier 3 material

### 2.2 Daily Login Rewards

| Day | Reward |
|-----|--------|
| Day 1 | 50 Lumens + 50 Essence |
| Day 2 | 100 Grid Dust |
| Day 3 | 2 Dawn Crystals + 2 Void Crystals |
| Day 4 | 75 Stardust |
| Day 5 | 1 Balance Stone |
| Day 6 | 150 Lumens + 150 Essence |
| Day 7 | 1 Nexus Shard + Choice of Tier 3 Material |

### 2.3 Achievement Rewards

| Achievement Category | Reward Type |
|---------------------|-------------|
| First Victory | 500 of chosen faction currency |
| 10/50/100/500 Wins | Escalating Tier 3-4 materials |
| Victory Path Mastery (each of 8 paths) | 1 Arbiter's Seal per path |
| Cat's Game Expert (10 draws) | 1 Convergence Core |
| Faction Devotion (100 wins, single faction) | 1 faction Tier 5 material |
| Perfect Balance (50 wins each faction) | 1 Grid Heart |

### 2.4 Challenge System (Weekly/Monthly)

**Weekly Challenges:**
- Win 5 games using corner strategy → 3 Herald's Light or Eclipser's Darkness
- Achieve 3 draws → 2 Balance Stones
- Win with each victory path → 500 Stardust

**Monthly Challenges:**
- Win 50 games → 1 Archon Essence or Nullifier Essence
- Complete all weekly challenges → 2 Nexus Shards
- Reach new faction rank → Tier 4-5 materials

### 2.5 Drop Rates

| Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--------|--------|--------|--------|--------|--------|
| Standard Victory | 100% | 20% | 2% | 0.1% | 0% |
| Perfect Victory | 100% | 50% | 10% | 1% | 0.05% |
| Draw | 50% | 30% | 5% | 0.5% | 0.01% |
| Daily Login (Day 7) | 100% | 100% | 50% | 10% | 1% |
| Achievements | Varies | Varies | Guaranteed | 50% | 10% |

---

## 3. Conversion & Crafting System

### 3.1 Basic Conversions

**Upward Crafting (5:1 ratio within same faction):**
```
5 Spark Fragments → 1 Dawn Crystal
5 Dawn Crystals → 1 Herald's Light
5 Herald's Light → 1 Archon Essence
5 Archon Essence → 1 Primordial Light
```
(Same structure for Voidborn and Neutral lines)

**Cross-Faction Conversion (at loss):**
```
3 Lumens ↔ 2 Essence (33% loss)
10 Grid Dust → 1 Balance Stone
2 Balance Stones → 1 Arbiter's Seal
```

### 3.2 Crafting Recipes

**Cosmetic Crafting:**

| Item | Recipe | Result |
|------|--------|--------|
| **Basic Piece Skin** | 500 faction currency + 5 Tier 1 materials | Common skin |
| **Enhanced Piece Skin** | 1000 faction currency + 10 Tier 2 materials | Uncommon skin |
| **Radiant/Abyssal Skin** | 2500 currency + 5 Tier 3 + 2 Tier 4 | Rare skin |
| **Legendary Skin** | 5000 currency + 10 Tier 4 + 1 Tier 5 | Legendary skin |

**Effect Crafting:**

| Effect | Recipe | Result |
|--------|--------|--------|
| **Victory Animation** | 3 Tier 3 materials (any faction) | Faction-specific animation |
| **Placement Effect** | 2 Tier 2 + 1 Tier 3 materials | Cell claiming visual |
| **Grid Theme** | 5 Tier 4 materials | Complete grid visual overhaul |
| **Convergence Theme** | 1 of each Tier 5 material | Dual-faction theme (rarest) |

**Special Crafting:**

| Item | Recipe | Result |
|------|--------|--------|
| **Faction Title** | 10 Tier 3 faction materials | Display title |
| **Arbiter's Blessing** | 3 Arbiter's Seals | Double rewards for 10 matches |
| **Grid Heart Amulet** | 1 Grid Heart | Permanent +5% all rewards |

### 3.3 Deconstruction (Resource Sinks)

Players can deconstruct unwanted cosmetics:
- Common items: 25% of crafting cost returned
- Uncommon items: 30% returned
- Rare items: 35% returned
- Legendary items: Cannot deconstruct (prevents regret)

---

## 4. Storage & Inventory System

### 4.1 Wallet (Currencies)

No storage limit on primary currencies:
- Lumens: Unlimited
- Essence: Unlimited
- Stardust: Unlimited
- Nexus Shards: Unlimited

### 4.2 Material Inventory

| Tier | Stack Limit | Excess Handling |
|------|-------------|-----------------|
| Tier 1 | 999 | Auto-convert to Tier 2 |
| Tier 2 | 500 | Auto-convert to Tier 3 |
| Tier 3 | 100 | Warning, must craft or convert |
| Tier 4 | 25 | Warning, must craft or convert |
| Tier 5 | 5 | Cannot exceed, must use |

### 4.3 Cosmetic Collection

- All unlocked cosmetics stored permanently
- Collection tracking shows completion percentage
- "Showcase" feature for displaying favorites

### 4.4 Inventory UI Integration

```
┌─────────────────────────────────────────────────────────┐
│  COSMIC VAULT                                           │
├─────────────────────────────────────────────────────────┤
│  CURRENCIES                                             │
│  ☀ Lumens: 12,500    ● Essence: 8,750                  │
│  ★ Stardust: 2,340   ◇ Nexus Shards: 15               │
├─────────────────────────────────────────────────────────┤
│  MATERIALS                    [Luminara] [Voidborn] [Neutral]
│  ┌────────────────────────────────────────────────────┐│
│  │ Tier 1: ████████░░ (245/999)                       ││
│  │ Tier 2: ██████░░░░ (156/500)                       ││
│  │ Tier 3: ███░░░░░░░ (34/100)                        ││
│  │ Tier 4: █░░░░░░░░░ (7/25)                          ││
│  │ Tier 5: ░░░░░░░░░░ (1/5)                           ││
│  └────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  COLLECTION: 47% Complete                              │
│  [Skins] [Animations] [Effects] [Themes] [Titles]      │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Resource Flow Between Systems

### 5.1 Resource Economy Flow

```
                    ┌─────────────────┐
                    │   MATCH PLAY    │
                    │  (Source)       │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  Lumens    │  │  Essence   │  │  Stardust  │
     │ (Luminara) │  │ (Voidborn) │  │ (Neutral)  │
     └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                  ┌────────────────┐
                  │   CRAFTING     │
                  │   STATION      │
                  └────────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   COSMETIC   │  │   EFFECT     │  │   BOOST      │
│    SHOP      │  │    SHOP      │  │   ITEMS      │
│ (Visual      │  │ (Animations, │  │ (Temporary   │
│  Upgrades)   │  │  Particles)  │  │  Bonuses)    │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 5.2 Integration with Progression System

| Progression Milestone | Resource Unlock |
|----------------------|-----------------|
| Faction Rank: Spark/Flicker | Access to Tier 1-2 crafting |
| Faction Rank: Kindled/Shadow | Access to Tier 3 crafting |
| Faction Rank: Illuminated/Darkened | Access to Tier 4 crafting |
| Faction Rank: Herald/Eclipser | Access to Tier 5 crafting |
| Faction Rank: Archon/Nullifier | Legendary recipe access |
| Faction Rank: Primordial | Master crafter (reduced costs) |

### 5.3 Integration with Combat/Match System

**Pre-Match:**
- Equip cosmetics purchased with resources
- Apply temporary boost items

**During Match:**
- Visual effects reflect equipped cosmetics
- Cell placement shows purchased effects
- Victory/defeat animations from collection

**Post-Match:**
- Rewards distributed based on outcome
- Bonus calculations applied
- Streak bonuses tracked
- Resources added to inventory

### 5.4 Integration with Economy System

**Currency Sinks (Preventing Inflation):**
1. Cosmetic purchases (permanent drain)
2. Crafting costs (material consumption)
3. Cross-faction conversion loss (33% penalty)
4. Premium items requiring Nexus Shards
5. Limited-time event items with high costs

**Currency Sources (Controlled Inflow):**
1. Match rewards (primary)
2. Daily login (secondary)
3. Achievements (one-time)
4. Weekly/monthly challenges (renewable)
5. Special events (limited)

---

## 6. Initial Balance Numbers

### 6.1 Economy Targets

**Session Economics (assumed 10-minute average game):**
- Average earnings per hour: 600-800 faction currency
- Time to first cosmetic unlock: 30-60 minutes
- Time to rare cosmetic: 5-10 hours
- Time to legendary: 50-100 hours

### 6.2 Pricing Structure

| Item Rarity | Currency Cost | Material Cost |
|-------------|---------------|---------------|
| Common | 250-500 | 3-5 Tier 1 |
| Uncommon | 750-1500 | 5-10 Tier 2 |
| Rare | 2000-4000 | 3-5 Tier 3 + 1-2 Tier 4 |
| Epic | 5000-8000 | 5-10 Tier 4 + 1-2 Tier 5 |
| Legendary | 10000-15000 | 10+ Tier 4 + 2-3 Tier 5 |

### 6.3 Drop Rate Calibration

**Target Acquisition Rates:**
- Tier 1: Multiple per session (abundance)
- Tier 2: 1-3 per session (regular)
- Tier 3: 1 per 5-10 sessions (anticipation)
- Tier 4: 1 per 20-50 sessions (excitement)
- Tier 5: 1 per 100+ sessions (celebration)

### 6.4 Conversion Efficiency

**Crafting Path Analysis:**
- Pure farming path: 625 Tier 1 → 1 Tier 5 (5^4 ratio)
- Mixed path (achievements + farming): ~200-300 Tier 1 equivalent
- Recommended: Combination of natural acquisition + crafting

---

## 7. Resource Visual Design

### 7.1 Currency Appearance

| Currency | Icon | Color | Particle Effect |
|----------|------|-------|-----------------|
| Lumens | Radiating sun | Gold/amber | Warm glow, floating motes |
| Essence | Spiral void | Purple/black | Dark energy tendrils |
| Stardust | Star constellation | Silver/white | Twinkling sparkles |
| Nexus Shards | Prismatic crystal | Rainbow/iridescent | Color-shifting gleam |

### 7.2 Material Appearance by Tier

| Tier | Shape | Size | Visual Complexity |
|------|-------|------|-------------------|
| Tier 1 | Small fragments | Tiny | Simple, single color |
| Tier 2 | Geometric crystals | Small | Two-tone, subtle glow |
| Tier 3 | Complex formations | Medium | Animated, internal light |
| Tier 4 | Ornate artifacts | Large | Particle aura, pulsing |
| Tier 5 | Cosmic relics | Very large | Reality-bending effects |

### 7.3 Collection Animations

**Acquisition Effects:**
- Currency: Streams into wallet counter
- Tier 1-2: Quick flash and stack
- Tier 3-4: Dramatic reveal with sound
- Tier 5: Full-screen celebration, narrator announcement

---

## 8. Special Event Resources

### 8.1 Seasonal Currencies

| Event | Currency | Duration | Exchange Rate |
|-------|----------|----------|---------------|
| First Dawn Festival | Dawn Tokens | 2 weeks | 100 = 1 Nexus Shard |
| Eclipse Celebration | Eclipse Tokens | 2 weeks | 100 = 1 Nexus Shard |
| Convergence Event | Harmony Tokens | 1 week | 50 = 1 Convergence Core |
| Anniversary | Cosmic Tokens | 1 month | 200 = choice of Tier 5 |

### 8.2 Event-Exclusive Materials

- Cannot be crafted, only earned during events
- Used for event-exclusive cosmetics
- Expire 2 weeks after event ends (prevents hoarding)
- Unconverted materials refund partial Stardust

---

## 9. Anti-Exploitation Measures

### 9.1 Earning Caps

- Daily match reward cap: 5000 faction currency
- Weekly challenge completion: Once per challenge
- Achievement rewards: One-time only
- Login rewards: Resets after 7-day cycle

### 9.2 Trade Restrictions

- No player-to-player trading (prevents RMT)
- Cross-faction conversion: 24-hour cooldown after large conversions
- Crafting: No reverse crafting (Tier 3 → Tier 2 impossible)

### 9.3 Integrity Measures

- Win-trading detection (repeated matches with same opponent)
- Intentional loss farming prevention (minimum game actions required)
- Bot detection through gameplay patterns

---

## 10. Summary

The Celestial Grid resource system provides:

1. **Thematic Integration**: All resources tie directly to Luminara/Voidborn lore
2. **Clear Progression**: Tiered materials create satisfying advancement
3. **Meaningful Choices**: Cross-faction conversion and crafting trees
4. **Balanced Economy**: Multiple sinks prevent currency inflation
5. **Engagement Loops**: Daily, weekly, monthly reward cycles
6. **Visual Spectacle**: Resources themselves are part of the visual experience
7. **Fair F2P Model**: All gameplay content earnable through play

Resources support the core fantasy: players accumulating cosmic power through eternal conflict, spending that power to customize their representation in the grand battle between light and void.

---

*This resource design ensures the spectacular visual content has a satisfying acquisition journey while maintaining economy health through balanced sinks and sources.*
