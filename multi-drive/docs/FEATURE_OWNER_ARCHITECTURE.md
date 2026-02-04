# Feature Owner System - Correct Architecture

## Core Principle

**This is a recursive AI system using the Chat API. Not a JavaScript routing library.**

## The Pattern

Every agent in the system follows the SAME pattern:

1. Receive request via Chat API
2. Evaluate complexity using AI understanding (not regex)
3. If complex: delegate to sub-agents via Chat API
4. If atomic: implement directly
5. Sub-agents follow steps 1-4 recursively

```
User Request
    │
    ▼
┌─────────────────────────────────────────┐
│  AI Agent (via Chat API)                │
│                                         │
│  1. Understand request semantically     │
│  2. Score complexity (ABUDDI system)    │
│  3. Decision:                           │
│     - Simple? → Implement directly      │
│     - Complex? → Delegate via Chat API  │
└─────────────────────────────────────────┘
    │
    ▼ (if complex)
┌─────────────────────────────────────────┐
│  Sub-Agent (via Chat API)               │
│                                         │
│  SAME PATTERN:                          │
│  1. Understand request semantically     │
│  2. Score complexity                    │
│  3. Decision:                           │
│     - Simple? → Implement directly      │
│     - Complex? → Delegate further       │
└─────────────────────────────────────────┘
    │
    ▼ (continues recursively)
    ...until work fits in one context
```

## What This Is NOT

- ❌ A JavaScript library with regex patterns
- ❌ A hardcoded list of agents/owners
- ❌ One-level decomposition
- ❌ Keyword matching for intent detection
- ❌ Static routing rules

## What This IS

- ✅ AI understanding requests semantically
- ✅ Dynamic agent creation/selection by AI
- ✅ Recursive decomposition via Chat API
- ✅ Same evaluation pattern at every level
- ✅ Continues until work is atomic (fits in one context)

## The Chat API Flow

```javascript
// Pseudocode - every agent does this
async function handleRequest(request) {
  // 1. AI evaluates complexity (via Chat API call with complexity prompt)
  const complexity = await chatAPI.evaluate({
    system: COMPLEXITY_SCORING_PROMPT,
    user: request
  });

  // 2. AI decides what to do
  if (complexity.score < THRESHOLD) {
    // Atomic - do the work
    return await chatAPI.implement({
      system: IMPLEMENTATION_PROMPT,
      user: request
    });
  } else {
    // Complex - decompose and delegate
    const subTasks = complexity.decomposition;

    for (const task of subTasks) {
      // Call sub-agent via Chat API
      // Sub-agent does THE SAME THING (recursive)
      const result = await chatAPI.delegate({
        system: task.agentPrompt,
        user: task.scopedRequest
      });
    }

    // Synthesize results
    return synthesize(results);
  }
}
```

## Complexity Scoring (From Design Doc)

The AI uses the ABUDDI scoring system:
- **A** - Atomic scope (files to read/modify)
- **B** - Breadth of expertise (domains required)
- **U** - Uncertainty (unknowns)
- **D** - Dependencies (integration points)
- **D** - Depth (layers deep)
- **I** - Impact (blast radius)

Score determines: handle directly, delegate to 1 agent, delegate to multiple, or elevate to Feature Owner.

## Key Insight

**The routing IS the AI.**

There is no separate routing layer. The AI (Product Maestro, Feature Owner, Sub-IC) receives a request, understands it, evaluates complexity, and decides what to do - all through its natural language understanding via the Chat API.

The JavaScript code's job is just to:
1. Make Chat API calls
2. Pass the right system prompts
3. Handle the recursive calling pattern
4. Collect and synthesize results

NOT to do intent classification, pattern matching, or routing decisions.
