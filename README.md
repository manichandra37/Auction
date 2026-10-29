# InnAuction – hotel auction marketplace prototype

Static prototype of an online auction marketplace for hotel and motel properties.
No build step: every page is plain HTML plus `runtime.js`, so it runs on GitHub Pages as is.

| Page | File |
| --- | --- |
| Home | `index.html` |
| Search results | `search.html` |
| Listing detail | `listing.html` (add `?bidState=winning` to show the highest-bidder state) |
| Register to bid | `register-nda.html`, `register-funds.html`, `register-deposit.html` |
| List your hotel | `sell-financials.html`, `sell-auction-terms.html` |
| Bidder dashboard | `my-bids.html` |
| Seller dashboard | `seller-dashboard.html` |
| Admin review queue | `admin.html` |

## Run locally

Open `index.html` in a browser, or serve the folder: `python3 -m http.server`.

## Publish with GitHub Pages

Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`.
