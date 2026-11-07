# ResultsDesk Plus

An unofficial userscript that adds extra features to [resultsdesk.nz](https://resultsdesk.nz/) for New Zealand election night. It runs in your own browser on top of the real site; it is not affiliated with ResultsDesk.

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Click **[Install ResultsDesk Plus](https://raw.githubusercontent.com/Ethan-TK/resultsdesk-plus/main/resultsdesk-plus.user.js)** and confirm.
3. Open or reload [resultsdesk.nz](https://resultsdesk.nz/).

Your userscript manager will pick up new versions automatically.

## What it adds

- **Faster live updates.** Checks for new data about once a second and redraws as soon as ResultsDesk publishes it, instead of waiting up to 30–60 seconds. Pauses while the tab is hidden.
- **Striped flipped seats.** Electorates where the leader differs from the last election's winner get diagonal stripes over the new party's colour.
- **Margin shading.** Close races are paler, safe seats solid. A legend on the map switches it on and off.
- **Last-changed badges.** Electorates whose count just updated get a tag with the new votes and how long ago; lead changes are highlighted.
- **Sitting MP.** The electorate panel shows who holds the seat ("Held by …") on 2026 live results. Based on 2023 winners plus the Port Waikato (2023) and Tāmaki Makaurau (2025) by-elections; the party shown is the one they were elected for. New 2026 electorates show "New electorate".
- **Coalition tracker.** A **Coalition** button in the map controls opens a panel with National · ACT · NZ First vs Labour · Green · Te Pāti Māori, the majority line, and seats over time.
- **Overhang notice.** Appears when a party wins more electorates than its party vote earns, with the new Parliament size and majority.
- **TV mode.** Header button or press **T**: full-screen map with big seat tallies, coalition bar and a feed of latest updates, touring regions every 20 seconds. **Esc** exits.
- Removes the Buy me a coffee and Contact header links.

## Notes

- It hooks into the site's own code, so a ResultsDesk update can break some features. The site itself keeps working. Open the browser console (F12): a working install logs `[ResultsDesk Plus] active`.
- Results can only appear as fast as ResultsDesk publishes them (about once a minute on election night).

## Building

Edit files in `src/`, then:

```bash
node build.js
```

Bump `VERSION` in `build.js` before publishing so installed copies update.
