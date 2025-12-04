import { RevenueManager } from "./revenueManager";

/**
 * AutoaffiDistributor
 * -------------------
 * Hämtar, beräknar och distribuerar intäkter
 * från alla anslutna affiliate-nätverk.
 */
export class AutoaffiDistributor {
  private manager: RevenueManager;

  constructor() {
    this.manager = new RevenueManager();
  }

  public async distributeRevenues() {
    console.log("💰 [AutoaffiDistributor] Starting revenue distribution...");

    try {
      // 1️⃣ ClickBank
      console.log("🔗 Fetching ClickBank data...");
      await this.safeIngest("clickbank");

      // 2️⃣ Digistore24
      console.log("🔗 Fetching Digistore24 data...");
      await this.safeIngest("digistore24");

      // 3️⃣ Beräkna & distribuera
      console.log("🧠 Processing combined data...");
      await this.manager.calculateAndDistribute();

      console.log("✅ [AutoaffiDistributor] Revenue distribution complete!");
    } catch (err) {
      console.error("❌ [AutoaffiDistributor] Error during distribution:", err);
      throw err;
    }
  }

  private async safeIngest(network: string) {
    try {
      await this.manager.ingest(network);
      console.log(`✅ [Ingest] ${network} OK`);
    } catch (err) {
      console.error(`⚠️ [Ingest] ${network} failed:`, err);
    }
  }
}

// 🧪 Direkt testning
if (require.main === module) {
  (async () => {
    const distributor = new AutoaffiDistributor();
    await distributor.distributeRevenues();
  })();
}