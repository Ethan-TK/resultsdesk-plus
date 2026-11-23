# ResultsDesk Plus

An unofficial userscript that adds extra features to [resultsdesk.nz](https://resultsdesk.nz/) for New Zealand election night. It runs in your own browser on top of the real site; it is not affiliated with ResultsDesk.

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Click **[Install ResultsDesk Plus](https://raw.githubusercontent.com/Ethan-TK/resultsdesk-plus/main/resultsdesk-plus.user.js)** and confirm.
3. Open or reload [resultsdesk.nz](https://resultsdesk.nz/).

Your userscript manager will pick up new versions automatically.

## What it adds

- **New design, with a switch back.** A full redesign on wide screens: a neutral graphite theme and new typeface on every tab; a new **results panel** for the country and for each electorate, which opens with who is winning and by how much (thin share bars, change since the last election, status such as "National hold", special votes, pin button); and a new **map toolbar** (election year, Candidate/Party, General/Māori, Go to a city, zoom, reset, coalition). The **New design** switch in the top bar returns to the old look; your choice is remembered. Below 901px wide and in TV mode the site's own layout is used.
- **Faster live updates.** A tiny check about once a second spots new data and redraws as soon as ResultsDesk publishes it, instead of waiting up to 30–60 seconds. The full results file is only downloaded when it has changed (plus a 30-second safety net). Slows to every 5 seconds once every electorate is final, and pauses while the tab is hidden.
- **Striped flipped seats.** Electorates where the leader differs from the last election's winner get diagonal stripes over the new party's colour.
- **Margin shading.** Close races are paler, safe seats solid. A legend on the map switches it on and off.

- **Special votes.** The New Zealand panel shows how many special votes are still to count (the Electoral Commission's estimate), their share of all votes, turnout so far and with them included, and when the official count is due (Fri 27 Nov). Each electorate panel shows a rough estimate for that seat (national rate × votes counted there) and flags "could change" when the lead is small next to it. TV mode shows the national total.
- **Local results.** Open an electorate and scroll to *Local results*: how each suburb (or town) and each voting place voted, with a one-line summary of who won most areas, advance voting compared with election day, and a switch between *By suburb* and *By place*. It follows the Candidate / Party switch and works for all 71 electorates. The numbers are the Electoral Commission's own published votes by voting place (see below). Opening an electorate splits it into those suburbs on the map, each coloured by who won it (shade = how strongly) with details on hover, and the **Suburbs** button in the map toolbar (top right; in the old design, the side controls) shows every electorate's suburbs at once (it always starts off). Each voting place claims the ground nearest to it and places in the same suburb are joined, clipped to the electorate's outline, so the shapes are approximate, not official boundaries. Electorates that changed hands keep their diagonal stripes over the suburbs, and electorate borders use the same line style as the suburb borders.
- **Sitting MP.** The electorate panel shows who holds the seat ("Held by …") on 2026 live results. Based on 2023 winners plus the Port Waikato (2023) and Tāmaki Makaurau (2025) by-elections; the party shown is the one they were elected for. New 2026 electorates show "New electorate".
- **All parties, sized to fit.** The New Zealand panel lists every party (no "Show more" button), reaches down to the bottom of the screen, and shrinks the rows so every party on 4% or more fits without scrolling. On very short screens the bloc builder under the totals is hidden to make room.
- **Party colours.** Every party uses its own colour (Opportunity and ACT's magenta from their websites, the rest from Wikipedia's party colour data) on the map, party table and panels.
- **Pin electorates.** Click the faint pin beside an electorate's name in its panel. Pinned seats sit as small chips above the map key (leading party colour, striped if flipped, leader's vote share, lead in votes and % counted); click a chip to open it, × to unpin. Up to 6, remembered between visits.
- **Coalition tracker.** A **Coalition** button in the map controls opens a panel with National · ACT · NZ First, OPP (Opportunity, in its cyan) and Labour · Green · Te Pāti Māori, the majority line, and seats over time.
- **Overhang notice.** Appears when a party wins more electorates than its party vote earns, with the new Parliament size and majority.
- **TV mode.** Header button or press **T**: full-screen map with big seat tallies, coalition bar and a feed of latest updates, touring regions every 20 seconds. Click an electorate to see its votes and candidates (× or **Esc** closes it). **Esc** exits.
- **ResultsDeskPlus branding.** Logo, tab title, welcome screen and labels read "ResultsDeskPlus" (the footer's design credit to ResultsDesk.nz is kept).
- **Full-window map.** On desktop the map runs edge to edge and fills the window, with no side padding or footer, and the page no longer shifts up and down when you scroll. The Electorates and Trends tabs fill the window too.
- **Best-fit map view.** The starting view (and Reset) fits all of New Zealand as large as possible in the visible map area, clear of the results panel, the controls and the key.
- **Reset view.** A button at the bottom of the map controls puts the map back to that view. It only appears once you've moved or zoomed the map, and it doesn't close the panel you have open.
- **Quieter footer.** The panel footer just shows when results last changed (no "next refresh in" countdown).
- **Hide the top bar.** A small arrow under the header hides it for more map; click it again to bring it back (remembered between visits).
- **Key follows the leader.** The margin key takes the colour of the party currently leading (most seats, then most votes), blue until results arrive.
- **Changelog.** The Help button is replaced by a Changelog listing what each version changed.
- Removes the Buy me a coffee and Contact header links, the "Get PRO" button and Pro promo cards (Pro features stay Pro), and the NZ / Switzerland switch.

## Firefox

If only the styling changes on Firefox (no TV mode button, no Coalition button), Tampermonkey is starting the script too late and the site's security policy blocks it. The console (F12, filter `Plus`) will say so. Fix: Tampermonkey icon → **Dashboard** → **Settings** → set **Config mode** to **Advanced** → under **Experimental** set **Inject Mode** to **Instant** → **Save**, then reload resultsdesk.nz.

## Notes

- It hooks into the site's own code, so a ResultsDesk update can break some features. The site itself keeps working. Open the browser console (F12): a working install logs `[ResultsDesk Plus] active`.
- Results can only appear as fast as ResultsDesk publishes them (about once a minute on election night).

## Local results data

`data/2026/*.json` holds votes by voting place for every electorate. It comes from the Electoral Commission's per-electorate results PDFs on [electionresults.govt.nz](https://electionresults.govt.nz/) (2026 General Election, **preliminary** results produced 8 Nov 2026, before special votes) and is turned into data by `tools/build_local_data.py`, which checks every party and candidate total against the live results before writing anything. Places with fewer than 6 votes are shown as zero by the Commission. `build.js` compresses the data into the script itself, because the site's security policy only lets its page load data from its own domains.

Voting-place locations for the map come from the street address in each place's name, matched to [LINZ NZ Addresses](https://data.linz.govt.nz/layer/123113) (CC BY 4.0; contains data sourced from LINZ) by `tools/add_coordinates.py`. About 97% of places with a street address are placed, and a match is only kept when the suburb or the electorate agrees. Hospital and care-home teams and places given only as a corner or intersection have no location.

To refresh it when official results are published: download the 71 PDFs in your browser into one folder, save the live `results-bundle.json` the site loads, export the LINZ NZ Addresses layer as CSV (NZGD2000, free LINZ account), and save the site's two 2026 electorate boundary files (`general_electorates_2026.json`, `maori_electorates_2026.json`), then

```bash
pip install pymupdf
python tools/build_local_data.py <folder-with-pdfs> results-bundle.json data/2026
python tools/add_coordinates.py nz-addresses.csv general_electorates_2026.json maori_electorates_2026.json data/2026
node build.js
```

## Building

Edit files in `src/`, then:

```bash
node build.js
```

Bump `VERSION` in `build.js` before publishing so installed copies update.
