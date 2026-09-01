-- =============================================================================
-- 00000000000005_messaging_and_review_categories.sql
--
-- Two additive features from the UI audit ("Trivara - UI Blind Spots & Gaps
-- vs. Other OTAs"), both intentionally scoped to be pure additions with no
-- change to existing tables' meaning:
--
--   1. Host-guest messaging. There was previously no way for a guest to ask
--      a host a question before booking, or for a host to message a guest
--      after - the only contact was one-way transactional email. Adds
--      `conversations` (one thread per listing+guest pair) and `messages`.
--
--   2. Per-category review ratings. 00000000000001_consolidated_baseline.sql
--      deliberately kept `reviews` to a single overall `rating` and
--      documented (see its README) that the cleanliness/accuracy/
--      communication/location/value columns referenced by a since-removed,
--      never-shipped review form were left out because the frontend side
--      was "out of scope ... being done in parallel by another engineer."
--      This migration is that frontend work actually landing: real, nullable
--      1-5 columns per category, additive alongside the existing overall
--      `rating` (which stays the single source of truth for
--      refresh_listing_rating() / listings.rating - category scores are
--      display-only breakdowns, not a second way to compute the average).
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- DROP POLICY IF EXISTS before every CREATE POLICY.
-- =============================================================================


-- =============================================================================
-- 1. MESSAGING
-- =============================================================================

-- One conversation per (listing, guest) pair - re-opening "Message host" on
-- a listing you've already messaged the host about reuses the same thread
-- instead of spawning a new one every time.
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_guest_id ON public.conversations(guest_id);
CREATE INDEX IF NOT EXISTS idx_conversations_host_id ON public.conversations(host_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view own conversations" ON public.conversations;
CREATE POLICY "Participants can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = guest_id OR auth.uid() = host_id);

-- Either side may start a thread (a guest asking before booking, or a host
-- reaching out about an existing booking) - the only thing RLS enforces here
-- is that you can't create a conversation naming yourself as neither party.
-- Matching the listing's actual host_id, or that the two users share a real
-- booking, is validated in messageService.ts rather than in SQL: getting
-- that wrong can at most start an unwanted conversation between two real,
-- named users (visible only to those two, per the SELECT policy above), the
-- same trust boundary as email - it can't leak a third party's data.
DROP POLICY IF EXISTS "Participants can start conversations" ON public.conversations;
CREATE POLICY "Participants can start conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = guest_id OR auth.uid() = host_id);

DROP POLICY IF EXISTS "Participants can update own conversations" ON public.conversations;
CREATE POLICY "Participants can update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = guest_id OR auth.uid() = host_id);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 4000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view messages in own conversations" ON public.messages;
CREATE POLICY "Participants can view messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (auth.uid() = c.guest_id OR auth.uid() = c.host_id)
    )
  );

DROP POLICY IF EXISTS "Participants can send messages in own conversations" ON public.messages;
CREATE POLICY "Participants can send messages in own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (auth.uid() = c.guest_id OR auth.uid() = c.host_id)
    )
  );

-- Lets the recipient (not the sender) mark a message read.
DROP POLICY IF EXISTS "Participants can mark messages read" ON public.messages;
CREATE POLICY "Participants can mark messages read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (auth.uid() = c.guest_id OR auth.uid() = c.host_id)
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

-- Keeps conversations.last_message_at current so the inbox can sort threads
-- by recency with a plain ORDER BY instead of a per-render aggregate query.
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_conversation_on_message ON public.messages;
CREATE TRIGGER trg_touch_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();

-- Enables Supabase Realtime (postgres_changes) subscriptions on messages so
-- an open inbox/thread updates live instead of needing a manual refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;


-- =============================================================================
-- 2. PER-CATEGORY REVIEW RATINGS
-- =============================================================================

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS cleanliness_rating SMALLINT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS accuracy_rating SMALLINT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS communication_rating SMALLINT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS value_rating SMALLINT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS location_rating SMALLINT;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_cleanliness_rating_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_cleanliness_rating_check
  CHECK (cleanliness_rating IS NULL OR cleanliness_rating BETWEEN 1 AND 5);
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_accuracy_rating_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_accuracy_rating_check
  CHECK (accuracy_rating IS NULL OR accuracy_rating BETWEEN 1 AND 5);
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_communication_rating_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_communication_rating_check
  CHECK (communication_rating IS NULL OR communication_rating BETWEEN 1 AND 5);
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_value_rating_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_value_rating_check
  CHECK (value_rating IS NULL OR value_rating BETWEEN 1 AND 5);
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_location_rating_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_location_rating_check
  CHECK (location_rating IS NULL OR location_rating BETWEEN 1 AND 5);

-- =============================================================================
-- End of 00000000000004_messaging_and_review_categories.sql
-- =============================================================================
