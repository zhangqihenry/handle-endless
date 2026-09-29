<script setup lang="ts">
interface Entry { word: string; pinyin: string; day?: number; date?: string; daily?: boolean; extra?: boolean }
interface LibraryResult { items: Entry[]; page: number; pages: number; total: number; revision: string; counts: Record<string, number> }
const loggedIn = ref(false)
const checking = ref(true)
const password = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const type = ref('daily')
const query = ref('')
const pageSizes = [50, 100, 250, 500, 1000]
const ordinaryPageSize = useStorage('handle-endless-admin-page-size', 50)
if (!pageSizes.includes(ordinaryPageSize.value))
  ordinaryPageSize.value = 50
const result = ref<LibraryResult>({ items: [], page: 1, pages: 1, total: 0, revision: '', counts: {} })
const word = ref('')
const pinyin = ref('')
const originalWord = ref('')
const duplicateMessage = ref('')
const checkPending = ref(false)
const pendingDelete = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const libraryNames: Record<string, string> = { daily: '官方每日库', ordinary: '官方普通成语库', extra: '扩展库' }
let checkSequence = 0

async function api(path: string, method = 'GET', data?: unknown) {
  const response = await fetch(`/api/admin/${path}`, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: data == null ? undefined : JSON.stringify(data),
  })
  const value = await response.json()
  if (!response.ok) {
    if (response.status === 401)
      loggedIn.value = false
    throw new Error(value.error || '请求失败，请稍后重试。')
  }
  return value
}
async function load(page = 1) {
  result.value = await api(`library?type=${type.value}&q=${encodeURIComponent(query.value)}&page=${page}&pageSize=${type.value === 'ordinary' ? ordinaryPageSize.value : 50}`)
}
async function action(work: () => Promise<void>) {
  if (busy.value)
    return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await work()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '请求失败。'
  }
  finally {
    busy.value = false
  }
}
async function login() {
  await action(async () => {
    await api('login', 'POST', { password: password.value })
    password.value = ''
    loggedIn.value = true
    await load()
  })
}
async function logout() {
  await action(async () => {
    await api('logout', 'POST', {})
    loggedIn.value = false
    resetForm()
    result.value.items = []
  })
}
function resetForm() {
  checkSequence++
  word.value = ''
  pinyin.value = ''
  originalWord.value = ''
  duplicateMessage.value = ''
  pendingDelete.value = ''
  checkPending.value = false
}
async function switchLibrary(next: string) {
  await action(async () => {
    type.value = next
    query.value = ''
    resetForm()
    await load()
  })
}
async function checkWord() {
  const sequence = ++checkSequence
  duplicateMessage.value = ''
  if ([...word.value.trim()].length !== 4)
    return
  checkPending.value = true
  try {
    const info = await api(`check?word=${encodeURIComponent(word.value.trim())}`)
    if (sequence !== checkSequence)
      return
    if (type.value === 'ordinary') {
      if (info.ordinary && info.word !== originalWord.value)
        duplicateMessage.value = `「${info.word}」已在普通库中，请使用编辑功能。`
      else
        duplicateMessage.value = info.daily ? '此词也在每日库中。普通库修改不改变每日答案及其读音。' : '可保存到普通库；加入扩展库后才会进入随机候选。'
      if (!pinyin.value && info.pinyin)
        pinyin.value = info.pinyin
    }
    else if (info.daily) {
      duplicateMessage.value = `「${info.word}」已在官方每日库中，不会添加到扩展库。`
    }
    else if (info.extra && info.word !== originalWord.value) {
      duplicateMessage.value = `「${info.word}」已在扩展库中，请使用编辑功能。`
    }
    else if (info.pinyin) {
      pinyin.value = info.pinyin
      duplicateMessage.value = '已采用官方普通成语库中的读音。此词可以加入扩展库。'
    }
    else {
      duplicateMessage.value = '官方每日库中没有此词，请填写并核对读音。'
    }
  }
  catch (cause) {
    if (sequence === checkSequence)
      error.value = String(cause instanceof Error ? cause.message : cause)
  }
  finally {
    if (sequence === checkSequence)
      checkPending.value = false
  }
}
watch(word, () => {
  checkSequence++
  duplicateMessage.value = ''
  checkPending.value = false
})
function edit(entry: Entry) {
  resetForm()
  originalWord.value = entry.word
  word.value = entry.word
  pinyin.value = entry.pinyin
  document.getElementById('extra-word')?.focus()
}
async function save() {
  await action(async () => {
    await api(type.value, originalWord.value ? 'PUT' : 'POST', { word: word.value, pinyin: pinyin.value, originalWord: originalWord.value, revision: result.value.revision })
    resetForm()
    await load(result.value.page)
    notice.value = `${libraryNames[type.value]}已保存，刷新游戏后生效。`
  })
}
async function remove() {
  await action(async () => {
    await api(type.value, 'DELETE', { originalWord: pendingDelete.value, revision: result.value.revision })
    resetForm()
    await load(result.value.page)
    notice.value = '词条已删除。'
  })
}
async function toggleExtra(entry: Entry) {
  await action(async () => {
    await api('membership', 'PUT', { word: entry.word, selected: !entry.extra, revision: result.value.revision })
    await load(result.value.page)
    notice.value = `「${entry.word}」${entry.extra ? '已从扩展库移除' : '已添加至扩展库'}。刷新游戏后生效。`
  })
}
async function changePassword() {
  await action(async () => {
    if (newPassword.value !== confirmPassword.value)
      throw new Error('两次输入的新密码不一致。')
    await api('password', 'POST', { currentPassword: currentPassword.value, newPassword: newPassword.value })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    loggedIn.value = false
    notice.value = '密码已修改，请使用新密码登录。'
  })
}
onMounted(async () => {
  document.title = 'Handle_Endless · 词库管理'
  try {
    await api('session')
    loggedIn.value = true
    await load()
  }
  catch (cause) {
    if (loggedIn.value)
      error.value = cause instanceof Error ? cause.message : '无法读取词库。'
  }
  finally { checking.value = false }
})
</script>

<template>
  <main class="admin-page">
    <header class="admin-header">
      <a href="/" class="admin-brand">HANDLE_ENDLESS <span>词库管理</span></a><div>
        <a href="/">返回游戏</a><button v-if="loggedIn" :disabled="busy" @click="logout">
          退出登录
        </button>
      </div>
    </header>
    <div v-if="checking" class="admin-login">
      正在检查登录状态…
    </div>
    <section v-else-if="!loggedIn" class="admin-login admin-card">
      <div class="admin-eyebrow">
        管理员入口
      </div><h1>管理你的成语库</h1>
      <p>输入管理密码，查看每日库，维护普通成语库和扩展库。</p>
      <form @submit.prevent="login">
        <label for="admin-password">管理密码</label><input id="admin-password" v-model="password" type="password" autocomplete="current-password" required autofocus><button class="admin-primary" type="submit" :disabled="busy">
          {{ busy ? '正在登录…' : '登录管理页面' }}
        </button>
      </form>
      <p v-if="error" role="alert" class="admin-error">
        {{ error }}
      </p><p v-if="notice" role="status" class="admin-success">
        {{ notice }}
      </p>
    </section>
    <section v-else class="admin-content">
      <div class="admin-intro">
        <div class="admin-eyebrow">
          词库维护
        </div><h1>查看词库，管理随机题目</h1><p>每日题目沿用官方答案表。随机题目从官方每日库与扩展库的合集中抽取。</p>
      </div>
      <div class="library-tabs">
        <button v-for="label, key in libraryNames" :key="key" :class="{ active: type === key }" :disabled="busy" @click="switchLibrary(String(key))">
          <span>{{ label }}</span><strong>{{ result.counts[key]?.toLocaleString() || 0 }}</strong><small>{{ key === 'daily' ? '只读，保留官方数据' : '可添加、编辑、删除' }}</small>
        </button>
      </div>
      <p v-if="error" role="alert" class="admin-error admin-banner">
        {{ error }}
      </p><p v-if="notice" role="status" class="admin-success admin-banner">
        {{ notice }}
      </p>
      <section v-if="type !== 'daily'" class="admin-card editor-card">
        <div class="section-title">
          <h2>{{ originalWord ? `编辑「${originalWord}」` : type === 'ordinary' ? '添加普通成语' : '添加扩展成语' }}</h2><button v-if="originalWord" type="button" @click="resetForm">
            取消编辑
          </button>
        </div>
        <form class="entry-form" @submit.prevent="save">
          <div><label for="extra-word">四字成语</label><input id="extra-word" v-model="word" placeholder="输入成语，自动检查重复" maxlength="4" required @blur="checkWord"></div><div><label for="extra-pinyin">拼音与声调</label><input id="extra-pinyin" v-model="pinyin" placeholder="chun1 he2 jing3 ming2" autocomplete="off"></div><button type="submit" class="admin-primary" :disabled="busy">
            {{ busy ? '正在保存…' : originalWord ? '保存修改' : '添加成语' }}
          </button>
        </form>
        <p v-if="checkPending" class="admin-help">
          正在检查官方词库…
        </p><p v-else-if="duplicateMessage" role="status" class="admin-help">
          {{ duplicateMessage }}
        </p>
        <p v-if="type === 'extra'" class="admin-help">
          与官方每日库重复的词条会被拒绝。普通库已有的词可以添加，读音自动采用当前普通库数据；其他词条请填写四个拼音，声调用 1 至 5，ü 用 v。
        </p>
        <p v-if="type === 'ordinary'" class="admin-help">
          已选入扩展库的词，修改后会同步更新扩展库。每日库重合词在游戏中始终保留官方读音，确保每日题目一致。
        </p>
      </section>
      <section class="admin-card library-table-card">
        <div class="section-title">
          <h2>{{ libraryNames[type] }}</h2><span class="read-only-badge">{{ type === 'daily' ? '只读' : '可编辑 · 保存到 NAS' }}</span>
        </div>
        <p v-if="type === 'daily'" class="admin-help">
          展示官方原始每日答案表。后续日期按官方算法从此表抽取，修改扩展库不会改变每日题目。
        </p>
        <p v-if="type === 'ordinary'" class="admin-help">
          用于严格模式的输入校验及拼音处理。勾选即加入扩展库，取消即移除。标注“每日库已有”的词已在随机候选中，无需重复添加。
        </p>
        <form class="library-search" @submit.prevent="action(() => load())">
          <input v-model="query" aria-label="搜索词库" placeholder="搜索成语、拼音或日期"><button type="submit" :disabled="busy">
            搜索
          </button><button type="button" :disabled="busy" @click="action(() => load(result.page))">
            刷新列表
          </button>
        </form>
        <div v-if="type === 'ordinary'" class="page-size-control">
          <label for="ordinary-page-size">每页显示</label>
          <select id="ordinary-page-size" v-model.number="ordinaryPageSize" :disabled="busy" @change="action(() => load())">
            <option v-for="size in pageSizes" :key="size" :value="size">
              {{ size }} 个成语
            </option>
          </select>
          <span>共 {{ result.total.toLocaleString() }} 条 · 第 {{ result.page }} / {{ result.pages }} 页</span>
        </div>
        <div v-if="pendingDelete" role="alert" class="delete-confirm">
          <span>确认从{{ libraryNames[type] }}删除「{{ pendingDelete }}」？{{ type === 'ordinary' ? '扩展库和每日库中已有的词将保留。' : '' }}</span><button :disabled="busy" @click="remove">
            确认删除
          </button><button @click="pendingDelete = ''">
            取消
          </button>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th v-if="type === 'daily'">
                  原始日期
                </th><th>成语</th><th>拼音</th><th v-if="type === 'ordinary'">
                  扩展库
                </th><th v-if="type !== 'daily'">
                  操作
                </th>
              </tr>
            </thead><tbody>
              <tr v-for="entry in result.items" :key="entry.day || entry.word">
                <td v-if="type === 'daily'">
                  {{ entry.date }}
                </td><td class="idiom-word">
                  {{ entry.word }}<span v-if="type === 'ordinary' && entry.daily" class="daily-badge">每日库已有</span>
                </td><td>{{ entry.pinyin }}</td><td v-if="type === 'ordinary'">
                  <button class="extra-toggle" role="checkbox" :aria-checked="!!entry.extra" :aria-label="`${entry.word} 添加至扩展库`" :disabled="busy || entry.daily" :title="entry.daily ? '已在每日库中，不重复添加到扩展库' : ''" @click="toggleExtra(entry)">
                    <span aria-hidden="true">{{ entry.extra ? '☑' : '☐' }}</span>{{ entry.extra ? '已添加至扩展库' : '添加至扩展库' }}
                  </button>
                </td><td v-if="type !== 'daily'" class="row-actions">
                  <button :disabled="busy" @click="edit(entry)">
                    编辑
                  </button><button :disabled="busy" @click="pendingDelete = entry.word">
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!result.items.length" class="library-empty">
          {{ query ? '没有找到匹配的词条。' : '词库还是空的，从上方添加第一个成语。' }}
        </div>
        <div class="library-pagination">
          <span>共 {{ result.total.toLocaleString() }} 条 · 第 {{ result.page }} / {{ result.pages }} 页</span><div>
            <button :disabled="busy || result.page <= 1" @click="action(() => load(result.page - 1))">
              上一页
            </button><button :disabled="busy || result.page >= result.pages" @click="action(() => load(result.page + 1))">
              下一页
            </button>
          </div>
        </div>
      </section>
      <details class="admin-card password-card">
        <summary>修改管理密码</summary><form @submit.prevent="changePassword">
          <label for="current-password">当前密码</label><input id="current-password" v-model="currentPassword" type="password" autocomplete="current-password" required><label for="new-password">新密码</label><input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required><label for="confirm-password">再次输入新密码</label><input id="confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required><button class="admin-primary" type="submit" :disabled="busy">
            更新密码并重新登录
          </button>
        </form>
      </details>
    </section>
    <footer class="admin-footer">
      Handle_Endless · 词库修改在刷新游戏后生效，已打开的题目保持原有状态。每日答案表保持不变。
    </footer>
  </main>
</template>

<style>
.admin-page { min-height: 100vh; background: #f3f6f5; color: #263e42; font-family: system-ui, sans-serif; }
.admin-header { height: 76px; padding: 0 max(24px, calc((100vw - 1080px) / 2)); display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #e0e8e5; gap: 20px; }
.admin-brand { font-size: 13px; font-weight: 700; letter-spacing: 1px; }.admin-brand span { font-weight: 400; margin-left: 12px; color: #7d9090; }
.admin-header > div { display: flex; gap: 20px; font-size: 13px; }.admin-header button, .admin-header a:hover { color: #0d828e; }
.admin-content { max-width: 1080px; padding: 40px 24px 20px; margin: auto; }.admin-eyebrow { color: #0d828e; font-size: 12px; letter-spacing: 2px; margin-bottom: 12px; }
.admin-page h1 { font-size: 28px; font-weight: 650; letter-spacing: .5px; margin-bottom: 12px; }.admin-page h2 { font-size: 17px; font-weight: 600; }.admin-intro > p { color: #6d8080; font-size: 14px; line-height: 1.8; }
.admin-card { background: #fff; border: 1px solid #dfe8e5; border-radius: 12px; padding: 24px; }.admin-login { max-width: 440px; margin: 80px auto; padding: 36px; }.admin-login > p { font-size: 14px; line-height: 1.8; color: #718282; margin: 12px 0 24px; }
.admin-page label { display: block; margin: 14px 0 8px; font-size: 13px; }.admin-page input { width: 100%; min-width: 0; padding: 11px 12px; border: 1px solid #c9d8d4; border-radius: 6px; background: #fff; color: #263e42; font-size: 14px; }
.admin-primary { background: #0d828e; color: #fff; padding: 11px 20px; border-radius: 6px; white-space: nowrap; font-size: 14px; }.admin-login .admin-primary, .password-card .admin-primary { margin-top: 20px; width: 100%; }
.library-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 30px 0 24px; }.library-tabs button { text-align: left; background: #fff; border: 1px solid #dfe8e5; border-radius: 10px; padding: 20px; }.library-tabs .active { border-color: #0d828e; box-shadow: inset 0 0 0 1px #0d828e; background: #f1faf8; }.library-tabs span, .library-tabs strong, .library-tabs small { display: block; }.library-tabs span { font-size: 14px; }.library-tabs strong { font-size: 28px; margin: 8px 0; }.library-tabs small { color: #768b89; font-size: 12px; }
.section-title { display: flex; justify-content: space-between; align-items: center; gap: 12px; }.section-title button { color: #0d828e; font-size: 13px; }.read-only-badge { font-size: 12px; color: #6e8380; background: #f0f5f3; padding: 4px 9px; border-radius: 4px; }.admin-help { color: #748783; font-size: 12px; line-height: 1.8; margin-top: 12px; }
.entry-form { display: grid; grid-template-columns: 1fr 1.5fr auto; gap: 14px; align-items: end; }.editor-card { margin-bottom: 20px; }.library-search { display: flex; gap: 10px; margin: 22px 0; }.library-search input { max-width: 400px; }.library-search button, .library-pagination button { white-space: nowrap; border: 1px solid #ccdcd7; border-radius: 6px; padding: 8px 12px; font-size: 13px; }
.page-size-control { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 0 0 18px; font-size: 13px; }.page-size-control label { margin: 0; }.page-size-control select { border: 1px solid #c9d8d4; border-radius: 6px; padding: 8px 12px; background: #fff; color: #263e42; }.page-size-control > span { color: #748783; font-size: 12px; }
.table-scroll { overflow-x: auto; }.admin-page table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }.admin-page th { font-weight: 500; font-size: 12px; color: #789089; background: #f5f8f6; }.admin-page td, .admin-page th { padding: 14px; border-bottom: 1px solid #e9efec; white-space: nowrap; }.idiom-word { font-weight: 600; letter-spacing: 2px; }.row-actions button { color: #0d828e; margin-right: 16px; font-size: 13px; }.row-actions button:last-child { color: #a34a3e; }
.daily-badge { display: block; width: fit-content; margin-top: 6px; padding: 2px 6px; border-radius: 4px; background: #edf4ee; color: #577b57; font-size: 10px; font-weight: 400; letter-spacing: 0; }.extra-toggle { display: inline-flex; align-items: center; gap: 7px; color: #59716b; font-size: 12px; }.extra-toggle span { font-size: 20px; }.extra-toggle[aria-checked="true"] { color: #0d828e; }
.library-pagination { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 20px; font-size: 12px; color: #748783; }.library-pagination > div { display: flex; gap: 8px; }.library-empty { padding: 50px 12px; text-align: center; color: #748783; font-size: 14px; }.admin-page button:disabled { opacity: .4; cursor: not-allowed; }
.admin-error { color: #a23d2c !important; }.admin-success { color: #167d64 !important; }.admin-banner { background: #fff; border: 1px solid #dfe8e5; padding: 14px 20px; border-radius: 8px; margin: 18px 0; font-size: 14px; }.delete-confirm { background: #fff5ee; padding: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 18px; font-size: 13px; }.delete-confirm button { color: #a23d2c; text-decoration: underline; }
.password-card { margin-top: 24px; font-size: 14px; }.password-card form { max-width: 380px; }.password-card summary { cursor: pointer; }.admin-footer { text-align: center; color: #91a09b; font-size: 12px; padding: 30px 24px; line-height: 1.8; }
@media (max-width: 640px) { .admin-header { padding: 0 16px; height: 66px; }.admin-brand span { display: none; }.admin-content { padding: 28px 16px; }.admin-page h1 { font-size: 23px; }.admin-login { margin: 36px 16px; padding: 24px; }.library-tabs { gap: 8px; }.library-tabs button { padding: 13px 9px; }.library-tabs strong { font-size: 24px; }.library-tabs span { font-size: 12px; }.library-tabs small { font-size: 10px; }.admin-card { padding: 18px; }.entry-form { grid-template-columns: 1fr; gap: 4px; }.entry-form .admin-primary { margin-top: 12px; }.library-search { flex-wrap: wrap; }.library-search input { max-width: none; }.library-pagination { flex-wrap: wrap; } }
</style>
