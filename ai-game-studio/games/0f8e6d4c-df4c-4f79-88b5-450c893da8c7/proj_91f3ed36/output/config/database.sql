-- Cosmic Tic-Tac-Toe Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE cosmetic_tier AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary', 'prestige');
CREATE TYPE cosmetic_category AS ENUM ('symbol_trail', 'cell_animation', 'grid_skin', 'victory_effect', 'profile_frame', 'title', 'symbol_evolution_o', 'symbol_evolution_x');
CREATE TYPE faction_type AS ENUM ('orbis', 'crucia', 'neutral', 'awakened');
CREATE TYPE ai_tier AS ENUM ('void_novice', 'echoing_acolyte', 'grid_walker', 'force_adept', 'the_eternal');
CREATE TYPE match_outcome AS ENUM ('win', 'loss', 'draw');
CREATE TYPE symbol_type AS ENUM ('o', 'x');
CREATE TYPE achievement_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'legendary');
CREATE TYPE resource_type AS ENUM ('cosmic_essence', 'starlight_orbs', 'shadow_shards', 'void_fragments', 'alignment_crystals', 'primordial_sparks');
CREATE TYPE transaction_type AS ENUM ('match_reward', 'streak_bonus', 'daily_challenge', 'weekly_challenge', 'achievement', 'milestone', 'purchase', 'conversion', 'trade_send', 'trade_receive', 'trade_tax', 'skill_unlock', 'consumable_use', 'seasonal_reward', 'prestige_bonus', 'admin_grant');

-- Player tables
CREATE TABLE player (
    player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(48),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    account_flags INTEGER DEFAULT 0
);

CREATE TABLE player_progress (
    player_id UUID PRIMARY KEY REFERENCES player(player_id),
    level INTEGER DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
    cosmic_resonance INTEGER DEFAULT 0,
    prestige_level INTEGER DEFAULT 0 CHECK (prestige_level BETWEEN 0 AND 10),
    total_matches INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_draws INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    wins_as_o INTEGER DEFAULT 0,
    wins_as_x INTEGER DEFAULT 0,
    draws_vs_eternal INTEGER DEFAULT 0,
    perfect_games INTEGER DEFAULT 0,
    swift_victories INTEGER DEFAULT 0,
    fork_victories INTEGER DEFAULT 0,
    comeback_victories INTEGER DEFAULT 0,
    first_match_date DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE player_wallet (
    player_id UUID PRIMARY KEY REFERENCES player(player_id),
    cosmic_essence INTEGER DEFAULT 0 CHECK (cosmic_essence >= 0),
    starlight_orbs INTEGER DEFAULT 0 CHECK (starlight_orbs >= 0),
    shadow_shards INTEGER DEFAULT 0 CHECK (shadow_shards >= 0),
    void_fragments INTEGER DEFAULT 0 CHECK (void_fragments BETWEEN 0 AND 200),
    alignment_crystals INTEGER DEFAULT 0 CHECK (alignment_crystals BETWEEN 0 AND 50),
    primordial_sparks INTEGER DEFAULT 0 CHECK (primordial_sparks BETWEEN 0 AND 10),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE player_streak (
    player_id UUID PRIMARY KEY REFERENCES player(player_id),
    current_win_streak INTEGER DEFAULT 0,
    best_win_streak INTEGER DEFAULT 0,
    streak_protected BOOLEAN DEFAULT FALSE,
    current_draw_streak INTEGER DEFAULT 0,
    best_draw_streak INTEGER DEFAULT 0,
    last_match_outcome VARCHAR(16),
    last_match_at TIMESTAMP WITH TIME ZONE
);

-- Match tables
CREATE TABLE match (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES player(player_id) NOT NULL,
    opponent_type VARCHAR(16) NOT NULL DEFAULT 'ai',
    opponent_player_id UUID REFERENCES player(player_id),
    ai_tier ai_tier,
    symbol_played symbol_type NOT NULL,
    outcome match_outcome,
    total_moves INTEGER CHECK (total_moves BETWEEN 5 AND 9),
    duration_seconds INTEGER,
    impact_score_total FLOAT DEFAULT 0,
    was_swift_victory BOOLEAN DEFAULT FALSE,
    was_fork_victory BOOLEAN DEFAULT FALSE,
    was_comeback BOOLEAN DEFAULT FALSE,
    was_perfect_game BOOLEAN DEFAULT FALSE,
    streak_count_at_start INTEGER DEFAULT 0,
    streak_shield_used BOOLEAN DEFAULT FALSE,
    essence_earned INTEGER DEFAULT 0,
    orbs_earned INTEGER DEFAULT 0,
    shards_earned INTEGER DEFAULT 0,
    void_frags_earned INTEGER DEFAULT 0,
    align_crystals_earned INTEGER DEFAULT 0,
    prim_sparks_earned INTEGER DEFAULT 0,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE match_move (
    move_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES match(match_id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL CHECK (turn_number BETWEEN 1 AND 9),
    cell_row INTEGER NOT NULL CHECK (cell_row BETWEEN 0 AND 2),
    cell_col INTEGER NOT NULL CHECK (cell_col BETWEEN 0 AND 2),
    symbol symbol_type NOT NULL,
    is_player_move BOOLEAN NOT NULL,
    cell_value INTEGER,
    move_type VARCHAR(32),
    impact_score FLOAT DEFAULT 0,
    timestamp_ms BIGINT,
    UNIQUE(match_id, turn_number)
);

-- Wallet transactions (audit log)
CREATE TABLE wallet_transaction (
    txn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES player(player_id) NOT NULL,
    txn_type transaction_type NOT NULL,
    resource resource_type NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    source_id UUID,
    source_type VARCHAR(32),
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trading tables
CREATE TABLE trade (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES player(player_id) NOT NULL,
    receiver_id UUID REFERENCES player(player_id) NOT NULL,
    resource_type resource_type NOT NULL,
    amount_sent INTEGER NOT NULL CHECK (amount_sent BETWEEN 5 AND 50),
    tax_amount INTEGER NOT NULL,
    amount_received INTEGER NOT NULL,
    status VARCHAR(16) DEFAULT 'completed',
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (sender_id != receiver_id)
);

CREATE TABLE player_trade_limit (
    player_id UUID REFERENCES player(player_id),
    trade_date DATE NOT NULL,
    trades_today INTEGER DEFAULT 0,
    PRIMARY KEY (player_id, trade_date)
);

-- Indexes
CREATE INDEX idx_player_username ON player(username);
CREATE INDEX idx_match_player ON match(player_id);
CREATE INDEX idx_match_played_at ON match(played_at);
CREATE INDEX idx_wallet_txn_player ON wallet_transaction(player_id, created_at DESC);

-- Currency cap enforcement trigger
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
