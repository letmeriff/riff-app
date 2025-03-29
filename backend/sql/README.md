# SQL Scripts Directory

This directory contains all SQL scripts for the Riff application, organized as follows:

## Structure

- `migrations/`: Database migration scripts, to be applied in order by version number
- `schema/`: SQL scripts that define database schema and tables
- `archive/`: Historical SQL scripts that are kept for reference but no longer actively used

## Usage

Migration scripts are applied automatically by the backend application during startup or by running:

```
ts-node src/scripts/apply-yjs-migration.ts
```

## Best Practices

1. Always prefix migration files with a sequence number (e.g., `01_`, `02_`) to ensure they are applied in the correct order
2. Document the purpose of each migration in a comment at the top of the file
3. Keep schema-defining SQL in the schema directory
4. Move obsolete SQL scripts to the archive directory instead of deleting them
