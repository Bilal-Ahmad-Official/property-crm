import { describeAction, executeTool, formatToolResultForLog, toolSchemas, ToolResult, ToolSchema } from "./tools";

export type ChatMsg = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

export type AgentResult = { reply: string; actions: string[]; mode: "ai" | "builtin" };

export function isAIConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
}

function aiConfig() {
  return {
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "",
    baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

function systemMessage(pageContext?: string): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return [
    `You are Aria, the AI assistant built into Property CRM — a real-estate CRM with Properties, Leads, Contacts, Deals, Tasks, a Dashboard and Reports.`,
    `Today is ${today}. All prices are in USD.`,
    `You have live access to the CRM database through tools. Rules:`,
    `- ALWAYS use tools to answer questions about data (properties, leads, deals, tasks, contacts) — never invent records, ids or numbers.`,
    `- You may also ACT: create_task (reminders/follow-ups), update_lead_status, complete_task, add_note.`,
    `- When you create a task, mention it clearly. When you can't find something, say so and suggest alternatives.`,
    `- Be concise and practical: short paragraphs, bullet lists with prices/dates where relevant.`,
    pageContext ? `- The user is currently viewing the "${pageContext}" page of the CRM, so tailor answers to that module.` : "",
    `- If the user greets you, briefly introduce what you can do.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function callChatCompletions(messages: ChatMsg[], tools: ToolSchema[]): Promise<ChatMsg | null> {
  const { apiKey, baseUrl, model } = aiConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: tools.length ? tools : undefined,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI provider error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: ChatMsg }>;
  };
  return data.choices?.[0]?.message ?? null;
}

export async function runAgent(history: ChatMsg[], pageContext?: string): Promise<AgentResult> {
  if (!isAIConfigured()) return runRuleAgent(history, pageContext);

  const messages: ChatMsg[] = [
    { role: "system", content: systemMessage(pageContext) },
    ...history.slice(-16),
  ];
  const actions: string[] = [];

  try {
    for (let round = 0; round < 6; round++) {
      const choice = await callChatCompletions(messages, toolSchemas);
      if (!choice) break;
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        messages.push({ role: "assistant", content: choice.content || "", tool_calls: choice.tool_calls });
        for (const tc of choice.tool_calls) {
          let result: ToolResult;
          try {
            const args = tc.function.arguments
              ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
              : {};
            result = await executeTool(tc.function.name, args);
            actions.push(describeAction(tc.function.name, args));
          } catch (e) {
            result = { error: e instanceof Error ? e.message : "Tool execution failed" };
          }
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: formatToolResultForLog(result),
          });
        }
        continue;
      }
      const reply = (choice.content || "").trim();
      return { reply: reply || "Done.", actions, mode: "ai" };
    }
    return {
      reply: "I completed the work but couldn't summarize it in the steps available. Please try rephrasing.",
      actions,
      mode: "ai",
    };
  } catch (e) {
    console.error("[ai] falling back to built-in assistant:", e);
    const fallback = await runRuleAgent(history, pageContext);
    return {
      reply: `_(AI provider unavailable — answered with the built-in assistant.)_\n\n${fallback.reply}`,
      actions: fallback.actions,
      mode: "builtin",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Built-in rule-based assistant: works with no API key configured.   */
/* Uses the same CRM tools so it can still query and act on data.     */
/* ------------------------------------------------------------------ */

const money = (n: number) => (n >= 10000 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${Math.round(n).toLocaleString("en-US")}`);

function extractBudget(q: string): { max?: number; min?: number } {
  const kmb = q.match(/(?:\$|usd\s?)?([\d][\d,]*(?:\.\d+)?)\s*(k|m)\b/);
  if (kmb) {
    const base = Number(kmb[1].replace(/,/g, ""));
    const value = kmb[2] === "k" ? base * 1000 : base * 1000000;
    if (/under|below|less than|max|up to|cheaper|budget of/.test(q) || /under|below|less than/.test(q)) return { max: value };
    return { min: value };
  }
  const plain = q.match(/(?:\$|usd\s?)([\d][\d,]*(?:\.\d+)?)/);
  if (plain) {
    const value = Number(plain[1].replace(/,/g, ""));
    if (/under|below|less than|max|up to|cheaper/.test(q)) return { max: value };
    return { min: value };
  }
  const bare = q.match(/under\s+([\d][\d,]*)/);
  if (bare) {
    const value = Number(bare[1].replace(/,/g, ""));
    return { max: value };
  }
  return {};
}

function propertyTypeFrom(q: string): string | undefined {
  if (/apartment|flat|condo/.test(q)) return "APARTMENT";
  if (/villa/.test(q)) return "VILLA";
  if (/\bhouse\b|home|duplex|cottage/.test(q)) return "HOUSE";
  if (/plot|land|lot/.test(q)) return "PLOT";
  if (/commercial|retail|shop/.test(q)) return "COMMERCIAL";
  if (/office/.test(q)) return "OFFICE";
  return undefined;
}

export async function runRuleAgent(history: ChatMsg[], pageContext?: string): Promise<AgentResult> {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content || "";
  const q = lastUser.toLowerCase().trim();
  const actions: string[] = [];
  const ctx = pageContext ? `(You're on the ${pageContext} page.) ` : "";

  if (!q) {
    return {
      reply: `${ctx}Ask me about your properties, leads, deals or tasks — for example "show available properties under $900k" or "summarize my leads".`,
      actions,
      mode: "builtin",
    };
  }

  // Greeting
  if (/^(hi|hello|hey|yo|salam|assalam|good (morning|afternoon|evening))\b/.test(q) && q.length < 30) {
    return {
      reply: `${ctx}Hello! I'm Aria, your Property CRM assistant. I can:\n- Search and summarize **properties** ("available houses under $900k")\n- Summarize **leads** and move them through the pipeline\n- Summarize **deals**, pipeline value and commission\n- Summarize or **create tasks** ("remind me to call James tomorrow")\n- Find **contacts** and add notes\nWhat would you like to do?`,
      actions,
      mode: "builtin",
    };
  }

  // Help
  if (/\bhelp\b|what can you|capabilit|features|how do i/.test(q)) {
    return {
      reply: `Here's what I can do across your CRM:\n\n**Properties** — search by budget, type, status or city; summarize the portfolio.\n**Leads** — list and summarize; move a lead to a new stage on request.\n**Deals** — pipeline value, commission, won revenue; list by stage.\n**Tasks** — list, summarize, create ("remind me to …"), and complete.\n**Contacts** — find by name/email/phone; add notes.\n\nTry: "show available properties under $900k", "summarize my leads", "what's my pipeline value?", "remind me to call Michael Brown tomorrow".`,
      actions,
      mode: "builtin",
    };
  }

  // Create a task / reminder
  const wantsTask = /\b(task|reminder|remind|to-?do|follow[- ]?up|schedule)\b/.test(q);
  const wantsCreate = /\b(add|create|new|make|set|remind|schedule)\b/.test(q);
  if (wantsTask && wantsCreate) {
    const dateMatch = q.match(/\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    const due: Record<string, string> = { today: "today", tomorrow: "tomorrow", "next week": "next week" };
    let dueDate: string | undefined;
    if (dateMatch) {
      const d = dateMatch[1];
      const now = new Date();
      if (d === "today") dueDate = now.toISOString().slice(0, 10);
      else if (d === "tomorrow") dueDate = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
      else if (d === "next week") dueDate = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      else {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const target = days.indexOf(d);
        const delta = (target - now.getDay() + 7) % 7 || 7;
        dueDate = new Date(now.getTime() + delta * 86400000).toISOString().slice(0, 10);
      }
    }
    const priority = /urgent|asap|immediately/.test(q) ? "URGENT" : /important|high/.test(q) ? "HIGH" : undefined;
    const type = /\bcall\b/.test(q) ? "CALL" : /viewing|showing/.test(q) ? "VIEWING" : /meeting|appointment/.test(q) ? "MEETING" : /paperwork|contract|document|lease/.test(q) ? "PAPERWORK" : "FOLLOW_UP";
    let title = lastUser
      .replace(/^(please\s+)?(can you\s+)?/i, "")
      .replace(/\b(add|create|new|make|a|an)\s+\w*\s*(task|reminder|to-?do)\b\s*(for|to)?/gi, "")
      .replace(/\bremind me (to|about)\b/gi, "")
      .replace(/\bschedule\b/gi, "")
      .replace(/\b(today|tomorrow|next week)\b/gi, "")
      .trim();
    if (!title || title.length < 4) title = lastUser.trim();
    const created = (await executeTool("create_task", {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      dueDate,
      priority,
      type,
    })) as { id?: string; title?: string };
    actions.push(`Created task “${created?.title ?? title}”`);
    const dueText = dateMatch ? ` for ${dateMatch[1]}` : "";
    return {
      reply: `Done — I created the task **“${created?.title ?? title}”**${dueText}${priority ? ` with ${priority.toLowerCase()} priority` : ""}. You can see it in the Tasks module.`,
      actions,
      mode: "builtin",
    };
  }

  // Leads
  if (/\bleads?\b|\binquir/.test(q)) {
    const statusMatch = q.match(/\b(new|contacted|qualified|viewing|negotiation|won|lost)\b/);
    const result = (await executeTool("summarize_leads", statusMatch ? { status: statusMatch[1] } : {})) as {
      totalLeads: number;
      byStatus: { status: string; count: number }[];
      recent: { name: string; status: string; budgetMax?: number | null; interest?: string | null; assignee?: string | null }[];
    };
    actions.push("Summarized leads");
    const byStatusLine = result.byStatus.map((r) => `${r.status}: ${r.count}`).join(" · ");
    const recentLines = result.recent
      .slice(0, 5)
      .map(
        (l) =>
          `- **${l.name}** (${l.status})${l.budgetMax ? ` — budget up to ${money(l.budgetMax)}` : ""}${l.interest ? `, looking for ${l.interest.toLowerCase()}` : ""}${l.assignee ? ` · ${l.assignee}` : ""}`
      )
      .join("\n");
    return {
      reply: `${ctx}You have **${result.totalLeads} leads** in the pipeline.\n\nBy stage: ${byStatusLine}\n\nMost recent:\n${recentLines}\n\nWant me to move any lead to the next stage?`,
      actions,
      mode: "builtin",
    };
  }

  // Deals
  if (/\bdeals?\b|\bpipeline\b|\brevenue\b|\bcommission\b|\bclos(ed|ing)\b/.test(q)) {
    const result = (await executeTool("summarize_deals", {})) as {
      openPipelineValue: number;
      openPipelineCommission: number;
      openDeals: number;
      wonRevenueThisYear: number;
      wonDealsThisYear: number;
      byStage: { stage: string; count: number; value: number }[];
    };
    actions.push("Summarized deals");
    const stageLines = result.byStage
      .filter((r) => !r.stage.startsWith("CLOSED"))
      .map((r) => `- ${r.stage.replace(/_/g, " ")}: ${r.count} deal(s), ${money(r.value)}`)
      .join("\n");
    return {
      reply: `${ctx}Here's your deal pipeline:\n\n**Open pipeline:** ${result.openDeals} deals worth ${money(result.openPipelineValue)} (${money(result.openPipelineCommission)} commission)\n**Won this year:** ${result.wonDealsThisYear} deals, ${money(result.wonRevenueThisYear)} commission\n\nBy stage:\n${stageLines}`,
      actions,
      mode: "builtin",
    };
  }

  // Tasks (summary)
  if (/\btasks?\b|\bto-?do\b/.test(q)) {
    const overdue = /overdue|late|behind/.test(q);
    const statusMatch = q.match(/\b(pending|in progress|completed)\b/);
    const result = (await executeTool("summarize_tasks", {
      overdueOnly: overdue,
      status: statusMatch ? statusMatch[1].replace(" ", "_").toUpperCase() : undefined,
    })) as {
      totalOpenTasks: number;
      overdueTasks: number;
      upcoming: { title: string; status: string; priority: string; dueDate: string | null; assignee?: string | null }[];
    };
    actions.push("Summarized tasks");
    const lines = result.upcoming
      .slice(0, 6)
      .map(
        (t) =>
          `- **${t.title}** — ${t.priority.toLowerCase()} priority${t.dueDate ? `, due ${new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}${t.assignee ? ` · ${t.assignee}` : ""}`
      )
      .join("\n");
    return {
      reply: `${ctx}You have **${result.totalOpenTasks} open tasks**, of which **${result.overdueTasks} are overdue**.\n\nNext up:\n${lines || "Nothing open — all clear!"}`,
      actions,
      mode: "builtin",
    };
  }

  // Contacts
  if (/\bcontacts?\b|\bclients?\b|\bowner\b|\blandlord\b|\bvendor\b/.test(q)) {
    const typeMatch = q.match(/\b(buyer|seller|tenant|landlord|vendor)\b/);
    const nameMatch = q.match(/\b(?:contact|client|about)\s+([a-z][a-z ]{2,30})$/);
    const result = (await executeTool("find_contacts", {
      query: nameMatch ? nameMatch[1].trim() : undefined,
      type: typeMatch ? typeMatch[1].toUpperCase() : undefined,
    })) as { name: string; type: string; email?: string | null; phone?: string | null }[];
    actions.push("Searched contacts");
    if (!result.length) {
      return { reply: `${ctx}I couldn't find matching contacts. Try a name, email or phone fragment.`, actions, mode: "builtin" };
    }
    const lines = result
      .slice(0, 6)
      .map((c) => `- **${c.name}** (${c.type.toLowerCase()})${c.email ? ` — ${c.email}` : ""}${c.phone ? ` · ${c.phone}` : ""}`)
      .join("\n");
    return { reply: `${ctx}I found ${result.length} matching contact(s):\n\n${lines}`, actions, mode: "builtin" };
  }

  // Property search (default for anything property-related)
  if (/propert|apartment|flat|condo|house|home|villa|plot|land|commercial|office|rent|buy|available|available|under|budget/.test(q)) {
    const budget = extractBudget(q);
    const type = propertyTypeFrom(q);
    const listingType = /\brent\b|for rent|lease/.test(q) ? "RENT" : /\bbuy\b|for sale|purchase|sale\b/.test(q) ? "SALE" : undefined;
    const cityMatch = q.match(/\bin\s+([a-z][a-z ]{2,20})/);
    const result = (await executeTool("search_properties", {
      city: cityMatch ? cityMatch[1].trim() : undefined,
      type,
      listingType,
      maxPrice: budget.max,
      minPrice: budget.min,
      status: /sold/.test(q) ? "SOLD" : /rented/.test(q) ? "RENTED" : /available|for sale|for rent|buy|rent/.test(q) ? "AVAILABLE" : undefined,
      limit: 6,
    })) as { title: string; price: number; type: string; status: string; listingType: string; bedrooms: number; bathrooms: number; city: string; address: string; areaSqFt: number }[];
    actions.push("Searched properties");
    if (!result.length) {
      return {
        reply: `${ctx}I couldn't find properties matching those filters in the CRM. Try broadening the budget or type — or ask me to "summarize the portfolio" to see everything listed.`,
        actions,
        mode: "builtin",
      };
    }
    const lines = result
      .map(
        (p) =>
          `- **${p.title}** (${p.type.toLowerCase()}, ${p.status.toLowerCase()}) — ${p.listingType === "RENT" ? `${money(p.price)}/mo` : money(p.price)} · ${p.bedrooms ? `${p.bedrooms} bd / ` : ""}${p.bathrooms} ba · ${p.areaSqFt.toLocaleString("en-US")} sq ft · ${p.address}, ${p.city}`
      )
      .join("\n");
    const budgetText = budget.max ? ` under ${money(budget.max)}` : budget.min ? ` above ${money(budget.min)}` : "";
    return {
      reply: `${ctx}I found ${result.length} matching propert${result.length === 1 ? "y" : "ies"}${budgetText}:\n\n${lines}\n\nWant full details on any of these, or shall I add a viewing task?`,
      actions,
      mode: "builtin",
    };
  }

  // Portfolio overview fallback
  const result = (await executeTool("portfolio_summary", {})) as {
    totalProperties: number;
    totalPortfolioValue: number;
    byStatus: { status: string; count: number }[];
  };
  actions.push("Summarized the property portfolio");
  return {
    reply: `${ctx}Here's a quick overview: **${result.totalProperties} properties** in the portfolio worth ${money(result.totalPortfolioValue)}. By status: ${result.byStatus.map((r) => `${r.status}: ${r.count}`).join(" · ")}.\n\nI can dig into properties, leads, deals, tasks or contacts — just ask. Type "help" to see everything I can do.`,
    actions,
    mode: "builtin",
  };
}
