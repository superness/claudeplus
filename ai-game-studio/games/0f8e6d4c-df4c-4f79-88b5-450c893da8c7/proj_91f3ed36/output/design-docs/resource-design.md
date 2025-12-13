# Resource Design Document: Cosmic Tic-Tac-Toe - The Eternal Grid

## Overview

This document defines the resource systems that fuel progression, cosmetics, and engagement in Cosmic Tic-Tac-Toe. Given the game's elegant simplicity, resources serve to reward play without complicating core mechanics. Resources primarily unlock visual spectacle enhancements, allowing players to personalize their cosmic avatar experience.

---

## Resource Taxonomy

### Tier 1: Essence (Common Currency)

**Cosmic Essence** - The fundamental resource
- **Acquisition**: Earned from every completed match
- **Drop Rate**:
  - Victory: 100 Essence
  - Draw: 75 Essence
  - Defeat: 50 Essence
  - First match of day: +100 bonus
- **Purpose**: Base currency for common purchases
- **Visual**: Shimmering particles of mixed azure/crimson energy
- **Storage**: Unlimited accumulation

---

### Tier 2: Aligned Currencies (Uncommon)

**Orbs** (Orbis-aligned currency)
- **Acquisition**: Victories as O player, completing Orbis challenges
- **Drop Rate**:
  - O Victory: 20 Orbs
  - Perfect O Game (win without opponent getting 2-in-a-row): 50 Orbs
  - Draw as O: 10 Orbs
- **Purpose**: Orbis-themed cosmetics, circle animation upgrades
- **Visual**: Crystallized spheres of azure energy
- **Conversion**: 500 Essence → 10 Orbs

**Shards** (Crucia-aligned currency)
- **Acquisition**: Victories as X player, completing Crucia challenges
- **Drop Rate**:
  - X Victory: 20 Shards
  - Swift X Victory (win in 5 total moves): 50 Shards
  - Draw as X: 10 Shards
- **Purpose**: Crucia-themed cosmetics, cross animation upgrades
- **Visual**: Jagged fragments of crimson energy
- **Conversion**: 500 Essence → 10 Shards

---

### Tier 3: Rare Materials

**Void Fragments**
- **Acquisition**: Win streaks, special events
- **Drop Rate**:
  - 3-win streak: 1 Void Fragment
  - 5-win streak: 3 Void Fragments
  - 10-win streak: 10 Void Fragments
  - Weekly challenge completion: 5 Void Fragments
- **Purpose**: Grid skins, premium cell effects
- **Visual**: Dark matter particles with energy veins
- **Storage Cap**: 100 maximum (encourages spending)

**Alignment Crystals**
- **Acquisition**: Complete both Orbis and Crucia daily challenges
- **Drop Rate**: 1 Crystal per dual completion
- **Purpose**: Awakened cosmetics (dual-force themes)
- **Visual**: Perfectly balanced crystal, half azure/half crimson
- **Storage Cap**: 20 maximum

---

### Tier 4: Legendary Currency

**Primordial Spark**
- **Acquisition**:
  - Season pass milestones
  - First completion of each achievement tier
  - Extremely rare match drops (0.1% victory chance)
- **Purpose**: Legendary effects, exclusive grid transformations
- **Visual**: Pure white energy with both forces swirling within
- **Storage Cap**: 10 maximum
- **Conversion**: Cannot be converted; earned only

---

## Consumables

### Match Boosters (Single Use)

**Essence Amplifier**
- **Effect**: 2x Essence earned from next match
- **Cost**: 200 Essence
- **Duration**: 1 match

**Streak Shield**
- **Effect**: Protects win streak once on loss
- **Cost**: 1 Void Fragment
- **Duration**: Until consumed

**Dual Affinity**
- **Effect**: Earn both Orbs AND Shards regardless of symbol played
- **Cost**: 1 Alignment Crystal
- **Duration**: 3 matches

---

## Crafting/Conversion System

### Basic Conversions

| Input | Output | Ratio |
|-------|--------|-------|
| 500 Cosmic Essence | 10 Orbs | 50:1 |
| 500 Cosmic Essence | 10 Shards | 50:1 |
| 100 Orbs | 1 Void Fragment | 100:1 |
| 100 Shards | 1 Void Fragment | 100:1 |
| 50 Orbs + 50 Shards | 1 Alignment Crystal | Balanced |
| 5 Void Fragments + 5 Alignment Crystals | 1 Primordial Spark | Ultimate |

### Cosmetic Crafting

| Recipe | Result |
|--------|--------|
| 200 Orbs | Azure Symbol Trail (O animation) |
| 200 Shards | Crimson Symbol Trail (X animation) |
| 3 Void Fragments | Dark Matter Cell Skin |
| 2 Alignment Crystals | Awakened Victory Effect |
| 1 Primordial Spark | Legendary Grid Theme |

---

## Resource Sinks

### Primary Sinks (Prevent Inflation)

1. **Cosmetic Shop**: Rotating inventory of effects, animations, grid skins
2. **Season Battle Pass**: Premium track requires Essence investment
3. **Crafting System**: Converting up consumes large quantities
4. **Limited-Time Events**: Event currencies created from base resources

### Secondary Sinks

1. **Match Boosters**: Consumable purchases
2. **Challenge Unlocks**: Some challenges cost Essence to attempt
3. **Profile Customization**: Titles, borders, avatars

### Resource Flow Diagram

```
[MATCH PLAYED]
      │
      ▼
┌─────────────────────────────────┐
│        Cosmic Essence           │ ←── Base reward from all matches
└─────────────────────────────────┘
      │                    │
      ▼                    ▼
 ┌─────────┐         ┌─────────┐
 │  Orbs   │         │ Shards  │ ←── Win/challenge rewards (aligned)
 └─────────┘         └─────────┘
      │                    │
      └────────┬───────────┘
               ▼
      ┌─────────────────┐
      │ Void Fragments  │ ←── Win streaks, conversions
      └─────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────────┐  ┌─────────────────┐
│  Alignment   │  │ Primordial Spark│ ←── Ultimate reward
│  Crystals    │  └─────────────────┘
└──────────────┘
```

---

## Inventory & Storage

### Storage System

- **Cosmic Essence**: Unlimited (soft currency, always earnable)
- **Orbs/Shards**: Unlimited (encourages specialization)
- **Void Fragments**: Cap 100 (creates urgency to craft/spend)
- **Alignment Crystals**: Cap 20 (rare, meaningful)
- **Primordial Sparks**: Cap 10 (legendary scarcity)
- **Consumables**: 10 of each type maximum

### Inventory Interface

- Single unified currency display (always visible)
- Expandable drawer showing all resources
- Visual indicators when near caps
- Quick-craft suggestions when at capacity

---

## System Integration

### Economy System Integration

- Essence is primary economy driver
- Shop prices balanced around ~10 matches per common item
- Premium items require multi-session accumulation
- Dual currencies prevent "solved" farming (must play both symbols)

### Combat/Match System Integration

- All matches reward resources (no wasted time)
- Victory rewards scaled but defeat still meaningful
- Streak system adds excitement without punishing casual play
- Symbol played affects resource type earned

### Progression System Integration

- Resources unlock cosmetic tiers
- Achievement milestones provide resource bursts
- Season system resets provide catchup mechanics
- Collection completion offers Spark rewards

### Culture System Integration

- Orbis players naturally accumulate Orbs
- Crucia players naturally accumulate Shards
- Playing both creates balanced resource profile
- Awakened cosmetics require true balance

---

## Initial Balance Numbers

### Daily Expected Earnings (Active Player)

| Activity | Essence | Orbs | Shards | Other |
|----------|---------|------|--------|-------|
| 10 matches (5W/3D/2L) | ~800 | ~60 | ~40 | - |
| Daily challenges (3) | 300 | 20 | 20 | - |
| First match bonus | 100 | - | - | - |
| **Daily Total** | ~1,200 | ~80 | ~60 | - |

### Shop Pricing Targets

| Tier | Example Item | Price | Matches to Earn |
|------|--------------|-------|-----------------|
| Common | Symbol Color Variant | 500 Essence | ~5 |
| Uncommon | Cell Animation | 100 Orbs/Shards | ~15 |
| Rare | Grid Border Skin | 3 Void Fragments | ~3 days |
| Epic | Victory Effect | 2 Alignment Crystals | ~1 week |
| Legendary | Complete Grid Theme | 1 Primordial Spark | ~2 weeks+ |

### Conversion Economy Check

- Common player can craft 1 Void Fragment per ~6 days of play
- Balanced player (plays both symbols) earns Alignment Crystal every 2-3 days
- Primordial Spark is ~2 week investment minimum

---

## Design Philosophy Notes

1. **Respect Player Time**: Every match is rewarding; no wasted games
2. **Enable Expression**: Resources unlock personal style, not power
3. **Encourage Variety**: Playing both symbols yields better outcomes
4. **Create Meaning**: Caps and rarity make high-tier resources exciting
5. **Maintain Simplicity**: Core game unchanged; resources enhance around it
6. **Cultural Alignment**: Resources reinforce Orbis/Crucia identity
7. **Spectacular Payoff**: Resource spending creates visual spectacle upgrades

---

## Summary

The resource system for Cosmic Tic-Tac-Toe creates meaningful progression without compromising the elegant simplicity of the core game. Five resource tiers provide clear goals:

- **Cosmic Essence** fuels daily engagement
- **Orbs/Shards** reward aligned play and unlock faction cosmetics
- **Void Fragments** reward consistency through streaks
- **Alignment Crystals** reward balanced play across both forces
- **Primordial Sparks** represent ultimate achievement

Resources flow naturally from matches into cosmetic unlocks that enhance the "spectacular super graphics" vision—better particle effects, more dramatic victory sequences, and personalized grid themes. The system respects casual players while giving dedicated players meaningful progression goals.
