# Responsive UI review — 17 October 2026

Reviewed authenticated Meta, Campaigns, Analytics, Reports, Rules & Alerts, Shopify Sales, Combined Overview, Integrations, Settings and Setup Checklist screens. Initial screenshots were inspected at mobile, tablet and desktop widths; before/after images are stored locally in `artifacts/ui-review/`. These screenshots can contain workspace/account information and should not be published without review.

Changes:

- Production navigation becomes a drawer below 1024px, giving tablet reporting screens the full viewport. The drawer supports Escape, focus containment, initial focus, restoring focus, background scroll locking and reduced motion. Hidden navigation is not keyboard-focusable.
- Settings forms use consistent card padding and field spacing instead of inherited preview padding. Mobile inputs use 16px text. Checkbox labels align horizontally with adequate touch height.
- Combined filters use a regular three-column desktop grid and one column on phones. Five summary cards share a desktop row, with responsive grouping and a full-width final card on phones. The MER card now renders its already-validated value when available.
- Import-health cards use two source columns and collapse on phones. Tables scroll within their own container. Page headings, status badges and controls wrap within the viewport. Workspace/connection badges describe the current screen.
- All production action buttons have a minimum 44px height. The tablet/mobile menu button is at least 44px square.

Automated checks cover all ten production screens at 320, 390, 768, 1024 and 1440px, including page errors and document overflow. Navigation interaction checks cover 390 and 768px, Escape, focus, scroll restoration and navigating to Shopify. Preview overflow checks cover seven preview screens at 375, 768, 1024, 1280 and 1440px. No invitations, purchases, source changes or emails are created by these checks.

TypeScript and production build passed. Browser verification uses desktop Chrome viewport emulation; this is not a claim of testing every physical device or browser.
