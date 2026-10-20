# Supabase integration skill

Use this skill whenever the task involves Supabase database, authentication, storage, migrations, or RLS.

- Inspect the existing project and schema before changing anything.
- Use the project's Supabase environment variables; never expose service-role or secret keys in frontend code.
- Keep database changes in reviewed SQL migrations under `supabase/migrations/`.
- Enable Row Level Security for user-owned tables and add explicit policies for every required operation.
- Prefer the publishable/anon key in browser code and server-side clients for privileged operations.
- Validate all user input and scope queries to the authenticated user where applicable.
- For authentication, use Supabase Auth with secure cookie/session handling and never implement mock authentication.
- Run the platform's Supabase validation action after generating or editing Supabase files.
- Run `supabase_upload` only after a migration exists and has been reviewed. Report deployment success only when the action returns success.
