import { spawnSync } from "node:child_process";

const pgCtl = process.env.ISOLATED_POSTGRES_PG_CTL || "";
const env = { ...process.env };
delete env.ISOLATED_POSTGRES_PG_CTL;
spawnSync(pgCtl, process.argv.slice(2), { stdio: "inherit", env });
process.exit(1);
