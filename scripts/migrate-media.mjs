import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const work = path.join(root, '.migration')
const manifestPath = path.join(root, 'public/media-manifest.json')
const baseUrl = 'https://nvrofeaaewwdeefxtmqu.supabase.co/storage/v1/object/public/chunky-reader-media'
const media = /\.(png|jpe?g|webp|gif|svg|ico|mp3|wav|ogg|m4a|mp4|woff2?|ttf)$/i
const sha = data => crypto.createHash('sha256').update(data).digest('hex')
const mode = process.argv[2]
await fs.mkdir(work, { recursive:true, mode:0o700 })
if (mode === 'prepare') {
  const paths = execFileSync('git',['ls-files','-z','public'],{encoding:'utf8'}).split('\0').filter(p=>media.test(p))
  const files = {}
  for (const file of paths) {
    const data = await fs.readFile(path.join(root,file))
    const hash = sha(data)
    files[file.slice(7)] = {object:`v1/${hash}${path.extname(file).toLowerCase()}`,bytes:data.length,sha256:hash}
  }
  await fs.writeFile(manifestPath,JSON.stringify({enabled:false,baseUrl,files},null,2)+'\n')
  console.log(`Prepared ${paths.length} media references. Run stage, then authenticated upload, verify, and cutover.`)
} else {
  const manifest = JSON.parse(await fs.readFile(manifestPath,'utf8'))
  const unique = [...new Map(Object.entries(manifest.files).map(([file,info])=>[info.object,{file,...info}])).values()]
  if (mode === 'stage') {
    for (const info of unique) {
      const output = path.join(work,'upload',info.object)
      await fs.mkdir(path.dirname(output),{recursive:true})
      await fs.copyFile(path.join(root,'public',info.file),output)
      if (sha(await fs.readFile(output)) !== info.sha256) throw new Error('Staged checksum mismatch')
    }
    console.log(`Staged and backed up ${unique.length} unique objects in .migration/upload/v1`)
  } else if (mode === 'upload') {
    // Uses the user's authenticated Supabase CLI; never creates a public privileged endpoint.
    execFileSync('npx',['--yes','supabase','storage','cp','--recursive','--jobs','6','--cache-control','max-age=31536000',
      '--project-ref','nvrofeaaewwdeefxtmqu',path.join(work,'upload/v1'),'ss:///chunky-reader-media/v1'],{stdio:'inherit'})
  } else if (mode === 'verify') {
    let index=0, done=0
    const failures=[]
    await Promise.all(Array.from({length:6},async()=>{
      while(index<unique.length) {
        const info=unique[index++]
        try {
          const response=await fetch(`${manifest.baseUrl}/${info.object}`)
          if(!response.ok) throw new Error(String(response.status))
          const bytes=Buffer.from(await response.arrayBuffer())
          if(bytes.length!==info.bytes || sha(bytes)!==info.sha256) throw new Error('checksum mismatch')
          done++
          if(done%100===0) console.log(`Verified ${done}/${unique.length}`)
        } catch { failures.push(info.object) }
      }
    }))
    if(failures.length) throw new Error(`${failures.length} objects failed verification; cutover remains disabled.`)
    await fs.writeFile(path.join(work,'verified.json'),JSON.stringify({manifestHash:sha(await fs.readFile(manifestPath)),objects:done,at:new Date().toISOString()}))
    console.log(`Verified all ${done} remote object checksums.`)
  } else if (mode === 'cutover') {
    const verified=JSON.parse(await fs.readFile(path.join(work,'verified.json'),'utf8'))
    if(verified.manifestHash!==sha(await fs.readFile(manifestPath)) || verified.objects!==unique.length) throw new Error('Verify this exact manifest before cutover.')
    manifest.enabled=true
    await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n')
    console.log('Remote media enabled. Validate the app before removing backed-up binaries from Git.')
  } else throw new Error('Use prepare, stage, upload, verify, or cutover')
}
