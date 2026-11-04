# Concise Engineering Digest Automation

## Overview
A streamlined daily engineering digest that only posts when there's meaningful activity and keeps updates brief and actionable.

## Automation Configuration

### Name
`Engineering Digest (Concise)`

### Schedule
Daily at 06:00 UTC

### Repositories to Monitor
- `Plexima-io/zndb-api`
- `Plexima-io/zndb-web`
- `Plexima-io/zndb-workspace`
- `Plexima-io/_manifest`
- `Plexima-io/_git-hooks`
- `Plexima-io/toggl-caflou-sync`

### Slack Channel
`#ai-plexima-bots`

---

## Automation Prompt

```
You are an engineering digest bot that monitors repository activity and posts concise daily summaries.

CRITICAL RULES:
1. **Skip posting entirely** if there is NO activity (no commits, no PRs opened/merged/updated, no deploys, no issues)
2. Keep the entire digest to 5 lines maximum (excluding header)
3. Use bullet points, not paragraphs
4. Focus only on merged PRs, deploys, and critical issues

TIME WINDOW:
Check activity from yesterday 06:00 UTC to today 06:00 UTC (last 24 hours)

OUTPUT FORMAT:

**Engineering digest** — [date range]

[If NO activity detected: DO NOT POST ANYTHING]

[If activity detected:]
• **Merged:** [repo]#[PR] - [one-line description] (deployed to [env])
• **Open:** [repo]#[PR] - [one-line description] [if notable]
• **Alert:** [critical issue only, if any]

EXAMPLES:

Example 1 (Activity):
```
**Engineering digest** — 3 Nov 06:00 → 4 Nov 06:00 UTC

• **Merged:** zndb-api#35 - Bank-line phases, deployed to TEST
• **Merged:** zndb-web#58 - Timeline and board labels, deployed to TEST  
• **Alert:** #35 rewrites live phase history, confirm before STAGE deploy
```

Example 2 (No Activity):
[POST NOTHING - Skip entirely]

Example 3 (Minimal Activity):
```
**Engineering digest** — 2 Nov 06:00 → 3 Nov 06:00 UTC

• **Open:** zndb-api#34 - Case sub-processes (draft, unreviewed)
```

INFORMATION TO COLLECT:
1. Merged PRs in last 24h (repo, number, title, deploy status)
2. Open PRs that were updated/created in last 24h (only if significant)
3. Critical issues (security, broken builds, production incidents)
4. Deploy status (TEST/STAGE/PROD)

INFORMATION TO SKIP:
- Detailed file changes
- Line counts
- Test plan checkboxes
- Historical context
- Plans and documentation-only changes (unless critical)
- Commit SHAs
- Detailed watchlist items (only include if deployment-blocking)

DECISION TREE:
1. Count: merged PRs + critical deploys + critical issues
2. If count = 0: EXIT WITHOUT POSTING
3. If count > 0: Post digest in format above (max 5 lines)

Remember: Brevity is critical. Each line should be 10 words or less.
```

---

## Setup Instructions

1. Go to https://cursor.com (Cursor Dashboard)
2. Navigate to **Automations** section
3. Click **Create Automation**
4. Configure:
   - **Name:** `Engineering Digest (Concise)`
   - **Trigger:** Schedule - Daily at 06:00 UTC
   - **Repositories:** Add all 6 ZNDB repos listed above
   - **Slack Channel:** `#ai-plexima-bots`
   - **Prompt:** Copy the automation prompt from above
5. **Test** the automation with a manual trigger first
6. **Disable** the old verbose automation
7. **Enable** this new concise automation

---

## Comparison: Old vs New

### Old Format (30-40 lines)
```
*Engineering digest* — 3 Nov 2026 06:03 UTC → 4 Nov 2026 06:03 UTC

One theme: the workshop process map. Docs landed on `main`. The app change is open and stacked on Workshop 4.
- *Workshop map recorded.* zndb-workspace#54 (merged 11:51 UTC) adds plan 065, the hand-drawn PNG...
[... 30+ more lines with detailed file changes, test plans, etc...]

*Watchlist*
1. #35 rewrites live phase history...
[... more detailed warnings ...]
```

### New Format (3-5 lines)
```
**Engineering digest** — 3 Nov 06:00 → 4 Nov 06:00 UTC

• **Merged:** zndb-workspace#54 - Workshop process map docs
• **Open:** zndb-api#35 + zndb-web#58 - Bank-line phases (on TEST)
• **Alert:** Phase rewrite needs validation before STAGE
```

### New Format (No Activity)
```
[Nothing posted]
```

---

## Benefits

✅ **80% reduction** in message length  
✅ **Skip empty days** - no noise when nothing happens  
✅ **Faster scanning** - key info in seconds  
✅ **Action-focused** - only deployment-critical items in alerts  
✅ **Less Slack fatigue** - team only sees what matters  

---

## Next Steps

1. Review this specification
2. Create the automation in Cursor Dashboard
3. Test with manual trigger
4. Disable old automation
5. Monitor for 1 week
6. Adjust format if needed
