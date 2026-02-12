---
name: db-ops
description: Tools for managing the database, including migrations, seeding, and resetting.
---

# Database Operations

Use these commands to manage the database in `packages/database`.

## 1. Schema Management (Drizzle Kit)

Run these commands from the `packages/database` directory (`cd packages/database`).

- **Generate Migrations**: Create SQL migration files from schema changes.
  ```bash
  npm run generate
  ```
- **Push Schema**: Apply schema changes directly to the database (prototyping).
  ```bash
  npm run push
  ```
- **Studio**: Open Drizzle Studio to view/edit data visually.
  ```bash
  npm run studio
  ```

## 2. Maintenance Scripts

Run these scripts using `tsx` or `ts-node` from `packages/database`.

- **Check Data**: Validate current data integrity.
  ```bash
  npx tsx check-data.ts
  ```
- **Clean/Reset Database**: **WARNING** Deletes all data. Use with caution.
  ```bash
  npx tsx clean-db.ts
  ```
- **Fix Owner**: specialized script to fix owner permissions.
  ```bash
  npx tsx fix-owner.ts
  ```

## 3. Common Issues

- **Schema mismatch**: If `apps/web` or `apps/bot` complain about missing columns, run `npm run push` to ensure the DB is up to date.
