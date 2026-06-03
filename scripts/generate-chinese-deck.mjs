import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TTS_VOICE_VERSIONS } from './tts-config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const CHARACTERS = [
  ['一', 'yi1', 'one'],
  ['二', 'er4', 'two'],
  ['三', 'san1', 'three'],
  ['四', 'si4', 'four'],
  ['五', 'wu3', 'five'],
  ['六', 'liu4', 'six'],
  ['七', 'qi1', 'seven'],
  ['八', 'ba1', 'eight'],
  ['九', 'jiu3', 'nine'],
  ['十', 'shi2', 'ten'],
  ['人', 'ren2', 'person'],
  ['口', 'kou3', 'mouth'],
  ['手', 'shou3', 'hand'],
  ['目', 'mu4', 'eye'],
  ['耳', 'er3', 'ear'],
  ['大', 'da4', 'big'],
  ['小', 'xiao3', 'small'],
  ['上', 'shang4', 'up'],
  ['下', 'xia4', 'down'],
  ['中', 'zhong1', 'middle'],
  ['日', 'ri4', 'sun'],
  ['月', 'yue4', 'moon'],
  ['山', 'shan1', 'mountain'],
  ['水', 'shui3', 'water'],
  ['火', 'huo3', 'fire'],
  ['木', 'mu4', 'tree'],
  ['土', 'tu3', 'earth'],
  ['田', 'tian2', 'field'],
  ['天', 'tian1', 'sky'],
  ['地', 'di4', 'ground'],
  ['云', 'yun2', 'cloud'],
  ['雨', 'yu3', 'rain'],
  ['风', 'feng1', 'wind'],
  ['花', 'hua1', 'flower'],
  ['草', 'cao3', 'grass'],
  ['石', 'shi2', 'stone'],
  ['竹', 'zhu2', 'bamboo'],
  ['林', 'lin2', 'woods'],
  ['森', 'sen1', 'forest'],
  ['王', 'wang2', 'king'],
  ['女', 'nv3', 'girl'],
  ['男', 'nan2', 'boy'],
  ['子', 'zi3', 'child'],
  ['父', 'fu4', 'father'],
  ['母', 'mu3', 'mother'],
  ['儿', 'er2', 'child'],
  ['友', 'you3', 'friend'],
  ['我', 'wo3', 'me'],
  ['你', 'ni3', 'you'],
  ['他', 'ta1', 'he'],
  ['她', 'ta1', 'she'],
  ['好', 'hao3', 'good'],
  ['爱', 'ai4', 'love'],
  ['笑', 'xiao4', 'smile'],
  ['哭', 'ku1', 'cry'],
  ['吃', 'chi1', 'eat'],
  ['喝', 'he1', 'drink'],
  ['看', 'kan4', 'look'],
  ['听', 'ting1', 'listen'],
  ['说', 'shuo1', 'speak'],
  ['来', 'lai2', 'come'],
  ['去', 'qu4', 'go'],
  ['坐', 'zuo4', 'sit'],
  ['走', 'zou3', 'walk'],
  ['跑', 'pao3', 'run'],
  ['飞', 'fei1', 'fly'],
  ['开', 'kai1', 'open'],
  ['关', 'guan1', 'close'],
  ['门', 'men2', 'door'],
  ['车', 'che1', 'car'],
  ['船', 'chuan2', 'boat'],
  ['书', 'shu1', 'book'],
  ['笔', 'bi3', 'pen'],
  ['包', 'bao1', 'bag'],
  ['家', 'jia1', 'home'],
  ['学', 'xue2', 'learn'],
  ['校', 'xiao4', 'school'],
  ['猫', 'mao1', 'cat'],
  ['狗', 'gou3', 'dog'],
  ['鸟', 'niao3', 'bird'],
  ['鱼', 'yu2', 'fish'],
  ['马', 'ma3', 'horse'],
  ['牛', 'niu2', 'cow'],
  ['羊', 'yang2', 'sheep'],
  ['虫', 'chong2', 'bug'],
  ['米', 'mi3', 'rice'],
  ['面', 'mian4', 'noodles'],
  ['果', 'guo3', 'fruit'],
  ['菜', 'cai4', 'vegetables'],
  ['蛋', 'dan4', 'egg'],
  ['奶', 'nai3', 'milk'],
  ['糖', 'tang2', 'candy'],
  ['红', 'hong2', 'red'],
  ['蓝', 'lan2', 'blue'],
  ['白', 'bai2', 'white'],
  ['黑', 'hei1', 'black'],
  ['多', 'duo1', 'many'],
  ['少', 'shao3', 'few'],
  ['早', 'zao3', 'morning'],
  ['晚', 'wan3', 'evening'],
]

function cardFor([character, pinyin, meaning], index) {
  return {
    id: `char-${character}`,
    type: 'chinese',
    displayText: character,
    pinyin,
    simpleMeaning: meaning,
    speechCue: `${character}. ${pinyin}. ${meaning}.`,
    audio: `audio/chinese-level-1/${TTS_VOICE_VERSIONS.chineseTeacher}/char-${character}.mp3`,
    lessonGroup: Math.floor(index / 5) + 1,
    difficulty: Math.floor(index / 20) + 1,
    category: 'simple characters',
  }
}

async function main() {
  if (CHARACTERS.length !== 100) {
    throw new Error(`Expected 100 Chinese characters, found ${CHARACTERS.length}.`)
  }

  const deck = {
    id: 'chinese-level-1',
    title: 'Chinese Starter Characters',
    description: 'Learn 100 very simple Chinese characters in tiny five-card lessons.',
    type: 'chinese-vocab',
    profile: 'library',
    accent: 'Mandarin Chinese, child-friendly',
    cards: CHARACTERS.map(cardFor),
  }

  const outPath = path.join(ROOT, 'public', 'decks', 'chinese-level-1.json')
  await fs.writeFile(outPath, `${JSON.stringify(deck, null, 2)}\n`, 'utf-8')
  console.log(`Generated ${deck.cards.length} Chinese characters to ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
