-- Distinct events can legitimately have identical bodies (for example uninstall
-- after reinstall). Deduplicate by the provider event identifier, not body content.
DO $$ DECLARE constraint_name text; BEGIN
 FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='public.shopify_webhook_receipts'::regclass AND contype='u' LOOP
  EXECUTE format('ALTER TABLE public.shopify_webhook_receipts DROP CONSTRAINT %I',constraint_name);
 END LOOP;
END $$;
