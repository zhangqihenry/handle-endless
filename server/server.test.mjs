import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAppServer } from './index.mjs'

const password = 'handleendlessadmin123'
async function setup(t, catalogOverrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'handle-endless-test-'))
  await writeFile(join(dir, 'index.html'), '<html>Handle_Endless</html>')
  const options = { dataDir: join(dir, 'data'), webDir: dir, catalog: {
    daily: [{ word: '路不拾遗', pinyin: 'lu4 bu4 shi2 yi2', date: '2022-01-01', day: 1 }],
    ordinary: [{ word: '路不拾遗', pinyin: 'lu4 bu4 shi2 yi2' }, { word: '春和景明', pinyin: 'chun1 he2 jing3 ming2' }],
    simplifiedMap: { 遺: '遗' },
    ...catalogOverrides,
  } }
  let server = await createAppServer(options)
  const listen = () => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  await listen()
  let base = `http://127.0.0.1:${server.address().port}`
  let cookie = ''
  async function request(path, method = 'GET', data, headers = {}) {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) })
    const value = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text()
    return { status: response.status, value, headers: response.headers }
  }
  const login = async (value = password) => {
    const response = await request('/api/admin/login', 'POST', { password: value })
    if (response.status === 200) cookie = response.headers.get('set-cookie').split(';')[0]
    return response
  }
  t.after(async () => { if (server.listening) await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }) })
  return { request, login, dir, revision: async () => (await request('/api/admin/library?type=extra')).value.revision,
    restart: async () => {
      await new Promise(resolve => server.close(resolve))
      server = await createAppServer(options)
      await listen()
      base = `http://127.0.0.1:${server.address().port}`
    },
  }
}

test('management APIs require login and password file cannot be fetched', async (t) => {
  const app = await setup(t)
  assert.equal((await app.request('/api/admin/library')).status, 401)
  assert.equal((await app.request('/api/admin/check?word=路不拾遗')).status, 401)
  assert.equal((await app.request('/api/admin/extra', 'POST', {})).status, 401)
  assert.equal((await app.request('/data/admin-auth.json')).status, 404)
  assert.equal((await app.request('/server/catalog.json')).status, 404)
  assert.equal((await app.request('/assets/%2e%2e%2fdata/admin-auth.json')).status, 404)
  assert.equal((await app.request('/admin')).status, 200)
  assert.equal((await app.login('wrong')).status, 401)
  const login = await app.login()
  assert.equal(login.status, 200)
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  const credentials = await readFile(join(app.dir, 'data/admin-auth.json'), 'utf8')
  assert.ok(!credentials.includes(password))
})

test('official libraries are searchable and the daily table has no mutation endpoint', async (t) => {
  const app = await setup(t); await app.login()
  const daily = await app.request('/api/admin/library?type=daily&q=2022-01-01')
  assert.equal(daily.value.items[0].word, '路不拾遗')
  assert.equal(daily.value.counts.ordinary, 2)
  assert.equal((await app.request('/api/admin/library?type=ordinary&q=春')).value.total, 1)
  assert.equal((await app.request('/api/admin/library', 'PUT', { word: '更改官方' })).status, 404)
})

test('daily duplicates including traditional forms are rejected without writing', async (t) => {
  const app = await setup(t); await app.login()
  for (const word of ['路不拾遗', '路不拾遺']) {
    const result = await app.request('/api/admin/extra', 'POST', { word, pinyin: 'lu4 bu4 shi2 yi2', revision: await app.revision() })
    assert.equal(result.status, 409)
    assert.match(result.value.error, /官方每日库/)
  }
  assert.deepEqual((await app.request('/extra-idioms.json')).value, [])
})

test('add, edit, delete and restart persist extras; ordinary words can be added', async (t) => {
  const app = await setup(t); await app.login()
  let result = await app.request('/api/admin/extra', 'POST', { word: '春和景明', revision: await app.revision() })
  assert.equal(result.status, 200)
  assert.equal((await app.request('/extra-idioms.json')).value[0].pinyin, 'chun1 he2 jing3 ming2')
  result = await app.request('/api/admin/extra', 'PUT', { originalWord: '春和景明', word: '甲乙丙丁', pinyin: 'jia3 yi3 bing3 ding1', revision: result.value.revision })
  assert.equal(result.status, 200)
  await app.restart()
  assert.equal((await app.request('/api/admin/session')).status, 401)
  await app.login()
  assert.equal((await app.request('/extra-idioms.json')).value[0].word, '甲乙丙丁')
  assert.equal((await app.request('/api/admin/extra', 'DELETE', { originalWord: '甲乙丙丁', revision: await app.revision() })).status, 200)
  assert.deepEqual((await app.request('/extra-idioms.json')).value, [])
})

test('edit cannot introduce daily duplicates, invalid data or duplicate extras', async (t) => {
  const app = await setup(t); await app.login()
  assert.equal((await app.request('/api/admin/extra', 'POST', { word: '春和景明', revision: await app.revision() })).status, 200)
  assert.equal((await app.request('/api/admin/extra', 'POST', { word: '春和景明', revision: await app.revision() })).status, 409)
  assert.equal((await app.request('/api/admin/extra', 'PUT', { originalWord: '春和景明', word: '路不拾遗', revision: await app.revision() })).status, 409)
  assert.equal((await app.request('/api/admin/extra', 'POST', { word: '甲乙丙丁', pinyin: 'bad', revision: await app.revision() })).status, 400)
  assert.equal((await app.request('/api/admin/login', 'POST', null)).status, 400)
  assert.equal((await app.request('/extra-idioms.json')).value.length, 1)
})

test('concurrent writes reject stale revisions rather than overwriting', async (t) => {
  const app = await setup(t); await app.login()
  const revision = await app.revision()
  const results = await Promise.all([
    app.request('/api/admin/extra', 'POST', { word: '春和景明', revision }),
    app.request('/api/admin/extra', 'POST', { word: '甲乙丙丁', pinyin: 'jia3 yi3 bing3 ding1', revision }),
  ])
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
  assert.equal((await app.request('/extra-idioms.json')).value.length, 1)
})

test('cross-origin mutations and repeated login attempts are blocked', async (t) => {
  const app = await setup(t)
  assert.equal((await app.request('/api/admin/login', 'POST', { password }, { origin: 'https://example.com' })).status, 403)
  await app.login()
  assert.equal((await app.request('/api/admin/extra', 'POST', {}, { origin: 'https://example.com' })).status, 403)
  for (let i = 0; i < 5; i++) assert.equal((await app.login('wrong')).status, 401)
  assert.equal((await app.login()).status, 429)
})

test('password change persists and invalidates sessions; logout revokes session', async (t) => {
  const app = await setup(t); await app.login()
  assert.equal((await app.request('/api/admin/password', 'POST', { currentPassword: password, newPassword: 'a-new-test-password' })).status, 200)
  assert.equal((await app.request('/api/admin/session')).status, 401)
  await app.restart()
  assert.equal((await app.login()).status, 401)
  assert.equal((await app.login('a-new-test-password')).status, 200)
  assert.equal((await app.request('/api/admin/logout', 'POST', {})).status, 200)
  assert.equal((await app.request('/api/admin/session')).status, 401)
})

test('ordinary rows mark daily overlap and toggles persist with the game payload', async (t) => {
  const app = await setup(t); await app.login()
  const initial = (await app.request('/api/admin/library?type=ordinary')).value
  assert.equal(initial.items.find(e => e.word === '路不拾遗').daily, true)
  assert.equal(initial.items.find(e => e.word === '春和景明').extra, false)
  const toggle = selected => app.request('/api/admin/membership', 'PUT', { word: '春和景明', selected, revision: initial.revision })
  assert.equal((await toggle(true)).status, 200)
  assert.equal((await toggle(false)).status, 409)
  await app.restart(); await app.login()
  const next = (await app.request('/api/admin/library?type=ordinary')).value
  assert.equal(next.items.find(e => e.word === '春和景明').extra, true)
  assert.equal((await app.request('/libraries.json')).value.extra[0].word, '春和景明')
  assert.equal((await app.request('/api/admin/membership', 'PUT', { word: '春和景明', selected: false, revision: next.revision })).status, 200)
  assert.deepEqual((await app.request('/extra-idioms.json')).value, [])
  assert.equal((await app.request('/api/admin/library?type=ordinary&q=春和景明')).value.total, 1)
})

test('daily membership cannot be selected; API validates membership requests', async (t) => {
  const app = await setup(t)
  assert.equal((await app.request('/api/admin/ordinary', 'PUT', {})).status, 401)
  assert.equal((await app.request('/api/admin/membership', 'PUT', {})).status, 401)
  await app.login()
  for (const word of ['路不拾遗', '路不拾遺']) {
    assert.equal((await app.request('/api/admin/membership', 'PUT', { word, selected: true, revision: await app.revision() })).status, 409)
  }
  assert.equal((await app.request('/api/admin/membership', 'PUT', { word: '春和景明', selected: 'true', revision: await app.revision() })).status, 400)
  assert.equal((await app.request('/api/admin/membership', 'PUT', { word: '甲乙丙丁', selected: true, revision: await app.revision() })).status, 404)
})

test('ordinary CRUD and selected-word edits synchronize atomically and survive restart', async (t) => {
  const app = await setup(t); await app.login()
  const mutate = async (path, method, data) => app.request(`/api/admin/${path}`, method, { ...data, revision: await app.revision() })
  assert.equal((await mutate('ordinary', 'POST', { word: '甲乙丙丁', pinyin: 'jia3 yi3 bing3 ding1' })).status, 200)
  assert.equal((await mutate('ordinary', 'POST', { word: '甲乙丙丁', pinyin: 'jia3 yi3 bing3 ding1' })).status, 409)
  assert.equal((await mutate('ordinary', 'POST', { word: '甲乙丙丁', pinyin: 'bad' })).status, 400)
  assert.equal((await mutate('membership', 'PUT', { word: '甲乙丙丁', selected: true })).status, 200)
  const entry = { word: '甲乙丙戊', pinyin: 'jia3 yi3 bing3 wu4' }
  assert.equal((await mutate('ordinary', 'PUT', { originalWord: '甲乙丙丁', ...entry })).status, 200)
  await app.restart(); await app.login()
  assert.deepEqual((await app.request('/extra-idioms.json')).value, [entry])
  const payload = (await app.request('/libraries.json')).value
  assert.equal(payload.ordinaryOverrides['甲乙丙丁'], null)
  assert.deepEqual(payload.ordinaryOverrides[entry.word], entry)
  assert.equal((await mutate('ordinary', 'DELETE', { originalWord: entry.word })).status, 200)
  assert.equal((await app.request(`/api/admin/library?type=ordinary&q=${entry.word}`)).value.total, 0)
  assert.deepEqual((await app.request('/extra-idioms.json')).value, [entry])
})

test('ordinary daily-overlap edits and removal do not change the daily table', async (t) => {
  const app = await setup(t); await app.login()
  const daily = (await app.request('/api/admin/library?type=daily')).value.items
  assert.equal((await app.request('/api/admin/ordinary', 'PUT', { originalWord: '路不拾遺', word: '路不拾遺', pinyin: 'lu4 bu4 shi2 yi4', revision: await app.revision() })).status, 200)
  const row = (await app.request('/api/admin/library?type=ordinary&q=路不拾遗')).value.items[0]
  assert.equal(row.pinyin, 'lu4 bu4 shi2 yi4')
  assert.equal(row.daily, true)
  assert.equal((await app.request('/api/admin/ordinary', 'DELETE', { originalWord: '路不拾遗', revision: await app.revision() })).status, 200)
  assert.deepEqual((await app.request('/api/admin/library?type=daily')).value.items, daily)
})

test('editing ordinary readings updates selected extras, without adding unselected words to random pool', async (t) => {
  const app = await setup(t); await app.login()
  const update = pinyin => app.request('/api/admin/ordinary', 'PUT', { originalWord: '春和景明', word: '春和景明', pinyin })
  assert.equal((await update('chun1 he2 jing3 ming2')).status, 409)
  assert.equal((await app.request('/api/admin/ordinary', 'PUT', { originalWord: '春和景明', word: '春和景明', pinyin: 'chun1 he2 jing3 ming3', revision: await app.revision() })).status, 200)
  assert.deepEqual((await app.request('/extra-idioms.json')).value, [])
  assert.equal((await app.request('/api/admin/membership', 'PUT', { word: '春和景明', selected: true, revision: await app.revision() })).status, 200)
  assert.equal((await app.request('/extra-idioms.json')).value[0].pinyin, 'chun1 he2 jing3 ming3')
  assert.equal((await app.request('/api/admin/ordinary', 'PUT', { originalWord: '春和景明', word: '春和景明', pinyin: 'chun1 he2 jing3 ming2', revision: await app.revision() })).status, 200)
  assert.equal((await app.request('/extra-idioms.json')).value[0].pinyin, 'chun1 he2 jing3 ming2')
})

test('v0.2 extension file migrates once without losing entries or later admin edits', async (t) => {
  const app = await setup(t)
  await rm(join(app.dir, 'data/library-state.json'))
  const legacy = [{ word: '春和景明', pinyin: 'chun1 he2 jing3 ming2' }]
  await writeFile(join(app.dir, 'data/extra-idioms.json'), JSON.stringify(legacy))
  await app.restart(); await app.login()
  assert.deepEqual((await app.request('/extra-idioms.json')).value, legacy)
  assert.equal((await app.request('/api/admin/membership', 'PUT', { word: '春和景明', selected: false, revision: await app.revision() })).status, 200)
  await app.restart()
  assert.deepEqual((await app.request('/extra-idioms.json')).value, [])
  assert.deepEqual(JSON.parse(await readFile(join(app.dir, 'data/extra-idioms.json'), 'utf8')), legacy)
})

test('original traditional variants stay visible and share ordinary overrides', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'handle-variants-'))
  const server = await createAppServer({ dataDir: dir, catalog: { daily: [], ordinary: [
    { word: '路不拾遗', pinyin: 'lu4 bu4 shi2 yi2' }, { word: '路不拾遺', pinyin: 'lu4 bu4 shi2 yi2' },
  ], simplifiedMap: { 遺: '遗' } } })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }) })
  const base = `http://127.0.0.1:${server.address().port}`
  const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
  const headers = { cookie: login.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' }
  const before = await (await fetch(`${base}/api/admin/library?type=ordinary&q=路不拾遗`, { headers })).json()
  assert.equal(before.total, 2)
  const save = await fetch(`${base}/api/admin/ordinary`, { method: 'PUT', headers, body: JSON.stringify({ originalWord: '路不拾遺', word: '路不拾遺', pinyin: 'lu4 bu4 shi2 yi4', revision: before.revision }) })
  assert.equal(save.status, 200)
  const after = await (await fetch(`${base}/api/admin/library?type=ordinary&q=路不拾遺`, { headers })).json()
  assert.equal(after.total, 1)
  assert.equal(after.items[0].pinyin, 'lu4 bu4 shi2 yi4')
})

test('ordinary pagination accepts all five sizes, covers every row and keeps search boundaries', async (t) => {
  const ordinary = Array.from({ length: 1205 }, (_, i) => ({ word: `测${String.fromCodePoint(0x4e00 + i)}分页`, pinyin: 'ce4 shi4 fen1 ye4' }))
  const app = await setup(t, { ordinary }); await app.login()
  for (const pageSize of [50, 100, 250, 500, 1000]) {
    const first = (await app.request(`/api/admin/library?type=ordinary&pageSize=${pageSize}`)).value
    assert.equal(first.pageSize, pageSize)
    assert.equal(first.items.length, pageSize)
    assert.equal(first.pages, Math.ceil(ordinary.length / pageSize))
    const collected = [...first.items]
    for (let page = 2; page <= first.pages; page++) {
      const next = (await app.request(`/api/admin/library?type=ordinary&pageSize=${pageSize}&page=${page}`)).value
      assert.equal(next.page, page)
      collected.push(...next.items)
    }
    assert.deepEqual(collected.map(e => e.word), ordinary.map(e => e.word))
    const last = (await app.request(`/api/admin/library?type=ordinary&pageSize=${pageSize}&page=99999`)).value
    assert.equal(last.page, first.pages)
    assert.equal(last.items.length, ordinary.length % pageSize)
    const search = (await app.request(`/api/admin/library?type=ordinary&pageSize=${pageSize}&page=12&q=${ordinary[603].word}`)).value
    assert.equal(search.page, 1)
    assert.equal(search.total, 1)
    assert.equal(search.items[0].word, ordinary[603].word)
  }
  for (const invalid of ['', '0', '-1', '1001', '1000000', '1.5', 'abc', 'Infinity']) {
    const result = (await app.request(`/api/admin/library?type=ordinary&pageSize=${invalid}`)).value
    assert.equal(result.pageSize, 50)
    assert.equal(result.items.length, 50)
  }
  assert.equal((await app.request('/api/admin/library?type=daily&pageSize=1000')).value.pageSize, 50)
})
