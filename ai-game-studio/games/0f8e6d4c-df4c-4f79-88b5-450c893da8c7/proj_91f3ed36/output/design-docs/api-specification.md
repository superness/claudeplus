# API Specification: Cosmic Tic-Tac-Toe - The Eternal Grid

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │
│  │   Web App    │    │  Mobile App  │    │ Desktop App  │                       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                       │
│         │                   │                   │                                │
│         └───────────────────┼───────────────────┘                                │
│                             │                                                    │
│                    ┌────────▼────────┐                                           │
│                    │   API Gateway   │ (Rate limiting, Auth, Load balancing)     │
│                    └────────┬────────┘                                           │
└─────────────────────────────┼───────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────────────────┐
│                      SERVICE LAYER                                               │
│         ┌───────────────────┼───────────────────┐                               │
│         │                   │                   │                               │
│  ┌──────▼──────┐    ┌───────▼───────┐   ┌──────▼──────┐                        │
│  │  Auth       │    │    Game       │   │  Economy    │                        │
│  │  Service    │    │    Service    │   │  Service    │                        │
│  └──────┬──────┘    └───────┬───────┘   └──────┬──────┘                        │
│         │                   │                   │                               │
│  ┌──────▼──────┐    ┌───────▼───────┐   ┌──────▼──────┐                        │
│  │ Progression │    │   Cosmetic    │   │  Trading    │                        │
│  │  Service    │    │   Service     │   │  Service    │                        │
│  └──────┬──────┘    └───────┬───────┘   └──────┬──────┘                        │
│         │                   │                   │                               │
│         └───────────────────┼───────────────────┘                               │
│                             │                                                    │
│                    ┌────────▼────────┐                                           │
│                    │  Event Bus      │ (Redis Pub/Sub)                           │
│                    └────────┬────────┘                                           │
└─────────────────────────────┼───────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────────────────┐
│                       DATA LAYER                                                 │
│         ┌───────────────────┼───────────────────┐                               │
│         │                   │                   │                               │
│  ┌──────▼──────┐    ┌───────▼───────┐   ┌──────▼──────┐                        │
│  │ PostgreSQL  │    │    Redis      │   │  S3/CDN     │                        │
│  │  Primary    │    │    Cache      │   │  Assets     │                        │
│  └─────────────┘    └───────────────┘   └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Boundaries

| Service | Responsibility | Database Tables Owned |
|---------|----------------|----------------------|
| **Auth Service** | Authentication, sessions, account management | `player`, `sessions` |
| **Game Service** | Match logic, AI opponents, move validation | `match`, `match_move`, `player_streak` |
| **Economy Service** | Currencies, transactions, caps, rewards | `player_wallet`, `wallet_transaction` |
| **Progression Service** | Levels, XP, achievements, skill trees | `player_progress`, `player_skills`, `skill_node`, `achievement` |
| **Cosmetic Service** | Items, inventory, loadouts, shop | `cosmetic_item`, `player_inventory`, `player_loadout`, `shop_rotation` |
| **Trading Service** | Player-to-player trades, limits | `trade`, `player_trade_limit` |

---

## API Base URL

```
Production: https://api.cosmictictactoe.com/v1
Staging:    https://api.staging.cosmictictactoe.com/v1
```

---

## Authentication & Authorization

### Authentication Flow

```
┌─────────┐                    ┌────────────┐                    ┌──────────────┐
│  Client │                    │ Auth       │                    │  PostgreSQL  │
│         │                    │ Service    │                    │              │
└────┬────┘                    └─────┬──────┘                    └──────┬───────┘
     │                               │                                  │
     │  POST /auth/login             │                                  │
     │  {email, password}            │                                  │
     │ ─────────────────────────────►│                                  │
     │                               │                                  │
     │                               │  Validate credentials            │
     │                               │ ────────────────────────────────►│
     │                               │                                  │
     │                               │  Player record                   │
     │                               │ ◄────────────────────────────────│
     │                               │                                  │
     │                               │  Generate JWT + Refresh token    │
     │                               │                                  │
     │  200 OK                       │                                  │
     │  {access_token, refresh_token}│                                  │
     │ ◄─────────────────────────────│                                  │
     │                               │                                  │
```

### Token Format

**Access Token (JWT)**
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "player_uuid",
    "username": "CosmicPlayer",
    "iat": 1704067200,
    "exp": 1704070800,
    "iss": "cosmictictactoe.com",
    "permissions": ["play", "trade", "customize"]
  }
}
```

**Token Lifetimes**
| Token Type | Lifetime | Storage |
|------------|----------|---------|
| Access Token | 1 hour | Memory only |
| Refresh Token | 30 days | Secure cookie (HttpOnly) |

### Authorization Header

```http
Authorization: Bearer <access_token>
```

### Permission Scopes

| Scope | Description | Required For |
|-------|-------------|--------------|
| `play` | Start and complete matches | All gameplay |
| `trade` | Execute trades | Trading endpoints |
| `customize` | Modify loadout | Cosmetic changes |
| `admin` | Administrative actions | Admin panel |

---

## API Endpoints

### Auth Service

#### POST /auth/register
Create new player account.

**Request**
```json
{
  "username": "CosmicPlayer",
  "email": "player@example.com",
  "password": "SecurePassword123!"
}
```

**Response (201 Created)**
```json
{
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "CosmicPlayer",
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "expires_in": 3600
}
```

**Error Responses**
| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_EMAIL` | Email format invalid |
| 400 | `WEAK_PASSWORD` | Password doesn't meet requirements |
| 409 | `USERNAME_TAKEN` | Username already exists |
| 409 | `EMAIL_EXISTS` | Email already registered |

---

#### POST /auth/login
Authenticate existing player.

**Request**
```json
{
  "email": "player@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK)**
```json
{
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "CosmicPlayer",
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "expires_in": 3600
}
```

---

#### POST /auth/refresh
Obtain new access token using refresh token.

**Request**
```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

**Response (200 OK)**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 3600
}
```

---

#### POST /auth/logout
Invalidate all tokens for current session.

**Response (200 OK)**
```json
{
  "message": "Successfully logged out"
}
```

---

### Game Service

#### POST /matches
Start a new match.

**Request**
```json
{
  "opponent_type": "ai",
  "ai_tier": "grid_walker",
  "symbol_choice": "o"
}
```

**Response (201 Created)**
```json
{
  "match_id": "660e8400-e29b-41d4-a716-446655440001",
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "opponent_type": "ai",
  "ai_tier": "grid_walker",
  "symbol_played": "o",
  "board": [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ],
  "current_turn": "player",
  "status": "in_progress",
  "streak_count_at_start": 3,
  "started_at": "2025-01-01T12:00:00Z"
}
```

**AI Tiers**
| Tier | Win Rate | Reward Multiplier |
|------|----------|-------------------|
| `void_novice` | 90% | 0.5x |
| `echoing_acolyte` | 70% | 0.75x |
| `grid_walker` | 50% | 1.0x |
| `force_adept` | 30% | 1.5x |
| `the_eternal` | 0% (draw only) | 2.0x |

---

#### POST /matches/{match_id}/moves
Execute a move in active match.

**Request**
```json
{
  "row": 1,
  "col": 1
}
```

**Response (200 OK)**
```json
{
  "match_id": "660e8400-e29b-41d4-a716-446655440001",
  "move": {
    "turn_number": 1,
    "row": 1,
    "col": 1,
    "symbol": "o",
    "is_player_move": true,
    "cell_value": 3,
    "move_type": "opening",
    "impact_score": 3.0
  },
  "board": [
    [null, null, null],
    [null, "o", null],
    [null, null, null]
  ],
  "ai_response": {
    "turn_number": 2,
    "row": 0,
    "col": 0,
    "symbol": "x",
    "is_player_move": false,
    "cell_value": 2,
    "move_type": "normal",
    "impact_score": 2.0
  },
  "board_after_ai": [
    ["x", null, null],
    [null, "o", null],
    [null, null, null]
  ],
  "current_turn": "player",
  "status": "in_progress"
}
```

**Error Responses**
| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_CELL` | Row/col out of bounds |
| 400 | `CELL_OCCUPIED` | Cell already has symbol |
| 400 | `NOT_YOUR_TURN` | It's opponent's turn |
| 404 | `MATCH_NOT_FOUND` | Match doesn't exist |
| 410 | `MATCH_ENDED` | Match already completed |

---

#### GET /matches/{match_id}
Get match state and history.

**Response (200 OK)**
```json
{
  "match_id": "660e8400-e29b-41d4-a716-446655440001",
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "opponent_type": "ai",
  "ai_tier": "grid_walker",
  "symbol_played": "o",
  "outcome": "win",
  "total_moves": 5,
  "duration_seconds": 45,
  "impact_score_total": 15.5,
  "was_swift_victory": true,
  "was_fork_victory": false,
  "was_comeback": false,
  "was_perfect_game": true,
  "moves": [
    {
      "turn_number": 1,
      "row": 1,
      "col": 1,
      "symbol": "o",
      "is_player_move": true,
      "move_type": "opening"
    }
  ],
  "rewards": {
    "cosmic_essence": 150,
    "starlight_orbs": 30,
    "void_fragments": 0,
    "alignment_crystals": 0,
    "primordial_sparks": 0,
    "cosmic_resonance": 100
  },
  "played_at": "2025-01-01T12:00:00Z"
}
```

---

#### GET /matches/active
Get player's current active match (if any).

**Response (200 OK)**
```json
{
  "match": {
    "match_id": "660e8400-e29b-41d4-a716-446655440001",
    "board": [...],
    "current_turn": "player",
    "status": "in_progress"
  }
}
```

**Response (204 No Content)**
No active match.

---

#### GET /matches/history
Get player's match history with pagination.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Results per page (max 100) |
| `offset` | integer | 0 | Skip N results |
| `outcome` | string | - | Filter: `win`, `loss`, `draw` |
| `symbol` | string | - | Filter: `o`, `x` |
| `ai_tier` | string | - | Filter by AI tier |

**Response (200 OK)**
```json
{
  "matches": [
    {
      "match_id": "...",
      "outcome": "win",
      "symbol_played": "o",
      "ai_tier": "grid_walker",
      "total_moves": 5,
      "impact_score_total": 15.5,
      "played_at": "2025-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

---

#### GET /players/{player_id}/streak
Get player's current streak status.

**Response (200 OK)**
```json
{
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "current_win_streak": 5,
  "best_win_streak": 12,
  "streak_protected": true,
  "current_draw_streak": 2,
  "best_draw_streak": 5,
  "last_match_outcome": "win",
  "next_streak_reward": {
    "wins_needed": 5,
    "reward": {
      "void_fragments": 3,
      "description": "5-Win Streak Bonus"
    }
  }
}
```

---

### Economy Service

#### GET /players/{player_id}/wallet
Get player's currency balances.

**Response (200 OK)**
```json
{
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "currencies": {
    "cosmic_essence": 15420,
    "starlight_orbs": 834,
    "shadow_shards": 612,
    "void_fragments": 45,
    "alignment_crystals": 12,
    "primordial_sparks": 2
  },
  "caps": {
    "void_fragments": 200,
    "alignment_crystals": 50,
    "primordial_sparks": 10
  },
  "warnings": [
    {
      "currency": "void_fragments",
      "current": 45,
      "cap": 200,
      "at_capacity_percent": 22.5
    }
  ],
  "updated_at": "2025-01-01T12:00:00Z"
}
```

---

#### GET /players/{player_id}/transactions
Get wallet transaction history.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Results per page |
| `offset` | integer | 0 | Skip N results |
| `type` | string | - | Filter by transaction type |
| `currency` | string | - | Filter by currency |

**Response (200 OK)**
```json
{
  "transactions": [
    {
      "txn_id": "770e8400-e29b-41d4-a716-446655440002",
      "txn_type": "match_reward",
      "resource": "cosmic_essence",
      "amount": 150,
      "balance_after": 15420,
      "source_type": "match",
      "source_id": "660e8400-e29b-41d4-a716-446655440001",
      "description": "Victory vs Grid Walker",
      "created_at": "2025-01-01T12:00:45Z"
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

---

#### POST /currency/convert
Convert currencies (intentionally inefficient rate).

**Request**
```json
{
  "from_currency": "cosmic_essence",
  "to_currency": "starlight_orbs",
  "amount": 500
}
```

**Response (200 OK)**
```json
{
  "conversion": {
    "from_currency": "cosmic_essence",
    "from_amount": 500,
    "to_currency": "starlight_orbs",
    "to_amount": 10,
    "rate": "50:1"
  },
  "wallet_after": {
    "cosmic_essence": 14920,
    "starlight_orbs": 844
  }
}
```

**Conversion Rates**
| From | To | Rate |
|------|----|------|
| Cosmic Essence | Starlight Orbs | 50:1 |
| Cosmic Essence | Shadow Shards | 50:1 |
| Starlight Orbs | Cosmic Essence | 1:25 |
| Shadow Shards | Cosmic Essence | 1:25 |

---

### Progression Service

#### GET /players/{player_id}/progress
Get player's progression state.

**Response (200 OK)**
```json
{
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "level": 45,
  "cosmic_resonance": 4200,
  "cosmic_resonance_to_next": 6500,
  "prestige_level": 0,
  "total_matches": 200,
  "total_wins": 140,
  "total_draws": 20,
  "total_losses": 40,
  "wins_as_o": 75,
  "wins_as_x": 65,
  "draws_vs_eternal": 3,
  "perfect_games": 12,
  "swift_victories": 8,
  "fork_victories": 15,
  "comeback_victories": 5,
  "first_match_date": "2024-10-15",
  "unlocks": {
    "skill_tree": true,
    "trading": true,
    "grid_walker_ai": true,
    "force_adept_ai": false,
    "the_eternal_ai": false
  }
}
```

---

#### GET /players/{player_id}/skills
Get player's skill tree progress.

**Response (200 OK)**
```json
{
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "trees": [
    {
      "tree_id": "orbis",
      "name": "Path of Orbis",
      "faction": "orbis",
      "nodes_unlocked": 8,
      "total_nodes": 12,
      "total_invested": {
        "starlight_orbs": 750
      },
      "is_mastered": false,
      "branches": [
        {
          "branch": "orbit",
          "unlocked_nodes": [
            {
              "node_id": "orbis_orbit_t1",
              "name": "Azure Glow",
              "tier": 1,
              "unlocked_at": "2024-11-01T10:00:00Z"
            }
          ],
          "locked_nodes": [
            {
              "node_id": "orbis_orbit_t4",
              "name": "Gravitational Pull",
              "tier": 4,
              "cost": {
                "starlight_orbs": 200,
                "alignment_crystals": 2
              },
              "prerequisites": ["orbis_orbit_t3"]
            }
          ]
        }
      ]
    }
  ],
  "awakened_path": {
    "accessible": false,
    "requirements": {
      "orbis_mastery": false,
      "crucia_mastery": false,
      "wins_as_o": 75,
      "wins_as_x": 65,
      "required_wins": 50
    }
  }
}
```

---

#### POST /players/{player_id}/skills/{node_id}/unlock
Unlock a skill tree node.

**Response (200 OK)**
```json
{
  "unlocked": {
    "node_id": "orbis_orbit_t2",
    "name": "Orbital Ring",
    "tier": 2,
    "effect": {
      "type": "symbol_enhancement",
      "config": {
        "ring_count": 1,
        "ring_color": "#4DA6FF"
      }
    }
  },
  "currency_spent": {
    "starlight_orbs": 100
  },
  "wallet_after": {
    "starlight_orbs": 734
  },
  "tree_progress": {
    "nodes_unlocked": 9,
    "total_nodes": 12
  }
}
```

**Error Responses**
| Code | Error | Description |
|------|-------|-------------|
| 400 | `INSUFFICIENT_CURRENCY` | Not enough currency |
| 400 | `PREREQUISITE_NOT_MET` | Required node not unlocked |
| 400 | `ALREADY_UNLOCKED` | Node already owned |

---

#### GET /players/{player_id}/achievements
Get player's achievement progress.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | - | Filter: `combat`, `progression`, `collection`, `social` |
| `status` | string | - | Filter: `complete`, `in_progress`, `locked` |

**Response (200 OK)**
```json
{
  "achievements": [
    {
      "achieve_id": "880e8400-e29b-41d4-a716-446655440003",
      "achieve_code": "first_blood",
      "name": "First Blood",
      "description": "Win your first match",
      "tier": "bronze",
      "category": "combat",
      "is_complete": true,
      "unlocked_at": "2024-10-15T10:05:00Z",
      "reward_claimed": true
    },
    {
      "achieve_id": "880e8400-e29b-41d4-a716-446655440004",
      "achieve_code": "century",
      "name": "Century",
      "description": "Win 100 matches",
      "tier": "gold",
      "category": "combat",
      "is_progressive": true,
      "current_progress": 140,
      "target_count": 100,
      "is_complete": true,
      "reward_claimed": false,
      "rewards": {
        "void_fragments": 5,
        "cosmic_resonance": 500
      }
    }
  ],
  "summary": {
    "total": 50,
    "complete": 28,
    "in_progress": 15,
    "locked": 7
  }
}
```

---

#### POST /players/{player_id}/achievements/{achieve_id}/claim
Claim rewards for completed achievement.

**Response (200 OK)**
```json
{
  "achievement": {
    "achieve_code": "century",
    "name": "Century"
  },
  "rewards_claimed": {
    "void_fragments": 5,
    "cosmic_resonance": 500
  },
  "wallet_after": {
    "void_fragments": 50
  },
  "title_unlocked": null
}
```

---

### Cosmetic Service

#### GET /cosmetics
Get available cosmetic items.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | - | Filter by category |
| `tier` | string | - | Filter by rarity tier |
| `faction` | string | - | Filter: `orbis`, `crucia`, `neutral`, `awakened` |
| `affordable` | boolean | - | Filter by player's current wallet |

**Response (200 OK)**
```json
{
  "items": [
    {
      "item_id": "990e8400-e29b-41d4-a716-446655440005",
      "item_code": "trail_azure_basic",
      "name": "Azure Trail",
      "description": "A soft azure glow follows your O symbols",
      "category": "symbol_trail",
      "tier": "common",
      "faction": "orbis",
      "price": {
        "cosmic_essence": 800
      },
      "unlock_requirements": null,
      "preview_url": "https://cdn.cosmictictactoe.com/previews/trail_azure_basic.webm",
      "is_owned": true,
      "is_equipped": false,
      "is_available": true
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

---

#### GET /players/{player_id}/inventory
Get player's owned cosmetic items.

**Response (200 OK)**
```json
{
  "inventory": [
    {
      "inventory_id": "aa0e8400-e29b-41d4-a716-446655440006",
      "item_id": "990e8400-e29b-41d4-a716-446655440005",
      "item_code": "trail_azure_basic",
      "name": "Azure Trail",
      "category": "symbol_trail",
      "tier": "common",
      "is_equipped": false,
      "acquired_at": "2024-10-20T14:00:00Z",
      "acquisition_type": "purchase"
    }
  ],
  "collection_stats": {
    "total_owned": 25,
    "by_tier": {
      "common": 12,
      "uncommon": 8,
      "rare": 4,
      "epic": 1,
      "legendary": 0
    },
    "completion_percent": 16.7
  }
}
```

---

#### POST /cosmetics/{item_id}/purchase
Purchase a cosmetic item.

**Response (200 OK)**
```json
{
  "purchased": {
    "item_id": "990e8400-e29b-41d4-a716-446655440005",
    "name": "Azure Trail",
    "tier": "common"
  },
  "price_paid": {
    "cosmic_essence": 800
  },
  "wallet_after": {
    "cosmic_essence": 14620
  },
  "inventory_id": "aa0e8400-e29b-41d4-a716-446655440006"
}
```

**Error Responses**
| Code | Error | Description |
|------|-------|-------------|
| 400 | `INSUFFICIENT_FUNDS` | Not enough currency |
| 400 | `ALREADY_OWNED` | Item already in inventory |
| 400 | `REQUIREMENTS_NOT_MET` | Unlock requirements not satisfied |
| 400 | `ITEM_UNAVAILABLE` | Limited item not available |

---

#### GET /players/{player_id}/loadout
Get player's equipped cosmetics.

**Response (200 OK)**
```json
{
  "loadout": {
    "symbol_trail_o": {
      "item_id": "990e8400-e29b-41d4-a716-446655440005",
      "name": "Azure Trail"
    },
    "symbol_trail_x": null,
    "symbol_evolution_o": null,
    "symbol_evolution_x": null,
    "cell_animation": {
      "item_id": "...",
      "name": "Ripple Effect"
    },
    "grid_skin": null,
    "victory_effect": null,
    "profile_frame": null,
    "active_title": {
      "item_id": "...",
      "name": "Novice"
    }
  }
}
```

---

#### PUT /players/{player_id}/loadout
Update player's equipped loadout.

**Request**
```json
{
  "symbol_trail_o": "990e8400-e29b-41d4-a716-446655440005",
  "grid_skin": null
}
```

**Response (200 OK)**
```json
{
  "loadout": {
    "symbol_trail_o": {
      "item_id": "990e8400-e29b-41d4-a716-446655440005",
      "name": "Azure Trail"
    },
    "grid_skin": null
  },
  "updated_at": "2025-01-01T12:00:00Z"
}
```

---

#### GET /shop/daily
Get today's shop rotation.

**Response (200 OK)**
```json
{
  "rotation_date": "2025-01-01",
  "refreshes_at": "2025-01-02T00:00:00Z",
  "slots": [
    {
      "slot_number": 1,
      "item": {
        "item_id": "...",
        "name": "Crimson Blaze",
        "category": "symbol_trail",
        "tier": "uncommon"
      },
      "is_featured": true,
      "discount_percent": 20,
      "original_price": {
        "shadow_shards": 100
      },
      "sale_price": {
        "shadow_shards": 80
      },
      "stock_remaining": null
    }
  ]
}
```

---

### Trading Service

#### GET /trading/status
Check if trading is available for player.

**Response (200 OK)**
```json
{
  "trading_enabled": true,
  "unlock_requirements": {
    "matches_required": 50,
    "matches_played": 200,
    "met": true
  },
  "daily_limit": {
    "max_trades": 5,
    "trades_today": 2,
    "remaining": 3,
    "resets_at": "2025-01-02T00:00:00Z"
  },
  "tax_rate": 0.10
}
```

---

#### POST /trades
Create a trade offer to another player.

**Request**
```json
{
  "receiver_username": "OtherPlayer",
  "resource_type": "starlight_orbs",
  "amount": 50
}
```

**Response (201 Created)**
```json
{
  "trade_id": "bb0e8400-e29b-41d4-a716-446655440007",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "receiver_id": "cc0e8400-e29b-41d4-a716-446655440008",
  "resource_type": "starlight_orbs",
  "amount_sent": 50,
  "tax_amount": 5,
  "amount_received": 45,
  "status": "completed",
  "executed_at": "2025-01-01T12:00:00Z",
  "wallet_after": {
    "starlight_orbs": 784
  }
}
```

**Error Responses**
| Code | Error | Description |
|------|-------|-------------|
| 400 | `TRADING_LOCKED` | Player hasn't unlocked trading |
| 400 | `DAILY_LIMIT_REACHED` | Max 5 trades per day |
| 400 | `INVALID_AMOUNT` | Amount must be 5-50 |
| 400 | `INSUFFICIENT_FUNDS` | Not enough currency |
| 400 | `SELF_TRADE` | Cannot trade with yourself |
| 404 | `RECEIVER_NOT_FOUND` | Target player doesn't exist |

---

### WebSocket API (Real-time Events)

#### Connection
```
wss://api.cosmictictactoe.com/v1/ws
```

**Authentication**
```json
{
  "type": "auth",
  "token": "eyJhbGciOiJSUzI1NiIs..."
}
```

#### Event Types

**Match Updates**
```json
{
  "type": "match_update",
  "match_id": "660e8400-e29b-41d4-a716-446655440001",
  "event": "opponent_move",
  "data": {
    "turn_number": 4,
    "row": 2,
    "col": 0,
    "symbol": "x"
  }
}
```

**Match Complete**
```json
{
  "type": "match_complete",
  "match_id": "660e8400-e29b-41d4-a716-446655440001",
  "outcome": "win",
  "rewards": {
    "cosmic_essence": 150,
    "starlight_orbs": 30
  },
  "streak_update": {
    "new_streak": 6,
    "streak_reward_earned": null
  }
}
```

**Achievement Unlocked**
```json
{
  "type": "achievement_unlocked",
  "achievement": {
    "achieve_code": "swift_striker",
    "name": "Swift Striker",
    "description": "Win in exactly 5 moves"
  }
}
```

**Level Up**
```json
{
  "type": "level_up",
  "old_level": 44,
  "new_level": 45,
  "unlocks": [
    {
      "type": "ai_tier",
      "value": "force_adept",
      "name": "Force Adept AI"
    }
  ]
}
```

**Daily Challenge Progress**
```json
{
  "type": "challenge_progress",
  "challenge": {
    "name": "Win 3 matches as O",
    "progress": 2,
    "target": 3
  }
}
```

---

## Error Codes and Handling

### Standard Error Response Format

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Not enough Starlight Orbs to complete purchase",
    "details": {
      "required": 100,
      "available": 45
    }
  },
  "request_id": "req_abc123xyz",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Global Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | `BAD_REQUEST` | Malformed request body |
| 400 | `VALIDATION_ERROR` | Input validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid auth token |
| 401 | `TOKEN_EXPIRED` | Access token has expired |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Resource state conflict |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Maintenance mode |

---

## Rate Limiting

### Limits by Endpoint Category

| Category | Requests/Minute | Burst |
|----------|-----------------|-------|
| Auth | 10 | 20 |
| Match Actions | 60 | 100 |
| Read Operations | 120 | 200 |
| Write Operations | 30 | 50 |
| WebSocket | 1 connection | - |

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067260
```

### Rate Limited Response (429)

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retry_after": 15
  }
}
```

---

## Performance Considerations

### Caching Strategy

| Endpoint | Cache TTL | Cache Key | Invalidation |
|----------|-----------|-----------|--------------|
| GET /cosmetics | 1 hour | `cosmetics:all` | Deploy |
| GET /shop/daily | Until midnight | `shop:{date}` | Daily rotation |
| GET /players/{id}/progress | 5 min | `progress:{id}` | On match end |
| GET /players/{id}/wallet | 30 sec | `wallet:{id}` | On transaction |
| GET /players/{id}/loadout | 10 min | `loadout:{id}` | On equip |

### Response Size Limits

- Maximum response body: 1 MB
- Maximum page size: 100 items
- Pagination required for lists > 20 items

### Expected Latencies

| Operation | Target P50 | Target P99 |
|-----------|------------|------------|
| Auth | 50ms | 200ms |
| Read | 20ms | 100ms |
| Write | 50ms | 250ms |
| Match Move | 100ms | 300ms |

---

## API Versioning

### Version Header
```http
API-Version: 2025-01-01
```

### Deprecation Policy
- 6 months notice before breaking changes
- Deprecated endpoints return `X-Deprecated: true` header
- Version sunset dates in `X-Sunset: 2025-07-01`

---

## Security Considerations

### Input Validation
- All string inputs sanitized for XSS
- SQL injection prevented via parameterized queries
- Maximum string lengths enforced per field

### CORS Configuration
```
Access-Control-Allow-Origin: https://cosmictictactoe.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

### Content Security
- All responses include `Content-Security-Policy` header
- HTTPS enforced via HSTS
- JSON responses include `X-Content-Type-Options: nosniff`

---

## SDK Example (JavaScript)

```javascript
import { CosmicTicTacToeClient } from '@cosmictictactoe/sdk';

const client = new CosmicTicTacToeClient({
  baseUrl: 'https://api.cosmictictactoe.com/v1'
});

// Login
const { accessToken } = await client.auth.login({
  email: 'player@example.com',
  password: 'password'
});

// Start a match
const match = await client.matches.create({
  opponent_type: 'ai',
  ai_tier: 'grid_walker',
  symbol_choice: 'o'
});

// Make a move
const result = await client.matches.move(match.match_id, {
  row: 1,
  col: 1
});

// Listen for real-time events
client.ws.on('match_complete', (event) => {
  console.log(`Match won! Earned ${event.rewards.cosmic_essence} Essence`);
});
```

---

## Summary

This API specification defines a comprehensive RESTful interface for Cosmic Tic-Tac-Toe organized across six microservices:

- **Auth Service**: JWT-based authentication with refresh tokens
- **Game Service**: Match creation, move execution, and history
- **Economy Service**: Currency management with caps and transactions
- **Progression Service**: Levels, skills, and achievements
- **Cosmetic Service**: Items, inventory, loadouts, and shop
- **Trading Service**: Player-to-player resource exchange

Key features:
- WebSocket support for real-time match and event updates
- Comprehensive error handling with detailed error codes
- Rate limiting per endpoint category
- Caching strategy for performance optimization
- Security best practices (CORS, CSP, HTTPS)

DECISION: apis_complete
