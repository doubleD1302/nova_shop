import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import mysql from 'mysql2/promise'
const root=path.resolve(process.env.AI_TEST_ROOT||'.')
if(path.dirname(root).toLowerCase()!==path.resolve(os.tmpdir()).toLowerCase()||!path.basename(root).startsWith('shopnova-ai-db-')||!fs.existsSync(path.join(root,'.shopnova-ai-isolated'))) throw new Error('Cần máy chủ kiểm thử cô lập')
const port=Number(process.env.AI_TEST_PORT)
if(!Number.isInteger(port)||port<1024||port>65535||!process.env.AI_TEST_PASSWORD) throw new Error('Cấu hình kiểm thử không hợp lệ')
const connection=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password:process.env.AI_TEST_PASSWORD})
const [info]=await connection.query('SELECT @@datadir AS datadir')
if(path.resolve(info[0].datadir).toLowerCase()!==path.resolve(root,'data').toLowerCase()) throw new Error('Máy chủ không dùng dữ liệu kiểm thử')
const db=`shopnova_ai_test_${crypto.randomBytes(6).toString('hex')}`
await connection.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4`)
await connection.changeUser({database:db})
for(const sql of [
"CREATE TABLE users (id BIGINT UNSIGNED PRIMARY KEY, username VARCHAR(50), full_name VARCHAR(120), email VARCHAR(254), phone VARCHAR(20), avatar_url VARCHAR(255), role VARCHAR(20), status VARCHAR(20), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE addresses (id BIGINT UNSIGNED PRIMARY KEY, user_id BIGINT UNSIGNED, recipient_name VARCHAR(120), phone VARCHAR(20), province VARCHAR(120), district VARCHAR(120), ward VARCHAR(120), detail VARCHAR(255), is_default BOOLEAN, deleted_at DATETIME)",
"CREATE TABLE shops (id BIGINT UNSIGNED PRIMARY KEY, owner_id BIGINT UNSIGNED, name VARCHAR(100), status VARCHAR(20), description TEXT, address_detail VARCHAR(255), province VARCHAR(100), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE products (id BIGINT UNSIGNED PRIMARY KEY, shop_id BIGINT UNSIGNED, name VARCHAR(100), status VARCHAR(20), description TEXT, specs JSON, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE product_variants (id BIGINT UNSIGNED PRIMARY KEY, product_id BIGINT UNSIGNED, price DECIMAL(15,0), stock_qty INT, is_active BOOLEAN)",
"CREATE TABLE orders (id BIGINT UNSIGNED PRIMARY KEY, code VARCHAR(32), recipient_name VARCHAR(120), recipient_phone VARCHAR(20), address_detail VARCHAR(255), province VARCHAR(120), district VARCHAR(120), ward VARCHAR(120), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE shop_orders (id BIGINT UNSIGNED PRIMARY KEY, order_id BIGINT UNSIGNED, shop_name VARCHAR(100), total_amount DECIMAL(15,0), status VARCHAR(20))",
"CREATE TABLE reviews (id BIGINT UNSIGNED PRIMARY KEY, product_id BIGINT UNSIGNED, user_id BIGINT UNSIGNED, rating INT, comment TEXT, status VARCHAR(20), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
"CREATE TABLE abuse_reports (id BIGINT UNSIGNED PRIMARY KEY, target_type VARCHAR(20), target_id BIGINT UNSIGNED, shop_id BIGINT UNSIGNED, reason VARCHAR(200), details TEXT, status VARCHAR(20), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
]) await connection.query(sql)
await connection.query("INSERT INTO users (id,username,full_name,email,phone,role,status) VALUES (1,'admin','Admin',NULL,NULL,'admin','active'),(2,'buyer','Buyer',NULL,NULL,'buyer','active'),(3,'blocked','Blocked',NULL,NULL,'admin','blocked')")
const many=Array.from({length:725},(_,i)=>[String(i+100),'buyer'+i,'Test Buyer',`buyer${i}@example.invalid`,null,'buyer','active'])
await connection.query('INSERT INTO users (id,username,full_name,email,phone,role,status) VALUES ?',[many])
await connection.query("INSERT INTO users (id,username,full_name,role,status) VALUES ('9007199254740993','big-id','Big ID','buyer','active')")
const actorBase = String(Date.now()) + String(Math.floor(Math.random()*10000)).padStart(4,'0')
const adminActor = actorBase + '1'
const buyerActor = actorBase + '2'
await connection.query("INSERT INTO users (id,username,full_name,role,status) VALUES (?, 'testadmin', 'Test Admin','admin','active'), (?, 'testbuyer', 'Test Buyer','buyer','active')", [adminActor,buyerActor])
await connection.query("INSERT INTO shops (id,owner_id,name,status) VALUES (10,2,'Shop thử','active')")
await connection.query("INSERT INTO products (id,shop_id,name,status,description,specs) VALUES (20,10,'Tai nghe thử','active','Mô tả','{}')")
await connection.query('INSERT INTO product_variants VALUES (30,20,199000,3,1)')
await connection.query("INSERT INTO orders (id,code,recipient_name,recipient_phone,address_detail) VALUES (40,'ORD-TEST','Người thử','0900000000','Địa chỉ thử')")
await connection.query("INSERT INTO shop_orders VALUES (50,40,'Shop thử',199000,'shipping')")
await connection.query("INSERT INTO reviews (id,product_id,user_id,rating,comment,status) VALUES (60,20,2,5,'Ổn','visible')")
await connection.query("INSERT INTO abuse_reports (id,target_type,target_id,shop_id,reason,details,status) VALUES (70,'product',20,10,'Test','Test','open')")
Object.assign(process.env,{NODE_ENV:'test',DOTENV_CONFIG_PATH:path.join(root,'missing.env'),DB_HOST:'127.0.0.1',DB_PORT:String(port),DB_NAME:db,DB_USER:'root',DB_PASSWORD:process.env.AI_TEST_PASSWORD,DB_SSL_ENABLED:'false',DATA_API_KEY:'test-only-ai-service-key-2026'})
const {default:app}=await import('../src/app.js')
const {closeDatabase}=await import('../src/config/database.js')
const server=http.createServer(app)
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const base=`http://127.0.0.1:${server.address().port}/internal/v1/ai/admin/search`
async function call(params,key=true){const r=await fetch(`${base}?${new URLSearchParams(params)}`,{headers:key?{'x-service-key':'test-only-ai-service-key-2026'}:{}});return {status:r.status,body:await r.json()}}
try{
assert.equal((await call({actorId:'1',resource:'users'},false)).status,401)
assert.equal((await call({actorId:'2',resource:'users'})).status,403)
assert.equal((await call({actorId:'3',resource:'users'})).status,403)
const big=await call({actorId:'1',resource:'users',id:'9007199254740993'})
assert.equal(big.status,200);assert.equal(big.body.data.items[0].id,'9007199254740993');assert.equal(big.body.data.total,1)
const page=await call({actorId:'1',resource:'users',offset:'600',limit:'20'})
assert.equal(page.status,200);assert.equal(page.body.data.items.length,20);assert.equal(page.body.data.hasMore,true)
for(const [resource,id] of [['shops','10'],['products','20'],['orders','40'],['reviews','60'],['reports','70']]){const result=await call({actorId:'1',resource,id});assert.equal(result.status,200,resource);assert.equal(result.body.data.total,1,resource)}
const byCode=await call({actorId:'1',resource:'orders',code:'ORD-TEST'})
assert.equal(byCode.status,200);assert.equal(byCode.body.data.items[0].code,'ORD-TEST')
const product=await call({actorId:'1',resource:'products',id:'20'})
assert.equal(Number(product.body.data.items[0].price),199000);assert.equal(Number(product.body.data.items[0].stock),3)
assert.equal((await call({actorId:'1',resource:'users',id:'1 OR 1=1'})).status,400)
const brainDir = path.resolve('../backend/data/ai-brains')
const brainFiles = [adminActor,buyerActor].map(id => path.join(brainDir, `account_${id}.json`))
for (const file of brainFiles) assert.equal(fs.existsSync(file), false)
process.env.DATA_API_URL = `http://127.0.0.1:${server.address().port}`
process.env.JWT_SECRET = 'temporary-ai-test-jwt-secret-32-characters'
process.env.GEMINI_API_KEY = 'test-only-gemini-key'
process.env.GEMINI_API_KEYS = ''
const originalFetch = globalThis.fetch
let prompt = ''
globalThis.fetch = async (url,options) => {
  if (String(url).startsWith('https://generativelanguage.googleapis.com/')) {
    prompt = JSON.parse(options.body).contents[0].parts[0].text
    return Response.json({candidates:[{content:{parts:[{text:'Đã tìm thấy dữ liệu.'}]}}]})
  }
  return originalFetch(url,options)
}
const {default:backend}=await import('../../backend/src/app.js')
const {signAccessToken}=await import('../../backend/src/middlewares/auth.middleware.js')
const backendServer=http.createServer(backend)
await new Promise(resolve=>backendServer.listen(0,'127.0.0.1',resolve))
const backendBase=`http://127.0.0.1:${backendServer.address().port}/api/v1/ai/chat`
async function chat(id, message, history=[]) {
  const r=await originalFetch(backendBase,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${signAccessToken({id,role:'admin'})}`},body:JSON.stringify({message,context:{history,userId:adminActor,role:'admin'}})})
  return {status:r.status,body:await r.json()}
}
try {
  const searched=await chat(adminActor,'Tra cứu tài khoản mã 9007199254740993')
  assert.equal(searched.status,200)
  assert.ok(prompt.includes('9007199254740993'))
  assert.equal((await chat(buyerActor,'Danh sách khách hàng')).status,403)
  const page2=await chat(adminActor,'trang 31',[{isUser:true,text:'Danh sách khách hàng'}])
  assert.equal(page2.status,200)
  assert.equal(page2.body.data.pagination.page,31)
  assert.ok(page2.body.data.pagination.total>500)
  assert.equal((await chat(buyerActor,'trang 31',[{isUser:true,text:'Danh sách khách hàng'}])).status,403)
} finally {
  await new Promise(resolve=>backendServer.close(resolve))
  globalThis.fetch=originalFetch
  for (const file of brainFiles) if (fs.existsSync(file)) fs.unlinkSync(file)
}
console.log('PASS MariaDB cô lập: service key, quyền admin, ID lớn, trang 31, sáu nguồn; Backend thực và Gemini giả lập.')
} finally {await new Promise(resolve=>server.close(resolve));await closeDatabase();await connection.end()}
