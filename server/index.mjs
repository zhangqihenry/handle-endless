import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PASSWORD = 'handleendlessadmin123'
const SESSION_MS = 8 * 60 * 60 * 1000
const fail = (status, message) => Object.assign(new Error(message), { status })
const revisionOf = data => createHash('sha256').update(JSON.stringify(data)).digest('hex')
const hashPassword = (password, salt) => scryptSync(password, salt, 64).toString('hex')

async function atomicWrite(path, value) {
  const temp = `${path}.${randomBytes(8).toString('hex')}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 })
  await rename(temp, path)
}

export async function createAppServer(options = {}) {
  const dataDir = resolve(options.dataDir || process.env.DATA_DIR || resolve(here, '../data'))
  const webDir = resolve(options.webDir || process.env.WEB_DIR || resolve(here, '../dist'))
  const catalog = options.catalog || JSON.parse(await readFile(resolve(here, 'catalog.json'), 'utf8'))
  const simplify = text => [...text].map(char => catalog.simplifiedMap?.[char] || char).join('')
  const dailySet = new Set(catalog.daily.map(entry => simplify(entry.word)))
  const baselineMap = new Map(catalog.ordinary.map(entry => [simplify(entry.word), entry]))
  await mkdir(dataDir, { recursive: true })
  const extraPath = resolve(dataDir, 'extra-idioms.json')
  const authPath = resolve(dataDir, 'admin-auth.json')
  try { await writeFile(extraPath, '[]\n', { flag: 'wx', mode: 0o600 }) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  // Migrate existing installations once. Keep the legacy file as a backup.
  const statePath = resolve(dataDir, 'library-state.json')
  try { await readFile(statePath, 'utf8') }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    const extra = JSON.parse(await readFile(extraPath, 'utf8'))
    if (!Array.isArray(extra)) throw fail(500, '扩展库文件格式错误。')
    await atomicWrite(statePath, { ordinaryOverrides: {}, extra })
  }
  let auth
  try { auth = JSON.parse(await readFile(authPath, 'utf8')) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    const salt = randomBytes(24).toString('hex')
    const password = options.initialPassword || process.env.INITIAL_ADMIN_PASSWORD || DEFAULT_PASSWORD
    auth = { salt, hash: hashPassword(password, salt) }
    await atomicWrite(authPath, auth)
  }
  const sessions = new Map()
  const failures = new Map()
  let queue = Promise.resolve()
  const exclusive = work => {
    const result = queue.then(work)
    queue = result.catch(() => {})
    return result
  }
  const readState = async () => {
    const data = JSON.parse(await readFile(statePath, 'utf8'))
    if (!Array.isArray(data.extra) || !data.ordinaryOverrides || typeof data.ordinaryOverrides !== 'object' || Array.isArray(data.ordinaryOverrides)) throw fail(500, '词库文件格式错误，请检查数据目录。')
    return data
  }
  const ordinaryEntriesFor = state => [
    ...catalog.ordinary.filter(entry => !Object.hasOwn(state.ordinaryOverrides, simplify(entry.word))),
    ...Object.values(state.ordinaryOverrides).filter(entry => entry !== null),
  ].sort((a, b) => a.word < b.word ? -1 : a.word > b.word ? 1 : 0)
  const ordinaryFor = state => {
    const map = new Map(baselineMap)
    for (const [word, entry] of Object.entries(state.ordinaryOverrides)) {
      if (entry === null) map.delete(word)
      else map.set(word, entry)
    }
    return map
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  const body = async req => {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > 16384) throw fail(413, '提交内容过大。')
      chunks.push(chunk)
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object')
      return value
    }
    catch { throw fail(400, '提交内容必须为有效 JSON。') }
  }
  const verifyPassword = password => typeof password === 'string' && password.length <= 128
    && timingSafeEqual(Buffer.from(auth.hash, 'hex'), Buffer.from(hashPassword(password, auth.salt), 'hex'))
  const tokenOf = req => (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('handle_admin='))?.slice(13)
  const cookie = (req, token, maxAge) => `handle_admin=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${req.socket.encrypted || process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`
  const authenticate = req => {
    const token = tokenOf(req)
    if (!token || !sessions.has(token) || sessions.get(token) < Date.now()) throw fail(401, '请先输入管理密码登录。')
    return token
  }
  const checkOrigin = req => {
    if (req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, '不允许跨站请求。')
    if (req.headers.origin) {
      let origin
      try { origin = new URL(req.headers.origin) }
      catch { throw fail(403, '请求来源无效。') }
      if (origin.host !== req.headers.host) throw fail(403, '不允许跨站请求。')
    }
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, '请使用 JSON 请求。')
  }
  const normalizeEntry = (input, ordinaryMap, isExtra = true) => {
    const word = typeof input.word === 'string' ? simplify(input.word.trim()) : ''
    if (word.length !== 4 || !/^\p{Script=Han}{4}$/u.test(word)) throw fail(400, '请输入四字成语。')
    if (isExtra && dailySet.has(word)) throw fail(409, `「${word}」已在官方每日库中，不能添加到扩展库。`)
    const pinyin = (isExtra ? ordinaryMap.get(word)?.pinyin : '') || (typeof input.pinyin === 'string' ? input.pinyin.trim().replace(/\s+/g, ' ') : '')
    if (!/^[a-zv]+[1-5]( [a-zv]+[1-5]){3}$/.test(pinyin)) throw fail(400, '请填写四个以空格分隔的拼音，声调用数字 1 至 5，例如 chun1 he2 jing3 ming2。')
    return { word, pinyin }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    try {
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname
      const method = req.method
      if (path === '/healthz') return json(res, 200, { ok: true })
      if (path.startsWith('/api/admin/')) {
        if (!['GET', 'HEAD'].includes(method)) checkOrigin(req)
        const ip = req.socket.remoteAddress || 'unknown'
        const attemptKey = `${ip}:${path === '/api/admin/login' ? 'login' : 'password'}`
        if (path === '/api/admin/login' && method === 'POST') {
          for (const [key, value] of failures) if (value.until < Date.now()) failures.delete(key)
          const attempt = failures.get(attemptKey)
          if (attempt?.count >= 5) throw fail(429, '密码错误次数过多，请在 15 分钟后重试。')
          const input = await body(req)
          if (!verifyPassword(input.password)) {
            failures.set(attemptKey, { count: (attempt?.count || 0) + 1, until: attempt?.until || Date.now() + 15 * 60000 })
            throw fail(401, '管理密码不正确。')
          }
          failures.delete(attemptKey)
          for (const [token, expires] of sessions) if (expires < Date.now()) sessions.delete(token)
          if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value)
          const token = randomBytes(32).toString('hex')
          sessions.set(token, Date.now() + SESSION_MS)
          res.setHeader('Set-Cookie', cookie(req, token, SESSION_MS / 1000))
          return json(res, 200, { ok: true })
        }
        const token = authenticate(req)
        if (path === '/api/admin/session' && method === 'GET') return json(res, 200, { ok: true })
        if (path === '/api/admin/logout' && method === 'POST') {
          sessions.delete(token)
          res.setHeader('Set-Cookie', cookie(req, '', 0))
          return json(res, 200, { ok: true })
        }
        if (path === '/api/admin/password' && method === 'POST') {
          const input = await body(req)
          await exclusive(async () => {
            if (!verifyPassword(input.currentPassword)) throw fail(401, '当前密码不正确，请重新登录。')
            if (typeof input.newPassword !== 'string' || input.newPassword.length < 8 || input.newPassword.length > 128) throw fail(400, '新密码长度应为 8 至 128 个字符。')
            const salt = randomBytes(24).toString('hex')
            const next = { salt, hash: hashPassword(input.newPassword, salt) }
            await atomicWrite(authPath, next)
            auth = next
            sessions.clear()
          })
          res.setHeader('Set-Cookie', cookie(req, '', 0))
          return json(res, 200, { ok: true })
        }
        if (path === '/api/admin/library' && method === 'GET') {
          const state = await readState()
          const extras = state.extra
          const ordinary = ordinaryEntriesFor(state)
          const extraSet = new Set(extras.map(entry => simplify(entry.word)))
          const type = url.searchParams.get('type') || 'daily'
          const lists = { daily: catalog.daily, ordinary: ordinary.map(entry => ({ ...entry, daily: dailySet.has(simplify(entry.word)), extra: extraSet.has(simplify(entry.word)) })), extra: extras }
          if (!Object.hasOwn(lists, type)) throw fail(400, '词库类型无效。')
          const query = (url.searchParams.get('q') || '').trim().slice(0, 80)
          const items = lists[type].filter(entry => simplify(entry.word).includes(simplify(query)) || entry.pinyin?.includes(query) || entry.date?.includes(query))
          const requestedSize = Number(url.searchParams.get('pageSize'))
          const pageSize = type === 'ordinary' && [50, 100, 250, 500, 1000].includes(requestedSize) ? requestedSize : 50
          const pages = Math.max(1, Math.ceil(items.length / pageSize))
          const page = Math.max(1, Math.min(Math.floor(Number(url.searchParams.get('page'))) || 1, pages))
          return json(res, 200, { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pages, pageSize, revision: revisionOf(state), counts: { daily: catalog.daily.length, ordinary: ordinary.length, extra: extras.length } })
        }
        if (path === '/api/admin/check' && method === 'GET') {
          const word = simplify((url.searchParams.get('word') || '').trim())
          const state = await readState()
          const extras = state.extra
          const ordinaryMap = ordinaryFor(state)
          return json(res, 200, { word, ordinary: ordinaryMap.has(word), daily: dailySet.has(word), extra: extras.some(entry => simplify(entry.word) === word), pinyin: ordinaryMap.get(word)?.pinyin || '' })
        }
        if (['/api/admin/extra', '/api/admin/ordinary', '/api/admin/membership'].includes(path) && ['POST', 'PUT', 'DELETE'].includes(method)) {
          const input = await body(req)
          const result = await exclusive(async () => {
            // Recheck after queueing: logout/password changes invalidate pending writes.
            authenticate(req)
            const state = await readState()
            if (input.revision !== revisionOf(state)) throw fail(409, '词库已被其他页面更新，请刷新列表后重试。')
            const ordinaryMap = ordinaryFor(state)
            const extras = state.extra
            const originalWord = simplify(typeof input.originalWord === 'string' ? input.originalWord.trim() : '')
            if (path === '/api/admin/membership') {
              if (method !== 'PUT' || typeof input.selected !== 'boolean') throw fail(400, '请选择有效的扩展库状态。')
              const word = simplify(typeof input.word === 'string' ? input.word.trim() : '')
              const ordinary = ordinaryMap.get(word)
              if (!ordinary) throw fail(404, '普通库中已没有此词，请刷新列表。')
              const index = extras.findIndex(entry => simplify(entry.word) === word)
              if (input.selected) {
                const entry = normalizeEntry(ordinary, ordinaryMap)
                if (index < 0) extras.push(entry)
              }
              else if (index >= 0) extras.splice(index, 1)
            }
            else if (path === '/api/admin/ordinary') {
              if (method !== 'POST' && !ordinaryMap.has(originalWord)) throw fail(404, '要修改的成语已不存在，请刷新列表。')
              if (method === 'DELETE') state.ordinaryOverrides[originalWord] = null
              else {
                const entry = normalizeEntry(input, ordinaryMap, false)
                if (ordinaryMap.has(entry.word) && (method === 'POST' || entry.word !== originalWord)) throw fail(409, `「${entry.word}」已在普通库中，不能重复添加。`)
                const extraIndex = extras.findIndex(item => simplify(item.word) === originalWord)
                if (method === 'PUT' && extraIndex >= 0) {
                  if (dailySet.has(entry.word)) throw fail(409, '此词已加入扩展库，请先取消选中，再改为每日库中的成语。')
                  if (extras.some((item, i) => i !== extraIndex && simplify(item.word) === entry.word)) throw fail(409, '新成语已在扩展库中，请先取消原词的扩展库选中状态。')
                  extras[extraIndex] = entry
                }
                if (method === 'PUT' && originalWord !== entry.word) state.ordinaryOverrides[originalWord] = null
                state.ordinaryOverrides[entry.word] = entry
              }
            }
            else {
              const index = extras.findIndex(entry => simplify(entry.word) === originalWord)
              if (method !== 'POST' && index < 0) throw fail(404, '要修改的成语已不存在，请刷新列表。')
              if (method === 'DELETE') extras.splice(index, 1)
              else {
                const entry = normalizeEntry(input, ordinaryMap)
                if (extras.some((item, i) => simplify(item.word) === entry.word && (method === 'POST' || i !== index))) throw fail(409, `「${entry.word}」已在扩展库中，不能重复添加。`)
                if (method === 'POST') extras.push(entry)
                else extras[index] = entry
              }
            }
            await atomicWrite(statePath, state)
            return { ok: true, revision: revisionOf(state) }

          })
          return json(res, 200, result)
        }
        throw fail(404, '接口不存在。')
      }
      if (path.startsWith('/api/')) throw fail(404, '接口不存在。')
      if (!['GET', 'HEAD'].includes(method)) throw fail(405, '不支持此请求方式。')
      if (path === '/extra-idioms.json') return json(res, 200, (await readState()).extra)
      if (path === '/libraries.json') return json(res, 200, await readState())
      if (!(path === '/' || path === '/admin' || path === '/admin/' || path.startsWith('/assets/') || ['/favicon.svg', '/og.png', '/robots.txt'].includes(path))) throw fail(404, '页面不存在。')
      const relative = path === '/' || path === '/admin' || path === '/admin/' ? 'index.html' : decodeURIComponent(path.slice(1))
      const file = resolve(webDir, relative)
      if (!file.startsWith(`${webDir}${sep}`) || (path.startsWith('/assets/') && !file.startsWith(`${resolve(webDir, 'assets')}${sep}`))) throw fail(404, '页面不存在。')
      const info = await stat(file)
      if (!info.isFile()) throw fail(404, '页面不存在。')
      const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain' }
      res.writeHead(200, { 'Content-Type': `${mime[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Content-Length': info.size, 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store' })
      if (method === 'HEAD') return res.end()
      const stream = createReadStream(file)
      stream.on('error', () => res.destroy())
      stream.pipe(res)
    }
    catch (error) {
      if (res.headersSent) return res.destroy()
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500)
      json(res, status, { error: status === 500 ? '服务暂时无法完成请求，请检查数据目录和服务器日志。' : error.message })
      if (status === 500) console.error('Request failed:', error.message)
    }
  })
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile(resolve(here, 'config.json'), 'utf8'))
  const port = Number(process.env.PORT || config.port)
  const server = await createAppServer()
  server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Handle_Endless: http://localhost:${port} · 管理页面 /admin`))
}
