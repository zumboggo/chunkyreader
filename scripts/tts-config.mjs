// Central Azure TTS voice choices for Chunky Reader.
// Change voices here, then rerun `npm run generate:audio -- --force`.
export const TTS_VOICES = {
  anneNarrator: 'en-US-JennyNeural',
  childInstructions: 'en-US-AvaNeural',
  phonicsTeacher: 'en-US-JennyNeural',
}

export const TTS_VOICE_VERSIONS = {
  anneNarrator: 'anne-soft-female-v2',
  childInstructions: 'child-instructions-v1',
  phonicsTeacher: 'phonics-sounds-v2',
}

export const TTS_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

export function createAzureSsml({
  language = 'en-US',
  voice,
  rate = '-8%',
  pitch = '+2%',
  body,
}) {
  return `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xml:lang="${escapeXml(language)}" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="${escapeXml(voice)}">
    <prosody rate="${escapeXml(rate)}" pitch="${escapeXml(pitch)}">
      ${body}
    </prosody>
  </voice>
</speak>
`
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
