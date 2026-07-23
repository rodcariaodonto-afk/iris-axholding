
DO $$
DECLARE
  acc uuid := 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0';
  usr uuid := '14a5d0a5-5885-44cd-976d-f498cd4c2bac';
BEGIN
  DELETE FROM public.message_grouping_queue WHERE account_id = acc;
  DELETE FROM public.message_processing_queue WHERE account_id = acc;
  DELETE FROM public.nina_processing_queue WHERE account_id = acc;
  DELETE FROM public.send_queue WHERE account_id = acc;
  DELETE FROM public.campaign_contacts WHERE account_id = acc;
  DELETE FROM public.outbound_campaigns WHERE account_id = acc;
  DELETE FROM public.messages WHERE account_id = acc;
  DELETE FROM public.conversation_states WHERE account_id = acc;
  DELETE FROM public.conversations WHERE account_id = acc;
  DELETE FROM public.deal_activities WHERE account_id = acc;
  DELETE FROM public.deals WHERE account_id = acc;
  DELETE FROM public.pipeline_stages WHERE account_id = acc;
  DELETE FROM public.appointments WHERE account_id = acc;
  DELETE FROM public.bookable_resources WHERE account_id = acc;
  DELETE FROM public.contacts WHERE account_id = acc;
  DELETE FROM public.tag_definitions WHERE account_id = acc;
  DELETE FROM public.media_library WHERE account_id = acc;
  DELETE FROM public.coworking_payments WHERE account_id = acc;
  DELETE FROM public.google_calendar_connections WHERE account_id = acc;
  DELETE FROM public.whatsapp_transfer_logs WHERE account_id = acc;
  DELETE FROM public.whatsapp_queue_members WHERE account_id = acc;
  DELETE FROM public.whatsapp_queues WHERE account_id = acc;
  DELETE FROM public.whatsapp_sessions WHERE account_id = acc;
  DELETE FROM public.whatsapp_account_settings WHERE account_id = acc;
  DELETE FROM public.team_members WHERE account_id = acc;
  DELETE FROM public.team_functions WHERE account_id = acc;
  DELETE FROM public.teams WHERE account_id = acc;
  DELETE FROM public.nina_settings WHERE account_id = acc;
  DELETE FROM public.governance_notifications WHERE account_id = acc;
  DELETE FROM public.data_deletion_requests WHERE account_id = acc;
  DELETE FROM public.data_exports WHERE account_id = acc;
  DELETE FROM public.data_subject_requests WHERE account_id = acc;
  DELETE FROM public.audit_logs WHERE account_id = acc;
  DELETE FROM public.account_policies WHERE account_id = acc;
  DELETE FROM public.account_invites WHERE account_id = acc;
  DELETE FROM public.account_members WHERE account_id = acc;
  DELETE FROM public.user_roles WHERE user_id = usr;
  DELETE FROM public.profiles WHERE id = usr;
  DELETE FROM public.accounts WHERE id = acc;
  DELETE FROM auth.users WHERE id = usr;
END $$;
