const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Carga un .env sencillo sin agregar dependencias al prototipo.
try {
  const env = require('node:fs').readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@doma.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cambiar-esta-clave';
const SESSION_TTL = Number(process.env.SESSION_TTL_HOURS || 8) * 3600000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'store.json');
const PUBLIC = path.join(ROOT, 'public');
const ADMIN = path.join(ROOT, 'admin');
const sessions = new Map();
let writeQueue = Promise.resolve();

async function readDb() { return JSON.parse(await fs.readFile(DB_FILE, 'utf8')); }
function saveDb(db) { writeQueue = writeQueue.then(() => fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))); return writeQueue; }
function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(body)); }
function fail(res, status, message) { json(res, status, {error: message}); }
async function body(req) { let raw=''; for await (const chunk of req) raw += chunk; try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('JSON inválido'); } }
function auth(req) { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); const session = sessions.get(token); if (!session || session.expires < Date.now()) return null; return session; }
function requireAdmin(req, res) { const session = auth(req); if (!session) { fail(res, 401, 'Autenticación administrativa requerida'); return null; } return session; }
function cleanProduct(input, old = {}) {
  const name = String(input.name ?? old.name ?? '').trim();
  const price = Number(input.price ?? old.price);
  if (!name || !Number.isFinite(price) || price <= 0) throw new Error('Nombre y precio válido son obligatorios');
  const variants = Array.isArray(input.variants ?? old.variants) ? (input.variants ?? old.variants).map(v => ({color:String(v.color||'').trim(), size:String(v.size||'').trim(), stock:Math.max(0, Math.floor(Number(v.stock)||0))})).filter(v=>v.color&&v.size) : [];
  if (!variants.length) throw new Error('Debe existir al menos una variante con color y talle');
  return { ...old, name, description:String(input.description ?? old.description ?? '').trim(), category:String(input.category ?? old.category ?? 'General').trim(), price, previousPrice: input.previousPrice == null ? (old.previousPrice ?? null) : Number(input.previousPrice) || null, featured:Boolean(input.featured ?? old.featured), active:input.active === undefined ? (old.active !== false) : Boolean(input.active), image:String(input.image ?? old.image ?? ''), variants };
}
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`); const p = url.pathname; const method=req.method;
  if (method==='OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization, Idempotency-Key','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'}); return res.end(); }
  if (p==='/api/health') return json(res,200,{ok:true,service:'doma-api'});
  if (p==='/api/auth/login' && method==='POST') { const b=await body(req); if (b.email!==ADMIN_EMAIL || b.password!==ADMIN_PASSWORD) return fail(res,401,'Credenciales incorrectas'); const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{email:ADMIN_EMAIL,expires:Date.now()+SESSION_TTL}); return json(res,200,{token,expiresIn:SESSION_TTL}); }
  const db=await readDb();
  if (p==='/api/products' && method==='GET') return json(res,200,db.products.filter(x=>x.active));
  if (p==='/api/orders' && method==='POST') {
    const b=await body(req); const key=req.headers['idempotency-key']; if(!key) return fail(res,400,'Falta Idempotency-Key');
    const existing=db.orders.find(o=>o.idempotencyKey===key); if(existing) return json(res,200,existing);
    const customer=b.customer||{}; if(!customer.name||!customer.email||!customer.phone) return fail(res,400,'Nombre, email y teléfono son obligatorios');
    if(!Array.isArray(b.items)||!b.items.length) return fail(res,400,'El pedido no tiene productos');
    const lines=[]; let total=0;
    for(const item of b.items){ const prod=db.products.find(x=>x.id===item.productId&&x.active); const variant=prod?.variants.find(v=>v.color===item.color&&v.size===item.size); const qty=Math.floor(Number(item.quantity)); if(!prod||!variant||!Number.isInteger(qty)||qty<1||variant.stock<qty) return fail(res,409,`Stock insuficiente o variante inválida para ${prod?.name||item.productId}`); lines.push({productId:prod.id,name:prod.name,color:variant.color,size:variant.size,quantity:qty,unitPrice:prod.price,lineTotal:prod.price*qty}); total+=prod.price*qty; }
    const customerId=db.customers.find(c=>c.email.toLowerCase()===String(customer.email).toLowerCase())?.id||id('cus'); if(!db.customers.some(c=>c.id===customerId)) db.customers.push({id:customerId,name:String(customer.name),email:String(customer.email),phone:String(customer.phone),createdAt:new Date().toISOString(),active:true});
    for(const line of lines){ const prod=db.products.find(x=>x.id===line.productId); const v=prod.variants.find(x=>x.color===line.color&&x.size===line.size); v.stock-=line.quantity; }
    const order={id:id('ord'),idempotencyKey:key,customerId,customer:{name:String(customer.name),email:String(customer.email),phone:String(customer.phone)},items:lines,subtotal:total,total,status:'PENDIENTE',paymentStatus:'PENDIENTE',fulfillment:'RETIRO_LOCAL',createdAt:new Date().toISOString()}; db.orders.push(order); db.events.push({id:id('evt'),type:'ORDER_CREATED',orderId:order.id,createdAt:order.createdAt}); await saveDb(db); return json(res,201,order);
  }
  const admin=requireAdmin(req,res); if(!admin) return;
  if(p==='/api/admin/dashboard'&&method==='GET'){const count=s=>db.orders.filter(o=>o.status===s).length;return json(res,200,{products:db.products.filter(x=>x.active).length,customers:db.customers.length,pending:count('PENDIENTE'),preparing:count('EN_PREPARACION'),ready:count('LISTO_PARA_RETIRAR'),delivered:count('ENTREGADO'),cancelled:count('CANCELADO'),paidSales:db.sales.filter(s=>s.paymentStatus==='PAGADO').length,revenue:db.sales.filter(s=>s.paymentStatus==='PAGADO').reduce((a,s)=>a+s.total,0)});}
  if(p==='/api/admin/products'&&method==='GET') return json(res,200,db.products);
  if(p==='/api/admin/products'&&method==='POST'){try{const product={id:id('prod'),createdAt:new Date().toISOString(),...cleanProduct(await body(req))};db.products.push(product);await saveDb(db);return json(res,201,product)}catch(e){return fail(res,400,e.message)}}
  const productMatch=p.match(/^\/api\/admin\/products\/([^/]+)$/); if(productMatch){const product=db.products.find(x=>x.id===productMatch[1]);if(!product)return fail(res,404,'Producto no encontrado');if(method==='DELETE'){product.active=false;await saveDb(db);return json(res,200,product)}if(method==='PATCH'){const b=await body(req);product.featured=Boolean(b.featured);await saveDb(db);return json(res,200,product)}if(method==='PUT'){try{Object.assign(product,cleanProduct(await body(req),product));await saveDb(db);return json(res,200,product)}catch(e){return fail(res,400,e.message)}}}
  if(p==='/api/admin/orders'&&method==='GET') return json(res,200,db.orders);
  const orderMatch=p.match(/^\/api\/admin\/orders\/([^/]+)$/); if(orderMatch&&method==='PATCH'){const order=db.orders.find(x=>x.id===orderMatch[1]);if(!order)return fail(res,404,'Pedido no encontrado');const b=await body(req);const allowed=['PENDIENTE','EN_PREPARACION','LISTO_PARA_RETIRAR','ENTREGADO','CANCELADO'];if(!allowed.includes(b.status))return fail(res,400,'Estado inválido');if(order.status==='CANCELADO'||order.status==='ENTREGADO')return fail(res,409,'El pedido ya está cerrado');if(b.status==='CANCELADO'){for(const line of order.items){const prod=db.products.find(x=>x.id===line.productId);const v=prod?.variants.find(x=>x.color===line.color&&x.size===line.size);if(v)v.stock+=line.quantity;}}order.status=b.status;order.updatedAt=new Date().toISOString();db.events.push({id:id('evt'),type:'ORDER_STATUS_CHANGED',orderId:order.id,status:order.status,createdAt:order.updatedAt});if(order.status==='ENTREGADO')db.sales.push({id:id('sale'),orderId:order.id,total:order.total,paymentStatus:'PENDIENTE',createdAt:order.updatedAt});await saveDb(db);return json(res,200,order)}
  if(p==='/api/admin/customers'&&method==='GET') return json(res,200,db.customers);
  if(p==='/api/admin/sales'&&method==='GET') return json(res,200,db.sales);
  return fail(res,404,'Ruta no encontrada');
}
async function serve(req,res){const requestPath=req.url.split('?')[0];const isAdmin=requestPath==='/admin'||requestPath.startsWith('/admin/');const adminPath=requestPath.replace(/^\/admin/,'');const file=requestPath==='/'?'/index.html':(isAdmin?(adminPath==='/'?'/index.html':adminPath):requestPath);const safe=path.normalize(file).replace(/^([.][.][/\\])+/, '');const target=path.join(isAdmin?ADMIN:PUBLIC,safe);try{const data=await fs.readFile(target);const ext=path.extname(target);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data)}catch{fail(res,404,'Archivo no encontrado')}}
const server=http.createServer(async(req,res)=>{try{if(req.url.startsWith('/api/'))await route(req,res);else await serve(req,res)}catch(e){console.error(e);fail(res,500,'Error interno del servidor')}});server.listen(PORT,()=>console.log(`DOMA disponible en http://localhost:${PORT}`));
