import assert from 'node:assert/strict'
import { searchAdminData } from '../src/services/ai-admin.service.js'
const calls = []
const query = async (sql, params) => {
  calls.push({ sql, params })
  if (sql.startsWith('SELECT id FROM users')) return [{ id:'3' }]
  if (sql.startsWith('SELECT COUNT')) return [{ total:725 }]
  return [{ id:'700', username:'test700' }]
}
const result = await searchAdminData(query,{ actorId:'3', resource:'users', id:'700', limit:'20', offset:'0' })
assert.equal(result.items[0].id,'700')
assert.equal(result.total,725)
assert.equal(calls[1].params[1],'700')
assert.ok(calls[1].sql.includes('u.id = ?'))
assert.ok(!calls[1].sql.includes('700'))
assert.ok(calls[2].sql.includes('LIMIT ? OFFSET ?'))
assert.deepEqual(calls[2].params,['3','700',20,0])
const page = await searchAdminData(query,{ actorId:'3', resource:'users', limit:'20', offset:'600' })
assert.equal(page.offset,600)
assert.equal(page.hasMore,true)
let count=0
const unauthorized = await searchAdminData(async()=>{ count++; return [] },{ actorId:'2', resource:'users' })
assert.equal(unauthorized.error,'FORBIDDEN')
assert.equal(count,1)
for (const input of [
  {actorId:'3',resource:'__proto__'}, {actorId:'3',resource:'users',id:'1 OR 1=1'},
  {actorId:'3',resource:'users',limit:'1e2'}, {actorId:'3',resource:'products',email:'a@example.invalid'},
  {actorId:'3',resource:'users',offset:'-1'}, {actorId:'3',resource:'users',limit:'51'},
  {actorId:'3',resource:Object.create(null)}, {actorId:'3',resource:'users',limit:['20']},
]) assert.equal((await searchAdminData(query,input)).error,'VALIDATION_ERROR')
console.log('PASS: phân trang, tìm theo ID vượt 500, chặn sai quyền và input (query giả lập).')
