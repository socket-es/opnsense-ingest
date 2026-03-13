import fs from "node:fs/promises";
import path from "node:path";

export async function run(args) {
  const { firewallHost, snapshotTime, source = "opnDossier", findings } = args;
  
  if (!firewallHost || !snapshotTime || !findings) {
    return { ok: false, error: "Faltan firewallHost, snapshotTime o findings", status: "error" };
  }
  
  const baseDir = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, ".openclaw", "workspace");
  const dataDir = path.join(baseDir, "opnsense", "snapshots");
  const hostDir = path.join(dataDir, firewallHost);
  
  await fs.mkdir(hostDir, { recursive: true });
  
  const fileName = `${snapshotTime}-${source}.json`;
  const filePath = path.join(hostDir, fileName);
  
  const fullPayload = {
    firewallHost, snapshotTime, source, findings,
    ingestedAt: new Date().toISOString(),
    ingestedBy: "opnsense-ingest v1.0.0"
  };
  
  await fs.writeFile(filePath, JSON.stringify(fullPayload, null, 2), "utf8");
  
  const deadRules = (findings?.dead_rules?.length || 0).toString();
  const securityIssues = (findings?.security_issues?.length || 0).toString();
  const summary = `${deadRules} dead rules, ${securityIssues} security issues`;
  
  try {
    const files = await fs.readdir(hostDir);
    for (const file of files) {
      const filePathCleanup = path.join(hostDir, file);
      const stats = await fs.stat(filePathCleanup);
      if (Date.now() - stats.mtimeMs > 30 * 24 * 60 * 60 * 1000) {
        await fs.rm(filePathCleanup);
      }
    }
  } catch {}
  
  return {
    ok: true,
    saved: filePath,
    host: firewallHost,
    time: snapshotTime,
    summary,
    status: "ok"
  };
}
