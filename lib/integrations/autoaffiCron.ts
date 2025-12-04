import { AutoaffiDistributor } from "./autoaffiDistributor";
import cron from "node-cron";

console.log("🚀 Autoaffi Cron service starting...");

// Initiera distributorn (kärnan som kopplar till ClickBank, Digistore24, osv)
const distributor = new AutoaffiDistributor();

// 🕐 Kör varje natt kl 02:00 (server-tid)
// Cron-format: minute hour day month weekday
cron.schedule("0 2 * * *", async () => {
  console.log("🌙 Nightly Autoaffi sync started at", new Date().toISOString());
  try {
    await distributor.distributeRevenues();
    console.log("✅ Nightly Autoaffi sync complete!");
  } catch (err) {
    console.error("❌ Error during nightly Autoaffi sync:", err);
  }
});

// 🧪 För lokal testning – kör direkt (du kan kommentera bort detta på Vercel)
(async () => {
  console.log("🧩 Running immediate Autoaffi sync for test...");
  try {
    await distributor.distributeRevenues();
    console.log("✅ Manual test sync complete!");
  } catch (err) {
    console.error("❌ Manual test sync failed:", err);
  }
})();