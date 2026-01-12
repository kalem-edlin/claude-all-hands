---
description: Address PR review comments
---

<objective>
Process unresolved PR review comments for the current feature branch, prioritize them, and address each based on user direction.
</objective>

<process>
1. Read all unresolved review comments from the current feature branch's PR
2. Group any duplicative review feedback
3. Order concerns by priority using P1/P2/P3 indicators based on review indicators and your judgement
4. For EACH grouped concern, use AskUserQuestion to present it separately:
   - Include P<N> priority indicator
   - Describe the concern and proposed resolution action
   - Offer multichoice options: approve, decline, or "say something" (provide specific instructions)
5. Execute on user's feedback for each concern
6. Commit and push changes with an inferred commit message
7. Resolve PR comments related to addressed issues (skip declined concerns)
8. If any comments remain unresolved, briefly summarize and ask user what to do next
</process>

<success_criteria>
- Each concern presented as separate AskUserQuestion with multichoice options
- Only approved/instructed concerns addressed
- Declined concerns left untouched in PR
- Changes committed and pushed
</success_criteria>
