# Reproduction Creator Agent - Critical Fixes Needed

## Summary

The `reproduction_creator` agent is creating scripts with **BROKEN Chrome launch method** that doesn't work. Scripts fail because Chrome doesn't load the game properly.

## Evidence of Failure

**Latest test** (`instant_throttle_bug_evidence_1763411554440.json`):
- Status: FAILED
- Console logs: Only Chrome internal logs, NO game output
- Command response: Echoed back instead of executed
- Root cause: Game didn't even load

## The Critical Issue

**Current template uses:**
```javascript
spawn('cmd.exe', ['/c', 'start', 'chrome', '--app=${gameUrl}'], {detached: true, stdio: 'ignore'});
```

**This method:**
- ❌ Launches Chrome through Windows shell (unreliable from WSL)
- ❌ Flags get mangled or ignored
- ❌ Game doesn't load properly (console shows only Chrome internals)
- ❌ No process control (detached, stdio ignored)
- ❌ Missing cache disable flags (loads old cached code)

## What Needs Updating

### 1. Update `/mnt/c/github/claudeplus/agents/reproduction_creator.json`

**Change the template from:**
```javascript
spawn('cmd.exe', [
  '/c', 'start', 'chrome',
  '--enable-logging',
  '--v=1',
  `--user-data-dir=${profileDir}`,
  `--app=${gameUrl}`
], {detached: true, stdio: 'ignore'});
```

**To:**
```javascript
const chromePath = 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe';
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

spawn(chromePath, [
  `--user-data-dir=${profileDir}`,
  '--enable-logging',
  '--v=1',
  '--no-first-run',
  '--disable-http-cache',
  '--disable-cache',
  '--disk-cache-size=1',
  '--aggressive-cache-discard',
  gameUrl
]);
```

### 2. Add All 6 Framework Issues to Template

The template should include ALL fixes by default:

**Issue #1: Response Unwrapping**
```javascript
ws.on('message', (msg) => {
  const parsed = JSON.parse(msg);
  if (parsed.type === 'response' && parsed.response) {
    testClient.send(JSON.stringify(parsed.response));  // Unwrap!
  } else {
    testClient.send(msg);
  }
});
```

**Issue #2: Cache-Busting URL**
```javascript
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;
```

**Issue #3: Chrome Cache Flags**
```javascript
'--disable-http-cache',
'--disable-cache',
'--disk-cache-size=1',
'--aggressive-cache-discard',
```

**Issue #4: Init Wait Time**
```javascript
await new Promise(r => setTimeout(r, 10000));  // 10 seconds, not 3!
```

**Issues #5-6**: Mining-specific (only add if test involves mining)

### 3. Update System Prompt

Add to the `systemPrompt` field:

```
# CRITICAL CHROME LAUNCH METHOD

**ALWAYS use direct chrome.exe path, NEVER use cmd.exe!**

The ONLY correct way to launch Chrome:

```javascript
const chromePath = 'C:\\\\\\\\Program Files\\\\\\\\Google\\\\\\\\Chrome\\\\\\\\Application\\\\\\\\chrome.exe';
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

spawn(chromePath, [
  `--user-data-dir=${profileDir}`,
  '--enable-logging',
  '--v=1',
  '--no-first-run',
  '--disable-http-cache',      // MANDATORY
  '--disable-cache',            // MANDATORY
  '--disk-cache-size=1',        // MANDATORY
  '--aggressive-cache-discard', // MANDATORY
  gameUrl                       // Plain argument, NO --app prefix
]);
```

**DO NOT use:**
- cmd.exe /c start chrome (BROKEN)
- --app=${gameUrl} flag (BROKEN)
- {detached: true, stdio: 'ignore'} (BROKEN)
```

## Why This Fix is Critical

**Before fix:**
1. Pipeline creates script with broken Chrome launch
2. Chrome launches but game doesn't load properly
3. Console logs show only Chrome internals
4. WebSocket commands fail (game not responding)
5. Evidence status: FAILED
6. Pipeline retries, same issue repeats
7. Infinite loop of failures

**After fix:**
1. Pipeline creates script with correct Chrome launch
2. Chrome loads game properly
3. Console logs show game initialization
4. WebSocket commands execute correctly
5. Evidence collected with real data
6. Bug verification succeeds
7. Pipeline proceeds to next stage

## Immediate Action Needed

The `automation_framework_fixer` agent can detect and fix Issues #1-4 in existing scripts, but it CAN'T fix the Chrome launch method because that's hardcoded in the template.

**We must update the `reproduction_creator` template** so NEW scripts are created correctly from the start.

## Reference

See `/mnt/c/github/claudeplus/CORRECT_CHROME_LAUNCH_METHOD.md` for complete details and working example.

See `/mnt/c/github/superstarships/test_mining_automation.js` for proof of working method (successfully mined 180 units of resources).
