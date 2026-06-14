CREATE TABLE IF NOT EXISTS private_cloud_customers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  company_name text,
  railway_project_id text,
  railway_environment_id text,
  railway_app_service_id text,
  railway_db_service_id text,
  railway_url text,
  subdomain text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  notes text,
  monthly_fee_krw integer,
  created_at timestamp NOT NULL DEFAULT now(),
  provisioned_at timestamp
);
