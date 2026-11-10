import { logger } from "../lib/logger";

const healthAndWellbeingSystemPrompt = `You are Afeeyah AI, a careful health information assistant for people in Nigeria.

Give understandable, evidence-informed information about common health concerns. Support women and family health, including pregnancy, maternal wellbeing, child health, immunisation, and preventive care. If a question is unrelated to health, say you can help with health topics and invite a relevant question.

Be concise, clear, and calm. Use plain language, avoid unnecessary medical terms, and distinguish established guidance from uncertainty. Never diagnose, prescribe medication, provide unsafe dosing, invent evidence, or claim certainty. Encourage a qualified clinician when symptoms are new, severe, worsening, or persistent.

If the user describes potentially urgent symptoms—including heavy bleeding, severe abdominal or chest pain, difficulty breathing, fainting, seizures, severe headache or vision changes, high fever, thoughts of self-harm, reduced fetal movement, or an unresponsive child—put the urgent action first: seek emergency care now and contact local emergency services or go to the nearest hospital.

If asked to locate a specific health facility, be transparent that facility lookup is not available yet. Do not invent facility names, locations, hours, or services. Suggest contacting a local health authority or a nearby hospital for current options.

This is general health information, not a diagnosis or a substitute for professional medical advice.

Format every answer for WhatsApp:
- Aim for 100 words or fewer; use only the detail needed to answer safely.
- Use short paragraphs and bullet points beginning with •.
- Use *single asterisks* for short headings or emphasis.
- Do not use Markdown tables, pipes, horizontal rules, hash headings, double asterisks, or long dense paragraphs.
- Put the direct answer first, and the most important action first for warning signs or emergencies.`;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type Provider = {
  name: "groq" | "grok" | "nvidia";
  url: string;
  model: string;
  apiKey: string;
};

function getProvider(): Provider | undefined {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
      apiKey: groqKey,
    };
  }

  const grokKey = process.env.GROK_API_KEY;
  if (grokKey) {
    return {
      name: "grok",
      url: "https://api.x.ai/v1/chat/completions",
      model: process.env.GROK_MODEL ?? "grok-3-mini",
      apiKey: grokKey,
    };
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    return {
      name: "nvidia",
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      model:
        process.env.NVIDIA_MODEL ?? "meta/llama-3.1-70b-instruct",
      apiKey: nvidiaKey,
    };
  }

  return undefined;
}

export function getAiProviderStatus() {
  const provider = getProvider();
  return {
    configured: Boolean(provider),
    provider: provider?.name ?? null,
  };
}

function withDisclaimer(answer: string) {
  const disclaimer =
    "\n\nAfeeyah AI shares general information, not a diagnosis. For urgent symptoms, seek care now.";
  return answer.includes("not a substitute") ? answer : `${answer}${disclaimer}`;
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function formatInlineWhatsApp(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatForWhatsApp(answer: string) {
  const cleaned = answer
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/\r\n/g, "\n");
  const output: string[] = [];
  let tableHeader: string[] | undefined;

  for (const rawLine of cleaned.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (output.length && output[output.length - 1] !== "") output.push("");
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = splitTableRow(line);
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      if (!tableHeader) {
        tableHeader = cells;
        continue;
      }

      const [title, ...details] = cells;
      const detail = details.filter(Boolean).join(" — ");
      output.push(`• ${formatInlineWhatsApp(title)}${detail ? ` — ${formatInlineWhatsApp(detail)}` : ""}`);
      continue;
    }

    tableHeader = undefined;

    if (/^(---+|___+|\*\*\*+)$/.test(line)) continue;

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (output.length && output[output.length - 1] !== "") output.push("");
      output.push(`*${formatInlineWhatsApp(heading[1])}*`);
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      output.push(`• ${formatInlineWhatsApp(bullet[1])}`);
      continue;
    }

    output.push(formatInlineWhatsApp(line));
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function answerHealthQuestion(
  question: string,
  context?: { status?: string; language?: string },
) {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No AI provider is configured. Set GROQ_API_KEY, GROK_API_KEY, or NVIDIA_API_KEY.",
    );
  }

  const userContext = [
    context?.status ? `User status: ${context.status}.` : "",
    context?.language ? `Preferred language: ${context.language}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
         { role: "system", content: healthAndWellbeingSystemPrompt },
        {
          role: "user",
          content: `${userContext}\nQuestion: ${question}`.trim(),
        },
      ],
    }),
  });

  if (!response.ok) {
    logger.warn(
      { provider: provider.name, status: response.status },
      "Afeeyah AI provider returned an error",
    );
    throw new Error(`AI provider request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("AI provider returned an empty answer.");
  return withDisclaimer(formatForWhatsApp(answer));
}