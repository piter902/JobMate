import type { FocusOption } from './types';

const FOCUS_INSTRUCTIONS: Record<FocusOption, string> = {
  none: '',
  experience: '重点提及简历中与JD匹配的工作年限、行业背景、岗位类型。',
  skills: '重点提及简历中与JD共同拥有的具体技术、工具、语言名称。',
  projects: '重点提及简历中与JD业务场景相关的具体项目经验。',
};

export function buildSystemPrompt(focus: FocusOption): string {
  const fi = FOCUS_INSTRUCTIONS[focus];
  const focusLine = fi ? `\n${fi}` : '';

  return `你是求职者，正在Boss直聘上给HR发送首次招呼语。

输出一个JSON对象（不要其他内容）：
{"greeting":"招呼语","score":85,"scoreReason":"一句话依据"}

规则（极其重要）：
- 你是求职者对着HR说话，语气礼貌自信，不是HR招人
- greeting只能使用简历中明确写出的信息，严禁编造任何技能、经验、项目
- 如果简历没有某项JD要求的能力，绝不在招呼语中提及
- 简历中未出现的关键词（工具名、技术名、公司名等），一概不提
- 如果简历内容很少，简短概括即可，不要脑补
- F05格式要求：greeting先用一句话介绍身份，只有简历明确写明才能提学历、专业、届别；随后用1.、2.连续编号，每条单独一行且仅一句话，每点一个有证据的匹配优势，避免重复。通常3条，允许2–4条，证据不足可更少，不凑数。开头15–25字，每条15–30字，尽量不超过40字；总长目标100–150字，尽量不超过180字，长度为软目标，不编造或截断。到岗时间、实习安排、工作语言及熟练程度必须有简历明确依据。JSON字符串内必须在介绍和每个编号之间写入JSON转义序列（反斜杠+n），禁止把1.、2.、3.挤在同一行。${focusLine}

score规则：
- 严格对照简历和JD，逐项比对技能、经验、学历
- 简历中缺乏的关键要求，每条扣10-20分
- 不要给虚高的分数`;
}

export function buildUserPrompt(resumeText: string, jdText: string, focus: FocusOption): string {
  const labels: Record<FocusOption, string> = {
    none: '通用',
    experience: '经验匹配',
    skills: '技能',
    projects: '项目经历',
  };

  return `【我的简历（只有这些是真实的）】
${resumeText || '（未提供简历）'}

【目标职位JD】
${jdText}

侧重点：${labels[focus]}`;
}

// 从页面文本提取信息并生成招呼语（一次调用）

// 从页面文本提取信息并生成招呼语（一次调用）
export function buildExtractAndGeneratePrompt(pageText: string, focus: FocusOption, resumeText: string): {
  system: string;
  user: string;
} {
  const focusMap: Record<FocusOption, string> = {
    none: '通用',
    experience: '经验匹配',
    skills: '技能',
    projects: '项目经历',
  };

  return {
    system: `你是求职者的AI助手。从Boss直聘页面提取信息，逐维度匹配JD和简历，生成招呼语。

返回JSON（不要任何其他内容）：
{
  "company": "公司/企业名称（如：阿里巴巴、华为技术、创远高新），不要填成岗位名",
  "jobTitle": "岗位名称（如：前端开发工程师、产品经理），不要填成公司名",
  "bossName": "HR/发布人姓名",
  "jdText": "JD原文截取",
  "dimensions": [
    {"requirement": "JD中明确列出的一个要求", "matched": true, "evidence": "简历中的匹配证据"},
    {"requirement": "JD中的另一个要求", "matched": false, "evidence": "简历中缺乏"}
  ],
  "score": 75,
  "matchedCount": 6,
  "totalCount": 8,
  "greeting": "招呼语",
  "scoreReason": "匹配6/8项。优势：xxx。短板：缺yyy"
}

===== 逐维度打分规则 =====

1. 从JD原文中提取每一条明确列出的任职要求，作为独立维度。
   包括：学历、专业、年限、每项技术/工具/语言、行业背景、
   每项软技能（沟通/文档/管理等）、证书资质、其他硬性条件。
   只提取JD中明确写出的，不编造维度。

2. 逐维度对比简历：
   - matched=true → evidence写"简历中：{具体匹配内容}"
   - matched=false → evidence写"简历中无此项"

3. 评分公式（核心能力一票否决制）：

   第一步：识别JD的"核心能力"
   - JD中排名第一、最重要的那个要求（通常是岗位名称对应的技能/行业），作为核心能力
   - 例：JD是"汽车电子工程师" → 核心能力是"汽车/嵌入式/硬件"
   - 例：JD是"前端开发" → 核心能力是"前端技术栈"
   - 例：JD是"行政专员" → 核心能力是"行政/综合管理"

   第二步：核心能力是否匹配？
   - 简历中完全找不到核心能力 → 这是跨界投递，总分上限15分
   - 简历中部分相关但非主力经验 → 总分上限40分
   - 简历中核心能力吻合 → 正常按维度打分

   第三步：正常维度打分（仅当核心能力匹配时）
   - score = round((matchedCount / totalCount) * 100)
   - 如果核心能力不匹配，忽略此公式，直接给0-15分
   - 软技能（沟通、学历、年限）的匹配不能掩盖核心能力的不匹配

3.1 技术岗位严格判定：
   - 前端投后端/硬件/嵌入式/汽车 → 核心能力不匹配 → 上限15分
   - 前端投前端/全栈/大前端 → 核心能力匹配 → 正常打分
   - 不同后端语言之间(Java/Python/Go) → 部分相关 → 上限40分

3.2 通用岗位：
   - 行政、人事、HR、运营、销售、市场 → 核心能力泛化 → 正常打分

4. 招呼语规则（极其重要）：
   - 你是求职者给HR发消息
   - 只提及 matched=true 的维度，绝口不提不匹配的
   - 简历中没有的能力/经验/技能，一个字都不准编造
   - F05格式要求：greeting先用一句话介绍身份，只有简历明确写明才能提学历、专业、届别；随后用1.、2.连续编号，每条单独一行且仅一句话，每点一个有证据的匹配优势，避免重复。通常3条，允许2–4条，证据不足可更少，不凑数。开头15–25字，每条15–30字，尽量不超过40字；总长目标100–150字，尽量不超过180字，不编造或截断。到岗时间、实习安排、工作语言及熟练程度必须有简历明确依据。JSON字符串内必须在介绍和每个编号之间写入JSON转义序列（反斜杠+n），禁止把1.、2.、3.挤在同一行。
   - 侧重点"${focusMap[focus]}"：优先展开该维度

5. scoreReason格式："匹配X/Y项。优势：[关键匹配点]。短板：[关键缺失]"`,

    user: `【我的简历（只有这些是真实的，不能超出此范围）】
${resumeText || '（未提供简历）'}

【本地提纯后的当前岗位文本】
${pageText}

侧重点：${focusMap[focus]}

请逐维度对比分析，生成招呼语。`,
  };
}
