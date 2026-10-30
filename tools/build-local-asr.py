#!/usr/bin/env python3
"""重建本地 Vosk 运行库和三个语言包。仅用 Python 标准库，无密钥和收费 API。"""
import base64
import io
from pathlib import Path
import re
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1] / 'assets/asr'
MODELS = {'zh': 'vosk-model-small-cn-0.22', 'ja': 'vosk-model-small-ja-0.22', 'en': 'vosk-model-small-en-us-0.15'}

def download(url):
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()

def runtime():
    data = download('https://registry.npmjs.org/vosk-browser/-/vosk-browser-0.0.8.tgz')
    with tarfile.open(fileobj=io.BytesIO(data)) as package:
        source = package.extractfile('package/dist/vosk.js').read().decode()
    for match in re.finditer(r'[A-Za-z0-9+/=]{500,}', source):
        try:
            worker = base64.b64decode(match.group()).decode()
        except (ValueError, UnicodeDecodeError):
            continue
        if 'retrieveFinalResult(recognizerId)' not in worker:
            continue
        start = worker.index('        retrieveFinalResult(recognizerId)')
        end = worker.index('        removeRecognizer(recognizerId)', start)
        function = worker[start:end].replace('result: JSON.parse(finalResult),', 'result: JSON.parse(finalResult),\n                    final: true,')
        worker = worker[:start] + function + worker[end:]
        worker = worker.replace('const storagePath = "/vosk";', 'const storagePath = "/vosk_" + modelUrl.split("/").pop().replace(/[^a-zA-Z0-9]/g, "_");')
        source = source[:match.start()] + base64.b64encode(worker.encode()).decode() + source[match.end():]
        break
    else:
        raise RuntimeError('上游结构有变化，必须重新审查 Worker 适配')
    source = source.replace('''        terminate() {
            this.postMessage({
                action: "terminate",
            });
            this._ready = false;
        }''', '''        terminate() {
            this.worker.terminate();
            this.recognizers.clear();
            this._ready = false;
        }''')
    source = source.replace('factory(global.Vosk = {})', 'factory(global.XPhoneVosk = {})')
    (ROOT / 'vosk.js').write_text(source)

def models():
    with tempfile.TemporaryDirectory() as temporary:
        folder = Path(temporary)
        for language, name in MODELS.items():
            data = download(f'https://alphacephei.com/vosk/models/{name}.zip')
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for item in archive.infolist():
                    path = (folder / item.filename).resolve()
                    if not path.is_relative_to(folder.resolve()):
                        raise RuntimeError('语言包路径越界')
                archive.extractall(folder)
            with tarfile.open(ROOT / f'{language}.tar.gz', 'w:gz', compresslevel=6) as archive:
                archive.add(folder / name, arcname='model')
            print(language, 'ready')

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    runtime()
    models()
    for filename in ['COPYING', 'NOTICE']:
        (ROOT / filename).write_bytes(download(f'https://raw.githubusercontent.com/ccoreilly/vosk-browser/master/{filename}'))
