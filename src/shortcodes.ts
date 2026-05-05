// Shortcode expansion for admin-authored event descriptions.
//
// Currently supported:
//   [donate]   →  embeds the live donation form (tier picker + details + submit
//                  to /donate). Tiers come from the donation_tiers D1 table at
//                  render time, so editing tiers in the admin updates every
//                  event page that uses [donate] without re-saving.
//
// Adding a new shortcode = add a regex + an async renderer to SHORTCODES.

import { loadDonationTiers } from "./donations";
import { DonateForm } from "./views/donate";

type ShortcodeContext = { db: D1Database };

type Shortcode = {
  pattern: RegExp;
  render: (ctx: ShortcodeContext) => Promise<string>;
};

async function jsxToString(node: unknown): Promise<string> {
  // Hono JSX nodes have a toString() that may return string | Promise<string>
  // depending on whether the subtree contains async children.
  const result = (node as { toString: () => string | Promise<string> }).toString();
  return typeof result === "string" ? result : await result;
}

const SHORTCODES: Shortcode[] = [
  {
    pattern: /\[donate(?:\s+[^\]]*)?\]/gi,
    render: async ({ db }) => {
      const tiers = await loadDonationTiers(db);
      return jsxToString(DonateForm({ tiers }));
    },
  },
];

export async function expandShortcodes(
  html: string,
  ctx: ShortcodeContext,
): Promise<string> {
  let out = html;
  for (const sc of SHORTCODES) {
    if (!sc.pattern.test(out)) continue;
    sc.pattern.lastIndex = 0; // regex state from .test()
    const rendered = await sc.render(ctx);
    out = out.replace(sc.pattern, () => rendered);
  }
  return out;
}
