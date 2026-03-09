

# Fix: ElevenLabs TextDecoder error in StepElevenLabs

## Problem
The error `Failed to execute 'decode' on 'TextDecoder': parameter 1 is not of type 'ArrayBuffer'` occurs on line 119 of `StepElevenLabs.tsx`. When the edge function returns a 402 error, `(error as any).context.body` is not an `ArrayBuffer` — it may be a string or different type, causing `TextDecoder.decode()` to crash.

The underlying ElevenLabs issue is: "Free users cannot use library voices via the API" (402 payment required).

## Fix
Replace the fragile error extraction with safer parsing that handles multiple body types (string, ArrayBuffer, or missing):

```typescript
if (error) {
  let errorMsg = error.message;
  try {
    const body = (error as any)?.context?.body;
    if (body) {
      const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
      const parsed = JSON.parse(text);
      errorMsg = parsed?.error || errorMsg;
    }
  } catch {}
  throw new Error(errorMsg);
}
```

## Files changed
- `src/components/onboarding/StepElevenLabs.tsx` — Fix error parsing (lines 116-122)

