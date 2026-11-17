// Run against a local Vite server; uses an isolated guest profile, never real progress.
import assert from 'node:assert/strict'
import fs from 'node:fs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH })
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/chunkyreader/'
const results = []
const output = process.env.TEST_OUTPUT || '/tmp/mangmi-audit'
fs.mkdirSync(output, { recursive: true })
for (const [width, height] of [[1280,960],[640,480],[640,400]]) {
 const page = await browser.newPage({ viewport: { width, height } })
 await page.addInitScript(() => {
  localStorage.setItem('chunky-reader:account:v2:guest:shared:chunkyLearnerSettings.v1', JSON.stringify({ mangmiAirY: true }))
  window.testPad = []
  navigator.getGamepads = () => [{ mapping: 'standard', buttons: Array.from({length:16}, (_,i)=>({pressed:window.testPad.includes(i)})), axes:[0,0] }]
  document.hasFocus = () => true
 })
 async function home() { await page.goto(base); await page.getByRole('button').filter({hasText:'Parent Settings'}).waitFor(); await click('Parent Settings'); const toggle=page.getByRole('checkbox',{name:/Mangmi Air Y/}); await toggle.check(); await page.getByRole('button',{name:'Close',exact:true}).click(); assert(await page.locator('body').evaluate(el=>el.classList.contains('mangmi-air-y'))) }
 async function click(text) { await page.getByRole('button').filter({hasText:text}).first().click(); await page.waitForTimeout(150) }
 async function audit(name) {
  await page.waitForTimeout(120)
  const measurement = await page.evaluate(() => {
   const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
   const scope = [...document.querySelectorAll('.modal-overlay,[role="dialog"]')].filter(visible).at(-1) || document
   const bad = []
   for (const el of scope.querySelectorAll('button,input,select,a[href]')) {
    if (!visible(el)) continue
    el.scrollIntoView({block:'nearest',inline:'nearest'})
    const r=el.getBoundingClientRect()
    if (r.left < -1 || r.right > innerWidth+1 || r.top < -1 || r.bottom > innerHeight+1) bad.push((el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0,65))
   }
   window.scrollTo(0,0)
   return { horizontal:document.documentElement.scrollWidth > innerWidth+1, unreachable:bad }
  })
  results.push({width,height,name,...measurement})
  await page.screenshot({path:output+'/'+width+'x'+height+'-'+name+'.png'})
 }
 await home(); await audit('home')
 for (const section of ['Letters & Sounds','WordsGrowing','StoriesGrowing','MathNumber','ChineseChunky','Phonics Patterns','Flashcards','Panda’s Room','Parent Settings']) {
  await home(); await click(section); await audit(section.replaceAll(/[^a-zA-Z]/g,''))
  if(section==='Letters & Sounds') {
   for(const kind of ['Play with letters','Play with sounds']){
    await home();await click(section);await click(kind);await audit(kind.replaceAll(' ','-'))
    for(let i=0;i<8;i++){
     const btn=page.locator('.focus-lesson .focus-actions button,.focus-lesson .focus-option').filter({visible:true}).last()
     if(!await btn.count()) break
     if(await btn.isDisabled()) break
     await btn.click();await audit(kind.replaceAll(' ','-')+'-'+i)
    }
   }
  }
  if(section==='WordsGrowing') {
   for(let i=0;i<26;i++){
    const btn=page.locator('.choice-action:enabled').last()
    if(!await btn.count())break
    await btn.click();await audit('words-step-'+i)
    if(await page.getByText('Read independently',{exact:true}).count())break
   }
  }
  if(section==='ChineseChunky'){
   await click('Show Answer'); await audit('chinese-answer')
  }
  if(section==='MathNumber'){
   for(const range of ['10','15','20']){
    await page.getByRole('button',{name:'Numbers up to '+range,exact:true}).click();await audit('math-'+range)
   }
  }
  if(section==='StoriesGrowing'){
   await click('Anne and the Red Hat');await audit('story-reader')
   await home();await click(section);await click('The Box Boat');await audit('adventure-gate')
   await click('Accept & play')
   for(let i=0;i<28;i++){
    await audit('adventure-step-'+i)
    const next=page.getByRole('button').filter({hasText:/^(Skip to words|Into the story|Next word|Next →)/}).first()
    if(await next.count()) {await next.click();continue}
    const choice=page.locator('.adventure-choices button').first()
    if(await choice.count()){await choice.click();continue}
    break
   }
  }
  if(section==='Panda’s Room')for(const tab of ['Boxes','Collection','Room']){await page.getByRole('button',{name:tab,exact:true}).click();await audit('panda-'+tab)}
 }
 // Verify actual capture handlers and gamepad polling, without advancing app progress.
 await home();await click('MathNumber')
 await page.evaluate(()=>{
  window.choiceClicks=[]
  const section=document.querySelector('.focus-lesson')
  section.innerHTML='<div class="focus-options">'+[0,1,2,3].map(i=>'<button class="focus-option" data-test-choice="'+i+'">Choice '+(i+1)+'</button>').join('')+'</div>'
  section.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>window.choiceClicks.push(i))
 })
 for(const key of ['x','y','a','b','1','2','3','4'])await page.keyboard.press(key)
 for(const button of [2,3,0,1]){await page.evaluate(i=>window.testPad=[i],button);await page.waitForTimeout(520);await page.evaluate(()=>window.testPad=[]);await page.waitForTimeout(60)}
 assert.deepEqual(await page.evaluate(()=>window.choiceClicks),[0,1,2,3,0,1,2,3,0,1,2,3])
 await page.close()
}
await browser.close()
fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2))
const failures=results.filter(r=>r.horizontal||r.unreachable.length)
console.log(JSON.stringify({screens:results.length,failures},null,2))
assert.equal(failures.length,0,'Some screens have unreachable controls or horizontal overflow')
