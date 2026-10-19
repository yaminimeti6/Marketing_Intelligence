# Profit Planner

`/profit-planner` is an authenticated manual scenario calculator. It calculates variable costs, contribution after ads, an operating estimate after overhead, margins, blended revenue/ad spend and fixed-sales break-even ad spend/return. Inputs are not imported accounting records and results are not certified net profit.

All amounts use six-decimal fixed-point BigInt arithmetic. Ratios truncate to six decimals. Blank, negative, exponent-form, malformed and overprecision inputs are rejected. Zero revenue/spend denominators produce unavailable ratios. If non-ad costs exceed sales, affordable ad spend and break-even return are unavailable. Zero affordable ad spend is distinguished from unavailable.

One currency per scenario; changing currency changes the label, with no FX conversion. The user must use the same accounting period and consistent cost/tax treatment throughout. Net Sales should already reflect discounts and returns; do not subtract them twice. This increment excludes imported SKU COGS, accounting periods, stored cost history, income taxes and interest. Changing advertising spend may affect revenue; the break-even calculation holds revenue and other costs fixed.

CSV exports are generated locally. No scenario persistence, provider requests, AI requests or ad changes occur. Reloading clears inputs. This does not complete the broader Profit Analytics requirement.
