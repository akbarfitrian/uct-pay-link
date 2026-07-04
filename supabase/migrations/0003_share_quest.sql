-- ============================================================================
-- uct-pay-link :: "Social Sharer" quest (Direct sharing to WhatsApp / Telegram)
--
-- The client now offers WhatsApp/Telegram share buttons next to every
-- generated payment link (ShareButtons.tsx) and calls
-- completeQuest('social_sharer') the first time either is used.
-- complete_quest() (see 0001_points_system.sql) rejects any quest_id it
-- doesn't recognize in the `quests` catalog table, so this migration just
-- seeds that one new row — no new tables or functions needed, the existing
-- RPCs already handle any quest_id present here.
-- ============================================================================

insert into public.quests (quest_id, points) values
  ('social_sharer', 10)
on conflict (quest_id) do update set points = excluded.points;
