
DO $$
DECLARE
  acc_ids uuid[] := ARRAY['f4e57f05-1eb8-41ea-b66d-502ca06e7bf9'::uuid,'afffb4a3-f34a-4601-8e8c-b75c483ed0c5'::uuid];
  user_ids uuid[] := ARRAY['0018a570-adc4-49f5-a819-fd43d7d357d7'::uuid,'4f6de6fd-b85d-447c-880d-549f9dda24b3'::uuid];
BEGIN
  -- Quebra dependências em outras contas (deals que referenciam team_members desses usuários)
  UPDATE public.deals SET owner_id = NULL
   WHERE owner_id IN (SELECT id FROM public.team_members WHERE user_id = ANY(user_ids));
  DELETE FROM public.team_members WHERE user_id = ANY(user_ids);
  DELETE FROM public.account_members WHERE user_id = ANY(user_ids);

  -- Limpa dados das contas de teste
  DELETE FROM public.deal_activities WHERE account_id = ANY(acc_ids);
  DELETE FROM public.deals WHERE account_id = ANY(acc_ids);
  DELETE FROM public.team_members WHERE account_id = ANY(acc_ids);
  DELETE FROM public.team_functions WHERE account_id = ANY(acc_ids);
  DELETE FROM public.teams WHERE account_id = ANY(acc_ids);
  DELETE FROM public.pipeline_stages WHERE account_id = ANY(acc_ids);
  DELETE FROM public.tag_definitions WHERE account_id = ANY(acc_ids);
  DELETE FROM public.appointments WHERE account_id = ANY(acc_ids);
  DELETE FROM public.messages WHERE account_id = ANY(acc_ids);
  DELETE FROM public.message_processing_queue WHERE account_id = ANY(acc_ids);
  DELETE FROM public.message_grouping_queue WHERE account_id = ANY(acc_ids);
  DELETE FROM public.nina_processing_queue WHERE account_id = ANY(acc_ids);
  DELETE FROM public.send_queue WHERE account_id = ANY(acc_ids);
  DELETE FROM public.conversation_states WHERE account_id = ANY(acc_ids);
  DELETE FROM public.conversations WHERE account_id = ANY(acc_ids);
  DELETE FROM public.contacts WHERE account_id = ANY(acc_ids);
  DELETE FROM public.media_library WHERE account_id = ANY(acc_ids);
  DELETE FROM public.nina_settings WHERE account_id = ANY(acc_ids);
  DELETE FROM public.google_calendar_connections WHERE account_id = ANY(acc_ids);
  DELETE FROM public.account_policies WHERE account_id = ANY(acc_ids);
  DELETE FROM public.governance_notifications WHERE account_id = ANY(acc_ids);
  DELETE FROM public.data_subject_requests WHERE account_id = ANY(acc_ids);
  DELETE FROM public.data_exports WHERE account_id = ANY(acc_ids);
  DELETE FROM public.data_deletion_requests WHERE account_id = ANY(acc_ids);
  DELETE FROM public.audit_logs WHERE account_id = ANY(acc_ids);
  DELETE FROM public.account_invites WHERE account_id = ANY(acc_ids);
  DELETE FROM public.account_members WHERE account_id = ANY(acc_ids);
  DELETE FROM public.accounts WHERE id = ANY(acc_ids);

  DELETE FROM public.profiles WHERE user_id = ANY(user_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(user_ids);
  DELETE FROM auth.users WHERE id = ANY(user_ids);
END $$;
