

# Fix: Audio Transcription Returning Wrong Content

## Problem

The transcription returned "I'm coming to 175 Park Avenue..." when the user actually said "I need you to talk to me in English." The audio downloads correctly (23247 bytes) but Gemini produces hallucinated text instead of actual transcription.

## Root Cause

The `transcribeAudio` function uses `inline_data` format (native Gemini API format), but the Lovable AI Gateway is an **OpenAI-compatible** endpoint. The gateway likely strips or ignores the `inline_data` block, so Gemini receives only the text instruction "Transcribe this audio..." with no actual audio, and hallucinates a response.

## Solution

Change the audio content format to use a **data URI** inside an `image_url`-type block, which is the standard way to pass binary data through OpenAI-compatible APIs:

### File: `supabase/functions/message-grouper/index.ts`

Replace the `transcribeAudio` function's message content format:

```typescript
// Before (native Gemini format - not supported by gateway):
content: [
  { inline_data: { mime_type: "audio/ogg", data: base64Audio } },
  { type: "text", text: "Transcribe..." }
]

// After (OpenAI-compatible data URI format):
content: [
  {
    type: "image_url",
    image_url: {
      url: `data:audio/ogg;base64,${base64Audio}`
    }
  },
  { type: "text", text: "Transcribe this audio exactly as spoken. Return ONLY the transcription text, nothing else. Detect the language automatically and transcribe in that language." }
]
```

Also use the actual mime type from the message data (`audio/ogg; codecs=opus`) for better accuracy, and add a stronger prompt to prevent hallucination.

Single file change: `supabase/functions/message-grouper/index.ts` (transcribeAudio function, ~10 lines).

