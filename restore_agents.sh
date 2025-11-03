#!/bin/bash

# Restore systemPrompts for all agents from git commit 7c4426a

echo "Restoring agent systemPrompts..."

# List of all agents
agents=(
"api_designer"
"balance_analyzer" 
"balance_auditor"
"code_generator"
"combat_designer"
"culture_architect"
"data_modeler"
"design_integrator"
"design_reviewer"
"design_validator"
"ecology_validator"
"economy_designer"
"emergence_detector"
"engagement_scorer"
"final_integrator"
"gameplay_validator"
"geography_designer"
"market_simulator"
"narrative_validator"
"player_experience_simulator"
"progression_designer"
"resource_designer"
"sociologist_reviewer"
"system_designer"
"systems_integrator"
"technical_validator"
)

for agent in "${agents[@]}"; do
    echo "Restoring $agent..."
    git show 7c4426a:agents/${agent}.json > agents/${agent}.json
done

echo "Done restoring agents!"