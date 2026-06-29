# Pick and Chill

Pick and Chill adds compact recommendation badges to movie and TV-show tiles on:

- Netflix
- JioHotstar
- Prime Video

Ratings come from OMDb and combine IMDb with Rotten Tomatoes when both are available. Pick and Chill is an independent personal-use extension and is not affiliated with Netflix, JioHotstar, Prime Video, IMDb, Rotten Tomatoes, or OMDb.

## Install

1. Download and extract `pick-and-chill-extension.zip`.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted folder containing `manifest.json`.

Chrome cannot load the ZIP directly. Keep the extracted folder after installation; Chrome reads the extension from that folder.

## Add an OMDb API key

Each user needs their own OMDb API key.

1. Request a key at https://www.omdbapi.com/apikey.aspx.
2. Open `chrome://extensions`.
3. Find **Pick and Chill** and select **Details**.
4. Select **Extension options**.
5. Enter the OMDb key and select **Save settings**.
6. Refresh any open Netflix, JioHotstar, or Prime Video pages.

The key is stored locally in Chrome and is not included in this package.

## Use

Open a supported streaming service and browse normally. Eligible visible movie and show tiles receive a recommendation badge. Hover over or focus the badge to view the IMDb and Rotten Tomatoes values used for the recommendation.

## Troubleshooting

- No badges: confirm the OMDb key is saved, reload the extension, and refresh the streaming page.
- Loading dots remain: refresh the page and check whether the OMDb API is responding.
- Some tiles have no badge: live events, sports, channels, collections, advertisements, and titles without usable OMDb ratings are intentionally excluded.
- A streaming service changed its page layout: reload the latest Pick and Chill package when an updated version is available.

## Privacy

Pick and Chill has no accounts, analytics, or usage tracking. Settings, cached rating results, and optional diagnostic logs remain in Chrome local extension storage. The extension sends title lookup requests and the user's API key only to OMDb.

