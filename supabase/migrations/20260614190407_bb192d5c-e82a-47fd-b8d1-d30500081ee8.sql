CREATE POLICY "Authenticated users can read realtime messages"
ON realtime.messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can send realtime messages"
ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true);