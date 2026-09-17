# Staff sales channels

The staff menu now uses Overview, Pre-orders, Booth, Wholesale, Cookie menu, and Settings.

- Pre-orders lists website orders. Older staff-entered orders remain accessible through Settings > Previous records > Previous manual orders.
- Booth records daily totals by flavour, prepared/sold/sample/waste quantities, leftovers, price per piece, total discounts, and itemised expenses.
- Wholesale reuses existing supplier contacts as buyers. Each order snapshots its buyer contact and flavour prices and tracks amount received and outstanding.
- New records live in the Firestore `business_records` collection. Contacts remain in `suppliers`; saving a contact preserves existing agreement fields. No old records are migrated or deleted.
- The overview counts verified, active/completed website orders and saved Booth/Wholesale sales for the selected Malaysia calendar dates. Wholesale sales include unpaid amounts, which are also shown separately. The displayed expenses only cover new channel records. Previous manually entered sales and ledger entries are excluded to prevent double counting; they remain accessible in Settings.
- Saves use record IDs and revision checks. Retrying an already committed save returns a conflict instead of creating a second record. Staff should refresh after an uncertain save. Only staff/admin tokens can use the new API.

## Verification

Run calculation tests with `node --test tests/business.test.mjs`.

`tests/business-ui.cjs` exercises booth create/edit, buyer contacts, per-flavour wholesale pricing, payment updates, overview totals, and mobile navigation. It uses mocked API responses and never writes live records. Start the app on port 3010 with local Firebase configuration. Install Playwright separately or point `PLAYWRIGHT_MODULE` at an existing Playwright module; Edge is the default browser (`PLAYWRIGHT_CHANNEL` overrides it). Run `node tests/business-ui.cjs`. Screenshots go to ignored `artifacts/staff-checks/`.

A full production build passed with temporary placeholder public Firebase settings. This verifies compilation and prerendering, not Firestore connectivity. Before live use, configure the real Firebase environment and verify the project's Firestore access rules permit the new collection through the existing application setup. Live database reads/writes have not been tested in this copy.
