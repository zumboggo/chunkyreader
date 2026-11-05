// Optional browser verification: provide Playwright via PLAYWRIGHT_MODULE or install it locally.
import ts from 'typescript'
import { readFileSync } from 'node:fs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import assert from 'node:assert/strict'
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH})
const page = await browser.newPage()
await page.setContent(`<style>button{width:100px;height:60px;margin:10px} .modal-overlay{position:fixed;inset:0;background:white}</style><button id="home">Home</button><button id="lesson">Lesson</button><button disabled>Disabled</button><button hidden>Hidden</button><button id="settings">Settings</button><select id="select"><option>One</option><option>Two</option></select>`)
await page.evaluate(() => {
  window.clicks = 0
  window.padButtons = []
  navigator.getGamepads = () => [{mapping:'standard',buttons:Array.from({length:16},(_,i)=>({pressed:window.padButtons.includes(i)})),axes:[0,0]}]
  document.hasFocus = () => true
  document.querySelector('#lesson').onclick = () => window.clicks++
  document.querySelector('#settings').onclick = () => {
    const dialog=document.createElement('div'); dialog.className='modal-overlay'
    dialog.innerHTML='<button class="close-button">Close</button><button id="inside">Inside</button>'
    dialog.querySelector('button').onclick=()=>dialog.remove()
    document.body.append(dialog)
  }
})
const source = ts.transpile(readFileSync(new URL('../src/controllerNavigation.ts', import.meta.url), 'utf8'), { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 })
await page.addScriptTag({content: source.replace('export function', 'function') + '\ninstallControllerNavigation();'})
await page.keyboard.press('ArrowRight')
assert.equal(await page.evaluate(()=>document.activeElement.id),'lesson')
await page.keyboard.press('Enter')
assert.equal(await page.evaluate(()=>window.clicks),1)
await page.keyboard.press('Tab')
assert.equal(await page.evaluate(()=>document.activeElement.id),'settings')
await page.keyboard.press('Enter')
await page.waitForFunction(()=>document.activeElement.textContent==='Close')
assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Close')
await page.keyboard.press('Tab')
assert.equal(await page.evaluate(()=>document.activeElement.id),'inside')
await page.keyboard.press('Tab')
assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Close')
await page.keyboard.press('Escape')
await page.waitForTimeout(60)
assert.equal(await page.evaluate(()=>document.activeElement.id),'settings')
await page.keyboard.press('Tab')
await page.keyboard.press('ArrowDown')
assert.equal(await page.locator('select').inputValue(),'Two')
await page.locator('#lesson').focus()
await page.evaluate(()=>window.padButtons=[0])
await page.waitForTimeout(650)
assert.equal(await page.evaluate(()=>window.clicks),2,'holding A activates once')
await page.evaluate(()=>window.padButtons=[])
await page.waitForTimeout(50)
await page.evaluate(()=>window.padButtons=[0])
await page.waitForTimeout(50)
assert.equal(await page.evaluate(()=>window.clicks),3)
await page.evaluate(()=>{window.padButtons=[]; document.querySelector('#lesson').remove()})
await page.waitForTimeout(60)
assert.equal(await page.evaluate(()=>document.activeElement.id),'home','recover focus when screen control disappears')
await page.mouse.click(5,5)
assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('controller-navigation')),false)
await browser.close()
console.log('PASS: spatial movement, disabled/hidden controls, confirm, dialog containment/restoration, select adjustment, held/released gamepad A, removed focus, touch mode')
