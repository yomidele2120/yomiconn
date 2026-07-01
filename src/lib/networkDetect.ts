// Nigerian mobile number prefix → network detection
// Source: NCC number allocation, updated 2024.
// Our internal network IDs: 1=MTN, 2=Airtel, 3=Glo, 4=9mobile

const PREFIX_MAP: Record<string, { id: string; name: string }> = {};

const NETWORKS = {
  MTN: { id: "1", name: "MTN" },
  AIRTEL: { id: "2", name: "Airtel" },
  GLO: { id: "3", name: "Glo" },
  NINE: { id: "4", name: "9mobile" },
};

const add = (prefixes: string[], net: { id: string; name: string }) => {
  for (const p of prefixes) PREFIX_MAP[p] = net;
};

add(
  ["0703","0706","0803","0806","0810","0813","0814","0816","0903","0906","0913","0916","07025","07026","0704"],
  NETWORKS.MTN
);
add(
  ["0701","0708","0802","0808","0812","0902","0901","0904","0907","0912"],
  NETWORKS.AIRTEL
);
add(
  ["0705","0805","0807","0811","0815","0905","0915"],
  NETWORKS.GLO
);
add(
  ["0809","0817","0818","0908","0909"],
  NETWORKS.NINE
);

/**
 * Detect the Nigerian mobile network from a raw phone number.
 * Accepts local (0803…) or international (2348…, +2348…) forms.
 * Returns null if the number is too short or the prefix is unknown.
 */
export function detectNetwork(raw: string): { id: string; name: string } | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  // Normalize to local 0-prefix form
  if (digits.startsWith("234")) digits = "0" + digits.slice(3);
  if (digits.length < 4) return null;

  // Try longest prefix first (5-char then 4-char)
  const p5 = digits.slice(0, 5);
  if (PREFIX_MAP[p5]) return PREFIX_MAP[p5];
  const p4 = digits.slice(0, 4);
  if (PREFIX_MAP[p4]) return PREFIX_MAP[p4];
  return null;
}
