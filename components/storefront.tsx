"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./storefront.module.css";

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
const rupees = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const printed = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function Storefront({ section = "shop", catalog=false, browse="groceries" }: { section?: "shop" | "sell" | "ops"; catalog?:boolean; browse?:"groceries"|"categories"|"deals" }) {
  const [user,setUser]=useState<any>(null),[authReady,setAuthReady]=useState(false);
  useEffect(()=>{fetch(`${API}/auth/me`,{credentials:'include'}).then(async r=>{const account=r.ok?await r.json():null;setUser(account);if(section!=='shop'&&account?.role!=='admin')window.location.replace('/admin/login');}).catch(()=>{if(section!=='shop')window.location.replace('/admin/login')}).finally(()=>setAuthReady(true));},[section]);
  const [products, setProducts] = useState<Batch[]>([]);
  const [bag, setBag] = useState<Record<number, number>>({});
  const [sort, setSort] = useState(browse==='deals'?'discount':'urgency');
  const [category, setCategory] = useState("All");
  useEffect(()=>{const query=new URLSearchParams(window.location.search);setCategory(query.get('category')||'All');if(query.get('sort')==='discount')setSort('discount');},[]);
  const [toast, setToast] = useState("");
  const [inventory, setInventory] = useState<Batch[]>([]);
  const [stats, setStats] = useState<any>({});
  const [restored, setRestored] = useState(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("secondserve-bag")||"{}");if(saved && typeof saved==="object" && !Array.isArray(saved))setBag(Object.fromEntries(Object.entries(saved).filter(([id,q])=>Number.isInteger(Number(id)) && typeof q==="number" && Number.isInteger(q) && q>0)) as Record<number,number>);}catch{}setRestored(true);},[]);
  useEffect(()=>{if(restored)localStorage.setItem("secondserve-bag",JSON.stringify(bag));},[bag,restored]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const loadProducts = async () => {
    try {
      const r = await fetch(`${API}/batches?sort=${sort}`);
      if (!r.ok) throw Error();
      const current:Batch[]=await r.json();
      setProducts(current);
      setBag(old=>Object.fromEntries(Object.entries(old).filter(([id])=>current.some(p=>p.id===Number(id))).map(([id,q])=>[id,Math.min(q,current.find(p=>p.id===Number(id))!.quantity_remaining)])));
    } catch {
      setToast(
        "We can’t reach the marketplace service. Start the API and try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  const loadOps = async () => {
    const [b, s] = await Promise.all([
      fetch(`${API}/batches?admin=true`,{credentials:'include'}),
      fetch(`${API}/stats`,{credentials:'include'}),
    ]);
    if (b.ok) setInventory(await b.json());
    if (s.ok) setStats(await s.json());
  };
  useEffect(() => {
    loadProducts();
  }, [sort]);
  useEffect(() => {
    if (section === "ops" && user?.role==='admin') loadOps();
  }, [section,user]);
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const listed = products.filter(
    (p) => (category === "All" || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()) && (browse!=='deals' || (1-p.selling_price/p.mrp_per_unit)>=.3),
  ).sort((a,b)=>sort==='discount'?(1-b.selling_price/b.mrp_per_unit)-(1-a.selling_price/a.mrp_per_unit):0);
  const bagItems = products.filter((p) => bag[p.id]);
  const units = Object.values(bag).reduce((a, b) => a + b, 0);
  const total = bagItems.reduce(
    (sum, p) => sum + p.selling_price * bag[p.id],
    0,
  );
  const add = (p: Batch) =>
    setBag((old) => ({
      ...old,
      [p.id]: Math.min((old[p.id] || 0) + 1, p.quantity_remaining),
    }));
  const order = async (customer: string) => {
    try {
    const r = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: customer,
        items: bagItems.map((p) => ({ batch_id: p.id, quantity: bag[p.id] })),
      }),
    });
    const result = await r.json();
    if (!r.ok) {
      setToast(result.detail || "Unable to confirm order.");
      return false;
    }
    setBag({});
    setToast(
      `Order #${result.order_id} is confirmed. ${rupees(result.total)} total.`,
    );
    loadProducts();
    return true;
    } catch {
      setToast("Your order could not be confirmed. Please try again.");
      return false;
    }
  };
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <a className={styles.brand} href={section === "shop" ? "/" : section === "sell" ? "/seller" : "/admin"}>
          SECOND<span>SERVE</span>
        </a>
        <nav>
          {section === "shop" ? <><a href="/catalog">Groceries</a><a className={styles.categoriesLink} href="/categories">Categories <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></a><a href="/deals">Best deals</a>{user?<button onClick={async()=>{await fetch(`${API}/auth/logout`,{method:'POST',credentials:'include'});setUser(null)}}>Sign out</button>:<a href="/login">Sign in</a>}</> : <><a href="/admin">Inventory</a><a href="/seller">Add stock</a><button onClick={async()=>{await fetch(`${API}/auth/logout`,{method:'POST',credentials:'include'});window.location.href='/admin/login'}}>Sign out</button></>}
        </nav>
        {section === "shop" ?
        <button
          className={styles.bagButton}
          onClick={() => {
            setTimeout(
              () =>
                document
                  .getElementById("bag")
                  ?.scrollIntoView({ behavior: "smooth" }),
              0,
            );
          }}
          aria-label="Open bag"
        >
          Bag <b>{units}</b>
        </button>
        : <a href="/">Visit storefront</a>}
      </header>
      {toast && (
        <div className={styles.toast} role="status">
          {toast}
          <button onClick={() => setToast("")}>×</button>
        </div>
      )}
      {section === "shop" && (
        <Shop
          listed={listed}
          categories={categories}
          category={category}
          setCategory={setCategory}
          sort={sort}
          setSort={setSort}
          add={add}
          bagItems={bagItems}
          bag={bag}
          total={total}
          order={order}
          updateQuantity={(id:number, quantity:number)=>setBag(old=>{const next={...old};if(quantity<=0)delete next[id];else next[id]=quantity;return next;})}
          search={search}
          setSearch={setSearch}
          loading={loading}
          catalog={catalog}
          browse={browse}
        />
      )}
      {section === "sell" && authReady && user?.role==='admin' && (
        <Seller
          onComplete={(message) => {
            setToast(message);
            loadProducts();
          }}
        />
      )}
      {section === "ops" && authReady && user?.role==='admin' && (
        <Operations
          batches={inventory}
          stats={stats}
          reload={loadOps}
          message={setToast}
        />
      )}
      <footer><a href="/calculator">Shopkeeper pricing calculator</a><p>Clear dates. Fairer prices. More food enjoyed.</p></footer>
    </div>
  );
}

function Shop({
  listed,
  categories,
  category,
  setCategory,
  sort,
  setSort,
  add,
  bagItems,
  bag,
  total,
  order,
  updateQuantity,
  search,
  setSearch,
  loading,
  catalog,
  browse,
}: any) {
  const [checkout, setCheckout] = useState(false),
    [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <>
      {browse==='categories' && <section className={styles.catalog}><p className={styles.kicker}>SHOP BY DEPARTMENT</p><h1>Find your everyday favourites</h1><div className={styles.departmentGrid}>{[{name:'Staples',description:'Breakfast bowls and pantry essentials',photo:'oats'},{name:'Snacks',description:'Crunchy bites and afternoon treats',photo:'nuts'},{name:'Beverages',description:'Fruit drinks and coffee favourites',photo:'coffee'},{name:'Bakery',description:'Loaves, toast and baked bites',photo:'bread'}].map(department=><a className={styles.departmentCard} key={department.name} href={`/catalog?category=${department.name}`}><img src={`/images/${department.photo}.jpg`} alt=""/><h2>{department.name}</h2><p>{department.description}</p><span>Browse {department.name.toLowerCase()} →</span></a>)}</div></section>}
      {!catalog && <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>A SMARTER WAY TO SHOP</p>
          <h1>
            Good food.
            <br />
            <i>Better timing.</i>
          </h1>
          <p>
            Exceptional packaged food, priced for its actual shelf life. Every
            listing shows its printed date upfront.
          </p>
          <div className={styles.heroActions}>
            <button
              className={styles.primary}
              onClick={() =>
                document
                  .getElementById("products")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
            Browse groceries
            </button>
            <span>
              ✓ Date transparency
              <br />✓ Reduced waste
            </span>
          </div>
        </div>
        <div className={styles.heroImage}>
          <img
            src="/images/pantry-hero.png"
            alt="Packaged pantry food arranged on a countertop"
          />
          <div className={styles.heroBadge}>
            <b>
              UP TO
              <br />
              <strong>40%</strong>
            </b>
            <span>off MRP</span>
          </div>
        </div>
      </section>}
      {browse!=='categories' && <section id="products" className={styles.catalog}>
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.kicker}>CURATED INVENTORY</p>
            <h2>{browse==='deals'?'Save 30% or more':catalog?'All groceries':'Featured finds'}</h2>
            {browse==='deals'&&<p>Our biggest discounts, ordered by savings.</p>}
            {!catalog&&<a href="/catalog">Explore the full catalog →</a>}
          </div>
          <div className={styles.filters}>
            <input aria-label="Search products" placeholder="Search groceries" value={search} onChange={e=>setSearch(e.target.value)} />
            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((x: string) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="urgency">Closest date first</option>
              <option value="price">Lowest price first</option>
              <option value="discount">Biggest savings first</option>
            </select>
          </div>
        </div>
        <div className={styles.productGrid}>
          {(catalog?listed:listed.slice(0,8)).map((p: Batch) => (
            <article className={styles.card} key={p.id}>
              <div className={styles.cardVisual}>
                {p.image_path ? (
                  <img src={p.image_path.startsWith('/images/')?p.image_path:API + p.image_path} alt={p.name} loading="lazy" />
                ) : (
                  <span>{p.category}</span>
                )}
                <b>
                  {Math.round((1 - p.selling_price / p.mrp_per_unit) * 100)}%
                  OFF
                </b>
              </div>
              <div className={styles.cardBody}>
                <p>{p.category}</p>
                <h3>{p.name}</h3>
                <small>
                  {p.pack_size} · {p.quantity_remaining} units left
                </small>
                <div className={styles.dateLine}>
                  <span>
                    {p.date_type === "expiry" ? "Use by" : "Best before"}
                  </span>
                  <b>{printed(p.printed_date)}</b>
                </div>
                <div className={styles.price}>
                  <strong>{rupees(p.selling_price)}</strong>
                  <del>{rupees(p.mrp_per_unit)}</del>
                  <button disabled={(bag[p.id]||0)>=p.quantity_remaining} onClick={() => add(p)}>{(bag[p.id]||0)>=p.quantity_remaining?"In bag":"Add"}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {loading && <div className={styles.empty} role="status">Loading available groceries...</div>}
        {!loading && !listed.length && (
          <div className={styles.empty}>
            Nothing matches that filter just now.
          </div>
        )}
      </section>}
      <section id="bag" className={styles.bag}>
        <div>
          <p className={styles.kicker}>YOUR BAG</p>
          <h2>
            {bagItems.length ? "A few good saves" : "Nothing in your bag yet"}
          </h2>
        </div>
        <div className={styles.bagSummary}>
          {bagItems.map((p: Batch) => (
            <div key={p.id} className={styles.bagRow}>
              <div className={styles.bagItemName}>
                <span>{p.name}</span>
                <small>{p.pack_size}</small>
              </div>
              <b className={styles.bagItemPrice}>{rupees(p.selling_price * bag[p.id])}</b>
              <div className={styles.quantity}>
                <div className={styles.stepper}>
                <button aria-label={`Remove one ${p.name}`} onClick={()=>updateQuantity(p.id,bag[p.id]-1)}>-</button>
                <span>{bag[p.id]}</span>
                <button aria-label={`Add one ${p.name}`} disabled={bag[p.id]>=p.quantity_remaining} onClick={()=>updateQuantity(p.id,bag[p.id]+1)}>+</button>
                </div>
              </div>
            </div>
          ))}
          {bagItems.length > 0 && (
            <>
              <div className={styles.total}>
                <span>Total</span>
                <strong>{rupees(total)}</strong>
              </div>
              <div className={styles.checkoutAction}><button
                className={styles.primary}
                onClick={() => setCheckout(true)}
              >
                Continue to checkout
              </button>
              <small>
                We recheck date eligibility and availability before confirming.
              </small>
              </div>
            </>
          )}
        </div>
      </section>
      {checkout && (
        <div className={styles.overlay}>
          <form
            className={styles.checkout}
            onSubmit={async (e) => {
              e.preventDefault();
              if(submitting)return;
              setSubmitting(true);
              try { if (await order(name.trim())) setCheckout(false); }
              finally { setSubmitting(false); }
            }}
          >
            <button
              className={styles.close}
              type="button"
              onClick={() => setCheckout(false)}
            >
              ×
            </button>
            <p className={styles.kicker}>CHECKOUT</p>
            <h2>Confirm your order</h2>
            <p>
              {rupees(total)} · {bagItems.length} item type
              {bagItems.length === 1 ? "" : "s"}
            </p>
            <label>
              Name for this order
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <button disabled={submitting || !name.trim()} className={styles.primary}>{submitting?"Confirming...":"Confirm order"}</button>
            <small>
              This local build confirms orders; payment processing is not
              connected.
            </small>
          </form>
        </div>
      )}
    </>
  );
}

function Seller({ onComplete }: { onComplete: (text: string) => void }) {
  const [history,setHistory]=useState<Batch[]>([]);
  const loadHistory=async()=>{try{const response=await fetch(`${API}/batches?admin=true`,{credentials:'include'});if(response.ok)setHistory(await response.json());}catch{}};
  useEffect(()=>{loadHistory()},[]);
  const [offer, setOffer] = useState<Batch | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`${API}/batches`, {
        method: "POST",
        credentials: "include",
        body: new FormData(e.currentTarget),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.detail);
      setOffer(result);
      loadHistory();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const accept = async () => {
    if (!offer) return;
    setSaving(true);
    const r = await fetch(`${API}/batches/${offer.id}/accept`, {
      method: "POST",
      credentials: "include",
    });
    const result = await r.json();
    setSaving(false);
    if (!r.ok) return setError(result.detail);
    setOffer(result);
    loadHistory();
    onComplete("Listing published — inventory is live in the shop.");
  };
  return (
    <section className={styles.portal}>
      <aside>
        <p className={styles.kicker}>SELLER PORTAL</p>
        <h1>Turn good stock into recovered value.</h1>
        <p>
          Submit a batch and receive a clear, explainable recommendation. You
          choose whether to publish your listing.
        </p>
        <div className={styles.steps}>
          <span>
            01 <b>Tell us the batch</b>
          </span>
          <span>
            02 <b>Review your price</b>
          </span>
          <span>
            03 <b>Publish your listing</b>
          </span>
        </div>
      </aside>
      <div>
        <details className={styles.form}>
          <summary>Inventory and draft listings ({history.length})</summary>
          <p>Shared local seller workspace</p>
          {history.map(batch=><div key={batch.id} className={styles.historyRow}><b>{batch.name}</b><small>{batch.quantity_remaining} units remaining · {batch.status}</small>{batch.status==="eligible" && <button className={styles.linkButton} onClick={()=>setOffer(batch)}>Review draft listing</button>}</div>)}
        </details>
        {offer ? (
          <div className={styles.offer}>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <p className={styles.kicker}>RECOMMENDED SELLING PRICE</p>
            <h2>
              {offer.pricing.eligible
                ? rupees(offer.pricing.selling_price_per_unit)
                : "Needs review"}
            </h2>
            <p>{offer.pricing.reason}</p>
            {offer.pricing.eligible ? (
              <div className={styles.offerGrid}>
                <div>
                  <span>Potential batch sales value</span>
                  <b>{rupees(offer.pricing.total_listing_value)}</b>
                </div>
                <div>
                  <span>Customer price</span>
                  <b>{rupees(offer.pricing.selling_price_per_unit)}</b>
                </div>
                <div>
                  <span>Days remaining</span>
                  <b>{offer.pricing.remaining_days}</b>
                </div>
                <div>
                  <span>Pricing basis</span>
                  <b>
                    {offer.pricing.shelf_life_band} /{" "}
                    {offer.pricing.feasibility_class}
                  </b>
                </div>
              </div>
            ) : (
              <p className={styles.error}>
                This batch cannot be listed until it has been reviewed.
              </p>
            )}
            {offer.pricing.eligible && offer.status !== "listed" && (
              <button
                disabled={saving}
                className={styles.primary}
                onClick={accept}
              >
                Publish listing
              </button>
            )}
            {offer.status === "listed" && (
              <p className={styles.success}>Your batch is live.</p>
            )}
            <button
              className={styles.linkButton}
              onClick={() => setOffer(null)}
            >
              Submit another batch
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <p className={styles.kicker}>NEW BATCH</p>
            <h2>Start with the label</h2>
            {error && <p className={styles.error}>{error}</p>}
            <label>
              Product name
              <input name="name" required placeholder="Wholegrain crackers" />
            </label>
            <div className={styles.two}>
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
            <div className={styles.two}>
              <label>
                Pack size
                <input name="pack_size" required placeholder="e.g. 250 g" />
              </label>
              <label>
                Units available
                <input name="quantity" type="number" min="1" required />
              </label>
            </div>
            <div className={styles.two}>
              <label>
                Printed date
                <select name="date_type">
                  <option value="best_before">Best before</option>
                  <option value="expiry">Expiry / use by</option>
                </select>
              </label>
              <label>
                Date
                <input name="printed_date" type="date" required />
              </label>
            </div>
            <div className={styles.two}>
              <label>
                Estimated use / day
                <input
                  name="consumption_per_day"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                />
              </label>
              <label>
                Buyer type
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
                required
                placeholder="Cool, dry place"
              />
            </label>
            <label>
              Product image <small>JPG, PNG or WebP · max 5 MB</small>
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <button disabled={saving} className={styles.primary}>
              {saving ? "Assessing…" : "Get recommendation"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function Operations({
  batches,
  stats,
  reload,
  message,
}: {
  batches: Batch[];
  stats: any;
  reload: () => void;
  message: (x: string) => void;
}) {
  const review = async (id: number, decision: string) => {
    const r = await fetch(`${API}/batches/${id}/review?decision=${decision}`, {
      method: "POST",
      credentials: "include",
    });
    if (r.ok) {
      message(`Batch ${decision === "approve" ? "approved" : "rejected"}.`);
      reload();
    }
  };
  return (
    <section className={styles.operations}>
      <p className={styles.kicker}>INTERNAL OPERATIONS</p>
      <h1>Keep inventory healthy.</h1>
      <p>
        Verify printed-date and storage details before approving inventory.
        Protect this area with authentication before deployment.
      </p>
      <div className={styles.metrics}>
        <div>
          <span>Active batches</span>
          <b>{stats.available_batches ?? "—"}</b>
        </div>
        <div>
          <span>Units sold</span>
          <b>{stats.units_sold ?? "—"}</b>
        </div>
        <div>
          <span>Customer savings</span>
          <b>{rupees(stats.estimated_customer_savings || 0)}</b>
        </div>
      </div>
      <div className={styles.table}>
        <div className={styles.tableHead}>
          <span>Batch</span>
          <span>Unit prices</span>
          <span>Status</span>
          <span></span>
        </div>
        {batches.map((batch) => (
          <div className={styles.tableRow} key={batch.id}>
            <div>
              <b>{batch.name}</b>
              <small>
                {batch.category} · {batch.quantity_remaining}/
                {batch.quantity_total} units · {printed(batch.printed_date)}
              </small>
            </div>
            <div>
              {rupees(batch.selling_price || 0)} / unit
            </div>
            <span className={`${styles.status} ${styles[batch.status]}`}>
              {batch.status}
            </span>
            {batch.status === "pending" ? (
              <div className={styles.actions}>
                <button onClick={() => review(batch.id, "approve")}>
                  Approve
                </button>
                <button onClick={() => review(batch.id, "reject")}>
                  Reject
                </button>
              </div>
            ) : (
              <span>—</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
