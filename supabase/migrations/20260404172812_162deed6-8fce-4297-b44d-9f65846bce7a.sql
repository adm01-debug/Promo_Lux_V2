DROP POLICY IF EXISTS "Users can only listen to own channels" ON realtime.messages;

CREATE POLICY "Users can only listen to own channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (realtime.topic() = ('private:' || auth.uid()::text));