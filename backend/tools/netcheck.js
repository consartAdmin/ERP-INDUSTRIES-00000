// backend/tools/netcheck.js
import dns from "dns/promises";

export async function netcheck(_req, res) {
  try {
    const dnsRes = await dns.lookup("nfe.fazenda.mg.gov.br"); // { address, family }
    const url = "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4";
    const r = await fetch(url, { method: "GET" });
    const text = await r.text().catch(() => "");
    res.json({
      ok: true,
      dns: dnsRes,
      httpStatus: r.status,
      reachable: r.ok || (r.status >= 200 && r.status < 500),
      sample: text.slice(0, 200),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
