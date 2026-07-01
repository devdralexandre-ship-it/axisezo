DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;

-- Restrict Realtime broadcast/presence access to the single known app topic
-- ('kanban-realtime'), preventing authenticated users from subscribing to or
-- injecting messages into arbitrary topics belonging to other users.
CREATE POLICY "Kanban realtime read"
ON realtime.messages FOR SELECT TO authenticated
USING (realtime.topic() = 'kanban-realtime');

CREATE POLICY "Kanban realtime send"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.topic() = 'kanban-realtime');