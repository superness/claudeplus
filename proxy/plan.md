# Implementation Plan: Feature Owner System JSON Schemas

## Overview

Create 6 JSON Schema files (Draft-07) for the Feature Owner System based on the specifications in `FEATURE_OWNER_SYSTEM_DESIGN.md`. Each schema will include comprehensive field definitions, validation rules, and 3 valid + 3 invalid examples.

## Schema Locations

All schemas will be created in: `schemas/`

```
schemas/
├── agent.schema.json
├── fingerprint.schema.json
├── tool.schema.json
├── routing-decision.schema.json
├── teaching-request.schema.json
├── memory-entry.schema.json
└── examples/
    ├── agent/
    │   ├── valid/
    │   └── invalid/
    ├── fingerprint/
    │   ├── valid/
    │   └── invalid/
    ├── tool/
    │   ├── valid/
    │   └── invalid/
    ├── routing-decision/
    │   ├── valid/
    │   └── invalid/
    ├── teaching-request/
    │   ├── valid/
    │   └── invalid/
    └── memory-entry/
        ├── valid/
        └── invalid/
```

---

## Schema 1: agent.schema.json

### Source Reference
- Design doc sections: 4.2 (Product Maestro), 5.2-5.5 (Feature Owner examples), Appendix A
- Existing pattern: `agents/task_planner.json`

### Required Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `id` | string | Unique agent identifier (snake_case) | Appendix A, line 2596-2600 |
| `name` | string | Human-readable name | Appendix A, line 2601-2604 |
| `type` | enum | `"orchestrator"`, `"feature_owner"`, `"ic"` | Appendix A, line 2605-2608 |
| `domain` | object | Domain boundaries (primary, includes, excludes) | Appendix A, line 2614-2621 |
| `systemPrompt` | string | Full system prompt (min 100 chars) | Appendix A, line 2622-2626 |
| `tools` | array | List of tool IDs (min 1) | Appendix A, line 2632-2636 |
| `decisions` | array | Decision types this agent can make (min 1) | Appendix A, line 2645-2648 |

### Optional Fields with Defaults

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | `""` | Brief purpose description |
| `version` | string | `"1.0.0"` | Semantic version |
| `capabilities` | array | `[]` | Capability identifiers |
| `knowledge` | object | `{}` | Knowledge base references |
| `parameters` | object | See below | LLM parameters |
| `selfLearning` | object | `null` | Self-learning configuration |
| `elevationCapability` | object | `null` | Recursive scaling capability |

#### Default Parameters Object
```json
{
  "temperature": 0.7,
  "max_tokens": 3000,
  "response_format": "conversational"
}
```

### Validation Rules
- `id` must match pattern `^[a-z][a-z0-9_]*$`
- `systemPrompt` minimum length: 100 characters
- `tools` array must have at least 1 item
- `decisions` array must have at least 1 item
- `domain.primary` is required when `domain` is present
- `parameters.temperature` must be 0-1
- `parameters.max_tokens` must be >= 100

### Valid Examples

1. **identity_owner.json** - Full feature owner with all fields
2. **product_maestro.json** - Orchestrator type with teaching capability
3. **simple_ic.json** - Minimal IC agent with elevation capability

### Invalid Examples

1. **missing_required.json** - Missing `domain` field
2. **invalid_id.json** - ID with uppercase letters ("Identity_Owner")
3. **empty_tools.json** - Empty tools array

---

## Schema 2: fingerprint.schema.json

### Source Reference
- Design doc section: 11.2 (The Complexity Fingerprint Model)
- Lines 1965-2075

### Required Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `version` | string | Schema version (e.g., "1.0") | Line 1967 |
| `timestamp` | string | ISO 8601 timestamp | Line 1968 |
| `task` | string | Task description being assessed | Line 1969 |
| `dimensions` | object | The 6 complexity dimensions | Lines 1972-2032 |
| `compositeScore` | number | Calculated total (8-40 range) | Line 2034 |
| `scoreCategory` | enum | SIMPLE, MODERATE, COMPLEX, HIGHLY_COMPLEX, EXTREME | Line 2035 |
| `recommendation` | enum | PROCEED, MONITOR, ELEVATE | Line 2036 |

### Dimensions Sub-Schema

Each dimension in `dimensions` object:

| Dimension | Key | Score Range | Weight |
|-----------|-----|-------------|--------|
| Surface Area | `S_surfaceArea` | 1-5 | 1.0 |
| Dependency Depth | `D_dependencyDepth` | 1-5 | 1.5 |
| Uncertainty | `U_uncertainty` | 1-5 | 1.5 |
| Breadth of Expertise | `B_breadthOfExpertise` | 1-5 | 2.0 |
| Integration Points | `I_integrationPoints` | 1-5 | 1.0 |
| Testability Complexity | `T_testability` | 1-5 | 1.0 |

Each dimension object has:
- `score` (integer 1-5, required)
- `evidence` (object with specific fields per dimension, required)

### Optional Fields with Defaults

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `decompositionPlan` | object | `null` | Plan if elevation recommended |
| `assessedBy` | string | `null` | Agent ID that performed assessment |
| `parentTaskId` | string | `null` | Link to parent task if sub-task |

### Validation Rules
- Each dimension score must be 1-5
- `compositeScore` must equal calculated formula result (within 0.5 tolerance)
- `scoreCategory` must match score ranges:
  - 8-15: SIMPLE
  - 16-24: MODERATE
  - 25-32: COMPLEX
  - 33-37: HIGHLY_COMPLEX
  - 38-40: EXTREME
- Evidence objects must have at least one substantive field

### Valid Examples

1. **simple_task.json** - Score ~10, typo fix
2. **complex_feature.json** - Score ~31, social login implementation
3. **extreme_system.json** - Score ~38, e-commerce checkout

### Invalid Examples

1. **score_mismatch.json** - compositeScore doesn't match dimensions
2. **missing_evidence.json** - Dimension without evidence object
3. **invalid_category.json** - scoreCategory doesn't match compositeScore

---

## Schema 3: tool.schema.json

### Source Reference
- Design doc section: 7 (Bespoke Tool System)
- Lines 1050-1084

### Required Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `tool_id` | string | Unique tool identifier | Line 1052 |
| `name` | string | Human-readable name | Line 1053 |
| `description` | string | What the tool does | Line 1054 |
| `operations` | array | Available operations (min 1) | Lines 1058-1075 |

### Optional Fields with Defaults

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `domain` | string | `"general"` | Domain this tool belongs to |
| `owner_access` | array | `["*"]` | Agent IDs that can use this tool |
| `implementation` | object | `null` | How the tool is implemented |
| `version` | string | `"1.0.0"` | Tool version |
| `deprecated` | boolean | `false` | Whether tool is deprecated |

### Operation Sub-Schema

Each operation in `operations`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Operation identifier |
| `description` | string | Yes | What this operation does |
| `parameters` | object | No | Parameter definitions |
| `returns` | object | No | Return value schema |

### Validation Rules
- `tool_id` must match pattern `^[a-z][a-z0-9_]*$`
- `operations` must have at least 1 item
- Each operation must have `name` and `description`
- Parameter types must be valid JSON Schema types

### Valid Examples

1. **jwt_debugger.json** - Full tool with multiple operations
2. **playwright.json** - Browser automation tool
3. **simple_reader.json** - Minimal tool with one operation

### Invalid Examples

1. **no_operations.json** - Empty operations array
2. **invalid_tool_id.json** - ID with spaces
3. **duplicate_operations.json** - Two operations with same name

---

## Schema 4: routing-decision.schema.json

### Source Reference
- Design doc section: 4.3 (Routing Logic)
- Lines 322-363

### Required Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `request_id` | string | Unique request identifier | - |
| `timestamp` | string | ISO 8601 timestamp | - |
| `decision` | enum | Routing decision type | Lines 305-310 |
| `rationale` | string | Why this decision was made | - |

### Decision Types Enum
- `handle_directly` - Maestro handles without delegation
- `delegate_single` - Route to one Feature Owner
- `delegate_multi` - Coordinate multiple Feature Owners
- `create_new_agent` - Trigger Teaching Protocol
- `request_clarification` - Ask user for more info

### Optional Fields with Defaults

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `target_owner` | string | `null` | Single owner ID (for delegate_single) |
| `target_owners` | array | `[]` | Multiple owner IDs (for delegate_multi) |
| `delegations` | object | `{}` | Per-owner delegation prompts |
| `analysis` | object | `null` | Request analysis details |
| `confidence` | number | `null` | Confidence score 0-1 |
| `domains_identified` | array | `[]` | Domains found in request |

### Analysis Sub-Schema

| Field | Type | Description |
|-------|------|-------------|
| `intent` | string | Extracted user intent |
| `domains` | array | Domains mentioned |
| `complexity` | enum | simple, moderate, complex |
| `keywords` | array | Key terms identified |

### Validation Rules
- `decision=delegate_single` requires `target_owner`
- `decision=delegate_multi` requires `target_owners` with min 2 items
- `confidence` must be 0-1 if present
- `delegations` keys must match `target_owners` items

### Valid Examples

1. **handle_directly.json** - Simple status query
2. **delegate_single.json** - OAuth question to Identity Owner
3. **delegate_multi.json** - Dark mode across UI + Identity

### Invalid Examples

1. **missing_target.json** - delegate_single without target_owner
2. **single_multi.json** - delegate_multi with only 1 target
3. **mismatched_delegations.json** - Delegation for non-existent owner

---

## Schema 5: teaching-request.schema.json

### Source Reference
- Design doc section: 6 (The Teaching Protocol)
- Lines 903-934

### Required Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `domain_name` | string | Name of the new domain | Line 906 |
| `domain_description` | string | What this domain covers | Line 907 |
| `triggered_by` | string | What prompted this request | Line 908 |
| `domain_analysis` | object | Includes/excludes/related | Lines 910-914 |
| `knowledge_requirements` | object | What agent needs to know | Lines 916-920 |
| `tool_requirements` | object | Tools needed | Lines 922-925 |
| `decision_types` | array | Decisions agent will make | Line 927 |
| `validation_queries` | array | Sample queries to test | Lines 929-932 |

### Domain Analysis Sub-Schema

| Field | Type | Required |
|-------|------|----------|
| `includes` | array | Yes |
| `excludes` | array | Yes |
| `related_owners` | array | No (default: []) |

### Knowledge Requirements Sub-Schema

| Field | Type | Required |
|-------|------|----------|
| `codebase_paths` | array | No |
| `documentation` | array | No |
| `external_resources` | array | No |

### Tool Requirements Sub-Schema

| Field | Type | Required |
|-------|------|----------|
| `existing_tools` | array | No |
| `new_tools_needed` | array | No |

### Optional Fields with Defaults

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `requested_by` | string | `null` | Who requested this |
| `priority` | enum | `"normal"` | normal, high, low |
| `target_agent_id` | string | Auto-gen | Proposed agent ID |
| `estimated_complexity` | string | `null` | SIMPLE/MODERATE/COMPLEX |

### Validation Rules
- `validation_queries` must have at least 2 items
- `domain_analysis.includes` must have at least 1 item
- `decision_types` must have at least 1 item
- `domain_name` must not be empty

### Valid Examples

1. **accessibility_owner.json** - Full teaching request (from doc example)
2. **payments_owner.json** - Payment processing domain
3. **minimal_request.json** - Only required fields

### Invalid Examples

1. **no_queries.json** - Empty validation_queries
2. **no_includes.json** - Empty domain_analysis.includes
3. **no_decisions.json** - Empty decision_types

---

## Schema 6: memory-entry.schema.json

### Source Reference
- Design doc section: 8 (Memory and Knowledge Management)
- Lines 1134-1235

### Required Fields

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `entry_id` | string | Unique entry identifier | - |
| `timestamp` | string | ISO 8601 when created | - |
| `memory_type` | enum | Type of memory | Lines 1144-1176 |
| `owner_id` | string | Agent that owns this memory | - |
| `content` | object | The actual memory content | - |

### Memory Types Enum
- `short_term` - Conversation context
- `working` - Cross-agent task context
- `long_term` - Persistent knowledge
- `learned_pattern` - Self-learned insight
- `decision_history` - Past decisions/outcomes

### Content Sub-Schema (varies by memory_type)

**For learned_pattern:**
| Field | Type | Description |
|-------|------|-------------|
| `pattern_name` | string | Identifier for pattern |
| `description` | string | What was learned |
| `triggers` | array | When to apply this pattern |
| `validation_count` | integer | Times validated |

**For decision_history:**
| Field | Type | Description |
|-------|------|-------------|
| `decision` | string | Decision made |
| `context` | string | Situation context |
| `outcome` | string | What happened |
| `successful` | boolean | Was it correct? |

### Optional Fields with Defaults

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tags` | array | `[]` | Searchable tags |
| `source` | string | `null` | Where this came from |
| `expires_at` | string | `null` | ISO 8601 expiration |
| `confidence` | number | `1.0` | Confidence in this memory |
| `related_entries` | array | `[]` | Links to other entries |
| `session_id` | string | `null` | For short_term memories |

### Validation Rules
- `memory_type=learned_pattern` requires `content.validation_count >= 2`
- `memory_type=short_term` requires `session_id`
- `confidence` must be 0-1
- `expires_at` if present must be future date

### Valid Examples

1. **learned_pattern.json** - Self-learned common error fix
2. **decision_history.json** - Past routing decision
3. **short_term.json** - Current conversation context

### Invalid Examples

1. **invalid_pattern.json** - learned_pattern with validation_count=0
2. **no_session.json** - short_term without session_id
3. **expired_memory.json** - expires_at in the past

---

## Implementation Steps

1. Create `schemas/` directory structure
2. Implement each schema file with:
   - `$schema` reference to JSON Schema Draft-07
   - `$id` for schema identification
   - Complete property definitions
   - Required field declarations
   - Default values where applicable
   - Pattern validations
   - Enum constraints
3. Create example files in `examples/` subdirectories
4. Add a `README.md` in `schemas/` documenting usage

## File Dependencies

- Read from: `FEATURE_OWNER_SYSTEM_DESIGN.md`
- Reference: Existing `agents/*.json` patterns
- Create: All 6 schemas + 36 example files (6 per schema)

## Validation Approach

Each schema will be self-validating using JSON Schema Draft-07 features:
- `$ref` for reusable sub-schemas
- `if/then/else` for conditional requirements
- `allOf`/`oneOf` for complex constraints
- Custom `format` validators where needed

## Estimated Implementation Order

1. `agent.schema.json` (foundational, most complex)
2. `tool.schema.json` (referenced by agent)
3. `fingerprint.schema.json` (standalone, well-defined)
4. `routing-decision.schema.json` (depends on agent IDs)
5. `teaching-request.schema.json` (references tool and agent)
6. `memory-entry.schema.json` (references agent IDs)
