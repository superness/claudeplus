# Cosmic Tic-Tac-Toe: The Eternal Grid

A spectacular tic-tac-toe game with cosmetic progression, skill trees, and a deep economy system.

## Project Structure

```
output/
├── src/
│   ├── models/          # Entity classes
│   │   ├── Player.js
│   │   ├── PlayerProgress.js
│   │   ├── PlayerWallet.js
│   │   ├── Match.js
│   │   ├── CosmeticItem.js
│   │   ├── Achievement.js
│   │   └── SkillTree.js
│   ├── api/             # Express route handlers
│   │   ├── authRoutes.js
│   │   ├── gameRoutes.js
│   │   ├── economyRoutes.js
│   │   ├── progressionRoutes.js
│   │   ├── cosmeticRoutes.js
│   │   ├── tradingRoutes.js
│   │   └── middleware/auth.js
│   ├── data/            # Repository pattern data access
│   │   ├── BaseRepository.js
│   │   ├── PlayerRepository.js
│   │   └── MatchRepository.js
│   ├── services/        # Business logic
│   │   ├── AuthService.js
│   │   ├── GameService.js
│   │   ├── EconomyService.js
│   │   ├── ProgressionService.js
│   │   └── TradingService.js
│   ├── tests/           # Unit tests (Jest)
│   │   ├── models.test.js
│   │   ├── services.test.js
│   │   └── api.test.js
│   └── config/          # Application config
│       └── index.js
├── config/
│   ├── database.sql     # PostgreSQL schema
│   └── .env.example     # Environment template
└── package.json
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (optional, for caching)

### Installation

```bash
cd output
npm install
```

### Database Setup

```bash
# Create database
createdb cosmic_tictactoe

# Run schema
psql cosmic_tictactoe < config/database.sql
```

### Configuration

```bash
cp config/.env.example .env
# Edit .env with your settings
```

### Run

```bash
# Development
npm run dev

# Production
npm start

# Tests
npm test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Login |
| POST | /auth/refresh | Refresh token |
| POST | /matches | Start match |
| POST | /matches/:id/moves | Make move |
| GET | /players/:id/wallet | Get currencies |
| GET | /players/:id/progress | Get level/stats |
| POST | /cosmetics/:id/purchase | Buy item |

## Game Systems

- **5 AI Tiers**: Void Novice (0.5x) → The Eternal (2x rewards)
- **6 Currencies**: Cosmic Essence, Starlight Orbs, Shadow Shards, Void Fragments, Alignment Crystals, Primordial Sparks
- **Currency Caps**: VF=200, AC=50, PS=10
- **Skill Trees**: Orbis (O), Crucia (X), Awakened
- **Trading**: 5 trades/day, 10% tax, 5-50 amount range

## Key Features

- JWT authentication (HS256 symmetric keys)
- Token blacklist via Redis for secure logout
- Currency cap enforcement via DB triggers
- Streak rewards gated to Grid Walker+ AI tier
- Repository pattern for data access
- Factory function pattern for dependency injection
- Full test coverage templates

## Architecture

The application uses proper dependency injection with factory functions:

```javascript
// Services are instantiated with database/redis connections
const authService = new AuthService(db, redis);
const gameService = new GameService(db);
const economyService = new EconomyService(db);
const progressionService = new ProgressionService(db);
const tradingService = new TradingService(db);

// Routes receive services via factory functions
app.use('/api/v1/auth', createAuthRoutes(authService));
app.use('/api/v1/matches', createGameRoutes(gameService, authService));
app.use('/api/v1/economy', createEconomyRoutes(economyService, authService));
app.use('/api/v1/progression', createProgressionRoutes(progressionService, authService));
app.use('/api/v1/trading', createTradingRoutes(tradingService, authService));
```

## Balance Safeguards

The following critical balance protections are implemented:

1. **Streak Reward Gating**: Rare currencies (Void Fragments, Alignment Crystals, Primordial Sparks) are ONLY awarded from streak bonuses when playing against Grid Walker or higher AI tiers. This prevents the "Streak Shield Farm" exploit.

2. **Currency Caps**: Enforced at both application and database levels:
   - Void Fragments: max 200
   - Alignment Crystals: max 50
   - Primordial Sparks: max 10

3. **Trading Limits**:
   - 5 trades per day per player
   - 10% tax on all trades
   - Only common currencies (Starlight Orbs, Shadow Shards) are tradeable
   - Requires 50 matches played to unlock

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development |
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| DB_NAME | Database name | cosmic_tictactoe |
| DB_USER | Database user | postgres |
| JWT_SECRET | JWT signing key | (required in production) |
| JWT_REFRESH_SECRET | Refresh token key | (required in production) |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |
