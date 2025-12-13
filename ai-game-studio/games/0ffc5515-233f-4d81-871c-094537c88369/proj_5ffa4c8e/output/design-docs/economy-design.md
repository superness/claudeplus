# Economy Design Document: Celestial Grid - The Eternal Game

## Overview

This document defines the complete market and economic systems for Celestial Grid, establishing how players acquire, spend, and trade resources. The economy is designed as a cosmic marketplace where both factions operate distinct but interconnected trading systems, unified under the neutral Arbiter-governed exchange.

---

## 1. Market System Overview

### 1.1 Economic Philosophy

The Celestial Grid economy operates on the principle of **Cosmic Equilibrium**:
- **Luminara markets** emphasize cooperation, fixed fair prices, and collective prosperity
- **Voidborn markets** embrace dynamic pricing, competition, and opportunistic trading
- **Arbiter markets** maintain stability and offer premium goods at regulated prices

### 1.2 Market Structure

```
                    ┌─────────────────────────────────────┐
                    │      THE COSMIC MARKETPLACE         │
                    └───────────────┬─────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ RADIANT BAZAAR  │       │ ARBITER'S NEXUS │       │  SHADOW MARKET  │
│   (Luminara)    │       │    (Neutral)    │       │   (Voidborn)    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ Fixed Prices    │       │ Regulated Prices│       │ Dynamic Prices  │
│ Fair Trade      │       │ Premium Goods   │       │ Supply/Demand   │
│ Bulk Discounts  │       │ Exchange Rates  │       │ Flash Sales     │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 2. Vendor Systems

### 2.1 The Radiant Bazaar (Luminara Market)

**Philosophy**: "All light shares equally"

**Pricing Model**: Fixed prices with bulk discounts

| Vendor | Inventory Type | Refresh Timer | Price Model |
|--------|---------------|---------------|-------------|
| **The Crystal Crafter** | Common/Uncommon skins | 24 hours | Fixed |
| **The Dawn Weaver** | Victory animations | Weekly | Fixed |
| **The Light Keeper** | Boost items | 4 hours | Fixed |
| **The Pattern Sage** | Grid themes | Never (permanent) | Fixed |

**Bulk Discount System**:
```
Buy 1-4 items:   Base price
Buy 5-9 items:   5% discount
Buy 10-19 items: 10% discount
Buy 20+ items:   15% discount (maximum)
```

**Luminara Vendor Inventory Sample**:

| Item | Currency | Base Price | Stock |
|------|----------|------------|-------|
| Radiant O Skin (Common) | Lumens | 350 | Unlimited |
| Crystalline O Skin (Uncommon) | Lumens | 1,000 | 10/day |
| Dawn Burst Animation | Lumens | 2,500 | 5/week |
| Golden Grid Theme | Lumens + Materials | 5,000 + 5 Herald's Light | 1/month |
| Arbiter's Blessing (10 matches) | Lumens | 1,500 | 3/day |

### 2.2 The Shadow Market (Voidborn Market)

**Philosophy**: "Power flows to the opportunistic"

**Pricing Model**: Dynamic pricing based on supply and demand

| Vendor | Inventory Type | Refresh Timer | Price Model |
|--------|---------------|---------------|-------------|
| **The Void Merchant** | Common/Uncommon skins | 12 hours | Dynamic |
| **The Eclipse Trader** | Victory animations | 3 days | Dynamic |
| **The Entropy Dealer** | Boost items | 2 hours | Dynamic |
| **The Rift Walker** | Grid themes | Weekly | Dynamic |

**Dynamic Pricing Formula**:
```
Current Price = Base Price * Demand Multiplier * Scarcity Multiplier

Demand Multiplier (based on purchases in last 24h):
- 0-10 purchases:   0.85x (discount)
- 11-50 purchases:  1.00x (base)
- 51-100 purchases: 1.15x (moderate demand)
- 101+ purchases:   1.30x (high demand)

Scarcity Multiplier (based on remaining stock):
- 75-100% stock:    1.00x
- 50-74% stock:     1.10x
- 25-49% stock:     1.25x
- 1-24% stock:      1.50x (rare opportunity)
```

**Flash Sales** (Random Events):
- Trigger: Random, 2-4 times per week
- Duration: 1-4 hours
- Discount: 25-50% off select items
- Visual: Purple lightning borders on discounted items
- Notification: Push alert to all Voidborn-aligned players

**Voidborn Vendor Inventory Sample**:

| Item | Currency | Base Price | Current Price Range | Stock |
|------|----------|------------|---------------------|-------|
| Shadow X Skin (Common) | Essence | 400 | 340-520 | Limited |
| Abyssal X Skin (Uncommon) | Essence | 1,100 | 935-1,430 | 15/refresh |
| Void Crush Animation | Essence | 2,800 | 2,380-3,640 | 8/cycle |
| Dark Grid Theme | Essence + Materials | 5,500 + 5 Eclipser's Darkness | Variable | 1/week |
| Shadow Surge (10 matches) | Essence | 1,400 | 1,190-1,820 | 5/refresh |

### 2.3 The Arbiter's Nexus (Neutral Market)

**Philosophy**: "Balance in all transactions"

**Pricing Model**: Regulated fixed prices, premium positioning

| Vendor | Inventory Type | Refresh Timer | Price Model |
|--------|---------------|---------------|-------------|
| **The Balance Keeper** | Cross-faction items | Weekly | Fixed (Stardust) |
| **The Shard Collector** | Legendary items | Monthly | Fixed (Nexus Shards) |
| **The Convergence Merchant** | Dual-theme items | Never | Fixed |
| **The Exchange Master** | Currency conversion | Always open | Fixed rates |

**Arbiter's Nexus Inventory Sample**:

| Item | Currency | Price | Availability |
|------|----------|-------|--------------|
| Neutral O/X Skin Set | Stardust | 3,000 | Always |
| Arbiter's Eye Grid Theme | Stardust | 8,000 | Always |
| Equilibrium Animation (both win/lose) | Nexus Shards | 5 | Always |
| Convergence Piece Set (legendary) | Nexus Shards | 15 | 1/month |
| Grid Heart Cosmetic | Nexus Shards + Grid Heart | 10 + 1 Grid Heart | Always |
| Primordial Title Token | Nexus Shards | 25 | Always |

---

## 3. Currency Exchange System

### 3.1 The Exchange Master (Currency Conversion)

Located in the Arbiter's Nexus, the Exchange Master provides official conversion rates:

**Standard Conversion Rates**:

| From | To | Rate | Direction |
|------|-----|------|-----------|
| Lumens | Essence | 3:2 | Bidirectional |
| Essence | Lumens | 3:2 | Bidirectional |
| Lumens | Stardust | 5:1 | One-way |
| Essence | Stardust | 5:1 | One-way |
| Stardust | Nexus Shards | 500:1 | One-way |

**Conversion Penalties**:
- Standard conversion: 33% loss (3:2 rate means 33% lost)
- Large conversion (5000+ currency): 30% loss (slight improvement)
- Faction loyalty bonus (100+ faction wins): 25% loss

**Daily Conversion Limits**:
- Lumens/Essence exchange: 10,000 per day
- Stardust conversion: 1,000 Stardust output per day
- Nexus Shard conversion: 2 shards per week

### 3.2 Material Exchange

**Material Tier Conversion** (Crafting Station):

```
Within Same Faction (5:1 upward):
5 Tier 1 → 1 Tier 2 (no loss)
5 Tier 2 → 1 Tier 3 (no loss)
5 Tier 3 → 1 Tier 4 (no loss)
5 Tier 4 → 1 Tier 5 (no loss)

Cross-Faction Material Exchange:
3 Luminara materials → 2 Voidborn materials (same tier)
3 Voidborn materials → 2 Luminara materials (same tier)
10 Faction materials → 3 Neutral materials (same tier)
```

---

## 4. Pricing Structure & Formulas

### 4.1 Base Price Matrix

| Rarity | Currency Cost | Material Requirement | Target Acquisition Time |
|--------|---------------|---------------------|------------------------|
| **Common** | 300-500 | 3-5 Tier 1 | 30-45 minutes |
| **Uncommon** | 800-1,500 | 5-10 Tier 2 | 1-2 hours |
| **Rare** | 2,500-4,500 | 3-5 Tier 3 + 1-2 Tier 4 | 5-10 hours |
| **Epic** | 6,000-10,000 | 5-8 Tier 4 + 1-2 Tier 5 | 20-40 hours |
| **Legendary** | 12,000-20,000 | 10+ Tier 4 + 2-3 Tier 5 | 60-120 hours |

### 4.2 Item Category Pricing

**Piece Skins**:
| Rarity | Lumens/Essence | Stardust | Nexus Shards |
|--------|----------------|----------|--------------|
| Common | 400 | N/A | N/A |
| Uncommon | 1,200 | N/A | N/A |
| Rare | 3,500 | 2,000 | N/A |
| Epic | 8,000 | 4,500 | 3 |
| Legendary | 15,000 | 8,000 | 8 |

**Victory Animations**:
| Rarity | Lumens/Essence | Stardust | Nexus Shards |
|--------|----------------|----------|--------------|
| Common | 600 | N/A | N/A |
| Uncommon | 1,500 | N/A | N/A |
| Rare | 4,000 | 2,500 | N/A |
| Epic | 9,000 | 5,000 | 4 |
| Legendary | 18,000 | 10,000 | 10 |

**Grid Themes**:
| Rarity | Lumens/Essence | Stardust | Nexus Shards |
|--------|----------------|----------|--------------|
| Uncommon | 2,000 | N/A | N/A |
| Rare | 5,000 | 3,000 | N/A |
| Epic | 12,000 | 7,000 | 5 |
| Legendary | 25,000 | 15,000 | 15 |

**Titles**:
| Tier | Lumens/Essence | Stardust | Nexus Shards |
|------|----------------|----------|--------------|
| Faction Basic | 500 | N/A | N/A |
| Faction Advanced | 2,000 | N/A | N/A |
| Faction Master | 5,000 | N/A | N/A |
| Neutral | N/A | 1,500 | N/A |
| Legendary | N/A | N/A | 25 |

---

## 5. Money Flow: Sources and Sinks

### 5.1 Currency Sources (Inflow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CURRENCY SOURCES                                │
├──────────────────┬──────────────────┬───────────────────────────────┤
│     SOURCE       │  CURRENCY TYPE   │    HOURLY RATE (avg)          │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ Match Victory    │ Faction Currency │ 600-800/hour (wins only)      │
│ Match Loss       │ Faction Currency │ 150-200/hour (losses only)    │
│ Match Draw       │ Stardust         │ 50-100/hour (draws only)      │
│ Daily Login      │ Mixed            │ ~100 equivalent/day           │
│ Achievements     │ Mixed            │ One-time, varies              │
│ Weekly Challenges│ Mixed            │ ~500 equivalent/week          │
│ Monthly Challenges│ Mixed           │ ~2000 equivalent/month        │
│ Events           │ Event Currency   │ Variable, time-limited        │
└──────────────────┴──────────────────┴───────────────────────────────┘

Average Player Income (balanced play):
- Per Hour: 400-600 faction currency + materials
- Per Day (2 hours): 1,000-1,500 faction currency
- Per Week: 7,000-12,000 faction currency + 500 Stardust
- Per Month: 30,000-50,000 faction currency + 2,000 Stardust
```

### 5.2 Currency Sinks (Outflow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CURRENCY SINKS                                  │
├──────────────────────────────┬──────────────────────────────────────┤
│          SINK TYPE           │            DRAIN RATE                 │
├──────────────────────────────┼──────────────────────────────────────┤
│ Cosmetic Purchases (Primary) │ 60% of all currency spent            │
│ Crafting Material Costs      │ 20% of all currency spent            │
│ Cross-Faction Conversion     │ 10% loss on all conversions          │
│ Boost Item Consumption       │ 8% of all currency spent             │
│ Failed Craft Attempts*       │ 2% (material loss, not currency)     │
└──────────────────────────────┴──────────────────────────────────────┘

*Failed crafts only for experimental/legendary recipes
```

### 5.3 Economic Balance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **First Purchase** | 30-45 minutes | Quick gratification hook |
| **Common Set** (full) | 2-3 hours | Achievable in one session |
| **Uncommon Set** (full) | 8-12 hours | Weekend goal |
| **First Rare** | 10-15 hours | Milestone reward |
| **Epic Item** | 30-50 hours | Significant achievement |
| **Legendary Item** | 80-120 hours | Long-term goal |
| **Complete Collection** | 500+ hours | Dedication reward |

---

## 6. Vendor Inventories & Refresh Timers

### 6.1 Radiant Bazaar Schedules

| Vendor | Refresh Time | Stock Behavior |
|--------|--------------|----------------|
| Crystal Crafter | Daily 00:00 UTC | Full restock |
| Dawn Weaver | Weekly (Monday) | Full restock |
| Light Keeper | Every 4 hours | Full restock |
| Pattern Sage | Never | Permanent stock |

### 6.2 Shadow Market Schedules

| Vendor | Refresh Time | Stock Behavior |
|--------|--------------|----------------|
| Void Merchant | Every 12 hours | Partial restock (50-80%) |
| Eclipse Trader | Every 3 days | Variable restock |
| Entropy Dealer | Every 2 hours | Full restock, prices reset |
| Rift Walker | Weekly (Friday) | Limited items, auction-style |

### 6.3 Arbiter's Nexus Schedules

| Vendor | Refresh Time | Stock Behavior |
|--------|--------------|----------------|
| Balance Keeper | Weekly (Wednesday) | Full restock |
| Shard Collector | Monthly (1st) | Limited legendary rotation |
| Convergence Merchant | Never | Permanent, expensive |
| Exchange Master | Always open | No stock limits |

---

## 7. Economic Progression by Player Level

### 7.1 New Player Economy (0-10 hours)

**Available**:
- Basic faction vendors (Common items only)
- Standard match rewards
- Starter challenges

**Locked**:
- Uncommon+ items require 10 wins
- Shadow Market dynamic pricing (flat prices until 20 wins)
- Cross-faction exchange

**Recommended Purchases**:
1. First skin (Common): ~400 currency, ~45 minutes
2. Basic animation (Common): ~600 currency, ~1 hour
3. First title: ~500 currency, ~50 minutes

### 7.2 Developing Player Economy (10-50 hours)

**Unlocked at 10 hours/50 wins**:
- Uncommon vendor items
- Weekly challenges
- Dynamic pricing participation
- Material tier 1-2 crafting

**Available**:
- Full Radiant Bazaar access
- Shadow Market (with price fluctuation)
- Basic Arbiter's Nexus items

**Recommended Milestones**:
1. Full Common set: ~2,500 currency
2. First Uncommon skin: ~1,200 currency
3. One preferred animation: ~1,500 currency

### 7.3 Experienced Player Economy (50-200 hours)

**Unlocked at 50 hours/200 wins**:
- Rare vendor items
- Monthly challenges
- Cross-faction exchange
- Material tier 3-4 crafting

**Available**:
- Full faction vendor access
- Arbiter's Balance Keeper items
- Event participation with bonuses

**Recommended Milestones**:
1. First Rare item: ~4,000 currency
2. Complete faction theme: ~8,000 currency
3. First Nexus Shard purchase: ~5 shards

### 7.4 Veteran Player Economy (200+ hours)

**Unlocked at 200 hours/500 wins**:
- Epic and Legendary items
- Shard Collector inventory
- Material tier 5 crafting
- Master converter rates

**Available**:
- Complete market access
- Best exchange rates
- Exclusive veteran items
- Event exclusive early access

**Recommended Milestones**:
1. First Epic item: ~8,000 currency
2. Legendary collection progress: ~20,000 currency
3. Grid Heart crafting: ~50+ hours of materials

---

## 8. Player Trading Restrictions

### 8.1 No Direct Player-to-Player Trading

**Design Decision**: Celestial Grid does NOT support direct player trading.

**Rationale**:
1. Prevents real-money trading (RMT) abuse
2. Eliminates scamming opportunities
3. Maintains intended progression pace
4. Simplifies economy balance

### 8.2 Anti-Exploitation Measures

**Earning Caps**:
| Limit Type | Cap | Reset |
|------------|-----|-------|
| Daily faction currency | 8,000 | Daily 00:00 UTC |
| Daily Stardust | 500 | Daily 00:00 UTC |
| Weekly Nexus Shards | 3 | Weekly Monday |
| Daily conversions | 10,000 currency | Daily 00:00 UTC |

**Abuse Prevention**:
- Win-trading detection: Same opponent matches limited to 5/day
- AFK farming prevention: Minimum 3 moves required for rewards
- Bot detection: Behavioral analysis on repetitive patterns
- Match speed monitoring: Sub-3-second games flagged for review

### 8.3 Refund Policy

**Cosmetic Purchases**:
- Within 1 hour of purchase: Full refund (once per item)
- After 1 hour: No refund
- Used boost items: No refund

**Crafted Items**:
- Cannot be uncrafted
- Deconstruction returns 25-35% materials (see Resource Design)

---

## 9. Regional Economy Variations

### 9.1 Faction-Controlled Price Zones

The metaphysical "location" of purchases affects prices:

**Playing as Luminara**:
- Radiant Bazaar: Base prices
- Shadow Market: +15% markup (enemy territory)
- Arbiter's Nexus: Base prices

**Playing as Voidborn**:
- Shadow Market: Base prices (with dynamics)
- Radiant Bazaar: +15% markup (enemy territory)
- Arbiter's Nexus: Base prices

### 9.2 Special Economic Zones

**The Convergence Zone** (during draws):
- All prices reduced 10% for 10 minutes after a draw
- Both faction vendors accessible at base price
- Special "Balance" items available only during this window

**Event Zones** (seasonal):
- Temporary vendors appear during festivals
- Event currency exchange rates
- Time-limited exclusive items

---

## 10. Inflation Prevention Systems

### 10.1 Currency Decay (Soft)

**Not implemented**: No direct currency decay

**Instead**: Value maintained through new content
- Monthly new cosmetics create spending targets
- Seasonal events introduce temporary high-value items
- Legendary releases maintain long-term goals

### 10.2 Material Sinks

**Automatic Conversions**:
- Tier 1 materials auto-convert at 999 cap
- Tier 2 materials auto-convert at 500 cap
- Prevents infinite stockpiling

**Failed Experimental Crafts**:
- Legendary recipes have 80% success rate
- Failed crafts consume 50% of materials

### 10.3 Premium Currency Balance

**Nexus Shard Economy**:
- Hard-capped weekly acquisition (3/week)
- High-value permanent items create constant demand
- Cannot be converted to other currencies
- Event-exclusive items rotate out, maintaining scarcity

---

## 11. Money Flow Diagrams

### 11.1 Complete Economic Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CELESTIAL GRID ECONOMY                           │
└──────────────────────────────────────────────────────────────────────────┘

                              SOURCES
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
    ▼                            ▼                            ▼
┌─────────┐                ┌─────────┐                ┌─────────────┐
│ MATCHES │                │ LOGINS  │                │ CHALLENGES  │
│ 70% of  │                │ 10% of  │                │ 15% of      │
│ inflow  │                │ inflow  │                │ inflow      │
└────┬────┘                └────┬────┘                └──────┬──────┘
     │                          │                            │
     └──────────────────────────┼────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    PLAYER WALLET      │
                    │  ┌───────┐ ┌───────┐  │
                    │  │Lumens │ │Essence│  │
                    │  └───────┘ └───────┘  │
                    │  ┌─────────┐ ┌──────┐ │
                    │  │Stardust │ │Shards│ │
                    │  └─────────┘ └──────┘ │
                    └───────────┬───────────┘
                                │
    ┌───────────────────────────┼───────────────────────────┐
    │                           │                           │
    ▼                           ▼                           ▼
┌─────────┐              ┌─────────────┐             ┌─────────────┐
│COSMETICS│              │  CRAFTING   │             │   BOOSTS    │
│  60%    │              │    20%      │             │    8%       │
│  sink   │              │    sink     │             │   sink      │
└─────────┘              └─────────────┘             └─────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌─────────────┐
              │CONVERSION│ │ FAILED  │ │  TEMPORARY  │
              │  LOSS    │ │ CRAFTS  │ │   ITEMS     │
              │   10%    │ │   2%    │ │  (consumed) │
              └─────────┘ └─────────┘ └─────────────┘
```

### 11.2 Faction Economy Flow

```
LUMINARA PLAYER                              VOIDBORN PLAYER
      │                                            │
      ▼                                            ▼
┌─────────────┐                            ┌─────────────┐
│   EARNS     │                            │   EARNS     │
│   LUMENS    │                            │   ESSENCE   │
└──────┬──────┘                            └──────┬──────┘
       │                                          │
       ▼                                          ▼
┌──────────────┐                          ┌──────────────┐
│   RADIANT    │──── Cross-Faction ────── │   SHADOW     │
│   BAZAAR     │     Exchange (33%        │   MARKET     │
│  (Base Price)│◄────   loss)   ────────► │ (Dynamic)    │
└──────┬───────┘                          └──────┬───────┘
       │                                          │
       └────────────────┬─────────────────────────┘
                        │
                        ▼
               ┌────────────────┐
               │  ARBITER'S     │
               │    NEXUS       │
               │  (Stardust &   │
               │  Nexus Shards) │
               └────────────────┘
```

---

## 12. Summary

The Celestial Grid economy creates distinct shopping experiences that reflect faction philosophies:

1. **Luminara Economy**: Stable, predictable, rewards patience and bulk buying
2. **Voidborn Economy**: Dynamic, opportunistic, rewards timing and market awareness
3. **Arbiter Economy**: Premium, neutral, rewards long-term dedication

**Key Design Principles**:
- First cosmetic achievable in 30-45 minutes
- No pay-to-win elements (all purchases cosmetic)
- Conversion penalties prevent currency arbitrage
- Regional pricing adds strategic depth to faction choice
- Inflation controlled through content rotation, not currency decay

The economy supports the spectacular visual nature of the game by making cosmetics the primary value proposition while maintaining fair progression for free players.

---

*This economy design ensures the marketplace feels thematically appropriate to each faction while maintaining overall economic health and preventing exploitation.*
