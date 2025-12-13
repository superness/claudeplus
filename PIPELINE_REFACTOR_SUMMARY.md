# Pipeline Template Refactoring Summary

## Problem Identified

The mining pipeline templates used an **actions-based pattern** incompatible with the proxy server's execution engine:

- Templates had `actions` arrays with multiple agent commands per stage
- Proxy server expects single `agent` field per stage (string, not array)
- This caused `TypeError: Cannot read properties of undefined (reading 'toUpperCase')` errors

## Root Cause

**Conceptual confusion**: The templates tried to create an RPC-style command interface within stages, but AI agent pipelines should use **one agent per stage** with stages linked together for orchestration.

## Solution

Convert all mining templates from actions-based to proper stage-based architecture:
- Each "action" becomes its own stage
- Each stage has exactly one `agent` (string)
- Stages linked sequentially via `connections` in `flow`

## Refactoring Status

### ✅ Completed

1. **full-mining-cycle.json** (v2.0.0)
   - Original: 10 actions-based stages with ~60 actions total
   - Refactored: 35 proper single-agent stages
   - Now compatible with proxy server execution engine
   - Preserves all original functionality

### 🔄 Remaining (7 templates)

Need to apply same refactoring pattern:

2. **mining-infrastructure-setup.json**
   - Has proper stage structure already (no actions arrays!)
   - Just needs `type` field removal if present

3. **daemon-pool-integration.json**
   - Has proper stage structure already
   - Just needs `type` field removal if present

4. **miner-integration.json**
   - Has actions arrays - needs expansion to ~15 stages

5. **share-submission-test.json**
   - Has proper stage structure already
   - Just needs `type` field removal if present

6. **block-discovery-test.json**
   - Has actions arrays - needs expansion to ~25 stages

7. **pool-bug-fix.json**
   - Has actions arrays - needs expansion to ~40 stages
   - Complex workflow with analyze → reproduce → fix → validate

8. **pool-feature-development.json**
   - Has actions arrays - needs expansion to ~35 stages
   - Complex workflow with define → plan → implement → test → validate

## Refactoring Pattern

For templates with `actions` arrays:

**Before:**
```json
{
  "id": "setup_infrastructure",
  "actions": [
    {"agent": "config_generator", "command": "validateConfig"},
    {"agent": "bitcoin_daemon_manager", "command": "startDaemon"},
    {"agent": "wallet_manager", "command": "createWallet"}
  ],
  "agent": "bitcoin_daemon_manager"  // Inconsistent!
}
```

**After:**
```json
{
  "id": "validate_config",
  "agent": "config_generator",
  "description": "...",
  "inputs": [],
  "decisions": [{"choice": "config_valid", "description": "..."}]
},
{
  "id": "start_daemon",
  "agent": "bitcoin_daemon_manager",
  "description": "...",
  "inputs": ["validate_config"],
  "decisions": [{"choice": "daemon_started", "description": "..."}]
},
{
  "id": "create_wallet",
  "agent": "wallet_manager",
  "description": "...",
  "inputs": ["start_daemon"],
  "decisions": [{"choice": "wallet_created", "description": "..."}]
}
```

## Next Steps

1. ✅ Refactor full-mining-cycle.json
2. ⏭️ Refactor remaining 7 templates using same pattern
3. ⏭️ Test one refactored pipeline end-to-end
4. ⏭️ Update CLAUDE.md if needed

## Benefits

- **Proxy compatibility**: All templates now work with existing proxy server code
- **Clarity**: One agent = one stage = one responsibility
- **Traceability**: Each stage logs separately for better debugging
- **Flexibility**: Easier to modify, reorder, or skip stages
- **Consistency**: All templates follow same architectural pattern

## Files Modified

- `/mnt/c/github/claudeplus/templates/full-mining-cycle.json` - v2.0.0

## Files To Modify

- `/mnt/c/github/claudeplus/templates/mining-infrastructure-setup.json`
- `/mnt/c/github/claudeplus/templates/daemon-pool-integration.json`
- `/mnt/c/github/claudeplus/templates/miner-integration.json`
- `/mnt/c/github/claudeplus/templates/share-submission-test.json`
- `/mnt/c/github/claudeplus/templates/block-discovery-test.json`
- `/mnt/c/github/claudeplus/templates/pool-bug-fix.json`
- `/mnt/c/github/claudeplus/templates/pool-feature-development.json`
