# Combat Design Document: Cosmic Tic-Tac-Toe - The Eternal Grid

## Overview

Combat in Cosmic Tic-Tac-Toe is a turn-based strategic duel where two players channel primordial cosmic forces across the Sacred Nine—a 3x3 grid of pure dimensional potential. This is not mere symbol placement; each move is a channeling of cosmic power that transforms reality itself with spectacular visual consequences.

---

## Core Combat Mechanics

### Combat Type: Turn-Based Strategic Duel

**System**: Synchronous turn-based with alternating control
**Players**: 2 (Orbis channeler vs. Crucia channeler)
**Objective**: Align three symbols in any row, column, or diagonal
**Match Duration**: 5-9 turns (minimum 5 moves for a victory, maximum 9 for a draw)

### The Grid as Battlefield

| Cell Position | Strategic Value | Cosmic Name |
|---------------|-----------------|-------------|
| Center (1,1) | Highest—connects to all lines | Nexus Core |
| Corners (0,0), (0,2), (2,0), (2,2) | High—two potential alignments each | Anchor Points |
| Edges (0,1), (1,0), (1,2), (2,1) | Medium—one potential alignment each | Bridge Cells |

**Cell States**:
- **Void** (unclaimed): Dark matter with subtle energy shimmer
- **Orbis-Claimed**: Azure energy sphere with orbital particle rings
- **Crucia-Claimed**: Crimson cross with intersecting energy beams

---

## Turn Structure

### Phase 1: Channeling Focus (0.5-3 seconds)
- Player selects target cell
- Cosmic energy begins gathering around avatar
- Visual: Particles swirl toward player's position

### Phase 2: Symbol Manifestation (1-2 seconds)
- Symbol materializes in selected cell
- Cell transforms from void to claimed state
- Visual: Spectacular energy explosion radiates from cell

### Phase 3: Resonance Check (0.5 seconds)
- System checks for three-symbol alignment
- If alignment detected → Victory Cascade triggered
- If no alignment → Control passes to opponent

### Phase 4: Power Buildup
- Each placed symbol increases ambient energy level
- Visual intensity escalates with each turn
- By turn 7+, the entire grid crackles with cosmic power

---

## Combat Abilities

### Passive Abilities (Always Active)

**Orbis Channelers**:

| Ability | Effect | Visual |
|---------|--------|--------|
| Orbital Resonance | Placed O symbols emit healing azure light | Soft pulsing glow |
| Completion Aura | +5% bonus Essence when achieving alignment | Golden ring burst |
| Defensive Harmony | Draw matches feel more rewarding (extra particles) | Balanced energy waves |

**Crucia Channelers**:

| Ability | Effect | Visual |
|---------|--------|--------|
| Strike Momentum | X placements create sharper impact effects | Energy shockwave |
| Victory Surge | +5% bonus Shards for wins under 7 moves | Crimson lightning |
| Aggressive Pressure | First-move advantage feels more powerful | Dramatic entry animation |

### Active Cosmetic Abilities (Resource-Purchased)

These abilities consume no gameplay resources but require cosmetic unlocks:

| Ability | Cost | Effect | Duration |
|---------|------|--------|----------|
| **Trail of Azure** | 200 Orbs | O placement leaves orbital trail | Permanent unlock |
| **Crimson Slash** | 200 Shards | X slashes through cell before solidifying | Permanent unlock |
| **Void Echo** | 3 Void Fragments | All symbols pulse with dark energy | Permanent unlock |
| **Awakened Presence** | 2 Alignment Crystals | Symbol placement shows both forces briefly | Permanent unlock |
| **Primordial Manifestation** | 1 Primordial Spark | Victory creates legendary particle explosion | Permanent unlock |

### Symbol Enhancement Tiers

**O Symbol Evolutions** (Orb purchases):

| Tier | Cost | Visual Enhancement |
|------|------|-------------------|
| Basic | Free | Simple azure circle |
| Empowered | 100 Orbs | Circle with spinning inner ring |
| Radiant | 300 Orbs | Double-ring with particle corona |
| Celestial | 500 Orbs | Triple-ring system with orbiting satellites |
| Legendary | 1000 Orbs + 1 VF | Full planetary system with moons |

**X Symbol Evolutions** (Shard purchases):

| Tier | Cost | Visual Enhancement |
|------|------|-------------------|
| Basic | Free | Simple crimson cross |
| Empowered | 100 Shards | Cross with energy vein effects |
| Radiant | 300 Shards | Pulsing cross with spark discharge |
| Celestial | 500 Shards | Multi-layered cross with flame effect |
| Legendary | 1000 Shards + 1 VF | Burning cruciform with ember trails |

---

## Damage Calculation System

Since Cosmic Tic-Tac-Toe is purely strategic (no HP systems), "damage" is expressed through **Cosmic Impact Scores**—a visual feedback system that rewards skillful play.

### Impact Score Calculation

```
Base Impact = Cell_Value × Symbol_Tier × Combo_Multiplier

Where:
- Cell_Value: Center=3, Corner=2, Edge=1
- Symbol_Tier: Basic=1.0, Empowered=1.2, Radiant=1.5, Celestial=2.0, Legendary=3.0
- Combo_Multiplier: 1.0 + (0.2 × consecutive_strategic_placements)
```

### Strategic Placement Bonuses

| Move Type | Impact Bonus | Description |
|-----------|--------------|-------------|
| Fork Creation | +50% | Placing symbol creates two winning threats |
| Block | +25% | Preventing opponent's winning move |
| Center Control | +30% | First claim of Nexus Core |
| Corner Sequence | +20% | Claiming opposing corners |
| Swift Victory | +100% | Winning in exactly 5 moves |

### Victory Impact Calculation

```
Total_Victory_Impact = Sum(All_Move_Impacts) × Victory_Multiplier

Victory_Multiplier:
- Standard Win: 1.5×
- Swift Win (5 moves): 2.5×
- Fork Win (unavoidable victory): 2.0×
- Comeback Win (was 1 move from losing): 3.0×
```

**Impact Score Effects**:
- Determines intensity of victory particle explosion
- Influences screen shake duration
- Scales victory music crescendo
- Affects post-match celebration animation length

---

## Enemy Bestiary (AI Opponents)

### AI Difficulty Tiers

**Tier 1: Void Novice** (Beginner AI)
- **Behavior**: Random valid moves
- **Pattern**: No strategic awareness
- **Win Rate Target**: Player wins 90%+
- **Visual**: Dim, hesitant symbol manifestation
- **Reward Multiplier**: 0.5×

**Tier 2: Echoing Acolyte** (Easy AI)
- **Behavior**: Blocks immediate wins, otherwise random
- **Pattern**: Reactive only
- **Win Rate Target**: Player wins 70-80%
- **Visual**: Standard energy manifestation
- **Reward Multiplier**: 0.75×

**Tier 3: Grid Walker** (Normal AI)
- **Behavior**: Classic minimax to depth 2
- **Pattern**: Takes center, blocks wins, takes winning moves
- **Win Rate Target**: Player wins 50-60%
- **Visual**: Confident energy pulses
- **Reward Multiplier**: 1.0×

**Tier 4: Force Adept** (Hard AI)
- **Behavior**: Full minimax algorithm
- **Pattern**: Optimal play—always draws or wins
- **Win Rate Target**: Player draws most games
- **Visual**: Intense, crackling energy
- **Reward Multiplier**: 1.5×

**Tier 5: The Eternal** (Perfect AI)
- **Behavior**: Minimax with strategic move ordering
- **Pattern**: Plays optimally with dramatic timing
- **Win Rate Target**: Player cannot win (draws possible)
- **Visual**: Overwhelming cosmic presence
- **Reward Multiplier**: 2.0×

### Special Event AI Opponents

| Name | Behavior | Special Visual | Unlock Condition |
|------|----------|----------------|------------------|
| **The First Circle** | Orbis champion—defensive mastery | Azure constellation avatar | Reach Circler rank |
| **The Intersection** | Crucia champion—aggressive perfection | Crimson blade avatar | Reach Marker rank |
| **The Awakened One** | Alternates between both styles | Dual-force avatar | Own Awakened cosmetic |
| **Void Incarnate** | Plays from shadows—moves unclear until placed | Dark matter form | Collect 100 Void Fragments |
| **The Grid Itself** | Neutral—plays to create most spectacular draws | Pure energy form | 100 draws achieved |

---

## Loot Drop Tables

### Match Completion Rewards

**Victory Rewards**:

| Resource | Base Drop | Streak Bonus | Perfect Game Bonus |
|----------|-----------|--------------|-------------------|
| Cosmic Essence | 100 | +10 per streak level | +50 |
| Orbs (if O) | 20 | +5 per streak level | +30 |
| Shards (if X) | 20 | +5 per streak level | +30 |
| Void Fragment | 0 (streak rewards) | 1 at 3-streak, 3 at 5-streak | — |

**Draw Rewards**:

| Resource | Base Drop | Notes |
|----------|-----------|-------|
| Cosmic Essence | 75 | Draws are honorable |
| Orbs/Shards | 10 (played symbol) | Still earns alignment |
| Alignment Crystal | 0.5% chance | Rare draw bonus |

**Defeat Rewards**:

| Resource | Base Drop | Notes |
|----------|-----------|-------|
| Cosmic Essence | 50 | No wasted time |
| Orbs/Shards | 5 (played symbol) | Learning is valuable |

### Rare Drop Table

| Item | Drop Chance | Trigger |
|------|-------------|---------|
| Void Fragment | 0.1% | Any victory |
| Alignment Crystal | 0.05% | Any draw |
| Primordial Spark | 0.01% | Victory with max Impact Score |
| Cosmetic Crate | 1% | Any match completion |

### Streak Reward Escalation

| Streak Level | Bonus Essence | Void Fragment Drop |
|--------------|---------------|-------------------|
| 3 wins | +30 | 1 guaranteed |
| 5 wins | +50 | 3 guaranteed |
| 7 wins | +80 | 5 guaranteed |
| 10 wins | +150 | 10 guaranteed |
| 15 wins | +300 | 15 + 1 Primordial Spark |

---

## Difficulty Curve and Encounter Design

### Player Progression Path

**Phase 1: Awakening (Matches 1-10)**
- Opponents: Void Novice only
- Tutorial overlays explain cosmic lore
- Visual spectacle at 50% intensity (gentle introduction)
- Guaranteed win rate builds confidence

**Phase 2: Learning (Matches 11-50)**
- Opponents: Mix of Void Novice and Echoing Acolyte
- Introduce basic strategy concepts
- Visual spectacle at 75% intensity
- First encounter with defensive play

**Phase 3: Challenge (Matches 51-200)**
- Opponents: Grid Walker becomes primary
- Strategic depth fully unlocked
- Visual spectacle at 100% intensity
- Player learns fork creation and blocking

**Phase 4: Mastery (Matches 201+)**
- Opponents: Rotating pool including Force Adept
- Focus shifts from winning to perfect play
- Special event opponents available
- Achievement hunting becomes primary goal

### Encounter Variety System

**Daily Rotation**:
- Morning: Orbis-themed opponents (defensive style)
- Afternoon: Crucia-themed opponents (aggressive style)
- Evening: Mixed styles with bonus rewards

**Weekly Events**:
- Faction War Weekend (Orbs/Shards drop +50%)
- Draw Festival (Alignment Crystals drop +200%)
- Speed Trial (Bonus rewards for quick victories)
- Perfect Match Challenge (Legendary rewards for flawless play)

---

## Combat Visual Spectacle System

### Cell Claim Effects

**Orbis (O) Placement**:
1. Azure energy spirals from player position
2. Target cell glows with gathering light
3. Circle manifests from central point, expanding outward
4. Orbital rings spin into position
5. Particle corona settles into stable rotation

**Crucia (X) Placement**:
1. Crimson energy bolts from player position
2. Two slash lines converge on target cell
3. Cross forms from intersecting energy beams
4. Impact shockwave ripples across grid
5. Ember particles settle around symbol

### Victory Line Cascade

**Three-Symbol Alignment Sequence**:
1. **Detection Pulse** (0.2s): Brief white flash on aligned cells
2. **Connection Beam** (0.3s): Energy beam links all three symbols
3. **Power Surge** (0.5s): Beam intensifies, screen edges glow
4. **Victory Explosion** (1.0s): Spectacular particle burst along alignment
5. **Aftermath** (1.5s): Victorious force's energy dominates grid
6. **Resolution** (1.0s): Grid resets to void state with winner's colors

### Draw Resolution

**Stalemate Storm Sequence**:
1. **Tension Peak** (0.3s): All nine cells pulse simultaneously
2. **Balance Recognition** (0.5s): Azure and crimson energy swirl equally
3. **Cosmic Equilibrium** (1.0s): Both forces create balanced explosion
4. **Universe Birth** (1.5s): New reality sparkles into existence in background
5. **Peaceful Reset** (1.0s): Grid fades to serene void state

---

## Resource Integration

### Consumable Usage in Combat

**Essence Amplifier** (200 Essence):
- Activate before match
- Visual: Golden glow around resource counter
- Effect: 2× Essence earned from match

**Streak Shield** (1 Void Fragment):
- Activate before match
- Visual: Dark barrier shimmer around avatar
- Effect: Loss doesn't reset win streak

**Dual Affinity** (1 Alignment Crystal):
- Activate before match
- Visual: Both azure and crimson aura on avatar
- Effect: Earn both Orbs AND Shards for 3 matches

### Resource-Gated Content

| Content Type | Resource Requirement | Combat Effect |
|--------------|---------------------|----------------|
| Symbol Evolution | Orbs/Shards | Visual enhancement only |
| Grid Skins | Void Fragments | Background/border aesthetics |
| Victory Effects | Alignment Crystals | Victory celebration visuals |
| Legendary Themes | Primordial Spark | Complete visual transformation |

---

## Progression System Integration

### Experience Points (Implicit)

Rather than explicit XP, progression is tracked through:

**Match Count Milestones**:
| Matches | Reward | Unlock |
|---------|--------|--------|
| 10 | 500 Essence | Access to Grid Walker AI |
| 50 | 3 Void Fragments | First Grid Skin |
| 100 | 1 Alignment Crystal | Faction title (Circler/Marker) |
| 250 | 5 Void Fragments | Force Adept AI access |
| 500 | 2 Primordial Sparks | The Eternal AI access |
| 1000 | Legendary Cosmetic Set | Permanent 10% resource bonus |

### Achievement-Based Unlocks

| Achievement | Requirement | Reward |
|-------------|-------------|--------|
| First Blood | Win first match | 100 Essence |
| Perfectionist | Win without opponent getting 2-in-row | 50 Orbs or Shards |
| Speed Demon | Win in 5 moves | 200 Essence + 20 Shards |
| The Patient One | Win a 9-move game | 200 Essence + 20 Orbs |
| Fork Master | Create unavoidable victory | 1 Void Fragment |
| Comeback Champion | Win after opponent had 2-in-row | 2 Void Fragments |
| Draw Philosopher | Achieve 50 draws | 1 Alignment Crystal |
| The Awakened | Win 100+ games as each symbol | Awakened cosmetic set |
| Eternal Rival | Draw against The Eternal 10 times | Primordial Spark |

---

## Combat Balance Principles

### Design Philosophy

1. **Perfect Information**: No hidden mechanics—what you see is what exists
2. **Skill Ceiling**: Optimal play is achievable but requires strategic depth
3. **Spectacle Rewards Engagement**: Even losses feel visually rewarding
4. **Resource Fairness**: Cosmetics enhance visuals, never gameplay
5. **Cultural Respect**: Both playstyles (defensive Orbis, aggressive Crucia) are viable
6. **Draw Dignity**: Stalemates are celebrated, not punished

### Anti-Frustration Design

- Losses always reward resources (no wasted time)
- Streak shields prevent devastating loss streaks
- AI difficulties clearly labeled with win rate expectations
- Comeback bonuses reward perseverance
- Every match ends with spectacular visuals regardless of outcome

### Fairness Guarantees

- Symbol assignment can be random or chosen (player preference)
- No first-move advantage modification (pure tic-tac-toe rules)
- Resource bonuses are proportional, never exclusive
- All cosmetic content achievable through play (no pay-only items)

---

## Summary

Combat in Cosmic Tic-Tac-Toe transforms the classic 3x3 strategic duel into a spectacular cosmic ritual. The turn-based system remains pure—no modifications to core tic-tac-toe rules—while the visual layer delivers the "spectacular super graphics" vision.

Key features:
- **Impact Score System** rewards strategic play with visual intensity
- **Five AI tiers** from trivial to unbeatable
- **Rich cosmetic progression** through resource spending
- **Spectacle-first design** where every move creates cosmic visuals
- **Cultural integration** with Orbis/Crucia lore and aesthetics
- **Engagement rewards** ensuring no match feels wasted

The combat system honors the game's simplicity while making each session feel like channeling cosmic forces in an eternal battle for universal dominion.

---

DECISION: combat_complete
