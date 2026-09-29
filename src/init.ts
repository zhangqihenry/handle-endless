import { initialized, markEnd, markStart, meta, pauseTimer } from './storage'
import { isFinished, isPassed, puzzleLabel, showCheatSheet, showHelp } from './state'

useTitle(computed(() => `Handle_Endless · ${puzzleLabel.value}`))
if (!initialized.value)
  showHelp.value = true
watchEffect(() => {
  if (isPassed.value)
    meta.value.passed = true
})
watch([isFinished, meta], () => {
  if (isFinished.value)
    markEnd()
}, { flush: 'post' })
watch(isFinished, (value) => {
  if (value)
    showCheatSheet.value = false
}, { flush: 'post' })
const visible = useDocumentVisibility()
watch(visible, (value) => {
  if (value === 'hidden')
    pauseTimer()
  else if (meta.value.duration)
    markStart()
})
window.addEventListener('pagehide', pauseTimer)
