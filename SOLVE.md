# SOLVE.md

This file explains how you can help me help you, especially when time and energy are low.

## Fastest Path To Fixes
- Provide exact reproduction steps: page, action, expected result, actual result.
- Include console errors (copy/paste) and a screenshot or short screen recording.
- Note the device, browser, and whether it was desktop or mobile.
- If it is a print issue, include print dialog settings (scale, margins, paper size).

## Permissions That Enable Real Verification
To run the full verification checklist locally, I need to:
- Start the dev server (local port binding).
- Use a browser automation tool (Playwright) for repeatable checks.

If you want automated verification, approve these commands:
- `npm install`
- `npx playwright install chrome`
- `npm run dev -- --host 127.0.0.1 --port 3001`

## Data And State Help
- If an issue depends on existing data, export and share the relevant context:
  - Which drill/plan/player you were on
  - Any specific templates or sequences involved
  - Whether localStorage was cleared or reused

## Skills And Tools You Can Ask For
- Ask to create a verification skill to run a repeatable checklist after each change.
- Ask to create a print-layout skill to lock down PDF/print formatting rules.
- Ask to create a regression checklist skill for the exact features you care about.

## How To Ask For A Fix (Template)
- Page:
- Steps:
- Expected:
- Actual:
- Console error (if any):
- Screenshot/recording:
- Device + browser:
