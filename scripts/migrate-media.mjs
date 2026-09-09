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
  const existing = await fs.readFile(manifestPath,'utf8').then(JSON.parse).catch(error=>{
    if(error.code==='ENOENT') return undefined
    throw error
  })
  if(existing?.enabled) throw new Error('Media is already remote. Do not replace the catalog with a local-only inventory; preserve existing mappings when adding assets.')
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
    await Promise.all(Array.from({length:12},async()=>{
      while(index<unique.length) {
        const info=unique[index++]
        for(let attempt=0;attempt<3;attempt++) try {
          const response=await fetch(`${manifest.baseUrl}/${info.object}`, {signal:AbortSignal.timeout(30000)})
          if(!response.ok) throw new Error(String(response.status))
          const bytes=Buffer.from(await response.arrayBuffer())
          if(bytes.length!==info.bytes || sha(bytes)!==info.sha256) throw new Error('checksum mismatch')
          done++
          if(done%100===0) console.log(`Verified ${done}/${unique.length}`)
          break
        } catch {
          if(attempt===2) failures.push(info.object)
        }
      }
    }))
    await fs.writeFile(path.join(work,'failed-objects.json'),JSON.stringify(failures,null,2)+'\n')
    if(failures.length) throw new Error(`${failures.length} objects failed verification; see .migration/failed-objects.json. Cutover remains disabled.`)
    await fs.writeFile(path.join(work,'verified.json'),JSON.stringify({manifestHash:sha(await fs.readFile(manifestPath)),objects:done,at:new Date().toISOString()}))
    console.log(`Verified all ${done} remote object checksums.`)
  } else if (mode === 'cutover') {
    const verified=JSON.parse(await fs.readFile(path.join(work,'verified.json'),'utf8'))
    if(verified.manifestHash!==sha(await fs.readFile(manifestPath)) || verified.objects!==unique.length) throw new Error('Verify this exact manifest before cutover.')
    manifest.enabled=true
    await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n')
    console.log('Remote media enabled. Validate the app before removing backed-up binaries from Git.')
  } else if (mode === 'prune') {
    if (!manifest.enabled) throw new Error('Enable verified remote media before pruning.')
    const verified=JSON.parse(await fs.readFile(path.join(work,'verified.json'),'utf8'))
    const original=JSON.stringify({...manifest,enabled:false},null,2)+'\n'
    if(verified.manifestHash!==sha(original) || verified.objects!==unique.length) throw new Error('Verification does not match this manifest.')
    // Keep the install icon available before JavaScript and for web-app manifests.
    const paths=Object.keys(manifest.files).filter(file=>file!=='assets/mascots/mascot-reading.png')
    for(const file of paths) {
      const info=manifest.files[file]
      if(file.includes('..') || path.isAbsolute(file)) throw new Error('Unsafe asset path')
      if(sha(await fs.readFile(path.join(work,'upload',info.object)))!==info.sha256) throw new Error('Backup mismatch: '+file)
      if(sha(await fs.readFile(path.join(root,'public',file)))!==info.sha256) throw new Error('Local media changed: '+file)
    }
    const pathList=path.join(work,'media-paths.txt')
    await fs.writeFile(pathList,paths.map(file=>'public/'+file).join('\0')+'\0')
    execFileSync('git',['rm','--quiet','--pathspec-from-file='+pathList,'--pathspec-file-nul'],{stdio:'inherit'})
    console.log(`Removed ${paths.length} backed-up media files; retained the app install icon.`)
  } else throw new Error('Use prepare, stage, upload, verify, cutover, or prune')
}
