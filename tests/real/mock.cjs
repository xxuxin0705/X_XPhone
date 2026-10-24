// 假的 OpenAI 兼容接口：记录每次请求（模型、system 开头、user 结尾），按内容返回固定回复，支持流式
const http = require('http');
const LOG = [];
const STORY = '莉娅笑着把手机塞回口袋。“走吧，去吃烧烤。”\n\n<手机>\n私聊|姜照临|{{user}}|周五烧烤你来不来？我请客\n群聊|PK学园2年级|郁明也|今天作业是第三章\n加好友|海藤瞬|漆黑之翼\n朋友圈|姜照临|今天的晚霞好看\n拍一拍|姜照临|拍了拍你的小脑袋\n</手机>';
const CONTACTS = '人|姜照临|Jiang🐯|姜狗|男|的虎牙+1|中文|比你有钱\n人|郁明也|MING||男|。|中文|学习使我快乐\n群|PK学园2年级|姜照临|郁明也|姜照临:校草,郁明也:学委,灰吕杵志:班长|42|文化祭倒计时！';
function reply(body) {
  const ms = body.messages || [], sys = ms.filter(m => m.role == 'system').map(m => m.content).join('\n'), all = ms.map(m => typeof m.content == 'string' ? m.content : JSON.stringify(m.content)).join('\n'), last = String(ms.at(-1)?.content || '');
  if (/用一句话打个招呼/.test(all)) return '你好呀～我是 ' + body.model;
  if (/人\|真实姓名\|网名/.test(all)) return CONTACTS;
  if (/小手机|手机里|聊天回复|【当前聊天】/.test(sys + last) && !/手机同步格式/.test(all)) return '收到啦\n好的好的';
  return STORY.replace('{{user}}', (all.match(/\[name1=(.+?)\]/) || [])[1] || 'User');
}
http.createServer((q, r) => {
  let b = ''; q.on('data', d => b += d); q.on('end', () => {
    const u = q.url.split('?')[0];
    if (u.endsWith('/models')) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-a', object: 'model' }, { id: 'mock-b', object: 'model' }] })); }
    if (u == '/log') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify(LOG)); }
    if (u == '/reset') { LOG.length = 0; r.writeHead(200); return r.end('ok'); }
    if (!u.endsWith('/chat/completions')) { r.writeHead(404); return r.end('no'); }
    let j = {}; try { j = JSON.parse(b); } catch { }
    const out = reply(j), ms = j.messages || [];
    LOG.push({ model: j.model, stream: !!j.stream, n: ms.length, sys: String(ms.find(m => m.role == 'system')?.content || '').slice(0, 300), last: String(ms.at(-1)?.content || '').slice(-300), all: ms.map(m => String(m.content)).join('\n').length, out: out.slice(0, 80) });
    if (!j.stream) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ id: 'x', object: 'chat.completion', model: j.model, choices: [{ index: 0, message: { role: 'assistant', content: out }, finish_reason: 'stop' }] })); }
    r.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const parts = out.match(/[\s\S]{1,12}/g) || []; let i = 0;
    const tick = () => { if (i < parts.length) { r.write(`data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', model: j.model, choices: [{ index: 0, delta: { content: parts[i++] } }] })}\n\n`); setTimeout(tick, 15); } else { r.write(`data: ${JSON.stringify({ id: 'x', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`); r.end(); } };
    tick();
  });
}).listen(5001, () => console.log('mock on 5001'));
