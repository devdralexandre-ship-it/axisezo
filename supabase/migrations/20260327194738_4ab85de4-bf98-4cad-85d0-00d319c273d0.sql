
CREATE POLICY "Authenticated users can delete contacts"
ON public.contact_records
FOR DELETE
TO authenticated
USING (true);
