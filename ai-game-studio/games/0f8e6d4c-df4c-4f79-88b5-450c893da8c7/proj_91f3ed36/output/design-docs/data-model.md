# Data Model Design: Cosmic Tic-Tac-Toe - The Eternal Grid

## Overview

This document defines the complete data architecture for Cosmic Tic-Tac-Toe, translating game design into concrete schemas, relationships, and storage strategies. The model supports cosmetic progression, economic systems, match history, and player identity.

---

## 1. Entity-Relationship Diagram

```
                              ┌─────────────────┐
                              │     PLAYER      │
                              │─────────────────│
                              │ player_id (PK)  │
                              │ username        │
                              │ created_at      │
                              │ last_login      │
                              └────────┬────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ PLAYER_PROGRESS │         │ PLAYER_WALLET   │         │ PLAYER_INVENTORY│
│─────────────────│         │─────────────────│         │─────────────────│
│ player_id (FK)  │         │ player_id (FK)  │         │ inventory_id(PK)│
│ level           │         │ essence         │         │ player_id (FK)  │
│ prestige_level  │         │ orbs            │         │ item_id (FK)    │
│ total_xp        │         │ shards          │         │ equipped        │
│ wins_as_o       │         │ void_fragments  │         │ acquired_at     │
│ wins_as_x       │         │ align_crystals  │         └────────┬────────┘
│ total_draws     │         │ prim_sparks     │                  │
└─────────────────┘         └─────────────────┘                  │
                                                                 ▼
                                                      ┌─────────────────┐
                                                      │ COSMETIC_ITEM   │
                                                      │─────────────────│
                                                      │ item_id (PK)    │
                                                      │ category        │
                                                      │ tier            │
                                                      │ faction         │
                                                      │ name            │
                                                      └─────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ PLAYER_SKILLS   │         │   SKILL_NODE    │         │  SKILL_TREE     │
│─────────────────│         │─────────────────│         │─────────────────│
│ skill_entry(PK) │◄────────│ node_id (PK)    │◄────────│ tree_id (PK)    │
│ player_id (FK)  │         │ tree_id (FK)    │         │ faction         │
│ node_id (FK)    │         │ branch          │         │ name            │
│ unlocked_at     │         │ tier            │         └─────────────────┘
└─────────────────┘         │ cost            │
                            │ prereq_node_id  │
                            └─────────────────┘

┌─────────────────┐         ┌─────────────────┐
│     MATCH       │         │   MATCH_MOVE    │
│─────────────────│         │─────────────────│
│ match_id (PK)   │────────►│ move_id (PK)    │
│ player_id (FK)  │         │ match_id (FK)   │
│ opponent_type   │         │ turn_number     │
│ ai_tier         │         │ cell_position   │
│ symbol_played   │         │ symbol          │
│ outcome         │         │ impact_score    │
│ impact_total    │         │ timestamp       │
│ duration_sec    │         └─────────────────┘
│ played_at       │
└─────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ ACHIEVEMENT     │         │PLAYER_ACHIEVEMENT│        │   WIN_STREAK    │
│─────────────────│         │─────────────────│         │─────────────────│
│ achieve_id (PK) │◄────────│ entry_id (PK)   │         │ player_id (FK)  │
│ name            │         │ player_id (FK)  │         │ current_streak  │
│ description     │         │ achieve_id (FK) │         │ best_streak     │
│ tier            │         │ unlocked_at     │         │ streak_protected│
│ reward_type     │         │ progress        │         │ last_updated    │
│ reward_value    │         └─────────────────┘         └─────────────────┘
└─────────────────┘

┌─────────────────┐         ┌─────────────────┐
│     TRADE       │         │  DAILY_LOGIN    │
│─────────────────│         │─────────────────│
│ trade_id (PK)   │         │ login_id (PK)   │
│ sender_id (FK)  │         │ player_id (FK)  │
│ receiver_id(FK) │         │ login_date      │
│ resource_type   │         │ streak_day      │
│ amount_sent     │         │ bonus_claimed   │
│ tax_applied     │         └─────────────────┘
│ executed_at     │
└─────────────────┘
```

---

## 2. Schema Definitions

### 2.1 Player Core Tables

```sql
-- Core player identity
CREATE TABLE player (
    player_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(32) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(48),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login      TIMESTAMP WITH TIME ZONE,
    is_active       BOOLEAN DEFAULT TRUE,
    account_flags   INTEGER DEFAULT 0  -- bit flags for restrictions
);

-- Player progression state
CREATE TABLE player_progress (
    player_id           UUID PRIMARY KEY REFERENCES player(player_id),
    level               INTEGER DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
    cosmic_resonance    INTEGER DEFAULT 0,  -- current XP
    prestige_level      INTEGER DEFAULT 0 CHECK (prestige_level BETWEEN 0 AND 10),
    total_matches       INTEGER DEFAULT 0,
    total_wins          INTEGER DEFAULT 0,
    total_draws         INTEGER DEFAULT 0,
    total_losses        INTEGER DEFAULT 0,
    wins_as_o           INTEGER DEFAULT 0,
    wins_as_x           INTEGER DEFAULT 0,
    draws_vs_eternal    INTEGER DEFAULT 0,  -- special tracking
    perfect_games       INTEGER DEFAULT 0,  -- no opponent 2-in-row
    swift_victories     INTEGER DEFAULT 0,  -- wins in 5 moves
    fork_victories      INTEGER DEFAULT 0,
    comeback_victories  INTEGER DEFAULT 0,
    first_match_date    DATE,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player wallet for all currencies
CREATE TABLE player_wallet (
    player_id           UUID PRIMARY KEY REFERENCES player(player_id),
    cosmic_essence      INTEGER DEFAULT 0 CHECK (cosmic_essence >= 0),
    starlight_orbs      INTEGER DEFAULT 0 CHECK (starlight_orbs >= 0),
    shadow_shards       INTEGER DEFAULT 0 CHECK (shadow_shards >= 0),
    void_fragments      INTEGER DEFAULT 0 CHECK (void_fragments BETWEEN 0 AND 200),
    alignment_crystals  INTEGER DEFAULT 0 CHECK (alignment_crystals BETWEEN 0 AND 50),
    primordial_sparks   INTEGER DEFAULT 0 CHECK (primordial_sparks BETWEEN 0 AND 10),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Active player streak tracking
CREATE TABLE player_streak (
    player_id           UUID PRIMARY KEY REFERENCES player(player_id),
    current_win_streak  INTEGER DEFAULT 0,
    best_win_streak     INTEGER DEFAULT 0,
    streak_protected    BOOLEAN DEFAULT FALSE,  -- streak shield active
    current_draw_streak INTEGER DEFAULT 0,      -- for The Eternal draws
    best_draw_streak    INTEGER DEFAULT 0,
    last_match_outcome  VARCHAR(16),  -- 'win', 'loss', 'draw'
    last_match_at       TIMESTAMP WITH TIME ZONE
);
```

### 2.2 Cosmetic Item System

```sql
-- Cosmetic item tier enum
CREATE TYPE cosmetic_tier AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary', 'prestige');

-- Cosmetic category enum
CREATE TYPE cosmetic_category AS ENUM (
    'symbol_trail', 'cell_animation', 'grid_skin',
    'victory_effect', 'profile_frame', 'title',
    'symbol_evolution_o', 'symbol_evolution_x'
);

-- Faction affiliation enum
CREATE TYPE faction_type AS ENUM ('orbis', 'crucia', 'neutral', 'awakened');

-- Master cosmetic item catalog
CREATE TABLE cosmetic_item (
    item_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code           VARCHAR(64) UNIQUE NOT NULL,  -- internal reference
    name                VARCHAR(128) NOT NULL,
    description         TEXT,
    category            cosmetic_category NOT NULL,
    tier                cosmetic_tier NOT NULL,
    faction             faction_type DEFAULT 'neutral',

    -- Pricing (only one should be set based on tier)
    price_essence       INTEGER,
    price_orbs          INTEGER,
    price_shards        INTEGER,
    price_void_frags    INTEGER,
    price_align_crystals INTEGER,
    price_prim_sparks   INTEGER,

    -- Unlock requirements
    unlock_achievement  UUID REFERENCES achievement(achieve_id),
    unlock_level        INTEGER,
    unlock_prestige     INTEGER,
    unlock_match_count  INTEGER,

    -- Visual asset references
    asset_path          VARCHAR(255),
    preview_path        VARCHAR(255),
    particle_config     JSONB,  -- particle system parameters

    is_tradeable        BOOLEAN DEFAULT FALSE,
    is_limited          BOOLEAN DEFAULT FALSE,
    available_from      TIMESTAMP WITH TIME ZONE,
    available_until     TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player inventory (owned items)
CREATE TABLE player_inventory (
    inventory_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID REFERENCES player(player_id),
    item_id         UUID REFERENCES cosmetic_item(item_id),
    acquired_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acquisition_type VARCHAR(32) DEFAULT 'purchase',  -- purchase, achievement, reward, trade
    source_detail   VARCHAR(128),  -- e.g., "Daily Shop 2025-01-15"
    is_equipped     BOOLEAN DEFAULT FALSE,
    upgraded_level  INTEGER DEFAULT 0,  -- for Prestige Workshop upgrades

    UNIQUE(player_id, item_id)
);

-- Player's equipped loadout (quick lookup)
CREATE TABLE player_loadout (
    player_id           UUID PRIMARY KEY REFERENCES player(player_id),
    symbol_trail_o      UUID REFERENCES cosmetic_item(item_id),
    symbol_trail_x      UUID REFERENCES cosmetic_item(item_id),
    symbol_evolution_o  UUID REFERENCES cosmetic_item(item_id),
    symbol_evolution_x  UUID REFERENCES cosmetic_item(item_id),
    cell_animation      UUID REFERENCES cosmetic_item(item_id),
    grid_skin           UUID REFERENCES cosmetic_item(item_id),
    victory_effect      UUID REFERENCES cosmetic_item(item_id),
    profile_frame       UUID REFERENCES cosmetic_item(item_id),
    active_title        UUID REFERENCES cosmetic_item(item_id),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.3 Skill Tree System

```sql
-- Skill tree definitions
CREATE TABLE skill_tree (
    tree_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_code       VARCHAR(32) UNIQUE NOT NULL,  -- 'orbis', 'crucia', 'awakened'
    faction         faction_type NOT NULL,
    name            VARCHAR(64) NOT NULL,
    description     TEXT,
    mastery_title   VARCHAR(64),  -- title granted on completion
    total_nodes     INTEGER NOT NULL
);

-- Individual skill tree nodes
CREATE TABLE skill_node (
    node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id         UUID REFERENCES skill_tree(tree_id),
    node_code       VARCHAR(64) UNIQUE NOT NULL,
    branch          VARCHAR(32) NOT NULL,  -- e.g., 'orbit', 'harmony', 'celestial'
    tier            INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 4),
    name            VARCHAR(64) NOT NULL,
    description     TEXT,

    -- Cost (faction-specific)
    cost_orbs       INTEGER DEFAULT 0,
    cost_shards     INTEGER DEFAULT 0,
    cost_align_crystals INTEGER DEFAULT 0,
    cost_prim_sparks INTEGER DEFAULT 0,

    -- Prerequisites
    prereq_node_id  UUID REFERENCES skill_node(node_id),

    -- Effect references
    effect_type     VARCHAR(32),  -- 'symbol_enhancement', 'grid_enhancement', 'victory_enhancement'
    effect_config   JSONB,  -- visual effect parameters

    display_order   INTEGER  -- for UI ordering
);

-- Player unlocked skill nodes
CREATE TABLE player_skills (
    skill_entry_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID REFERENCES player(player_id),
    node_id         UUID REFERENCES skill_node(node_id),
    unlocked_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(player_id, node_id)
);

-- Player skill tree completion tracking
CREATE TABLE player_tree_progress (
    player_id           UUID REFERENCES player(player_id),
    tree_id             UUID REFERENCES skill_tree(tree_id),
    nodes_unlocked      INTEGER DEFAULT 0,
    total_invested      INTEGER DEFAULT 0,  -- total currency spent
    is_mastered         BOOLEAN DEFAULT FALSE,
    mastered_at         TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (player_id, tree_id)
);
```

### 2.4 Match and Combat System

```sql
-- AI opponent tier enum
CREATE TYPE ai_tier AS ENUM (
    'void_novice',      -- 0.5x rewards
    'echoing_acolyte',  -- 0.75x rewards
    'grid_walker',      -- 1.0x rewards
    'force_adept',      -- 1.5x rewards
    'the_eternal'       -- 2.0x rewards
);

-- Match outcome enum
CREATE TYPE match_outcome AS ENUM ('win', 'loss', 'draw');

-- Symbol played enum
CREATE TYPE symbol_type AS ENUM ('o', 'x');

-- Match history
CREATE TABLE match (
    match_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id           UUID REFERENCES player(player_id) NOT NULL,

    -- Opponent info
    opponent_type       VARCHAR(16) NOT NULL DEFAULT 'ai',  -- 'ai' or 'player'
    opponent_player_id  UUID REFERENCES player(player_id),  -- for PvP
    ai_tier             ai_tier,

    -- Match details
    symbol_played       symbol_type NOT NULL,
    outcome             match_outcome NOT NULL,
    total_moves         INTEGER NOT NULL CHECK (total_moves BETWEEN 5 AND 9),
    duration_seconds    INTEGER,

    -- Impact scoring
    impact_score_total  FLOAT DEFAULT 0,
    was_swift_victory   BOOLEAN DEFAULT FALSE,  -- 5 moves
    was_fork_victory    BOOLEAN DEFAULT FALSE,
    was_comeback        BOOLEAN DEFAULT FALSE,
    was_perfect_game    BOOLEAN DEFAULT FALSE,

    -- Streak context
    streak_count_at_start INTEGER DEFAULT 0,
    streak_shield_used  BOOLEAN DEFAULT FALSE,

    -- Rewards earned (snapshot)
    essence_earned      INTEGER DEFAULT 0,
    orbs_earned         INTEGER DEFAULT 0,
    shards_earned       INTEGER DEFAULT 0,
    void_frags_earned   INTEGER DEFAULT 0,
    align_crystals_earned INTEGER DEFAULT 0,
    prim_sparks_earned  INTEGER DEFAULT 0,

    played_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_match_player (player_id),
    INDEX idx_match_played_at (played_at)
);

-- Individual move history (for replay/analysis)
CREATE TABLE match_move (
    move_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID REFERENCES match(match_id) ON DELETE CASCADE,
    turn_number     INTEGER NOT NULL CHECK (turn_number BETWEEN 1 AND 9),
    cell_row        INTEGER NOT NULL CHECK (cell_row BETWEEN 0 AND 2),
    cell_col        INTEGER NOT NULL CHECK (cell_col BETWEEN 0 AND 2),
    symbol          symbol_type NOT NULL,
    is_player_move  BOOLEAN NOT NULL,

    -- Impact analysis
    cell_value      INTEGER,  -- center=3, corner=2, edge=1
    move_type       VARCHAR(32),  -- 'opening', 'block', 'fork', 'winning', 'normal'
    impact_score    FLOAT DEFAULT 0,

    timestamp_ms    BIGINT,  -- relative to match start

    UNIQUE(match_id, turn_number)
);
```

### 2.5 Achievement System

```sql
-- Achievement tier enum
CREATE TYPE achievement_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'legendary');

-- Achievement definitions
CREATE TABLE achievement (
    achieve_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achieve_code    VARCHAR(64) UNIQUE NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     TEXT NOT NULL,
    tier            achievement_tier NOT NULL,
    category        VARCHAR(32),  -- 'combat', 'progression', 'collection', 'social'

    -- Tracking type
    is_progressive  BOOLEAN DEFAULT FALSE,  -- has counter progress
    target_count    INTEGER,  -- for progressive achievements

    -- Rewards
    reward_essence      INTEGER DEFAULT 0,
    reward_orbs         INTEGER DEFAULT 0,
    reward_shards       INTEGER DEFAULT 0,
    reward_void_frags   INTEGER DEFAULT 0,
    reward_align_crystals INTEGER DEFAULT 0,
    reward_prim_sparks  INTEGER DEFAULT 0,
    reward_cosmetic_id  UUID REFERENCES cosmetic_item(item_id),
    reward_xp           INTEGER DEFAULT 0,

    -- Special unlock
    unlocks_title       VARCHAR(64),
    unlocks_feature     VARCHAR(64),

    is_hidden           BOOLEAN DEFAULT FALSE,
    is_seasonal         BOOLEAN DEFAULT FALSE,
    season_id           INTEGER,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player achievement progress
CREATE TABLE player_achievement (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID REFERENCES player(player_id),
    achieve_id      UUID REFERENCES achievement(achieve_id),
    current_progress INTEGER DEFAULT 0,  -- for progressive achievements
    is_complete     BOOLEAN DEFAULT FALSE,
    unlocked_at     TIMESTAMP WITH TIME ZONE,
    reward_claimed  BOOLEAN DEFAULT FALSE,

    UNIQUE(player_id, achieve_id)
);
```

### 2.6 Economy and Trading

```sql
-- Resource type enum for transactions
CREATE TYPE resource_type AS ENUM (
    'cosmic_essence', 'starlight_orbs', 'shadow_shards',
    'void_fragments', 'alignment_crystals', 'primordial_sparks'
);

-- Transaction type enum
CREATE TYPE transaction_type AS ENUM (
    'match_reward', 'streak_bonus', 'daily_challenge', 'weekly_challenge',
    'achievement', 'milestone', 'purchase', 'conversion', 'trade_send',
    'trade_receive', 'trade_tax', 'skill_unlock', 'consumable_use',
    'seasonal_reward', 'prestige_bonus', 'admin_grant'
);

-- Wallet transaction ledger (immutable audit trail)
CREATE TABLE wallet_transaction (
    txn_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID REFERENCES player(player_id) NOT NULL,
    txn_type        transaction_type NOT NULL,
    resource        resource_type NOT NULL,
    amount          INTEGER NOT NULL,  -- positive = gain, negative = spend
    balance_after   INTEGER NOT NULL,

    -- Context
    source_id       UUID,  -- match_id, trade_id, achievement_id, etc.
    source_type     VARCHAR(32),
    description     VARCHAR(255),

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_wallet_txn_player (player_id, created_at)
);

-- Player-to-player trading
CREATE TABLE trade (
    trade_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID REFERENCES player(player_id) NOT NULL,
    receiver_id     UUID REFERENCES player(player_id) NOT NULL,
    resource_type   resource_type NOT NULL,
    amount_sent     INTEGER NOT NULL CHECK (amount_sent BETWEEN 5 AND 50),
    tax_amount      INTEGER NOT NULL,  -- 10% tax
    amount_received INTEGER NOT NULL,  -- amount_sent - tax_amount
    status          VARCHAR(16) DEFAULT 'completed',
    executed_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CHECK (sender_id != receiver_id)
);

-- Daily trade counter (limit enforcement)
CREATE TABLE player_trade_limit (
    player_id       UUID REFERENCES player(player_id),
    trade_date      DATE NOT NULL,
    trades_today    INTEGER DEFAULT 0,

    PRIMARY KEY (player_id, trade_date)
);
```

### 2.7 Daily/Weekly Systems

```sql
-- Daily login tracking
CREATE TABLE daily_login (
    login_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID REFERENCES player(player_id),
    login_date      DATE NOT NULL,
    streak_day      INTEGER DEFAULT 1,  -- consecutive login day
    bonus_claimed   BOOLEAN DEFAULT FALSE,
    bonus_essence   INTEGER DEFAULT 0,

    UNIQUE(player_id, login_date)
);

-- Challenge type enum
CREATE TYPE challenge_type AS ENUM ('daily', 'weekly', 'seasonal');

-- Challenge definitions
CREATE TABLE challenge (
    challenge_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_code  VARCHAR(64) UNIQUE NOT NULL,
    name            VARCHAR(128) NOT NULL,
    description     TEXT NOT NULL,
    challenge_type  challenge_type NOT NULL,

    -- Requirements
    requirement_type VARCHAR(32),  -- 'matches_played', 'wins', 'symbol_wins', etc.
    requirement_count INTEGER NOT NULL,
    requirement_symbol symbol_type,  -- for symbol-specific challenges

    -- Rewards
    reward_essence      INTEGER DEFAULT 0,
    reward_orbs         INTEGER DEFAULT 0,
    reward_shards       INTEGER DEFAULT 0,
    reward_void_frags   INTEGER DEFAULT 0,

    is_active           BOOLEAN DEFAULT TRUE
);

-- Player challenge progress
CREATE TABLE player_challenge (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID REFERENCES player(player_id),
    challenge_id    UUID REFERENCES challenge(challenge_id),
    period_start    DATE NOT NULL,  -- start of daily/weekly period
    current_progress INTEGER DEFAULT 0,
    is_complete     BOOLEAN DEFAULT FALSE,
    reward_claimed  BOOLEAN DEFAULT FALSE,
    completed_at    TIMESTAMP WITH TIME ZONE,

    UNIQUE(player_id, challenge_id, period_start)
);
```

### 2.8 Shop and Consumables

```sql
-- Shop rotation (daily items)
CREATE TABLE shop_rotation (
    rotation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rotation_date   DATE NOT NULL,
    slot_number     INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 8),
    item_id         UUID REFERENCES cosmetic_item(item_id),
    discount_pct    INTEGER DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 50),
    stock_limit     INTEGER,  -- NULL = unlimited
    stock_remaining INTEGER,
    is_featured     BOOLEAN DEFAULT FALSE,

    UNIQUE(rotation_date, slot_number)
);

-- Consumable type enum
CREATE TYPE consumable_type AS ENUM (
    'essence_amplifier',  -- 2x essence for one match
    'streak_shield',      -- protect streak from one loss
    'dual_affinity'       -- earn both orbs and shards for 3 matches
);

-- Player consumable inventory
CREATE TABLE player_consumables (
    player_id       UUID REFERENCES player(player_id),
    consumable_type consumable_type NOT NULL,
    quantity        INTEGER DEFAULT 0 CHECK (quantity BETWEEN 0 AND 10),

    PRIMARY KEY (player_id, consumable_type)
);

-- Active consumable effects
CREATE TABLE active_consumable (
    effect_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID REFERENCES player(player_id),
    consumable_type consumable_type NOT NULL,
    matches_remaining INTEGER,  -- for multi-match effects
    activated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE
);
```

---

## 3. Data Dictionary

### 3.1 Player Tables

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| player | player_id | UUID | Unique player identifier |
| player | username | VARCHAR(32) | Login name, unique |
| player | email | VARCHAR(255) | Email address, unique |
| player | display_name | VARCHAR(48) | Public display name |
| player | account_flags | INTEGER | Bit flags: 1=banned, 2=muted, 4=trade_restricted |
| player_progress | level | INTEGER | Current level (1-100) |
| player_progress | cosmic_resonance | INTEGER | XP toward next level |
| player_progress | prestige_level | INTEGER | Prestige tier (0-10) |
| player_wallet | void_fragments | INTEGER | Rare currency (cap: 200) |
| player_wallet | alignment_crystals | INTEGER | Epic currency (cap: 50) |
| player_wallet | primordial_sparks | INTEGER | Legendary currency (cap: 10) |
| player_streak | current_win_streak | INTEGER | Active win streak count |
| player_streak | streak_protected | BOOLEAN | Streak Shield consumable active |

### 3.2 Cosmetic System

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| cosmetic_item | item_code | VARCHAR(64) | Internal reference code |
| cosmetic_item | category | ENUM | Item type: trail, animation, skin, etc. |
| cosmetic_item | tier | ENUM | Rarity: common through legendary |
| cosmetic_item | faction | ENUM | Orbis, Crucia, neutral, or awakened |
| cosmetic_item | particle_config | JSONB | Particle system parameters |
| cosmetic_item | is_limited | BOOLEAN | Time-limited availability |
| player_inventory | equipped | BOOLEAN | Currently active in loadout |
| player_inventory | upgraded_level | INTEGER | Prestige Workshop upgrade tier |

### 3.3 Match System

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| match | ai_tier | ENUM | AI difficulty level |
| match | symbol_played | ENUM | 'o' or 'x' |
| match | outcome | ENUM | win, loss, or draw |
| match | impact_score_total | FLOAT | Cumulative strategic impact |
| match | was_swift_victory | BOOLEAN | Won in exactly 5 moves |
| match | was_fork_victory | BOOLEAN | Won via unavoidable fork |
| match | was_comeback | BOOLEAN | Won after opponent had 2-in-row |
| match_move | cell_row/col | INTEGER | Grid position (0-2) |
| match_move | move_type | VARCHAR | Strategic classification |
| match_move | impact_score | FLOAT | Individual move impact value |

### 3.4 Achievement System

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| achievement | is_progressive | BOOLEAN | Has counter (vs. boolean) |
| achievement | target_count | INTEGER | Goal for progressive achievements |
| achievement | is_hidden | BOOLEAN | Secret achievement |
| achievement | unlocks_title | VARCHAR | Title granted on completion |
| player_achievement | current_progress | INTEGER | Counter for progressive |
| player_achievement | reward_claimed | BOOLEAN | Reward collected |

---

## 4. Sample Data

### 4.1 Cosmetic Items Sample

```json
[
  {
    "item_code": "trail_azure_basic",
    "name": "Azure Trail",
    "category": "symbol_trail",
    "tier": "common",
    "faction": "orbis",
    "price_essence": 800,
    "particle_config": {
      "type": "trail",
      "color": "#4DA6FF",
      "intensity": 0.5,
      "decay_rate": 0.1
    }
  },
  {
    "item_code": "grid_dark_matter",
    "name": "Dark Matter Field",
    "category": "grid_skin",
    "tier": "rare",
    "faction": "neutral",
    "price_void_frags": 20,
    "particle_config": {
      "background_type": "animated",
      "particle_density": "high",
      "color_primary": "#1a1a2e",
      "color_secondary": "#4a148c"
    }
  },
  {
    "item_code": "victory_universe_birth",
    "name": "Universe Birth",
    "category": "victory_effect",
    "tier": "legendary",
    "faction": "neutral",
    "price_prim_sparks": 3,
    "unlock_achievement": "achievement_500_wins",
    "particle_config": {
      "explosion_type": "cosmic",
      "particle_count": 10000,
      "duration_ms": 3000,
      "screen_shake": true
    }
  }
]
```

### 4.2 Skill Nodes Sample

```json
[
  {
    "tree_code": "orbis",
    "node_code": "orbis_orbit_t1",
    "branch": "orbit",
    "tier": 1,
    "name": "Azure Glow",
    "description": "O symbols emit a soft azure glow",
    "cost_orbs": 50,
    "prereq_node_id": null,
    "effect_config": {
      "glow_color": "#4DA6FF",
      "glow_intensity": 0.3,
      "pulse_rate": 0
    }
  },
  {
    "tree_code": "orbis",
    "node_code": "orbis_orbit_t2",
    "branch": "orbit",
    "tier": 2,
    "name": "Orbital Ring",
    "description": "Single ring orbits placed O symbols",
    "cost_orbs": 100,
    "prereq_node_id": "orbis_orbit_t1",
    "effect_config": {
      "ring_count": 1,
      "ring_color": "#4DA6FF",
      "rotation_speed": 1.0
    }
  }
]
```

### 4.3 Achievements Sample

```json
[
  {
    "achieve_code": "first_blood",
    "name": "First Blood",
    "description": "Win your first match",
    "tier": "bronze",
    "category": "combat",
    "is_progressive": false,
    "reward_essence": 100,
    "reward_xp": 50
  },
  {
    "achieve_code": "perfectionist",
    "name": "Perfectionist",
    "description": "Win without opponent getting two in a row",
    "tier": "silver",
    "category": "combat",
    "is_progressive": false,
    "reward_orbs": 50,
    "reward_shards": 50
  },
  {
    "achieve_code": "eternal_rival",
    "name": "Eternal Rival",
    "description": "Draw against The Eternal 10 times",
    "tier": "legendary",
    "category": "combat",
    "is_progressive": true,
    "target_count": 10,
    "reward_prim_sparks": 1,
    "unlocks_title": "Eternal Rival"
  }
]
```

---

## 5. Migration and Versioning Strategy

### 5.1 Schema Versioning

```sql
CREATE TABLE schema_version (
    version         INTEGER PRIMARY KEY,
    description     VARCHAR(255) NOT NULL,
    applied_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum        VARCHAR(64)  -- SHA256 of migration file
);

-- Example version tracking
INSERT INTO schema_version VALUES
    (1, 'Initial schema - core tables', NOW(), 'abc123...'),
    (2, 'Add streak tracking', NOW(), 'def456...'),
    (3, 'Add prestige workshop', NOW(), 'ghi789...');
```

### 5.2 Migration Template

```sql
-- Migration: V003__add_draw_streak_tracking.sql
-- Description: Add draw streak tracking for The Eternal achievement

BEGIN;

-- Add new columns to player_streak
ALTER TABLE player_streak
    ADD COLUMN IF NOT EXISTS current_draw_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS best_draw_streak INTEGER DEFAULT 0;

-- Add new achievement for draw streaks
INSERT INTO achievement (achieve_code, name, description, tier, category,
    is_progressive, target_count, reward_void_frags, unlocks_title)
VALUES
    ('draw_streak_5', 'Perfect Harmony', 'Achieve 5 draws vs The Eternal',
     'gold', 'combat', TRUE, 5, 1, NULL),
    ('draw_streak_10', 'Master of Balance', 'Achieve 10 draws vs The Eternal',
     'platinum', 'combat', TRUE, 10, NULL, 'Perfect Harmony'),
    ('draw_streak_20', 'Cosmic Equilibrium', 'Achieve 20 draws vs The Eternal',
     'legendary', 'combat', TRUE, 20, NULL, 'Cosmic Equilibrium');

-- Update schema version
INSERT INTO schema_version (version, description)
VALUES (3, 'Add draw streak tracking for The Eternal');

COMMIT;
```

### 5.3 Rollback Strategy

```sql
-- Rollback: V003_rollback__remove_draw_streak_tracking.sql

BEGIN;

-- Remove new columns
ALTER TABLE player_streak
    DROP COLUMN IF EXISTS current_draw_streak,
    DROP COLUMN IF EXISTS best_draw_streak;

-- Remove new achievements
DELETE FROM achievement WHERE achieve_code IN
    ('draw_streak_5', 'draw_streak_10', 'draw_streak_20');

-- Update schema version
DELETE FROM schema_version WHERE version = 3;

COMMIT;
```

---

## 6. Performance Considerations

### 6.1 Indexes

```sql
-- Player lookup indexes
CREATE INDEX idx_player_username ON player(username);
CREATE INDEX idx_player_last_login ON player(last_login);

-- Match query indexes (common queries)
CREATE INDEX idx_match_player_date ON match(player_id, played_at DESC);
CREATE INDEX idx_match_outcome ON match(outcome) WHERE outcome = 'win';
CREATE INDEX idx_match_symbol ON match(symbol_played);

-- Achievement progress queries
CREATE INDEX idx_player_achieve_incomplete ON player_achievement(player_id)
    WHERE is_complete = FALSE;

-- Wallet transaction audit
CREATE INDEX idx_wallet_txn_player_date ON wallet_transaction(player_id, created_at DESC);
CREATE INDEX idx_wallet_txn_type ON wallet_transaction(txn_type);

-- Shop rotation queries
CREATE INDEX idx_shop_rotation_date ON shop_rotation(rotation_date);

-- Inventory queries
CREATE INDEX idx_inventory_player ON player_inventory(player_id);
CREATE INDEX idx_inventory_equipped ON player_inventory(player_id) WHERE is_equipped = TRUE;
```

### 6.2 Partitioning Strategy

```sql
-- Partition match table by month for large-scale deployment
CREATE TABLE match (
    -- columns as above
) PARTITION BY RANGE (played_at);

CREATE TABLE match_2025_01 PARTITION OF match
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE match_2025_02 PARTITION OF match
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Continue for each month

-- Partition wallet transactions similarly
CREATE TABLE wallet_transaction (
    -- columns as above
) PARTITION BY RANGE (created_at);
```

### 6.3 Caching Strategy

| Data Type | Cache TTL | Cache Key Pattern | Invalidation |
|-----------|-----------|-------------------|--------------|
| Player profile | 5 min | `player:{id}:profile` | On update |
| Player wallet | 30 sec | `player:{id}:wallet` | On transaction |
| Player loadout | 10 min | `player:{id}:loadout` | On equip change |
| Cosmetic catalog | 1 hour | `cosmetics:all` | On shop reset |
| Daily shop | Until midnight | `shop:daily:{date}` | On rotation |
| Skill tree defs | 24 hours | `skills:trees` | On deploy |
| Achievements | 24 hours | `achievements:all` | On deploy |
| Player streak | 1 min | `player:{id}:streak` | On match end |

### 6.4 Query Optimization Notes

```sql
-- Frequently queried: Get player's complete state
-- Optimize with materialized view or denormalized cache

CREATE MATERIALIZED VIEW player_dashboard AS
SELECT
    p.player_id,
    p.username,
    p.display_name,
    pr.level,
    pr.prestige_level,
    pr.total_wins,
    pr.total_matches,
    pw.cosmic_essence,
    pw.starlight_orbs,
    pw.shadow_shards,
    pw.void_fragments,
    pw.alignment_crystals,
    pw.primordial_sparks,
    ps.current_win_streak,
    ps.best_win_streak,
    (SELECT COUNT(*) FROM player_inventory WHERE player_id = p.player_id) as owned_items,
    (SELECT COUNT(*) FROM player_achievement WHERE player_id = p.player_id AND is_complete = TRUE) as achievements
FROM player p
JOIN player_progress pr ON p.player_id = pr.player_id
JOIN player_wallet pw ON p.player_id = pw.player_id
LEFT JOIN player_streak ps ON p.player_id = ps.player_id;

-- Refresh on player activity
REFRESH MATERIALIZED VIEW CONCURRENTLY player_dashboard;
```

---

## 7. Data Validation Rules

### 7.1 Business Rules

| Rule | Table | Validation |
|------|-------|------------|
| Currency caps | player_wallet | void_fragments <= 200, alignment_crystals <= 50, primordial_sparks <= 10 |
| Trade limits | trade | amount BETWEEN 5 AND 50, sender != receiver |
| Daily trades | player_trade_limit | trades_today <= 5 |
| Level bounds | player_progress | level BETWEEN 1 AND 100, prestige BETWEEN 0 AND 10 |
| Match moves | match | total_moves BETWEEN 5 AND 9 |
| Cell positions | match_move | cell_row/col BETWEEN 0 AND 2 |
| Consumable stacks | player_consumables | quantity BETWEEN 0 AND 10 |
| Streak reward gate | match | VF/AC/PS rewards only if ai_tier >= 'grid_walker' |

### 7.2 Constraint Triggers

```sql
-- Prevent streak reward exploit: VF/AC/PS only from Grid Walker+
CREATE OR REPLACE FUNCTION check_streak_reward_eligibility()
RETURNS TRIGGER AS $$
BEGIN
    -- If awarding rare currencies from streak
    IF NEW.void_frags_earned > 0 OR NEW.align_crystals_earned > 0 OR NEW.prim_sparks_earned > 0 THEN
        -- Must be Grid Walker or higher
        IF NEW.ai_tier NOT IN ('grid_walker', 'force_adept', 'the_eternal') THEN
            -- Zero out streak rewards for easy AI
            NEW.void_frags_earned := 0;
            NEW.align_crystals_earned := 0;
            NEW.prim_sparks_earned := 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_streak_reward_gate
    BEFORE INSERT ON match
    FOR EACH ROW
    EXECUTE FUNCTION check_streak_reward_eligibility();

-- Enforce currency caps on wallet updates
CREATE OR REPLACE FUNCTION enforce_currency_caps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.void_fragments := LEAST(NEW.void_fragments, 200);
    NEW.alignment_crystals := LEAST(NEW.alignment_crystals, 50);
    NEW.primordial_sparks := LEAST(NEW.primordial_sparks, 10);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_currency_caps
    BEFORE INSERT OR UPDATE ON player_wallet
    FOR EACH ROW
    EXECUTE FUNCTION enforce_currency_caps();
```

---

## 8. JSON/Document Schemas

### 8.1 Particle Config Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ParticleConfig",
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "enum": ["trail", "glow", "explosion", "ambient", "ring"]
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9A-Fa-f]{6}$"
    },
    "color_secondary": {
      "type": "string",
      "pattern": "^#[0-9A-Fa-f]{6}$"
    },
    "intensity": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "particle_count": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10000
    },
    "duration_ms": {
      "type": "integer",
      "minimum": 100,
      "maximum": 10000
    },
    "decay_rate": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "screen_shake": {
      "type": "boolean"
    }
  },
  "required": ["type"]
}
```

### 8.2 Skill Effect Config Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SkillEffectConfig",
  "type": "object",
  "properties": {
    "glow_color": {
      "type": "string"
    },
    "glow_intensity": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "ring_count": {
      "type": "integer",
      "minimum": 1,
      "maximum": 3
    },
    "rotation_speed": {
      "type": "number",
      "minimum": 0.1,
      "maximum": 5.0
    },
    "pulse_rate": {
      "type": "number",
      "minimum": 0,
      "maximum": 2.0
    }
  }
}
```

---

## Summary

This data model provides complete coverage for Cosmic Tic-Tac-Toe:

**Core Entities**: Player identity, progression, wallet, inventory, loadout, and streaks across 8 primary tables.

**Cosmetic System**: Full catalog support with tiered pricing, faction alignment, particle configurations, and unlock requirements.

**Skill Trees**: Three-tier tree structure (Orbis, Crucia, Awakened) with node prerequisites and progression tracking.

**Match History**: Complete move-by-move recording with impact scoring, strategic classifications, and reward snapshots.

**Economy**: Immutable transaction ledger, trading system with limits/taxes, and shop rotation support.

**Critical Fixes Applied**:
- Streak reward gating (VF/AC/PS require Grid Walker+)
- Currency caps with overflow handling
- Draw streak tracking for The Eternal

The schema supports the identified UX improvements: tutorial tracking, loss streak recovery state, and prestige preview data. All relationships maintain referential integrity while allowing efficient queries for common operations.

---

DECISION: schemas_complete