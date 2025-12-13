# Cosmic Tic-Tac-Toe: Economy Design Document (Revised v2.0)

## Overview

This document establishes the market systems, pricing structures, and economic flow for Cosmic Tic-Tac-Toe. **This revision reconciles all discrepancies identified in the economy simulation and implements recommended tuning adjustments.**

---

## 1. Market System Mechanics

### 1.1 The Cosmic Bazaar (Main Shop)

The primary marketplace where players exchange resources for cosmetic items.

**Structure:**
- **Daily Rotation Shop**: 8 items refresh every 24 hours (2 common, 3 uncommon, 2 rare, 1 featured)
- **Permanent Catalog**: Always-available items organized by category
- **Faction Vendors**: Orbis Emporium (O items) and Crucia Armory (X items)
- **Legendary Vault**: Exclusive items requiring Primordial Sparks
- **Prestige Workshop**: High-cost cosmetic upgrades for veterans

**Purchase Flow:**
```
Player -> Browse Shop -> Select Item -> Confirm Currency -> Receive Item -> Apply Cosmetic
```

### 1.2 The Transmutation Forge (Resource Conversion)

**STANDARDIZED CONVERSION RATES** (Aligned with Resource Design):

| Input | Output | Ratio | Cooldown |
|-------|--------|-------|----------|
| 500 Cosmic Essence | 10 Orbs OR 10 Shards | 50:1 | None |
| 100 Orbs | 1 Void Fragment | 100:1 | None |
| 100 Shards | 1 Void Fragment | 100:1 | None |
| 50 Orbs + 50 Shards | 1 Alignment Crystal | Balanced | 12 hours |
| 5 Void Fragments + 5 Alignment Crystals | 1 Primordial Spark | Ultimate | 7 days |

**Design Note:** Conversion is intentionally expensive to prevent farming exploits. Direct earning through gameplay is always more efficient than conversion.

### 1.3 The Exchange (Player-to-Player Trading)

Limited trading system to prevent exploitation while allowing community interaction.

**Trading Rules:**
- Only Uncommon tier resources (Orbs/Shards) are tradeable
- Maximum 50 units per trade
- 10% transaction tax (resource sink)
- 5 trades per day limit per player
- No direct item trading (resources only)

---

## 2. Pricing Structure

### 2.1 Cosmetic Tier Pricing

| Cosmetic Tier | Primary Currency | Price Range |
|---------------|------------------|-------------|
| Common | Cosmic Essence | 500 - 2,000 |
| Uncommon | Starlight Orbs / Shadow Shards | 30 - 80 |
| Rare | Void Fragments | 5 - 25 |
| Epic | Alignment Crystals | 5 - 15 |
| Legendary | Primordial Sparks | 2 - 4 |

### 2.2 Category-Specific Pricing

**Symbol Trails (visual effects following your symbol):**
- Common Trails: 800 Essence
- Uncommon Trails: 40 Orbs/Shards
- Rare Trails: 10 Void Fragments
- Epic Trails: 8 Alignment Crystals
- Legendary Trails: 2 Primordial Sparks

**Cell Animations (what happens when placing symbols):**
- Common Animations: 600 Essence
- Uncommon Animations: 35 Orbs/Shards
- Rare Animations: 8 Void Fragments
- Epic Animations: 6 Alignment Crystals
- Legendary Animations: 2 Primordial Sparks

**Grid Skins (board appearance):**
- Common Grids: 1,500 Essence
- Uncommon Grids: 60 Orbs/Shards
- Rare Grids: 20 Void Fragments
- Epic Grids: 12 Alignment Crystals
- Legendary Grids: 3 Primordial Sparks

**Victory Effects (spectacular win animations):**
- Common Effects: 1,000 Essence
- Uncommon Effects: 50 Orbs/Shards
- Rare Effects: 15 Void Fragments
- Epic Effects: 10 Alignment Crystals
- Legendary Effects: 3 Primordial Sparks

**Profile Frames & Titles:**
- Common: 500 Essence
- Uncommon: 30 Orbs/Shards
- Rare: 5 Void Fragments
- Epic: 5 Alignment Crystals
- Legendary: 2 Primordial Sparks

### 2.3 Dynamic Pricing Events

**Cosmic Sales (Weekly):**
- Random category 25% off for 48 hours
- Announced in-game 24 hours before

**Faction Wars (Bi-Weekly):**
- Winning faction's items 15% off
- Losing faction's items remain full price
- Encourages playing both symbols

**New Moon Special (Monthly):**
- One legendary item at 50% off
- First-come-first-served (limited quantity)

---

## 3. Money Flow Diagram

### 3.1 Currency Sources (Faucets) - STANDARDIZED

**MATCH REWARDS** (Primary Source - Aligned with Resource Design):
```
MATCH REWARDS
|-- Victory: 100 Essence + 20 Faction Currency (matching symbol)
|-- Defeat: 50 Essence
|-- Draw: 75 Essence + 10 Faction Currency (matching symbol)
|-- Perfect Game (O wins without opponent 2-in-row): 100 Essence + 50 Orbs
|-- Swift Victory (X wins in 5 total moves): 100 Essence + 50 Shards
+-- First Match of Day: +100 Essence bonus
```

**WIN STREAKS** (Secondary Source - Additive Rewards):
```
WIN STREAKS (rewards are cumulative)
|-- 3 Wins: 1 Void Fragment
|-- 5 Wins: +2 Void Fragments (total: 3 VF for 5-win streak)
|-- 10 Wins: +5 Void Fragments + 1 Alignment Crystal (total: 8 VF + 1 AC)
+-- 20 Wins: +10 Void Fragments (total: 18 VF + 1 AC, weekly PS cap applies)
```

**DAILY CHALLENGES** (Tertiary Source):
```
DAILY CHALLENGES
|-- Play 5 Matches: 300 Essence
|-- Win 3 Matches: 200 Essence + 20 Faction Currency (choice)
|-- Win as Both Symbols: 1 Void Fragment
+-- Complete All Dailies: Bonus 200 Essence
```

**WEEKLY CHALLENGES:**
```
WEEKLY CHALLENGES
|-- Complete 7-day login streak: 5 Void Fragments
|-- Win 20 matches: 2 Alignment Crystals
+-- Play 50 matches: 1,000 Essence + 50 Orbs + 50 Shards
```

**ACHIEVEMENTS** (One-Time Sources):
```
|-- First Win: 1,000 Essence
|-- 100 Wins: 1 Primordial Spark
|-- 500 Wins: 2 Primordial Sparks
|-- Master Both Factions (100 wins each): 3 Primordial Sparks
+-- [50+ achievement milestones with varied rewards]
```

### 3.2 Currency Sinks (Drains)

**PRIMARY SINKS:**
```
|-- Cosmetic Purchases: ~70% of all currency spent
|-- Conversion Tax: 5% lost during resource conversion (added)
+-- Trading Tax: 10% of all player trades
```

**SECONDARY SINKS:**
```
|-- Re-rolls: 200 Essence to refresh daily shop early
|-- Name Changes: 5,000 Essence per change
|-- Profile Resets: 10 Void Fragments to reset stats
+-- Faction Switches: 2 Alignment Crystals for instant cooldown reset
```

**FACTION CURRENCY SINKS** (NEW - Addresses Accumulation Issue):
```
|-- Faction Prestige Tiers: 200 Orbs/Shards per tier (5 tiers each)
|-- Faction Exclusive Crafting: 150-250 units per recipe
|-- Event Entry Fees: 50-100 faction currency for special events
+-- Cosmetic Upgrade Kits: 100 Orbs/Shards to add faction glow to owned items
```

**ASPIRATIONAL SINKS:**
```
|-- Ultimate Cosmetic Sets: 4 Primordial Sparks each
|-- Limited Edition Items: Variable high pricing
+-- Prestige Resets: Trade accumulated resources for exclusive frame
```

**ESSENCE PRESTIGE SINKS** (NEW - Addresses Endgame Surplus):
```
|-- "Gilded" upgrade to any common item: 5,000 Essence
|-- "Cosmic Dust" particle effect on uncommon: 10,000 Essence
|-- "Awakened Aura" on rare items: 25,000 Essence
+-- "Legendary Brilliance" enhancement: 50,000 Essence
```

### 3.3 Economic Balance Formula

**Target Daily Flow (Active Player - 10 matches):**
```
Daily Earnings:
- Matches: ~800 Essence (5W/3D/2L split)
- Faction Currency: ~80 Orbs + ~60 Shards
- Daily Challenges: ~700 Essence + ~20 faction
- First Match Bonus: 100 Essence
- Void Fragments: ~1-2 (from streaks/challenges)
TOTAL: ~1,600 Essence, ~140 faction, ~1.5 VF

Daily Spending Opportunities:
- 1-2 Common items: ~800-1,500 Essence
- 1-2 Uncommon items: ~60-100 faction currency
- Faction prestige progress: ~50 faction currency
TOTAL: ~1,500 Essence equivalent

Balance: Slight surplus builds toward rare purchases
```

**Inflation Prevention:**
- Resource caps prevent hoarding (200 VF, 50 AC, 10 PS) - UPDATED
- Conversion is inefficient (always better to earn directly)
- Limited trading prevents resource flooding
- Aspirational and prestige sinks remove excess from veterans
- Seasonal achievements create recurring sinks

---

## 4. Vendor Systems

### 4.1 Cosmic Bazaar Vendor

**Inventory Refresh:**
- Daily items: 24-hour refresh at midnight UTC
- Weekly featured: 7-day refresh on Monday
- Permanent items: Always available

**Stock System:**
- Common items: Unlimited stock
- Uncommon items: 20 copies per refresh (increased from 10)
- Rare items: 10 copies per refresh (increased from 5)
- Epic: 3 copies per refresh
- Legendary: 1 copy per refresh (first-come-first-served)

### 4.2 Faction Vendors

**Orbis Emporium:**
- Accepts only Starlight Orbs
- Specializes in circular/flowing cosmetics
- 15% discount for players with Orbis loyalty (100+ O games played)

**Crucia Armory:**
- Accepts only Shadow Shards
- Specializes in angular/sharp cosmetics
- 15% discount for players with Crucia loyalty (100+ X games played)

**Inventory (Expanded for Sink):**
- 12 permanent faction-exclusive items each
- 3 rotating items (weekly refresh)
- 2 seasonal exclusives (monthly refresh)
- Faction Prestige items (1 per tier, 5 tiers)

### 4.3 The Awakened Sanctum (Dual-Faction Vendor)

**Access Requirements:** Must have played 50+ games as each symbol

**Currency:** Accepts BOTH Orbs AND Shards (requires equal amounts)

**Exclusive Items:**
- Harmony-themed cosmetics blending both aesthetics
- Prices in dual currency (e.g., 75 Orbs + 75 Shards)
- 8 permanent items + 2 monthly exclusives

**Design Note:** Changed from Alignment Crystals to dual faction currency. This reduces competition for AC while creating a sink for accumulated Orbs/Shards.

### 4.4 Prestige Workshop (NEW)

**Purpose:** Endgame Essence sink for veterans

**Available Upgrades:**
- Gilded frame (any common): 5,000 Essence
- Cosmic Dust particles (any uncommon): 10,000 Essence
- Awakened Aura (any rare): 25,000 Essence
- Legendary Brilliance (any epic): 50,000 Essence

**Each upgrade adds visual enhancement to owned cosmetics.**

---

## 5. Player Trading Limitations

### 5.1 Anti-Exploit Measures

**Account Restrictions:**
- Trading unlocks after 50 total matches
- New accounts have 7-day trade cooldown
- Flagged accounts lose trading privileges

**Transaction Limits:**
- Maximum 50 Orbs/Shards per trade
- 5 trades per 24-hour period
- Minimum trade value: 5 units
- Cannot trade with same account twice in 24 hours

**Monitoring:**
- Automated detection of circular trading
- Unusual trade patterns trigger review
- Gift limits prevent real-money trading (RMT)

### 5.2 Trading Interface

```
Trade Request -> Partner Accepts -> Both Select Resources ->
Confirm Trade -> 10% Tax Applied -> Exchange Complete
```

**Trade History:**
- All trades logged for 30 days
- Players can report suspicious trades
- Trade receipts sent to both parties

---

## 6. Economic Milestones by Progression

### 6.1 New Player (0-50 Matches)

**Expected Resources:**
- ~8,000 Cosmic Essence
- ~200 Orbs, ~200 Shards
- ~3-5 Void Fragments
- 0-1 Alignment Crystals

**Affordable Items:**
- 8-12 Common cosmetics
- 3-5 Uncommon cosmetics
- 1 Rare cosmetic (with saving)

**Goals:**
- Customize basic appearance
- Try different symbol aesthetics
- Unlock trading capability

### 6.2 Regular Player (50-200 Matches)

**Expected Resources:**
- ~30,000 Cosmic Essence (after spending)
- ~600 Orbs, ~500 Shards
- ~25 Void Fragments
- 5-8 Alignment Crystals

**Affordable Items:**
- Most common collection
- 12-18 Uncommon cosmetics
- 5-8 Rare cosmetics
- 1-2 Epic cosmetics

**Goals:**
- Build themed loadout
- Explore both faction aesthetics
- Target first Epic item

### 6.3 Dedicated Player (200-500 Matches)

**Expected Resources:**
- ~80,000 Cosmic Essence (after spending)
- ~1,500 Orbs, ~1,500 Shards
- ~60 Void Fragments
- 15-25 Alignment Crystals
- 2-4 Primordial Sparks

**Affordable Items:**
- Complete common/uncommon collections
- 15+ Rare cosmetics
- 5-8 Epic cosmetics
- 1-2 Legendary cosmetics

**Goals:**
- Complete favorite collections
- Acquire signature Legendary
- Max one faction's loyalty + prestige

### 6.4 Veteran Player (500+ Matches)

**Expected Resources:**
- High resource turnover
- Regular spending on prestige upgrades
- 5-10 Primordial Sparks over time

**Affordable Items:**
- Complete or near-complete collections
- Multiple Legendary items with enhancements
- Limited edition exclusives
- Full prestige upgrade paths

**Goals:**
- Collect limited/seasonal items
- Complete achievement cosmetics
- Max prestige enhancements
- Collect Ultimate Cosmetic Sets

---

## 7. Seasonal Economy Events

### 7.1 Cosmic Eclipse (Quarterly Event)

**Duration:** 2 weeks

**Special Currency:** Eclipse Tokens (temporary)

**Earning:**
- 1 Token per match (2 for wins)
- Bonus Tokens from event challenges

**Exclusive Shop:**
- 10 limited cosmetics (never returning)
- Prices: 20-100 Eclipse Tokens

**Post-Event:**
- Unused tokens convert to Essence (10:1)

### 7.2 Faction Wars (Bi-Weekly)

**Duration:** 3 days

**Mechanics:**
- Players choose faction allegiance
- All matches count toward faction score
- Winning faction gets shop discount

**Rewards:**
- Participation: 500 Essence
- Winning faction: +10 Faction Currency
- Top 10% contributors: 2 Void Fragments

### 7.3 Seasonal Achievements (NEW)

**Reset:** Every 3 months with new season

**Repeatable Rewards:**
- Win 50 matches this season: 3 Void Fragments
- Win 100 matches this season: 2 Alignment Crystals
- Complete all seasonal challenges: 1 Primordial Spark

**Purpose:** Creates recurring achievement rewards for veterans who completed one-time achievements.

---

## 8. Storage Caps (UPDATED)

| Resource | Storage Cap | Rationale |
|----------|-------------|-----------|
| Cosmic Essence | Unlimited | Soft currency, always earnable |
| Orbs/Shards | Unlimited | New sinks handle accumulation |
| Void Fragments | **200** (was 100) | Allows saving for sales/events |
| Alignment Crystals | **50** (was 20) | Matches earning rate better |
| Primordial Sparks | 10 | Maintains legendary scarcity |
| Consumables | 10 each | Prevents hoarding |

**Cap Warnings:**
- Visual indicator at 80% capacity
- "Quick spend" suggestions when near cap
- Forced prestige options at cap (optional)

---

## 9. Economic Health Metrics

### 9.1 Monitored Statistics

**Currency Velocity:**
- Track Essence earned vs. spent daily
- Flag if spending drops below 50% of earning
- Target: 70% spend rate

**Faction Currency Flow:**
- Monitor Orbs/Shards accumulation rate
- Flag if average player has 1,000+ of either
- Adjust prestige tier costs if needed

**Conversion Rates:**
- Monitor tier-to-tier conversion frequency
- Track efficiency comparison (conversion vs. earning)

**Item Popularity:**
- Track purchase distribution
- Rebalance if items are never purchased
- Rotate unpopular items out of shop

**Trade Activity:**
- Volume and value of player trades
- Detect and address manipulation

### 9.2 Adjustment Levers

**If inflation detected:**
- Increase cosmetic prices 5-10%
- Add new prestige tiers
- Reduce match rewards slightly (last resort)

**If deflation detected:**
- Introduce double-reward events
- Discount older items
- Add more earning opportunities

---

## Appendix A: Price Quick Reference

| Item Type | Common | Uncommon | Rare | Epic | Legendary |
|-----------|--------|----------|------|------|-----------|
| Symbol Trails | 800E | 40 O/S | 10 VF | 8 AC | 2 PS |
| Cell Animations | 600E | 35 O/S | 8 VF | 6 AC | 2 PS |
| Grid Skins | 1,500E | 60 O/S | 20 VF | 12 AC | 3 PS |
| Victory Effects | 1,000E | 50 O/S | 15 VF | 10 AC | 3 PS |
| Profile Items | 500E | 30 O/S | 5 VF | 5 AC | 2 PS |

**Currency Key:** E = Cosmic Essence, O/S = Orbs/Shards, VF = Void Fragments, AC = Alignment Crystals, PS = Primordial Sparks

---

## Appendix B: Conversion Reference (STANDARDIZED)

| From | To | Rate | Efficiency |
|------|-----|------|------------|
| 500 Essence | 10 Orbs/Shards | 50:1 | ~5 matches worth |
| 100 Orbs/Shards | 1 Void Fragment | 100:1 | ~12 matches worth |
| 50 Orbs + 50 Shards | 1 Alignment Crystal | Balanced | Requires both |
| 5 VF + 5 AC | 1 Primordial Spark | Ultimate | ~100 matches worth |

**Note:** Conversion is intentionally inefficient. Players should always prefer direct earning from matches, streaks, and challenges.

---

## Appendix C: Reconciliation Summary

**Issues Fixed from Economy Simulation:**

1. **Win Rewards**: Standardized to Resource Design values (100E victory, 50E loss, 75E draw)
2. **Conversion Ratios**: Aligned to Resource Design (500E:10 Orbs, 100 Orbs:1 VF)
3. **Streak Rewards**: Clarified as additive (3-win gives 1 VF, 5-win gives 1+2=3 VF total)
4. **Faction Currency Sinks**: Added Prestige Tiers, Crafting, and Dual-Currency Awakened Sanctum
5. **Storage Caps**: Increased VF to 200, AC to 50 to reduce frustration
6. **Essence Endgame Sink**: Added Prestige Workshop upgrades
7. **Seasonal Achievements**: Added repeatable seasonal achievement rewards
8. **Uncommon Item Stock**: Increased from 10 to 20 per refresh
9. **Legendary Profile Items**: Increased from 1 PS to 2 PS for tier consistency

**Design Philosophy:**
- Every match is rewarding
- Resources unlock spectacle, not power
- Playing both symbols yields best outcomes
- Veterans have meaningful long-term goals
- Caps create urgency, not frustration
