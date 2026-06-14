CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent_at
ON public.messages USING btree (conversation_id, sent_at ASC);