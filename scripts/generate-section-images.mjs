import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Replicate from 'replicate'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// Dynamic import to support ts/js
let LEARNING_SECTIONS
try {
  // We can't import typescript directly in node without a loader, 
  // so we'll just read the file and extract the prompts manually if needed,
  // or define them here for simplicity.
  LEARNING_SECTIONS = [
    {
      id: 'letters',
      imagePrompt: 'A cute panda discovering big floating letter blocks in a sunny meadow, simple and beautiful, no actual readable letters if possible, focus on alphabet learning atmosphere. Original gentle children’s picture-book illustration, soft watercolor and gouache textures, warm lighting, cozy woodland storybook feeling, simple clear composition, polished app icon/tile quality, beautiful but uncluttered, no text, no letters, no watermark.'
    },
    {
      id: 'sounds',
      imagePrompt: 'A panda listening to musical sound waves, birds singing, gentle bells, and soft glowing speech bubbles, abstract sound-learning scene, no text. Original gentle children’s picture-book illustration, soft watercolor and gouache textures, warm lighting, cozy woodland storybook feeling, simple clear composition, polished app icon/tile quality, beautiful but uncluttered, no text, no letters, no watermark.'
    },
    {
      id: 'words',
      imagePrompt: 'A panda reading picture-word cards with simple objects like apple, cat, sun, tree, cozy learning table, no text. Original gentle children’s picture-book illustration, soft watercolor and gouache textures, warm lighting, cozy woodland storybook feeling, simple clear composition, polished app icon/tile quality, beautiful but uncluttered, no text, no letters, no watermark.'
    },
    {
      id: 'stories',
      imagePrompt: 'A panda opening a magical storybook with warm light, tiny story scenes rising from the pages, cozy reading nook, no text. Original gentle children’s picture-book illustration, soft watercolor and gouache textures, warm lighting, cozy woodland storybook feeling, simple clear composition, polished app icon/tile quality, beautiful but uncluttered, no text, no letters, no watermark.'
    },
    {
      id: 'math',
      imagePrompt: 'A panda counting apples and wooden number blocks, groups of objects, simple addition/subtraction feeling, no equations or text. Original gentle children’s picture-book illustration, soft watercolor and gouache textures, warm lighting, cozy woodland storybook feeling, simple clear composition, polished app icon/tile quality, beautiful but uncluttered, no text, no letters, no watermark.'
    },
    {
      id: 'chinese',
      imagePrompt: 'A panda looking at a beautiful brush, bamboo, lanterns, and simple character-card shapes, Chinese-learning atmosphere, no actual readable characters unless later overlaid by code. Original gentle children’s picture-book illustration, soft watercolor and gouache textures, warm lighting, cozy woodland storybook feeling, simple clear composition, polished app icon/tile quality, beautiful but uncluttered, no text, no letters, no watermark.'
    }
  ]
} catch (e) {
  console.error("Could not load sections", e)
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const isTest = process.argv.includes('--limit')

async function main() {
  if (!process.env.REPLICATE_API_TOKEN && !isDryRun) {
    console.error('Error: REPLICATE_API_TOKEN must be set')
    process.exit(1)
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN || 'dummy',
  })

  const outDir = path.join(root, 'public', 'assets', 'sections')
  await fs.mkdir(outDir, { recursive: true })

  let sectionsToProcess = LEARNING_SECTIONS
  if (isTest) {
    sectionsToProcess = [LEARNING_SECTIONS[0]]
  }

  for (const section of sectionsToProcess) {
    const outPath = path.join(outDir, `${section.id}.webp`)
    console.log(`Generating image for ${section.id}...`)

    if (isDryRun) {
      console.log(`[DRY RUN] Would prompt: ${section.imagePrompt}`)
      continue
    }

    try {
      const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: section.imagePrompt,
            output_format: "webp",
            output_quality: 90,
            aspect_ratio: "1:1"
          }
        }
      )

      if (output && output[0]) {
        const imageUrl = output[0]
        const response = await fetch(imageUrl)
        const buffer = await response.arrayBuffer()
        await fs.writeFile(outPath, Buffer.from(buffer))
        console.log(`Saved ${outPath}`)
      }
    } catch (e) {
      console.error(`Failed to generate ${section.id}:`, e)
    }
  }
}

main().catch(console.error)
