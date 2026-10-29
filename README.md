# La Pendery

A custom, lightweight website built for my grandparents' vacation rental gîte in Arfeuilles, France. Built to replace bloated site builders with something fast, simple, and tailored to their exact needs.

Live site: https://lapendery.nl

## What it does

The site gives prospective visitors all the essential information about the gîte: house rules, amenities, rates, local attractions, and an interactive photo gallery.

Instead of forcing my grandparents to learn a complicated CMS dashboard like WordPress or PocketBase's raw admin UI, I built an inline editing system called **DirectEdit**:
- Log in with auth.
- Edit text blocks directly on the page.
- Hit save, and changes sync straight to the PocketBase backend via API rules.

## Tech Stack

- **Frontend:** Vanilla HTML5, modern CSS, JavaScript
- **Backend:** PocketBase (authentication, database records, API rules)
- **Deployment:** Reverse proxied via Caddy on a Linux VPS

## Features

- **DirectEdit (Custom inline CMS):** Authenticated inline text editing with real-time PocketBase synchronization.
- **Dynamic Content:** Pricing, amenities, FAQs, and house details pull from database collections.
- **Photo Carousel:** Lightweight client-side gallery showcasing the property and surroundings.
- **Direct Contact & Booking Integration:** Direct form submission along with booking calendar embeds.
- **Zero bloat:** No massive client-side frameworks, loads instantly.

## Setup & Local Dev

1. Clone the repo:
   ```bash
   git clone [https://github.com/CatPowerz/lapendery.git](https://github.com/CatPowerz/lapendery.git)
   cd lapendery
   ```
