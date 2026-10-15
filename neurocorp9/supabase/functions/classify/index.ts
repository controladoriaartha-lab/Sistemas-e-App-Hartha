// supabase/functions/classify/index.ts
// Deploy: supabase functions deploy classify
// Segredo:  supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o classificador do NEUROCORP9, preciso, focado em saúde e brasileiro.
Extraia do texto do usuário:
- atividade: string curta (ex: yoga, lavar louça, musculação)
- categorias: array de [mental, intelectual, física, organização, limpeza casa, movimento corporal]
- sub_movimento: array de [força, abaixar, equilíbrio, empurrar, puxar, torção, caminhar]
- duracao_min: inteiro estimado (se não houver, estime 15; máximo 120)
- regiao_corporal: array de [cabeca, bracos, core, pernas, corpo_inteiro]
- intensidade: inteiro de 1 a 5
- score: (duracao_min * intensidade) / 2
Retorne APENAS JSON válido, sem markdown. Exemplo:
{"atividade":"yoga","categorias":["física","movimento corporal"],"sub_movimento":["equilíbrio","força"],"duracao_min":20,"regiao_corporal":["core","pernas"],"intensidade":3,"score":30}`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || String(text).trim().length < 3) return json({ error: "texto muito curto" }, 400);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: String(text) },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Erro OpenAI");

    let classified;
    try {
      const content = String(data.choices[0].message.content).trim();
      classified = JSON.parse(content.replace(/```json|```/g, "").trim());
    } catch {
      classified = {
        atividade: String(text).slice(0, 30),
        categorias: ["movimento corporal"],
        sub_movimento: ["caminhar"],
        duracao_min: 15,
        regiao_corporal: ["corpo_inteiro"],
        intensidade: 2,
        score: 15,
      };
    }

    return json({ texto_original: text, ...classified });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
