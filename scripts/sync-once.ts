/**
 * Run a single sync from the command line (uses .env DATABASE_URL).
 * Run:  npm run sync
 */
import "dotenv/config";
import { runSync } from "../src/lib/sync";

runSync()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error("sync failed:", e);
    process.exit(1);
  });
