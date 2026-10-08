# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/be269c86-a5e9-4ffe-918f-43b7fb704d8b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/be269c86-a5e9-4ffe-918f-43b7fb704d8b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Architecture

One Cloudflare Worker serves both the admin app and the API:

- `src/`: React admin app, built by Vite into `dist/` and served as static assets.
- `worker/`: the API (Hono). It handles `/v1/*` (admin), `/api/v1/*` (public articles and media), `/videos/*` and `/images/*` (uploaded files), `/health` and `/task/*`. Every other path falls through to the React app.
- D1 (`players-rising`) stores admins, tokens, blogs and media records. Schema lives in `migrations/`.
- R2 (`players-rising-media`) stores uploaded images and videos.

## Local development

```sh
bun install
printf 'JWT_SECRET=dev\nSUPER_ADMIN_EMAIL=admin@example.com\nSUPER_ADMIN_PASSWORD=dev\n' > .dev.vars
npx wrangler d1 migrations apply players-rising --local
bun run dev:worker        # app + API on http://localhost:8787
```

`bun run dev` still runs the Vite dev server alone. Set `VITE_API_URL` to point it at a running API.

## Deploy

```sh
bun run db:migrate        # apply new migrations to the remote D1 database
bun run deploy            # build the app and deploy the Worker
```

Secrets (set once with `npx wrangler secret put <NAME>`):

- `JWT_SECRET`: signs admin access tokens.
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`: the built-in super admin login.
- `PUBLIC_BASE_URL` (var in `wrangler.toml`): base URL used in uploaded file links.

## Importing data from the old MongoDB backend

```sh
mongoexport --uri "$MONGO_URL" --db "$DB_NAME" -c blogs  --jsonArray -o blogs.json
mongoexport --uri "$MONGO_URL" --db "$DB_NAME" -c media  --jsonArray -o media.json
mongoexport --uri "$MONGO_URL" --db "$DB_NAME" -c admins --jsonArray -o admins.json
node scripts/import-mongo.mjs blogs.json media.json admins.json > import.sql
npx wrangler d1 execute players-rising --remote --file import.sql
```

IDs are kept, so existing article links keep working. Imported admins keep their bcrypt passwords, which are upgraded on their next login. Videos that were stored in GridFS have to be uploaded again.
