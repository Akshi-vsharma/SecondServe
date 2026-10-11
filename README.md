# Second Serve

A food marketplace that gives packaged groceries approaching their printed date a better chance of being enjoyed. Customers browse discounted stock, while administrators assess batches, review buying offers, and manage inventory.

Built with Next.js, React, TypeScript, FastAPI, SQLAlchemy, and SQLite. Runs locally without Docker, paid services, or cloud infrastructure.

## Features

- Separate customer storefront and administrator workspace.
- Full catalog with product search, category filters, and price/date sorting.
- Department browsing and a dedicated deals page for savings of 30% or more.
- Product photos, pack sizes, available quantities, MRP, discounted prices, and printed dates.
- Persistent shopping bag with quantity controls; decreasing an item to zero removes it.
- Customer registration and sign-in, plus administrator sign-in.
- Batch submission with local image uploads and an explicit offer-acceptance step.
- Configurable pricing recommendations with separate buying and selling rules.
- Server-side eligibility checks and transactional stock updates at checkout.
- Inventory review, units-sold statistics, and estimated customer savings.

Checkout records an order without taking payment. Customer accounts are available, but guest checkout is also supported.

## Quick start

### Prerequisites

- Node.js 20 or later and npm.
- Python 3.11 or later with pip and venv.
- Two terminal windows.

The commands below use Windows PowerShell from the repository root.

### 1. Set up the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m app.create_admin
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The administrator command prompts for an email and password. Password input is hidden and must contain at least eight characters. There are no default administrator credentials. Use a new email: the command does not overwrite existing accounts.

Tables are created automatically. Seeding adds 20 sample products across Staples, Snacks, Beverages, and Bakery, with dates calculated relative to the day they are first added.

### 2. Start the frontend

In a second terminal, from the repository root:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep the backend running in the first terminal.

Use `localhost` for both services so session cookies work consistently. The current API allows frontend requests from `http://localhost:3000`.

### macOS / Linux backend commands

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m app.seed
.venv/bin/python -m app.create_admin
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Frontend commands are the same on all platforms.

## Pages

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Homepage with featured groceries | Public |
| `/catalog` | Full searchable catalog | Public |
| `/categories` | Browse departments | Public |
| `/deals` | Products discounted by at least 30% | Public |
| `/login` | Customer sign-in and registration | Public |
| `/admin/login` | Administrator sign-in | Public |
| `/admin` | Inventory review and statistics | Administrator |
| `/seller` | Add batches and review saved offers | Administrator |

The seller page currently acts as an administrator-managed intake workspace. Independent seller accounts and seller-specific ownership are not implemented.

## Using the application

### Shopping

1. Browse the catalog, categories, or deals.
2. Check the pack size, printed date, and available quantity.
3. Add items to the bag and adjust quantities.
4. Continue to checkout and enter a name.
5. Confirm the order. The backend checks the current date, price, and stock before recording it.

The bag is saved in the browser. When stock is refreshed, unavailable items are removed and quantities are limited to current availability.

### Adding stock

1. Sign in at `/admin/login` with the account created during setup.
2. Open **Add stock**.
3. Enter the product, pack size, quantity, MRP, printed date, date type, and storage requirements.
4. Optionally provide a product image and estimated units consumed per day.
5. Review the recommended buying offer and customer price.
6. Accept an eligible offer to list the batch.

Batches requiring review do not appear in the customer catalog. An administrator can approve or reject a batch from the inventory workspace. Approval does not override a failed eligibility check or repair missing batch information.

## Pricing and eligibility

The pricing engine lives in [backend/app/services/pricing.py](backend/app/services/pricing.py). It uses deterministic business rules, rather than a trained AI model.

### Date handling

- Remaining days are calculated from the backend host's current date.
- Expiry/use-by dates that have passed are rejected.
- Best-before dates that have passed require review and remain unlisted.
- Products on their printed date have zero remaining days and can still be eligible.
- Missing or ambiguous dates, damaged packaging, and missing storage requirements are flagged by the engine.

Best-before and expiry/use-by dates are distinct. These checks do not establish food safety or provide legal certification. The current submission form requires a valid date and storage details; it does not expose every safety flag supported by the engine.

### Consumption feasibility

When daily consumption `C > 0` and remaining days `D > 0`:

```text
feasibility_ratio = quantity / (daily_consumption × remaining_days)
```

A ratio at or below 1 selects high feasibility; a ratio above 1 selects low feasibility. Category defaults are used when a positive consumption estimate is not supplied. If a ratio cannot be calculated, the current rules select low feasibility.

Consumption is expressed in units/packs per day. This is a heuristic, not a validated prediction. Pack size and target buyer are recorded, but currently do not independently change the calculation.

### Configurable rules

Default shelf-life bands are short: 0–7 days, moderate: 8–30 days, and long: more than 30 days.

| Shelf life | Feasibility | Buying offer (% of MRP) | Customer price (% of MRP) |
| --- | --- | ---: | ---: |
| Short | Low | 20% | 60% |
| Short | High | 30% | 70% |
| Moderate | Low | 30% | 70% |
| Moderate | High | 40% | 75% |
| Long | Low | 40% | 75% |
| Long | High | 50% | 80% |

```text
buying offer = buying price per unit × accepted quantity
listing value = selling price per unit × available quantity
gross spread = listing value − buying offer
```

Gross spread excludes logistics, storage, fees, refunds, spoilage, and unsold stock. It is not net profit. The thresholds, consumption defaults, and percentages are in `CONFIG` and require category-specific calibration.

Listing prices are recalculated as time and available quantity change. Checkout uses the current backend price, not a price submitted by the browser.

## Authentication and inventory protection

- Passwords use salted PBKDF2-SHA256 hashing.
- Random session tokens are stored as hashes in SQLite.
- Sessions expire after seven days and use HttpOnly, SameSite=Lax cookies.
- Logout revokes the session on the server.
- Customer registration creates customer accounts only.
- Inventory submission, offer acceptance, review, private inventory, and statistics require administrator access.
- Browser-origin checks restrict write requests to the local frontend origin.
- Checkout uses SQLite `BEGIN IMMEDIATE` to serialize stock updates.
- Duplicate cart lines are combined before stock validation.
- Uploads allow declared JPEG, PNG, or WebP types up to 5 MB and use generated filenames.

Upload checks currently use declared MIME types; decoding and content-level validation are not implemented.

## Data and configuration

| Setting / location | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL; defaults to `http://localhost:8000` |
| `COOKIE_SECURE` | Set to `true` for secure cookies when served over HTTPS |
| `backend/data/marketplace.db` | SQLite database |
| `backend/uploads/` | Uploaded batch images |
| `public/images/` | Local stock photos and storefront imagery |

For a different API URL, create `.env.local` in the repository root:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart the frontend after changing it. For a different frontend origin, update both CORS and the write-origin check in `backend/app/main.py`; changing the API URL alone does not change those allowlists.

To set secure cookies in PowerShell before starting the API over HTTPS:

```powershell
$env:COOKIE_SECURE = "true"
```

Leave this unset for local HTTP development.

### Seed inventory

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed
```

Seeding is additive: it adds missing sample products and assigns missing sample photo paths without resetting quantities or changing existing dates. Sample inventory will age naturally and disappear from the catalog when it becomes ineligible.

Stock images are representative food photography, not photographs of the actual packaged batches. Credits are in [public/images/CREDITS.md](public/images/CREDITS.md).

## Tests and build

Run the backend tests from the backend directory:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The suite covers pricing combinations, date boundaries, invalid inputs, upload type validation, offer acceptance, inventory decrement, overselling, duplicate cart lines, authentication, access permissions, logout, and request-origin checks. API tests use a temporary SQLite database and do not reset marketplace data.

Build the frontend from the repository root:

```powershell
npm run build
npm start
```

The latest verified checks completed with **21 backend tests passing** and a successful Next.js production build. A production build verifies compilation; it is not a substitute for browser-based end-to-end testing.

## API

Interactive API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health |
| GET | `/batches` | Eligible marketplace inventory |
| GET | `/batches?admin=true` | All batches; administrator only |
| POST | `/batches` | Submit a batch as multipart form data |
| POST | `/batches/{id}/accept` | Accept an eligible buying offer |
| POST | `/batches/{id}/review?decision=approve\|reject` | Review a batch |
| POST | `/orders` | Record an order and decrement inventory |
| GET | `/stats` | Administrator inventory statistics |
| POST | `/auth/register` | Create a customer account |
| POST | `/auth/login` | Start a session |
| GET | `/auth/me` | Current account |
| POST | `/auth/logout` | Revoke the current session |

## Project structure

```text
app/                         Next.js page routes
components/
  storefront.tsx             Shopping and inventory interfaces
  storefront.module.css      Main interface styles
  login.tsx                  Customer and administrator sign-in
backend/
  app/
    main.py                  REST API and inventory transactions
    auth.py                  Accounts, sessions, and access checks
    models.py                Batch, order, and order-item models
    database.py              SQLite connection and sessions
    seed.py                  Additive sample inventory
    create_admin.py          Interactive administrator setup
    services/pricing.py      Configurable pricing engine
  tests/                     Pricing, API, and authentication tests
  requirements.txt           Python dependencies
public/images/               Local images and photo credits
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Empty catalog or service unavailable | Start the API on port 8000 and check `/health`. Seed inventory if needed. |
| Sign-in succeeds but admin access fails | Use an administrator account created with `app.create_admin`, and use `localhost` consistently. |
| Password entry shows no characters | The administrator setup intentionally hides password input. |
| Existing sample products disappear | Their printed dates may have passed. Rerunning the seed does not extend those dates. |
| Image upload rejected | Use a JPEG, PNG, or WebP file no larger than 5 MB. |
| Login cookie does not persist locally | Leave `COOKIE_SECURE` unset on HTTP and avoid mixing `localhost` with `127.0.0.1`. |
| Next.js reports missing SWC lockfile entries | Stop the frontend, rerun `npm install`, then restart it. |
