"""Generate cached Edge clips sequentially; retain exact SSML and word timings."""
import asyncio
import json
import pathlib
import sys
import edge_tts
from edge_tts.communicate import mkssml
from xml.sax.saxutils import escape

async def main():
    jobs = json.loads(pathlib.Path(sys.argv[1]).read_text())
    for index, job in enumerate(jobs, 1):
        target = pathlib.Path('public') / job['audio']
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.partial')
        speech = edge_tts.Communicate(job['text'], job['voice'], rate='-8%', pitch='+0Hz', boundary='WordBoundary')
        words = []
        with temporary.open('wb') as output:
            async for chunk in speech.stream():
                if chunk['type'] == 'audio':
                    output.write(chunk['data'])
                elif chunk['type'] == 'WordBoundary':
                    words.append({k: chunk[k] for k in ('text', 'offset', 'duration')})
        if temporary.stat().st_size < 500 or not words:
            raise RuntimeError('Missing audio or word timing data; packages remain unchanged')
        target.with_suffix('.ssml').write_text(mkssml(speech.tts_config, escape(job['text'])))
        target.with_suffix('.json').write_text(json.dumps({'provider':'Microsoft Edge', 'client':'edge-tts 7.3.1', 'voice':job['voice'], 'text':job['text'], 'rate':'-8%', 'pitch':'+0Hz', 'costUSD':0, 'words':words}, indent=2)+'\n')
        temporary.replace(target)
        if index % 10 == 0 or index == len(jobs):
            print(f'Recorded {index}/{len(jobs)}', flush=True)

asyncio.run(main())
