import fs from 'node:fs/promises';
import path from 'node:path';
import {
  TTS_OUTPUT_FORMAT,
  TTS_VOICE_VERSIONS,
  TTS_VOICES,
  createAzureSsml,
  escapeXml,
} from './tts-config.mjs';

const root = process.cwd();
const lessonsDir = path.join(root, 'public', '100-lessons');
const audioDir = path.join(lessonsDir, 'audio');
const azureConfigPath =
  process.env.AZURE_TTS_CONFIG_PATH ||
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'azure-tts-ssml', 'config.json');

const outputFormat = TTS_OUTPUT_FORMAT;
const synthesize = !process.argv.includes('--ssml-only');
const force = process.argv.includes('--force');

async function main() {
  const credentials = synthesize ? await loadCredentials() : null;
  
  if (!credentials) {
      console.log('Skipping synthesis due to missing credentials.');
  }

  const files = await fs.readdir(lessonsDir);
  const jsonFiles = files.filter(f => f.startsWith('lesson-') && f.endsWith('.json'));

  for (const file of jsonFiles) {
    const filePath = path.join(lessonsDir, file);
    const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
    let modified = false;

    for (let cIdx = 0; cIdx < content.chunks.length; cIdx++) {
      const chunk = content.chunks[cIdx];
      chunk.audioPaths = chunk.audioPaths || [];
      if (chunk.type === 'story-gauntlet') {
        chunk.wordAudioPaths = chunk.wordAudioPaths || [];
      }

      for (let iIdx = 0; iIdx < chunk.items.length; iIdx++) {
        const item = chunk.items[iIdx];
        const safeName = safeFileName(item);
        const fileName = `${content.id}_c${cIdx}_i${iIdx}_${safeName.substring(0, 20)}.mp3`;
        const relativeAudioPath = `audio/${fileName}`;
        const absoluteAudioPath = path.join(lessonsDir, relativeAudioPath);
        
        chunk.audioPaths[iIdx] = relativeAudioPath;
        modified = true;

        const voice = chunk.type === 'story' || chunk.type === 'story-gauntlet' ? TTS_VOICES.anneNarrator : TTS_VOICES.childInstructions;
        let body = escapeXml(item);
        if ((chunk.type === 'sounds-words' || chunk.type === 'sound-discovery') && item.length <= 3) {
            // spell it out or just say it
            body = escapeXml(item);
        }

        const ssml = createAzureSsml({
          language: 'en-US',
          voice,
          rate: '-8%',
          pitch: '+2%',
          body,
        });

        if (synthesize && credentials) {
          await fs.mkdir(path.dirname(absoluteAudioPath), { recursive: true });
          if (force || !(await exists(absoluteAudioPath))) {
            console.log(`Generating audio for: ${item}`);
            await synthesizeClip(credentials, ssml, absoluteAudioPath);
          }
        }

        // Generate word-level audio for story-gauntlet
        if (chunk.type === 'story-gauntlet') {
          const words = item.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9']/g, '')).filter(Boolean);
          chunk.wordAudioPaths[iIdx] = chunk.wordAudioPaths[iIdx] || [];
          
          for (let wIdx = 0; wIdx < words.length; wIdx++) {
            const word = words[wIdx];
            const safeWord = safeFileName(word);
            const wordFileName = `${content.id}_c${cIdx}_i${iIdx}_w${wIdx}_${safeWord.substring(0, 20)}.mp3`;
            const wordRelativeAudioPath = `audio/${wordFileName}`;
            const wordAbsoluteAudioPath = path.join(lessonsDir, wordRelativeAudioPath);
            
            chunk.wordAudioPaths[iIdx][wIdx] = wordRelativeAudioPath;

            const wordSsml = createAzureSsml({
              language: 'en-US',
              voice,
              rate: '-8%',
              pitch: '+2%',
              body: escapeXml(word),
            });

            if (synthesize && credentials) {
              if (force || !(await exists(wordAbsoluteAudioPath))) {
                console.log(`Generating word audio for: ${word}`);
                await synthesizeClip(credentials, wordSsml, wordAbsoluteAudioPath);
              }
            }
          }
        }
      }
    }

    if (modified) {
      await fs.writeFile(filePath, JSON.stringify(content, null, 2));
    }
  }
}

async function loadCredentials() {
  const fromEnv = {
    key: process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION,
  };
  if (fromEnv.key && fromEnv.region) return fromEnv;

  try {
    const configText = (await fs.readFile(azureConfigPath, 'utf8')).replace(/^\uFEFF/u, '');
    const config = JSON.parse(configText);
    const key = config.SubscriptionKey || config.subscriptionKey || config.key || config.speechKey;
    const region = config.ServiceRegion || config.serviceRegion || config.region || config.speechRegion;
    if (key && region) return { key, region };
  } catch {
    // ignore
  }

  return null;
}

async function synthesizeClip(credentials, ssml, outputPath) {
  const response = await fetch(`https://${credentials.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': credentials.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': outputFormat,
      'User-Agent': 'chunky-reader-audio-generator',
    },
    body: ssml,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`Azure TTS failed with ${response.status}: ${detail.slice(0, 160)}`);
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeFileName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
