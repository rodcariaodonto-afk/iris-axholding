WITH c AS (
  SELECT co.id FROM public.conversations co
  JOIN public.contacts ct ON ct.id = co.contact_id
  WHERE ct.phone_number = '5511999990001' AND ct.account_id = 'de65f931-3a02-4184-8489-0b9545759f21'
)
DELETE FROM public.message_grouping_queue q
WHERE q.whatsapp_message_id = 'TESTDIAG001'
   OR q.message_id IN (SELECT m.id FROM public.messages m WHERE m.conversation_id IN (SELECT id FROM c));

DELETE FROM public.message_processing_queue WHERE whatsapp_message_id = 'TESTDIAG001';

DELETE FROM public.nina_processing_queue WHERE conversation_id IN (SELECT co.id FROM public.conversations co JOIN public.contacts ct ON ct.id = co.contact_id WHERE ct.phone_number = '5511999990001' AND ct.account_id = 'de65f931-3a02-4184-8489-0b9545759f21');

DELETE FROM public.send_queue WHERE conversation_id IN (SELECT co.id FROM public.conversations co JOIN public.contacts ct ON ct.id = co.contact_id WHERE ct.phone_number = '5511999990001' AND ct.account_id = 'de65f931-3a02-4184-8489-0b9545759f21');

DELETE FROM public.messages WHERE conversation_id IN (SELECT co.id FROM public.conversations co JOIN public.contacts ct ON ct.id = co.contact_id WHERE ct.phone_number = '5511999990001' AND ct.account_id = 'de65f931-3a02-4184-8489-0b9545759f21');

DELETE FROM public.conversation_states WHERE conversation_id IN (SELECT co.id FROM public.conversations co JOIN public.contacts ct ON ct.id = co.contact_id WHERE ct.phone_number = '5511999990001' AND ct.account_id = 'de65f931-3a02-4184-8489-0b9545759f21');

DELETE FROM public.deals WHERE contact_id IN (SELECT id FROM public.contacts WHERE phone_number = '5511999990001' AND account_id = 'de65f931-3a02-4184-8489-0b9545759f21');

DELETE FROM public.conversations WHERE contact_id IN (SELECT id FROM public.contacts WHERE phone_number = '5511999990001' AND account_id = 'de65f931-3a02-4184-8489-0b9545759f21');

DELETE FROM public.contacts WHERE phone_number = '5511999990001' AND account_id = 'de65f931-3a02-4184-8489-0b9545759f21';