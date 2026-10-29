// 前半段（任务 + 生成规则）是「动态」模块的默认提示词，可以在 设置 → 应用配置 里换；后半段（配图规则 + 输出格式）固定
export const MOMENTS_CORE = "【朋友圈生成任务】\n\n请根据已注入的角色卡、用户信息、世界书、最近剧情对话以及上述信息，为联系人生成符合当前故事情境的朋友圈动态。\n当前剧情时间：{{currentStoryTime}}\n记忆信息：{{memoryInfo}}\n可用联系人列表：{{contactsInfo}}\n\n【核心生成规则】\n发布机制\n只为通讯录联系人生成朋友圈（每个联系人生成 0-1 条，视角色性格与发圈习惯而定）。\n绝对不要替用户（{{user}}）生成动态、点赞或评论。\n时间分布要合理错落（如“几分钟前”、“2小时前”等），须在当前剧情时间之前，不要全部集中在同一时间。\n内容与风格\n自然真实：文案必须像真人随手发的，符合角色性格、日常语气和世界观。严禁写成剧情总结、旁白或设定说明。\n内容多样：可以包含日常分享、心情感悟、美食风景、工作学习、兴趣爱好等，并合理反映角色近期的情感状态或剧情事件。\n隐私转化（关键）：带有“蜜语资料”的联系人也是微信好友。切勿在朋友圈直接泄露其私密设定或真实面目；必须将其隐藏设定巧妙转化为适合朋友圈可见范围的“生活化表达”。\n社交互动规则\n互动逻辑：关系亲密的好友更容易点赞和评论；评论内容和语气必须严格符合评论者的性格；可以有多人参与同一条朋友圈的互动。\n可见性限制：若朋友圈设定了“仅XX可看 / 仅XX不可看”，必须严格遵守该设定，只有拥有可见权限的好友才能点赞或回复。\n头像由系统根据联系人姓名自动匹配，无需在 JSON 中输出头像字段。\n\n";
export const MOMENTS_FMT = "【配图生成规则】\n① 当公开图片画面里不含②、③、④的情况下可使用通用配图格式：[图片]（中文图片描述）（English tags）。\n示例：[图片]（两个女生穿着便装并肩走在街边，背景是虚化的城市灯光）（2girls, adult character, street snapshot, casual outfits, walking side by side, blurred city background, anime illustration）\n\n② 当公开图片画面里角色仅含{{user}}本人时使用格式：[用户照片]（中文图片描述）（English tags），标签名禁止写用户姓名。\n\n③ 当公开图片画面里确实包含具体的有名有姓的主角或NPC时使用格式：[图片-姓名]（中文图片描述）（English tags）。\n\n④ 当公开图片画面里包括主角、NPC、用户{{user}}多人时使用格式：[图片-姓名,姓名,姓名]（中文图片描述）（English tags）。\n\n以上①-④配图格式，第一个括号写中文图片描述供朋友圈卡片背面展示，第二个括号只能写英文逗号分隔的英文生图 tag，不要写中文、解释或完整句子；少写第二个括号会被系统判定为格式错误，图片不会生成。系统会根据[用户照片]或[图片-姓名,姓名]中的身份，在实际生图时自动拼接已设置的固定外貌 Tag 和参考图；第二个括号只写本次动态需要的动作、表情、服装变化、构图、场景、光线和镜头，不要重复固定外貌 Tag。\n【输出格式】\n请仅输出纯 JSON 格式数据，不要包含任何多余的思考过程或说明文字：\n{\n  \"moments\": [\n    {\n      \"name\": \"联系人名字\",\n      \"text\": \"朋友圈文字内容\",\n      \"images\": [\n        \"[图片]（午后的咖啡杯放在靠窗桌边，阳光照着桌面）（coffee cup, window table, afternoon sunlight, phone photo, anime illustration）\"\n      ],\n      \"time\": \"几分钟前/几小时前\",\n      \"likeList\": [\"点赞的人名1\", \"点赞的人名2\"],\n      \"commentList\": [\n        {\"name\": \"评论者\", \"text\": \"评论内容\"},\n        {\"name\": \"回复者\", \"text\": \"回复内容\", \"replyTo\": \"被回复者\"}\n      ]\n    }\n  ]\n}";
export const MOMENTS_PROMPT = MOMENTS_CORE + MOMENTS_FMT;
// 适配动态数据格式；旧数据继续使用原字段。
export function normalizeMoments(result, contacts, options = {}, userName = '', current = Date.now()) {
 const list = Array.isArray(result?.moments) ? result.moments : Array.isArray(result?.posts) ? result.posts : [];
 const picked = new Set(options.names || []), people = new Map();
 contacts.forEach(c => { for (const n of [c.real, c.nick, c.name]) if(n) people.set(n,c); });
 const known = n => typeof n === 'string' && n !== userName && people.has(n);
 return list.filter(m => m && known(m.name || m.author) && (!options.only || picked.has(m.name || m.author))).slice(0, options.n || 10).map(m => {
  const raw = m.images || (m.img ? [m.img] : []), images = (Array.isArray(raw) ? raw : []).slice(0,9).filter(v=>typeof v==='string');
  const time = String(m.time || ''), match = time.match(/(\d+)\s*(分钟|小时|天)/), offset = match ? +match[1] * ({分钟:60000,小时:3600000,天:86400000}[match[2]]) : 0;
  return { author: m.name || m.author, text: String(m.text || ''), tr: m.tr || '', images, location: String(m.location || ''), ts: current - offset,
   likes: (Array.isArray(m.likeList || m.likes) ? m.likeList || m.likes : []).filter(known),
   comments: (Array.isArray(m.commentList || m.comments) ? m.commentList || m.comments : []).filter(c=>c && known(c.name || c.from) && typeof c.text==='string').map(c=>({from:c.name || c.from,text:c.text,tr:c.tr||'',to:known(c.replyTo || c.to) || (c.replyTo || c.to) === userName ? c.replyTo || c.to : ''})) };
 });
}
