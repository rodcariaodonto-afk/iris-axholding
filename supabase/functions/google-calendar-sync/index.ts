import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token refresh failed: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Support GET ?action=status for connection check
    const url = new URL(req.url);
    const queryAction = url.searchParams.get('action');

    // Use service role to read tokens
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user's Google Calendar connection
    const { data: connection, error: connError } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (req.method === 'GET' && queryAction === 'status') {
      return new Response(JSON.stringify({ connected: !!connection }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'No Google Calendar connection found', connected: false }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, appointment } = await req.json();
    // action: 'create' | 'update' | 'delete'

    // Check if token needs refresh
    let accessToken = connection.access_token;
    const tokenExpiry = new Date(connection.token_expires_at);
    
    if (tokenExpiry <= new Date(Date.now() + 60000)) { // Refresh if expires within 1 minute
      console.log('Refreshing access token...');
      const refreshResult = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshResult.access_token;
      
      // Update token in database
      await supabase
        .from('google_calendar_connections')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (refreshResult.expires_in * 1000)).toISOString(),
        })
        .eq('id', connection.id);
    }

    const calendarId = connection.calendar_id || 'primary';
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    let result: any = null;

    if (action === 'create') {
      // Normalize time to HH:MM format (database may send HH:MM:SS)
      const timeParts = appointment.time.split(':');
      const normalizedTime = `${timeParts[0]}:${timeParts[1]}`;
      
      const startDateTime = `${appointment.date}T${normalizedTime}:00`;
      const startHour = parseInt(timeParts[0]);
      const startMin = parseInt(timeParts[1]);
      const endMinutes = startHour * 60 + startMin + (appointment.duration || 60);
      const endHours = Math.floor(endMinutes / 60) % 24;
      const endMins = endMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
      const endDateTime = `${appointment.date}T${endTime}:00`;

      const wantsMeet = appointment.create_meet === true || appointment.type === 'meeting' || appointment.type === 'demo';

      const event: any = {
        summary: appointment.title,
        description: appointment.description || '',
        start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
      };

      if (wantsMeet) {
        event.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const createUrl = wantsMeet ? `${baseUrl}?conferenceDataVersion=1` : baseUrl;
      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Google Calendar API error: ${JSON.stringify(error)}`);
      }

      result = await response.json();

      // Save google_event_id and meeting_url (Meet link) to appointment
      if (appointment.id && result.id) {
        const updates: any = { google_event_id: result.id };
        if (result.hangoutLink) updates.meeting_url = result.hangoutLink;
        await supabase
          .from('appointments')
          .update(updates)
          .eq('id', appointment.id);
      }
    } else if (action === 'update') {
      if (!appointment.google_event_id) {
        return new Response(JSON.stringify({ error: 'No google_event_id for update' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Normalize time
      const timeParts = appointment.time.split(':');
      const normalizedTime = `${timeParts[0]}:${timeParts[1]}`;
      
      const startDateTime = `${appointment.date}T${normalizedTime}:00`;
      const startHour = parseInt(timeParts[0]);
      const startMin = parseInt(timeParts[1]);
      const endMinutes = startHour * 60 + startMin + (appointment.duration || 60);
      const endHours = Math.floor(endMinutes / 60) % 24;
      const endMins = endMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
      const endDateTime = `${appointment.date}T${endTime}:00`;

      const event = {
        summary: appointment.title,
        description: appointment.description || '',
        start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
      };

      const response = await fetch(`${baseUrl}/${appointment.google_event_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Google Calendar API error: ${JSON.stringify(error)}`);
      }

      result = await response.json();
    } else if (action === 'import') {
      // Import events from Google Calendar into appointments table
      const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days
      const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(); // next 180 days
      const listUrl = `${baseUrl}?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;
      const listResp = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!listResp.ok) {
        const error = await listResp.json();
        throw new Error(`Google Calendar list error: ${JSON.stringify(error)}`);
      }
      const listData = await listResp.json();
      const events = listData.items || [];

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      for (const ev of events) {
        // Skip all-day events (no dateTime) and cancelled
        if (!ev.start?.dateTime || ev.status === 'cancelled') { skipped++; continue; }

        const startDate = new Date(ev.start.dateTime);
        const endDate = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(startDate.getTime() + 60 * 60000);
        // Convert to São Paulo local date/time
        const tzDate = new Date(startDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const tzEnd = new Date(endDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const yyyy = tzDate.getFullYear();
        const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
        const dd = String(tzDate.getDate()).padStart(2, '0');
        const hh = String(tzDate.getHours()).padStart(2, '0');
        const mi = String(tzDate.getMinutes()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const timeStr = `${hh}:${mi}:00`;
        const duration = Math.max(15, Math.round((tzEnd.getTime() - tzDate.getTime()) / 60000));

        const attendees = (ev.attendees || []).map((a: any) => a.email).filter(Boolean);

        // Check if already exists
        const { data: existing } = await supabase
          .from('appointments')
          .select('id')
          .eq('google_event_id', ev.id)
          .maybeSingle();

        const payload: any = {
          google_event_id: ev.id,
          user_id: user.id,
          account_id: connection.account_id,
          title: ev.summary || '(Sem título)',
          description: ev.description || null,
          date: dateStr,
          time: timeStr,
          duration,
          type: 'meeting',
          status: 'scheduled',
          attendees,
          meeting_url: ev.hangoutLink || null,
        };

        if (existing) {
          const { error: upErr } = await supabase.from('appointments').update(payload).eq('id', existing.id);
          if (upErr) { console.error('[import] update failed', ev.id, upErr); skipped++; }
          else updated++;
        } else {
          const { error: insErr } = await supabase.from('appointments').insert(payload);
          if (insErr) { console.error('[import] insert failed', ev.id, insErr); skipped++; }
          else imported++;
        }
      }

      result = { imported, updated, skipped, total: events.length };
    } else if (action === 'delete') {
      if (!appointment.google_event_id) {
        return new Response(JSON.stringify({ skipped: true, message: 'No google_event_id' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(`${baseUrl}/${appointment.google_event_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok && response.status !== 410) {
        const error = await response.text();
        throw new Error(`Google Calendar delete error: ${error}`);
      }

      result = { deleted: true };
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
