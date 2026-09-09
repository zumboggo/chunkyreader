import fs from 'node:fs'
import crypto from 'node:crypto'
const manifest = JSON.parse(fs.readFileSync('public/media-manifest.json','utf8'))
let checked = 0
for (const [file, info] of Object.entries(manifest.files)) {
  if (!/^v1\/[a-f0-9]{64}\.[a-z0-9]+$/.test(info.object)) throw new Error('Invalid media object path')
  const local = 'public/' + file
  if (fs.existsSync(local)) {
    const data = fs.readFileSync(local)
    if (data.length !== info.bytes || crypto.createHash('sha256').update(data).digest('hex') !== info.sha256) throw new Error('Media changed: ' + file)
  } else if (!manifest.enabled) throw new Error('Missing local media before cutover: ' + file)
  checked++
}
console.log(`Verified ${checked} media references; remote cutover ${manifest.enabled ? 'enabled' : 'pending'}.`)
