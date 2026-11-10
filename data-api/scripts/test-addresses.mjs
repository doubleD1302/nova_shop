// Kiểm tra trên bản sao source và database tạm, không sử dụng dữ liệu ứng dụng.
process.env.NODE_ENV='test'; process.env.DB_USER='test_user'; process.env.DB_PASSWORD='test_local_value'; process.env.DB_HOST='127.0.0.1'; process.env.DB_PORT='1'; process.env.DB_READINESS_TIMEOUT_MS='200'; process.env.DATA_API_KEY='test_local_key'; process.env.ALLOW_LOCAL_DB_FALLBACK='true'
const assert=(await import('node:assert/strict')).default
const fs=await import('node:fs/promises'); const os=await import('node:os'); const path=await import('node:path'); const {pathToFileURL}=await import('node:url')
const root=await fs.mkdtemp(path.join(os.tmpdir(),'shopnova-address-test-'))
await fs.cp(path.resolve('src'),path.join(root,'src'),{recursive:true})
await fs.writeFile(path.join(root,'package.json'),'{"type":"module"}')
await fs.symlink(path.resolve('node_modules'),path.join(root,'node_modules'),'junction')
process.env.DOTENV_CONFIG_PATH=path.join(root,'no-env')
const moduleUrl=(relative)=>pathToFileURL(path.join(root,'src',relative)).href
const {app}=await import(moduleUrl('app.js')); const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r)); const base=`http://127.0.0.1:${server.address().port}/internal/v1`
async function request(path,method='GET',body) { const r=await fetch(base+path,{method,headers:{'x-service-key':'test_local_key','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}); return {status:r.status,json:await r.json()} }
try {
 const input={fullName:'Test Recipient',phone:'0900000000',province:'Ha Noi',detail:'123 Test'}
 const created=await request('/users/1/addresses','POST',input); assert.equal(created.status,201); const id=created.json.data.address.id
 assert.equal((await request('/users/2/addresses/'+id,'DELETE')).status,404)
 const updated=await request('/users/1/addresses/'+id,'PUT',{...input,detail:'456 Test',isDefault:true}); assert.equal(updated.status,200)
 assert.equal((await request('/users/2/addresses/'+id+'/default','PATCH')).status,404)
 assert.equal((await request('/users/1/addresses/'+id+'/default','PATCH')).status,200)
 const listed=await request('/users/1/addresses'); assert.equal(listed.json.data.addresses.filter(x=>x.isDefault).length,1); assert.equal(listed.json.data.addresses[0].detail,'456 Test')
 assert.equal((await request('/users/1/addresses/'+id,'DELETE')).status,200)
 const after=await request('/users/1/addresses'); assert.equal(after.json.data.addresses.filter(x=>x.isDefault).length,1)
 assert.equal((await request('/users/1/addresses','POST',{...input,phone:{}})).status,400)
 const beforeShop=await request('/users/2/seller-shop'); assert.equal(beforeShop.status,200)
 const shop=beforeShop.json.data.shop
 const patch=await request('/users/2/seller-shop','PUT',{name:shop.name,province:shop.province,tagline:'Changed'})
 assert.equal(patch.status,200); assert.equal(patch.json.data.shop.description,shop.description); assert.equal(patch.json.data.shop.address,shop.address)
 assert.equal((await request('/users/1/seller-shop','PUT',{tagline:'No'})).status,404)
 console.log('PASS: CRUD, owner, default, validation, and shop preservation on isolated SQLite')
} finally { server.close(); const {closeDatabase}=await import(moduleUrl('config/database.js')); await closeDatabase(); const {getLocalDatabase}=await import(moduleUrl('config/local-db.js')); getLocalDatabase().close(); await fs.rm(root,{recursive:true,force:true}) }
