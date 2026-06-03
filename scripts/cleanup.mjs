import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

async function cleanupApp() {
  const appPath = path.join(root, 'src', 'App.tsx')
  let content = await fs.readFile(appPath, 'utf8')

  content = content.replace("import { HundredLessonsHome, HundredLessonScreen } from './HundredLessons'\n", "")
  content = content.replace("import { getNewlyUnlockedRewards } from './rewards'\n", "")
  content = content.replace(/  const \[growingView, setGrowingView\] = useState<GrowingReaderView>\('home'\)\n/g, "")
  content = content.replace(/  const \[showStickers, setShowStickers\] = useState\(false\)\n/g, "")
  content = content.replace(/  const \[hundredLessonId, setHundredLessonId\] = useState\(''\)\n/g, "")
  content = content.replace(/setHundredLessonId\(''\)/g, "/* setHundredLessonId('') */")
  content = content.replace(/setGrowingView\('home'\)/g, "/* setGrowingView('home') */")

  await fs.writeFile(appPath, content)
  console.log('App.tsx cleaned up unused vars')
}

cleanupApp().catch(console.error)
