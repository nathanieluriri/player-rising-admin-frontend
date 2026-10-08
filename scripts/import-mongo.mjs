// Converts `mongoexport --jsonArray` dumps of the old backend into SQL for D1.
// Usage:
//   mongoexport --uri "$MONGO_URL" --db "$DB_NAME" -c blogs  --jsonArray -o blogs.json
//   mongoexport --uri "$MONGO_URL" --db "$DB_NAME" -c media  --jsonArray -o media.json
//   mongoexport --uri "$MONGO_URL" --db "$DB_NAME" -c admins --jsonArray -o admins.json
//   node scripts/import-mongo.mjs blogs.json media.json admins.json > import.sql
//   npx wrangler d1 execute players-rising --remote --file import.sql
import { readFileSync } from "node:fs";
import { basename } from "node:path";

function plain(v) {
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") {
    if ("$oid" in v) return v.$oid;
    if ("$numberLong" in v) return Number(v.$numberLong);
    if ("$numberInt" in v) return Number(v.$numberInt);
    if ("$numberDouble" in v) return Number(v.$numberDouble);
    if ("$date" in v) return Math.floor(new Date(v.$date.$numberLong ? Number(v.$date.$numberLong) : v.$date).getTime() / 1000);
    if ("$binary" in v) return Buffer.from(v.$binary.base64 ?? v.$binary, "base64").toString("utf8");
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const out = [];
for (const file of process.argv.slice(2)) {
  const table = basename(file).replace(/\.json$/, "");
  const docs = plain(JSON.parse(readFileSync(file, "utf8")));
  for (const { _id, ...doc } of docs) {
    if (table === "admins") {
      out.push(
        `INSERT OR REPLACE INTO admins (id, full_name, email, password, invited_by, date_created, last_updated) VALUES (${[
          _id,
          doc.full_name,
          doc.email,
          doc.password,
          doc.invited_by,
          doc.date_created,
          doc.last_updated,
        ]
          .map(q)
          .join(", ")});`,
      );
    } else if (table === "blogs" || table === "media") {
      out.push(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (${q(_id)}, ${q(JSON.stringify(doc))});`);
    } else {
      throw new Error(`Unknown collection file: ${file} (expected blogs.json, media.json or admins.json)`);
    }
  }
}
console.log(out.join("\n"));
