
UPDATE public.accounts
   SET status = 'suspended', cancelled_at = now()
 WHERE id = 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0';

UPDATE public.nina_settings
   SET is_active = false, auto_response_enabled = false
 WHERE account_id = 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0';

UPDATE public.outbound_campaigns
   SET status = 'paused'
 WHERE account_id = 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0'
   AND status IN ('active','scheduled','running');

-- Freeze pending queue by pushing scheduled_at far into the future.
-- Original scheduled_at is preserved in metadata for reactivation.
UPDATE public.send_queue
   SET metadata = COALESCE(metadata, '{}'::jsonb)
                  || jsonb_build_object('paused_original_scheduled_at', scheduled_at,
                                        'paused_at', now(),
                                        'paused_reason', 'account_suspended'),
       scheduled_at = '2099-01-01T00:00:00Z'
 WHERE account_id = 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0'
   AND status IN ('pending','processing');
