

## Problem

The published URL (`nina-axhub.lovable.app`) is running an older version of the code that doesn't include the Evolution API check fix. The preview works correctly because it runs the latest code.

**Evidence:**
- Preview (Lovable): WhatsApp ✅ green, 86% complete
- Published URL: WhatsApp ⊙ yellow/pending, 71% complete
- Database has Evolution API credentials filled, Meta WhatsApp fields are `null`

## Solution

1. **Publish again** -- The latest code with the `hasEvolution || hasMeta` fix needs to be deployed. Use the "Share → Publish" button to redeploy.

2. **No code changes needed** -- The current code in `src/hooks/useOnboardingStatus.ts` already has the correct logic. The fix just hasn't reached the live site yet.

If after publishing again the issue persists (browser cache), try opening the published URL in an incognito/private window or doing a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).

