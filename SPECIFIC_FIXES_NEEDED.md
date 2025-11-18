# Specific Fixes Needed for reproduce_instant_throttle_bug.js

**Analysis of script created by reproduction_creator agent**

## What the Script Has ✅

1. ✅ **Response unwrapping** (Lines 254-264) - automation_framework_fixer DID fix this!
   ```javascript
   if (parsed.type === 'response' && parsed.response) {
     const unwrapped = parsed.response;
     testClient.send(JSON.stringify(unwrapped));
   }
   ```

2. ✅ **Good test logic** - Checks velocity at 100ms and 500ms intervals
3. ✅ **Console log capture** - Has chrome_debug.log parsing
4. ✅ **WebSocket client identification** - Uses `?client=game` and `?client=test`

## What's Missing ❌

### Issue #2: Cache Busting (Line 306)

**Current (broken):**
```javascript
const gameUrl = 'http://localhost:8080/index.html?testMode=true';
```

**Needs to be:**
```javascript
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;
```

---

### Issue #2b: Chrome Cache Flags (Lines 308-317)

**Current (missing flags):**
```javascript
spawn('cmd.exe', [
  '/c', 'start', 'chrome',
  '--enable-logging',
  '--v=1',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  `--user-data-dir=${profileDir}`,
  `--app=${gameUrl}`
]);
```

**Needs to add:**
```javascript
spawn('cmd.exe', [
  '/c', 'start', 'chrome',
  '--enable-logging',
  '--v=1',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-http-cache',      // ADD THIS
  '--disable-cache',            // ADD THIS
  '--disk-cache-size=1',        // ADD THIS
  '--aggressive-cache-discard', // ADD THIS
  `--user-data-dir=${profileDir}`,
  `--app=${gameUrl}`
]);
```

---

### Issue #3: Initialization Wait (Line 332)

**Current (too short):**
```javascript
await new Promise(r => setTimeout(r, 3000));  // 3 seconds
```

**Needs to be:**
```javascript
await new Promise(r => setTimeout(r, 10000));  // 10 seconds
```

---

## Why These Fixes Matter

### Cache Busting
Without cache busting, the script will test OLD CODE even after bugs are fixed. This causes:
- Tests to fail when they should pass
- Fixes to appear broken when they actually work
- Endless debugging loops

### Init Wait Time
3 seconds is not enough for:
- Mineral fields to be generated
- Game systems to fully initialize
- WebSocket automation to be ready

Results in "simulator not ready" errors.

---

## How to Fix

### Option 1: Update automation_framework_fixer Agent Prompt

Add to `/mnt/c/github/claudeplus/agents/automation_framework_fixer.json`:

```json
{
  "systemPrompt": "...[existing prompt]...\n\n# MANDATORY CHECKS\n\nWhen fixing reproduction scripts, ALWAYS check these 3 items:\n\n1. Response unwrapping (in WebSocket server)\n2. Cache busting URL parameter: gameUrl must include &t=${Date.now()}\n3. Chrome cache disable flags: --disable-http-cache, --disable-cache, --disk-cache-size=1, --aggressive-cache-discard\n4. Initialization wait: Must be 10000ms (10 seconds), not 3000ms\n\n## Cache Busting Fix Template\n\nALWAYS update these lines:\n\n```javascript\n// OLD (line ~306)\nconst gameUrl = 'http://localhost:8080/index.html?testMode=true';\n\n// NEW\nconst gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;\n```\n\n## Chrome Flags Fix Template\n\nALWAYS add these flags to spawn() call:\n\n```javascript\nspawn('cmd.exe', [\n  '/c', 'start', 'chrome',\n  '--enable-logging',\n  '--v=1',\n  '--no-first-run',\n  '--no-default-browser-check',\n  '--disable-extensions',\n  // ADD THESE:\n  '--disable-http-cache',\n  '--disable-cache',\n  '--disk-cache-size=1',\n  '--aggressive-cache-discard',\n  `--user-data-dir=${profileDir}`,\n  `--app=${gameUrl}`\n]);\n```\n\n## Init Wait Fix Template\n\nALWAYS update this line:\n\n```javascript\n// OLD (line ~332)\nawait new Promise(r => setTimeout(r, 3000));\n\n// NEW\nawait new Promise(r => setTimeout(r, 10000));\n```"
}
```

---

### Option 2: Update reproduction_creator Agent Template

Add to `/mnt/c/github/claudeplus/agents/reproduction_creator.json` template:

```javascript
// MANDATORY: Cache busting
const gameUrl = `http://localhost:8080/index.html?testMode=true&t=${Date.now()}`;

// MANDATORY: Cache disable flags
spawn('cmd.exe', [
  '/c', 'start', 'chrome',
  '--enable-logging',
  '--v=1',
  '--no-first-run',
  '--disable-extensions',
  '--disable-http-cache',      // CRITICAL
  '--disable-cache',            // CRITICAL
  '--disk-cache-size=1',        // CRITICAL
  '--aggressive-cache-discard', // CRITICAL
  `--user-data-dir=${profileDir}`,
  `--app=${gameUrl}`
]);

// MANDATORY: 10-second wait
await new Promise(r => setTimeout(r, 10000));
```

---

## Testing the Fixes

After applying these 3 fixes to `reproduce_instant_throttle_bug.js`:

```bash
# 1. Ensure HTTP server running with -c-1
lsof -ti:8080 | xargs kill -9 2>/dev/null
npx http-server . -p 8080 -c-1 > http.log 2>&1 &
sleep 3

# 2. Run updated script
node reproduce_instant_throttle_bug.js
```

**Expected result:**
- ✅ Chrome loads with fresh code (no caching)
- ✅ Game fully initializes (10-second wait)
- ✅ Commands execute successfully
- ✅ Test either reproduces bug or passes

---

## Summary

The automation_framework_fixer agent successfully fixed **Issue #1** (response unwrapping) but doesn't know about **Issues #2-3** (caching and init wait).

**Quick fix:** Update the automation_framework_fixer agent prompt to ALWAYS check and fix cache busting + init wait along with response unwrapping.

**Files to update:**
- `/mnt/c/github/claudeplus/agents/automation_framework_fixer.json` - Add cache busting and init wait checks
- `/mnt/c/github/claudeplus/agents/reproduction_creator.json` - Update template to include these by default

**Impact:**
- Fixes will take effect on next pipeline run
- Existing scripts (like reproduce_instant_throttle_bug.js) can be manually patched
- Future scripts will have all fixes from the start
