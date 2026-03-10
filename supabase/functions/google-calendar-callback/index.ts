import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Get the app URL for redirects
    const appUrl = Deno.env.get('APP_URL') || 'https://nina-axhub.lovable.app';

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${appUrl}/scheduling?gcal_error=${error}`, 302);
    }

    if (!code || !stateParam) {
      return Response.redirect(`${appUrl}/scheduling?gcal_error=missing_params`, 302);
    }

    // Decode state to get user_id
    let userId: string;
    try {
      const state = JSON.parse(atob(stateParam));
      userId = state.user_id;
    } catch {
      return Response.redirect(`${appUrl}/scheduling?gcal_error=invalid_state`, 302);
    }

    // Exchange code for tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      return Response.redirect(`${appUrl}/scheduling?gcal_error=token_exchange_failed`, 302);
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

    // Save to database using service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Upsert connection (replace existing for this user)
    const { error: dbError } = await supabase
      .from('google_calendar_connections')
      .upsert(
        {
          user_id: userId,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          is_active: true,
        },
        { onConflict: 'user_id' }
      );

    if (dbError) {
      console.error('DB error:', dbError);
      // Try insert if upsert fails (no unique constraint on user_id yet)
      // Delete existing first
      await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('user_id', userId);
      
      const { error: insertError } = await supabase
        .from('google_calendar_connections')
        .insert({
          user_id: userId,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          is_active: true,
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return Response.redirect(`${appUrl}/scheduling?gcal_error=db_save_failed`, 302);
      }
    }

    console.log(`Google Calendar connected for user ${userId}`);
    return Response.redirect(`${appUrl}/scheduling?gcal_connected=true`, 302);
  } catch (error) {
    console.error('Callback error:', error);
    const appUrl = Deno.env.get('APP_URL') || 'https://nina-axhub.lovable.app';
    return Response.redirect(`${appUrl}/scheduling?gcal_error=unknown`, 302);
  }
});
