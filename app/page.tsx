"use client";
import { useEffect, useMemo, useState } from "react";
import Storefront from "../components/storefront";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Batch = {
  id: number;
  name: string;
  category: string;
  mrp_per_unit: number;
  pack_size: string;
  quantity_total: number;
  quantity_remaining: number;
  date_type: string;
  printed_date: string;
  status: string;
  buying_price: number;
  selling_price: number;
  pricing: any;
  image_path?: string;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
export default function Home() {
  return <Storefront />;
  const [tab, setTab] = useState<"shop" | "sell" | "admin">("shop"),
    [items, setItems] = useState<Batch[]>([]),
    [cart, setCart] = useState<Record<number, number>>({}),
    [category, setCategory] = useState("All"),
    [sort, setSort] = useState("urgency"),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [admin, setAdmin] = useState<Batch[]>([]),
    [stats, setStats] = useState<any>(null);
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/batches?sort=${sort}`);
      setItems(await r.json());
    } catch {
      setNotice(
        "Couldn’t reach the local API. Start the FastAPI server to browse inventory.",
      );
    } finally {
      setLoading(false);
    }
  };
  const loadAdmin = async () => {
    try {
      const [b, s] = await Promise.all([
        fetch(`${API}/batches?admin=true`),
        fetch(`${API}/stats`),
      ]);
      setAdmin(await b.json());
      setStats(await s.json());
    } catch {
      setNotice("Couldn’t reach the local API.");
    }
  };
  useEffect(() => {
    load();
  }, [sort]);
  useEffect(() => {
    if (tab === "admin") loadAdmin();
  }, [tab]);
  const categories = [
      "All",
      ...Array.from(new Set(items.map((x) => x.category))),
    ],
    visible = items.filter(
      (x) => category === "All" || x.category === category,
    );
  const cartRows = items.filter((x) => cart[x.id]);
  const total = cartRows.reduce((s, x) => s + x.selling_price * cart[x.id], 0);
  const add = (id: number) =>
    setCart((c) => ({
      ...c,
      [id]: Math.min(
        (c[id] || 0) + 1,
        items.find((x) => x.id === id)!.quantity_remaining,
      ),
    }));
  const checkout = async () => {
    try {
      const r = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: "Demo customer",
          items: cartRows.map((x) => ({
            batch_id: x.id,
            quantity: cart[x.id],
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.detail);
      setCart({});
      setNotice(
        `Order #${d.order_id} confirmed — ${money(d.total)}. No payment was taken.`,
      );
      load();
    } catch (e: any) {
      setNotice(e.message || "Unable to place order.");
    }
  };
  return (
    <main>
      <header>
        <a className="brand" onClick={() => setTab("shop")}>
          second<span>serve</span>
        </a>
        <nav>
          {(
            [
              ["shop", "Marketplace"],
              ["sell", "Sell stock"],
              ["admin", "Demo admin"],
            ] as const
          ).map(([key, label]) => (
            <button
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
              key={key}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="cart"
          onClick={() => document.getElementById("cart")?.scrollIntoView()}
        >
          Cart <b>{Object.values(cart).reduce((a, b) => a + b, 0)}</b>
        </button>
      </header>
      {notice && (
        <div className="notice">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {tab === "shop" && (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">SMARTER PANTRY, LESS WASTE</p>
              <h1>
                Good food deserves
                <br />
                <em>a second serve.</em>
              </h1>
              <p>
                Thoughtfully priced packaged food nearing its printed date —
                always shown clearly.
              </p>
              <button
                className="primary"
                onClick={() =>
                  document.getElementById("products")?.scrollIntoView()
                }
              >
                Shop available stock
              </button>
            </div>
            <div className="hero-card">
              <span>UP TO</span>
              <strong>40%</strong>
              <small>off MRP</small>
              <p>
                Real dates. Transparent pricing.
                <br />
                Demo marketplace.
              </p>
            </div>
          </section>
          <section id="products" className="content">
            <div className="section-head">
              <div>
                <p className="eyebrow">AVAILABLE TODAY</p>
                <h2>Make a tasty difference</h2>
              </div>
              <div className="filters">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="urgency">Most time-sensitive</option>
                  <option value="price">Lowest price</option>
                </select>
              </div>
            </div>
            {loading ? (
              <p className="empty">Loading marketplace…</p>
            ) : visible.length ? (
              <div className="grid">
                {visible.map((p) => (
                  <article className="product" key={p.id}>
                    <div className="product-image">
                      {p.image_path ? (
                        <img src={`${API}${p.image_path}`} alt={p.name} />
                      ) : (
                        <span>{p.category}</span>
                      )}
                      <i>
                        {Math.round(
                          (1 - p.selling_price / p.mrp_per_unit) * 100,
                        )}
                        % OFF
                      </i>
                    </div>
                    <div className="product-copy">
                      <p className="category">{p.category}</p>
                      <h3>{p.name}</h3>
                      <p className="pack">
                        {p.pack_size} · {p.quantity_remaining} left
                      </p>
                      <p className="date">
                        {p.date_type === "expiry" ? "Expiry" : "Best before"}:{" "}
                        <b>
                          {new Date(
                            p.printed_date + "T00:00:00",
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </b>
                      </p>
                      <div className="price">
                        <strong>{money(p.selling_price)}</strong>
                        <del>{money(p.mrp_per_unit)}</del>
                        <button onClick={() => add(p.id)}>Add</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">No inventory matches these filters.</p>
            )}
          </section>
          <aside id="cart" className="cart-panel">
            <div>
              <p className="eyebrow">YOUR DEMO CART</p>
              <h2>
                {cartRows.length
                  ? `${Object.values(cart).reduce((a, b) => a + b, 0)} items ready`
                  : "Your cart is empty"}
              </h2>
            </div>
            {cartRows.map((p) => (
              <div className="cart-row" key={p.id}>
                <span>
                  {p.name} × {cart[p.id]}
                </span>
                <b>{money(p.selling_price * cart[p.id])}</b>
              </div>
            ))}
            {cartRows.length > 0 && (
              <>
                <div className="cart-total">
                  <span>Total</span>
                  <strong>{money(total)}</strong>
                </div>
                <button className="primary" onClick={checkout}>
                  Place demo order
                </button>
                <small>No real payment or delivery is involved.</small>
              </>
            )}
          </aside>
        </>
      )}
      {tab === "sell" && (
        <Seller
          onSuccess={(m) => {
            setNotice(m);
            setTab("shop");
            load();
          }}
        />
      )}
      {tab === "admin" && (
        <Admin
          batches={admin}
          stats={stats}
          refresh={loadAdmin}
          setNotice={setNotice}
        />
      )}
      <footer>
        Second Serve is a demonstration marketplace. Pricing is rule-based, and
        date/safety checks require proper operational controls in production.
      </footer>
    </main>
  );
}
function Seller({ onSuccess }: { onSuccess: (x: string) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API}/batches`, {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.detail);
      if (d.status === "eligible") {
        const accepted = await fetch(`${API}/batches/${d.id}/accept`, {
          method: "POST",
        });
        if (!accepted.ok)
          throw Error("Offer was calculated but could not be accepted.");
      }
      onSuccess(
        `Offer calculated: we recommend ${money(d.pricing.total_buying_offer || 0)}. ${d.status === "pending" ? "This batch needs review." : "Offer accepted and inventory listed."}`,
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="seller">
      <div>
        <p className="eyebrow">SELLER DASHBOARD · DEMO</p>
        <h1>Turn near-date stock into value.</h1>
        <p>
          Enter the printed date manually. Our transparent rules calculate a
          recommended offer; this is not an automated safety certification.
        </p>
        <div className="rule">
          <b>How the offer works</b>
          <br />
          Shelf life, quantity and consumption feasibility select configurable
          buying and selling percentages. Expired, ambiguous, or unsafe batches
          are blocked or sent to review.
        </div>
      </div>
      <form onSubmit={submit}>
        <h2>Add a product batch</h2>
        {error && <p className="error">{error}</p>}
        <label>
          Product name
          <input name="name" required maxLength={160} />
        </label>
        <div className="two">
          <label>
            Category
            <select name="category">
              <option>Snacks</option>
              <option>Beverages</option>
              <option>Staples</option>
              <option>Dairy</option>
              <option>Bakery</option>
            </select>
          </label>
          <label>
            MRP per unit (₹)
            <input
              name="mrp_per_unit"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
        </div>
        <div className="two">
          <label>
            Pack size
            <input name="pack_size" placeholder="e.g. 500 g" required />
          </label>
          <label>
            Units available
            <input name="quantity" type="number" min="1" required />
          </label>
        </div>
        <div className="two">
          <label>
            Printed date type
            <select name="date_type">
              <option value="best_before">Best before</option>
              <option value="expiry">Expiry / use by</option>
            </select>
          </label>
          <label>
            Printed date
            <input name="printed_date" type="date" required />
          </label>
        </div>
        <div className="two">
          <label>
            Estimated units consumed/day
            <input
              name="consumption_per_day"
              type="number"
              min="0"
              step="0.01"
              placeholder="Optional"
            />
          </label>
          <label>
            Target buyer
            <select name="target_buyer">
              <option value="household">Household</option>
              <option value="restaurant">Restaurant</option>
            </select>
          </label>
        </div>
        <label>
          Storage requirements
          <input
            name="storage_requirements"
            placeholder="e.g. cool, dry place"
            required
          />
        </label>
        <label>
          Product image <small>(JPG, PNG or WebP; max 5 MB)</small>
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <button disabled={busy} className="primary">
          {busy ? "Calculating…" : "Calculate & accept demo offer"}
        </button>
      </form>
    </section>
  );
}
function Admin({
  batches,
  stats,
  refresh,
  setNotice,
}: {
  batches: Batch[];
  stats: any;
  refresh: () => void;
  setNotice: (x: string) => void;
}) {
  const review = async (id: number, decision: string) => {
    const r = await fetch(`${API}/batches/${id}/review?decision=${decision}`, {
      method: "POST",
    });
    if (r.ok) {
      setNotice(`Batch ${decision}d.`);
      refresh();
    } else setNotice("Review action was unavailable.");
  };
  return (
    <section className="content admin">
      <p className="eyebrow">DEMO ADMIN · NO AUTHENTICATION</p>
      <h1>Inventory review</h1>
      <div className="stats">
        {[
          ["Available batches", stats?.available_batches],
          ["Units sold", stats?.units_sold],
          ["Customer savings", money(stats?.estimated_customer_savings || 0)],
        ].map(([l, v]) => (
          <div key={String(l)}>
            <span>{l}</span>
            <strong>{v ?? "—"}</strong>
          </div>
        ))}
      </div>
      <div className="table">
        {batches.map((b) => (
          <div className="table-row" key={b.id}>
            <div>
              <b>{b.name}</b>
              <small>
                {b.category} · {b.quantity_remaining}/{b.quantity_total} units ·{" "}
                {b.date_type} {b.printed_date}
              </small>
            </div>
            <div>
              {money(b.buying_price || 0)} buy
              <br />
              {money(b.selling_price || 0)} sell
            </div>
            <span className={`status ${b.status}`}>{b.status}</span>
            {b.status === "pending" && (
              <div>
                <button onClick={() => review(b.id, "approve")}>Approve</button>
                <button onClick={() => review(b.id, "reject")}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
