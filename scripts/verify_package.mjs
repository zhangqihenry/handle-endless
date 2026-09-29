import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const version = JSON.parse(await readFile('package.json', 'utf8')).version
const root = resolve(`releases/Handle_Endless-${version}-docker`)
const { createAppServer } = await import(pathToFileURL(join(root, 'server/index.mjs')))
const dataDir = await mkdtemp(join(tmpdir(), 'handle-package-'))
const server = await createAppServer({ dataDir, webDir: join(root, 'www') })
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  for (const path of ['/', '/admin', '/healthz']) assert.equal((await fetch(base + path)).status, 200)
  assert.equal((await fetch(`${base}/api/admin/library`)).status, 401)
  const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'handleendlessadmin123' }) })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const library = await (await fetch(`${base}/api/admin/library?type=extra`, { headers: { cookie } })).json()
  assert.equal(library.counts.daily, 424)
  assert.equal(library.counts.ordinary, 29760)
  assert.equal(library.counts.extra, 0)
  const save = await fetch(`${base}/api/admin/extra`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ word: '春和景明', revision: library.revision }) })
  assert.equal(save.status, 200)
  assert.deepEqual(await (await fetch(`${base}/extra-idioms.json`)).json(), [{ word: '春和景明', pinyin: 'chun1 he2 jing3 ming2' }])
  const ordinary = await (await fetch(`${base}/api/admin/library?type=ordinary&q=春和景明`, { headers: { cookie } })).json()
  assert.equal(ordinary.items[0].extra, true)
  const untick = await fetch(`${base}/api/admin/membership`, { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ word: '春和景明', selected: false, revision: ordinary.revision }) })
  assert.equal(untick.status, 200)
  assert.deepEqual((await (await fetch(`${base}/libraries.json`)).json()).extra, [])
  assert.deepEqual(JSON.parse(await readFile(join(root, 'data/extra-idioms.json'), 'utf8')), [])
  console.log('安装包验证通过：页面、默认登录、官方目录、扩展词库写入、普通库选中状态、取消选中和游戏词库读取；包内初始数据仍为空。')
}
finally {
  await new Promise(resolve => server.close(resolve))
  await rm(dataDir, { recursive: true, force: true })
}
