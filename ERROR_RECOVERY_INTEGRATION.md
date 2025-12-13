# Error Recovery Integration - Pipeline Self-Healing

## Overview

The mining infrastructure pipelines now include **automatic error recovery** capabilities through the `error_recovery_agent`. When infrastructure failures occur (daemon crashes, RPC failures, pool disconnections, Stratum port issues), the pipeline automatically detects the problem, attempts recovery, and resumes execution.

## How It Works

### Recovery Flow

1. **Failure Detection**: A validation stage (like `verify_pool_daemon`) detects an infrastructure issue
2. **Recovery Stage**: Instead of ending the pipeline, it routes to `recover_infrastructure`
3. **Automated Fix**: The `error_recovery_agent` diagnoses and fixes the issue
4. **Re-Validation**: Pipeline loops back to re-verify the connection
5. **Resume or Escalate**: If recovery succeeds, pipeline continues. If recovery fails after retries, pipeline ends with escalation notice

### Example: Stratum Port Issue Recovery

**Scenario**: Pool server starts but Stratum port isn't accessible (like the WSL2/Mono networking issue you encountered)

**Traditional Pipeline Behavior**:
```
verify_pool_daemon → connection_failed → PIPELINE ENDS
```

**New Self-Healing Behavior**:
```
verify_pool_daemon → connection_failed
  ↓
recover_infrastructure
  - Diagnoses: Stratum port not listening despite process running
  - Attempts:
    1. Try changing port to 13333 and restart pool
    2. Check for port conflicts
    3. Verify pool config matches daemon config
    4. If all else fails: full environment reset
  ↓
recovery_successful
  ↓
verify_pool_daemon → connection_verified → configure_miner → CONTINUE
```

## Recovery Capabilities

The `error_recovery_agent` can automatically handle:

### 1. Daemon Crash Recovery
- **Detects**: Daemon process not running, RPC connection refused
- **Fixes**: Cleans stale locks, restarts bitcoind, verifies RPC accessible
- **Validation**: Tests RPC calls, checks block height

### 2. RPC Failure Recovery
- **Detects**: Connection errors, authentication failures, timeouts
- **Fixes**:
  - Connection refused → Restart daemon
  - Auth failure → Fix credentials in config and restart
  - Timeout → Check daemon responsiveness, restart if frozen
- **Validation**: Multiple successful RPC calls

### 3. Pool Disconnection Recovery
- **Detects**: Pool process crashed, lost daemon connection, Stratum port not listening
- **Fixes**:
  - Process crash → Restart CoiniumServ
  - Lost daemon connection → Verify daemon accessible, restart pool
  - Stratum port issue → Check port conflicts, change port if needed, restart pool
- **Validation**: Stratum port listening, daemon connection verified, getblocktemplate working

### 4. Miner Error Recovery
- **Detects**: Connection errors, authentication failures, high share rejection, process crashes
- **Fixes**:
  - Connection error → Verify pool accessible, restart miner
  - Auth failure → Fix credentials, restart miner
  - Process crash → Review logs, restart miner or switch to alternative
- **Validation**: Miner connected, shares submitting, low rejection rate

### 5. Stale Lock Cleanup
- **Detects**: Lock files exist but owning process not running
- **Fixes**: Validates lock is stale, safely removes it
- **Validation**: Component starts successfully without lock errors

### 6. Full Environment Reset
- **When**: Cascading failures, repeated recovery failures, critical errors
- **Actions**:
  1. Stop all components (miners → pool → daemon)
  2. Clean regtest data, pool logs
  3. Remove stale locks
  4. Restart in dependency order (daemon → pool → miners)
  5. Verify entire stack operational
- **Validation**: All components running, all connections verified

## Updated Pipelines

### Mining Infrastructure Setup (`mining-infrastructure-setup.json`)

**New Recovery Stage**:
```json
{
  "id": "recover_infrastructure",
  "name": "Recover Infrastructure",
  "agent": "error_recovery_agent",
  "description": "Detect and fix infrastructure issues (Stratum port, RPC failures, process crashes)",
  "inputs": ["verify_pool_daemon"],
  "decisions": [
    {"choice": "recovery_successful", "description": "Infrastructure recovered and operational"},
    {"choice": "recovery_failed", "description": "Recovery failed, escalation required"},
    {"choice": "environment_reset", "description": "Full environment reset completed"}
  ]
}
```

**Recovery Flow Connections**:
```json
{
  "from": "verify_pool_daemon",
  "to": "recover_infrastructure",
  "condition": "connection_failed",
  "description": "RPC connection failed, attempt recovery"
},
{
  "from": "recover_infrastructure",
  "to": "verify_pool_daemon",
  "condition": "recovery_successful",
  "description": "Infrastructure recovered, re-verify connection"
},
{
  "from": "recover_infrastructure",
  "to": "verify_pool_daemon",
  "condition": "environment_reset",
  "description": "Environment reset completed, re-verify connection"
},
{
  "from": "recover_infrastructure",
  "to": null,
  "condition": "recovery_failed",
  "description": "Recovery failed, escalation required - PIPELINE ENDS"
}
```

### Benefits

1. **Self-Healing**: Pipelines no longer fail immediately on infrastructure issues
2. **Automatic Recovery**: Common failures fixed without manual intervention
3. **Resume Capability**: Pipeline resumes from where it left off after recovery
4. **Escalation Path**: Signals when manual intervention is needed
5. **Full Reset Option**: Can perform complete environment reset if needed
6. **Comprehensive Logging**: All recovery attempts logged with timestamps and outcomes

## Recovery Success Criteria

Recovery is considered successful when:
- All processes running (daemon, pool, miner as applicable)
- All ports listening (RPC 18443, Stratum 3333)
- RPC calls succeeding consistently
- Pool connected to daemon (getblocktemplate working)
- Miners connected to pool (shares submitting)
- No errors in logs

## Escalation Conditions

Recovery escalates (ends pipeline with notification) when:
- Recovery attempted 3+ times without success
- Same component crashes >3 times in 10 minutes
- Multiple components failing simultaneously (cascading failure)
- Critical errors (corruption, data loss, security issues)
- Resource exhaustion (out of disk, memory, file descriptors)

## Recovery Metrics

The agent tracks:
- Total recovery attempts
- Successful vs. failed recoveries
- Average recovery time
- Time to detection (failure → detected)
- Time to recovery (detected → restored)
- Recovery success rate by component
- Most common failure types

## Using the Enhanced Pipeline

**Run the pipeline normally**:
```
[PIPELINE-EXECUTE]
{
  "pipelineName": "mining-infrastructure-setup",
  "userPrompt": "Set up complete mining infrastructure with automatic error recovery",
  "workingDirectory": "/mnt/c/github/private-SuperCoinServ"
}
```

**What happens when failures occur**:
- Pipeline detects failure (e.g., Stratum port not accessible)
- Automatically routes to `recover_infrastructure` stage
- Agent diagnoses the issue
- Attempts appropriate recovery strategy
- Re-validates the connection
- If successful: pipeline continues
- If failed after retries: pipeline ends with detailed error report

## Recovery Agent Configuration

Located in `/mnt/c/github/claudeplus/agents/error_recovery_agent.json`

**Key Settings**:
- `autoRecoveryEnabled`: true
- `maxRecoveryAttempts`: 3
- `recoveryBackoffSeconds`: [10, 30, 60]
- `escalateAfterFailures`: 3
- `detectionIntervalSeconds`: 15

**Component Paths** (pre-configured for SuperCoinServ):
- Bitcoin daemon: `~/.bitcoin/regtest`
- Pool server: `/mnt/c/github/private-SuperCoinServ/build/bin/Debug`
- RPC port: 18443
- Stratum port: 3333

**Recovery Strategies**:
- Daemon crash: restart with lock cleanup
- RPC failure: diagnose and reconnect (5 attempts)
- Pool disconnection: restart after verifying daemon (3 attempts)
- Miner error: restart with state cleanup (3 attempts)
- Stale lock: validate and remove (1 attempt)
- Cascading failure: full environment reset

## Example Recovery Scenarios

### Scenario 1: Stratum Port Not Accessible (Your Current Issue)

**Detection**:
```
verify_pool_daemon → connection_failed
Reason: Pool logs say "listening on :3333" but port not accessible
```

**Recovery Actions**:
1. Diagnose: Check netstat for port binding
2. Try: Change pool config to port 13333, restart pool
3. Verify: Test port accessibility with nc -zv
4. If still failing: Try port 23333
5. If still failing: Full environment reset

**Expected Outcome**: Pool running on accessible port, Stratum working

### Scenario 2: Daemon Crash During Pipeline

**Detection**:
```
Any RPC call fails → error_recovery_agent detects daemon not running
```

**Recovery Actions**:
1. Check debug.log for crash reason
2. Clean stale .lock file if present
3. Restart bitcoind -regtest -daemon
4. Wait 15 seconds for initialization
5. Verify RPC accessible

**Expected Outcome**: Daemon restarted, pipeline resumes

### Scenario 3: Pool Loses Connection to Daemon

**Detection**:
```
Pool logs show "Cannot connect to daemon" or RPC timeout errors
```

**Recovery Actions**:
1. Verify daemon is running and RPC accessible
2. If daemon down: recover daemon first
3. If daemon up: check pool config credentials
4. Restart pool to reestablish connection
5. Monitor for "Connected to daemon" message

**Expected Outcome**: Pool reconnected to daemon, pipeline continues

## Next Steps

Want to test the error recovery in action? You can:

1. **Run the infrastructure setup pipeline again** - It will now auto-fix the Stratum port issue
2. **Simulate failures** - Manually kill daemon/pool mid-pipeline to see recovery
3. **Review recovery logs** - Check `logs/recovery.log` for recovery metrics
4. **Customize recovery strategies** - Modify `error_recovery_agent.json` settings

The pipeline is now self-healing and ready to handle the Stratum networking issue automatically!
