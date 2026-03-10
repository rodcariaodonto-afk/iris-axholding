

# Fix: Audio Download Failing for Evolution API

## Root Cause

The error in the logs is clear:
```
Evolution media download failed: 400 {"status":400,"error":"Bad Request","response":{"message":["TypeError: Cannot read properties of undefined (reading 'ephemeralMessage')"]}}
```

The Evolution API's `getBase64FromMediaMessage` endpoint requires the message `key` object (containing `remoteJid`, `fromMe`, `id`). But:

1. The **webhook** saves `message_data: { from, type, ...msg }` where `msg = data.message` (the message content). The `key` lives at `data.key`, NOT inside `data.message`, so it's **never saved** in `message_data`.

2. The **message-grouper** tries `messageData.key` which is `undefined`, causing the Evolution API to fail.

3. After the Evolution API fails, the code does NOT fall back to the direct URL download because the condition on line 280 (`else if`) is only reached when Evolution settings are absent (they're present).

Result: audio download always fails, `Combined content` is empty, Nina responds without understanding the audio.

## Solution (2 changes)

### 1. `supabase/functions/whatsapp-webhook/index.ts` (line 357)
Include `data.key` in `message_data` so the grouper has access to it:
```typescript
// Before:
message_data: { from: phoneNumber, type: messageType, ...msg },

// After:
message_data: { from: phoneNumber, type: messageType, key: data.key, ...msg },
```

### 2. `supabase/functions/message-grouper/index.ts` (lines 271-284)
Add fallback to direct URL download when Evolution API fails:
```typescript
if (evolutionAudioUrl && settings?.evolution_api_url && settings?.evolution_api_key) {
  console.log('[MessageGrouper] Downloading audio via Evolution API');
  audioBuffer = await downloadEvolutionMedia(
    settings.evolution_api_url,
    settings.evolution_api_key,
    settings.evolution_instance_name,
    messageData
  );
}

// Fallback: try direct URL if Evolution API failed or not configured
if (!audioBuffer && evolutionAudioUrl) {
  console.log('[MessageGrouper] Attempting direct download from WhatsApp CDN URL');
  audioBuffer = await downloadDirectUrl(evolutionAudioUrl);
}
```

This ensures:
- The `key` is now available for the Evolution API endpoint
- If the Evolution API call still fails for any reason, it falls back to downloading directly from the WhatsApp CDN URL

