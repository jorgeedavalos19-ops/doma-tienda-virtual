import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../public/styles.css';
import '../../public/carousel.css';

const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const esc = value => String(value ?? '');
const colorValue = color => {
  const key = String(color || '').trim().toLowerCase();
  const colors = { blanco:'#fff', negro:'#20241f', 'verde bosque':'#334c3e', verde:'#4d7659', 'azul denim':'#426a8c', azul:'#3c6ea8', rojo:'#a8473e', natural:'#d6c4a4', beige:'#d8c2a0', gris:'#9b9b96', rosa:'#d58b9a', amarillo:'#e3c451' };
  return /^#[0-9a-f]{3,8}$/i.test(key) ? key : colors[key] || '#c9ccc1';
};
const stockText = stock => stock > 0 ? `Stock disponible: ${stock}` : 'Sin stock';
const variantStock = (product, color, size) => product?.variants?.find(v => v.color === color && v.size === size)?.stock ?? 0;
const getCart = () => JSON.parse(localStorage.getItem('doma-cart-v2') || '{}');

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'No se pudo completar la operación');
  return data;
}

function App() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('Todos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [cart, setCart] = useState(getCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [orders, setOrders] = useState(false);
  const [toast, setToast] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);

  const notify = message => { setToast(message); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setToast(''), 2800); };
  const saveCart = next => { setCart(next); localStorage.setItem('doma-cart-v2', JSON.stringify(next)); };
  const categories = useMemo(() => ['Todos', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const featured = useMemo(() => products.filter(p => p.featured && p.variants?.some(v => Number(v.stock) > 0)), [products]);
  const visibleProducts = category === 'Todos' ? products : products.filter(p => p.category === category);
  const cartEntries = Object.entries(cart);
  const cartCount = cartEntries.reduce((sum, [, item]) => sum + item.quantity, 0);
  const cartTotal = cartEntries.reduce((sum, [, item]) => sum + item.quantity * item.unitPrice, 0);

  useEffect(() => { api('/api/products').then(setProducts).catch(error => notify(error.message)); }, []);
  useEffect(() => { if (heroIndex >= featured.length) setHeroIndex(0); }, [featured.length, heroIndex]);

  const goCatalog = () => { setDetail(null); setOrders(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const chooseCategory = value => { setCategory(value); setDetail(null); setOrders(false); setMenuOpen(false); window.setTimeout(() => document.querySelector('#products')?.classList.add('catalog-changing'), 0); window.setTimeout(() => document.querySelector('#products')?.classList.remove('catalog-changing'), 750); };
  const addToCart = (product, color, size) => {
    if (!size) return notify('Seleccioná un talle para continuar');
    const variant = product.variants?.find(v => v.color === color && v.size === size);
    if (!variant || !variant.stock) return notify('Variante sin stock');
    const old = cart[product.id];
    saveCart({ ...cart, [product.id]: { productId: product.id, name: product.name, color, size, quantity: (old?.quantity || 0) + 1, unitPrice: product.price } });
    notify('Producto agregado');
  };
  const changeQuantity = (id, delta) => { const item = cart[id]; if (!item) return; const product = products.find(p => p.id === id); const next = Math.max(1, Math.min(variantStock(product, item.color, item.size), item.quantity + delta)); if (next !== item.quantity) saveCart({ ...cart, [id]: { ...item, quantity: next } }); };
  const removeCartItem = id => { const next = { ...cart }; delete next[id]; saveCart(next); };

  return <>
    <header><div className="brand-area"><button className="category-toggle" aria-expanded={menuOpen} aria-label={menuOpen ? 'Cerrar categorías' : 'Abrir categorías'} onClick={() => setMenuOpen(!menuOpen)}><span></span><span></span><span></span></button><button className="brand" onClick={goCatalog}>DOMA</button></div><nav><button onClick={goCatalog}>Catálogo</button></nav><button id="cart-button" onClick={() => { setCartOpen(true); setCheckout(false); }}>Carrito <span id="cart-count">{cartCount}</span></button></header>
    <aside className={`category-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}><h3>Categorías</h3>{categories.map(item => <button key={item} className={`category-option ${item === category ? 'active' : ''}`} onClick={() => chooseCategory(item)}>{item}</button>)}<button className="category-option orders-menu-option" onClick={() => { setOrders(true); setMenuOpen(false); }}>Mis pedidos</button></aside>
    <main className={detail || orders ? 'detail-view-open' : ''}>
      {!detail && !orders && <><section className="featured-carousel" aria-label="Productos destacados" hidden={category !== 'Todos' || !featured.length}><div className="carousel-track" style={{ transform: `translateX(-${heroIndex * 100}%)` }}>{featured.map(product => <article className="carousel-slide" key={product.id}><button className="product-image-link" onClick={() => setDetail(product)}><img src={product.image} alt={product.name} /></button><div className="carousel-copy"><small>DESTACADO · {product.category}</small><h2>{product.name}</h2><p>{product.description}</p><strong>{money(product.price)}</strong><button className="button" onClick={() => addToCart(product, product.variants[0]?.color, product.variants[0]?.size)}>Agregar al carrito</button></div></article>)}</div><button className="carousel-control carousel-prev" onClick={() => setHeroIndex((heroIndex - 1 + featured.length) % featured.length)}>‹</button><button className="carousel-control carousel-next" onClick={() => setHeroIndex((heroIndex + 1) % featured.length)}>›</button><div className="carousel-dots">{featured.map((p, index) => <button key={p.id} className={`carousel-dot ${index === heroIndex ? 'active' : ''}`} onClick={() => setHeroIndex(index)} aria-label={`Mostrar ${p.name}`}></button>)}</div></section><section id="catalogo" className="section"><div className="section-heading"><div><small>COLECCIÓN DOMA</small><h2>Encontrá tus favoritos</h2></div><span>{visibleProducts.length} productos</span></div><div id="products" className="products">{visibleProducts.map(product => <article className="product" key={product.id}><button className="product-image-link" onClick={() => setDetail(product)}><img src={product.image} alt={product.name} loading="lazy" /></button><div className="product-info"><small>{product.category}</small><h3>{product.name}</h3><p>{product.description}</p><div className="price">{money(product.price)}</div><small className="stock">{stockText(product.variants?.find(v => Number(v.stock) > 0)?.stock || 0)}</small></div></article>)}</div></section></>}
      {detail && <ProductDetail product={detail} onBack={goCatalog} onAdd={addToCart} />}
      {orders && <OrdersView notify={notify} />}
    </main>
    <button id="cart-float" className="cart-float" aria-label="Abrir bolsa de compras" onClick={() => { setCartOpen(true); setCheckout(false); }}>🛍️ <span>{cartCount}</span></button>
    <CartDrawer open={cartOpen} checkout={checkout} setCheckout={setCheckout} close={() => setCartOpen(false)} cart={cart} entries={cartEntries} total={cartTotal} changeQuantity={changeQuantity} removeItem={removeCartItem} onSuccess={async () => { setCart({}); localStorage.removeItem('doma-cart-v2'); setCheckout(false); setCartOpen(false); setProducts(await api('/api/products')); notify('Pedido recibido'); }} />
    {toast && <div className="toast show">{toast}</div>}
  </>;
}

function ProductDetail({ product, onBack, onAdd }) {
  const colors = [...new Set(product.variants?.map(v => v.color))];
  const sizes = [...new Set(product.variants?.map(v => v.size))];
  const [color, setColor] = useState(colors[0] || '');
  const [size, setSize] = useState('');
  const image = product.variants?.find(v => v.color === color && v.image)?.image || product.image;
  const stock = variantStock(product, color, size);
  return <section className="section product-detail"><button className="back-link" onClick={onBack}>← Volver al catálogo</button><div className="detail-layout"><div className="detail-image"><img src={image} alt={product.name} /></div><div className="detail-copy"><small>{product.category}</small><h1>{product.name}</h1><p>{product.description || 'Sin descripción disponible.'}</p><div className="detail-price">{money(product.price)}</div><div className="detail-variants"><div className="color-picker-label">Color</div><div className="color-picker" role="group" aria-label="Colores disponibles">{colors.map(item => <button key={item} type="button" className={`color-option ${item === color ? 'selected' : ''}`} style={{ '--swatch-color': colorValue(item) }} title={item} aria-label={`Color ${item}`} onClick={() => setColor(item)}></button>)}</div><div className="size-picker"><span>Talle</span><div className="size-options">{sizes.map(item => <button key={item} type="button" className={`size-option ${item === size ? 'selected' : ''}`} onClick={() => setSize(item)}>{item}</button>)}</div></div></div><small className="stock detail-stock">{size ? stockText(stock) : 'Seleccioná un talle'}</small><button className="button" onClick={() => onAdd(product, color, size)}>Agregar al carrito</button><div className="detail-info"><b>Stock total</b><span>{product.variants?.reduce((sum, item) => sum + Number(item.stock || 0), 0)} unidades</span></div></div></div></section>;
}

function CartDrawer({ open, checkout, setCheckout, close, cart, entries, total, changeQuantity, removeItem, onSuccess }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', dniLast3: '' });
  const [message, setMessage] = useState('');
  if (!open) return null;
  const submit = async event => { event.preventDefault(); setMessage('Enviando pedido…'); try { await api('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ customer: form, items: entries.map(([, item]) => item) }) }); setForm({ name:'', phone:'', email:'', dniLast3:'' }); await onSuccess(); } catch (error) { setMessage(error.message); } };
  return <><div id="cart-backdrop" onClick={close}></div><aside id="cart-drawer"><div className="toolbar"><h2>Tu bolsa</h2><button id="close-cart" onClick={close}>Salir</button></div>{!checkout ? <div id="cart-view"><div id="cart-items">{entries.map(([id, item]) => <div className="cart-item" key={id}><div><b>{item.name}</b><small>{item.color} · talle {item.size} · {money(item.unitPrice)}</small><div className="quantity-control"><button onClick={() => changeQuantity(id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(id, 1)}>+</button></div></div><button onClick={() => removeItem(id)}>Quitar</button></div>)}{!entries.length && <div className="empty">Tu carrito está vacío.</div>}</div><div className="cart-footer"><strong>Total <span>{money(total)}</span></strong><button className="button" disabled={!entries.length} onClick={() => setCheckout(true)}>Continuar con la compra</button></div></div> : <div id="checkout-view"><button className="back-link" onClick={() => setCheckout(false)}>← Volver al carrito</button><h3>Datos para retirar en el local</h3><form className="checkout-form" onSubmit={submit}><input placeholder="Nombre y apellido" required value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} /><input type="tel" placeholder="Teléfono" required value={form.phone} onChange={e => setForm({ ...form, phone:e.target.value })} /><input type="email" placeholder="Email (opcional)" value={form.email} onChange={e => setForm({ ...form, email:e.target.value })} /><input inputMode="numeric" pattern="[0-9]{3}" maxLength="3" placeholder="3 últimos números del DNI" required value={form.dniLast3} onChange={e => setForm({ ...form, dniLast3:e.target.value })} /><button className="button" type="submit">Confirmar retiro</button><p className="message">{message}</p></form></div>}</aside></>;
}

function OrdersView({ notify }) {
  const [form, setForm] = useState({ phone: '', dniLast3: '' });
  const [results, setResults] = useState([]); const [message, setMessage] = useState('');
  const submit = async event => { event.preventDefault(); setMessage('Buscando pedidos…'); try { const data = await api(`/api/orders?${new URLSearchParams(form)}`); setResults(data); setMessage(''); } catch (error) { setMessage(error.message); } };
  return <section className="section orders-section"><div className="section-heading"><div><small>SEGUIMIENTO</small><h2>Mis pedidos</h2></div></div><div className="card orders-lookup"><p>Ingresá el teléfono y los 3 últimos números de tu DNI para consultar tus pedidos.</p><form onSubmit={submit}><input type="tel" placeholder="Teléfono" required value={form.phone} onChange={e => setForm({ ...form, phone:e.target.value })} /><input inputMode="numeric" pattern="[0-9]{3}" maxLength="3" placeholder="3 últimos números del DNI" required value={form.dniLast3} onChange={e => setForm({ ...form, dniLast3:e.target.value })} /><button className="button">Consultar pedidos</button><p className="message">{message}</p></form></div><div id="orders-results">{results.map(order => <article className="card customer-order" key={order.id}><h3>{order.status}</h3><p>Pedido realizado: {new Date(order.createdAt || order.created_at).toLocaleDateString('es-AR')}</p><div className="customer-order-items">{(order.items || []).map((item, index) => <div key={index}>{item.quantity} × {item.name} · {item.color} · talle {item.size}</div>)}</div><strong>Total: {money(order.total)}</strong></article>)}</div></section>;
}

createRoot(document.getElementById('root')).render(<App />);
