# NPC Combat Decision Plan

## Goal

Use one shared, rule-based combat template for all NPCs. No LLM calls. Individual skill sets provide variety.

## States and Action Weights

| State | Condition | Basic attack | Random offensive skill | Defend | Strongest offensive skill |
|---|---|---:|---:|---:|---:|
| Aggressive | Default | 60% | 40% | 0% | 0% |
| Cautious | One incoming action deals more than 20% of maximum HP | 20% | 45% | 35% | 0% |
| Desperate | Current HP is below 15% of maximum HP | 0% | 20% | 0% | 80% |

- Priority: **Desperate > Cautious > Aggressive**. Evaluate before each NPC action.
- Cautious lasts two NPC turns; another qualifying hit refreshes the duration. Return to Aggressive when it expires unless Desperate applies.
- Measure a heavy hit using total actual HP lost from one resolved action, after mitigation, against maximum HP.
- Thresholds are strict: exactly 20% damage does not trigger Cautious; exactly 15% remaining HP does not trigger Desperate.
- Action weights are initial balancing values.

## Shared Rules

- NPCs consume no energy or spell slots and may reuse skills every turn.
- Random offensive skills are selected uniformly from valid offensive skills with legal, living targets.
- The strongest offensive skill has the highest expected damage against the target after armor, magic armor, and elemental resistance. Randomize ties.
- Never defend on consecutive turns. Remove defense from that turn's choices and proportionally redistribute its weight among offensive choices.
- If a selected skill category is unavailable, use a legal basic attack. Provide every NPC with a basic attack fallback.
- This plan changes action selection; retain existing target selection.

## Integration

- Expand `src/containers/aiDecisionContainer.js` to track states and select actions using this template.
- Update `src/containers/core/battleSystemCore.js` to record heavy hits, count cautious turns, and resolve NPC attacks and defense correctly.
- Keep action validation and combat outcomes server-authoritative. Apply the resource exemption only to NPCs; preserve player resource costs.
- Ensure defense effects expire according to the combat rules and log state changes and chosen actions for verification.

## Acceptance Checks

- A 100-max-HP NPC starts Aggressive; losing 25 HP from one action triggers Cautious for two NPC turns.
- A new qualifying hit refreshes Cautious; expiration restores Aggressive unless Desperate applies.
- At 14/100 HP, Desperate overrides Cautious and never selects defense.
- Verify strict threshold boundaries, no consecutive defense, basic attack fallback, and repeated NPC skill use without resource consumption.
- Verify that NPC defense affects damage and expires correctly, while player resource checks remain enforced.
