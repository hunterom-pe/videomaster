// Connection settings for the node-postgres pool (pure, unit-tested).
//
// Managed poolers such as Supabase's present a certificate chain that Node's default verification rejects
// ("self-signed certificate in certificate chain"), and the `pg` driver lets `sslmode=` in the URL override any
// `ssl` option. So for those hosts we strip the URL's ssl parameters and pass `ssl` explicitly: the connection is
// still encrypted, only certificate-chain verification is skipped. Set DB_SSL=no-verify to force this for other
// hosts. Localhost and every other host keep the driver's defaults.
export type PoolSettings = { connectionString: string; ssl?: { rejectUnauthorized: false }; max: number };

const SSL_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"];
const MANAGED_HOST = /(^|\.)supabase\.(com|co)$/i;

export function poolSettings(connectionString: string, env: { DB_SSL?: string; DB_POOL_MAX?: string } = {}): PoolSettings {
  // Serverless functions each hold their own pool, so keep it small (default 5, allowed 1-20).
  const requested = Number.parseInt(env.DB_POOL_MAX ?? "", 10);
  const max = Number.isFinite(requested) && requested >= 1 && requested <= 20 ? requested : 5;

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return { connectionString, max }; // let the driver report a malformed URL
  }
  const skipVerify = env.DB_SSL === "no-verify" || MANAGED_HOST.test(url.hostname);
  if (!skipVerify) return { connectionString, max };
  for (const p of SSL_PARAMS) url.searchParams.delete(p);
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max };
}
