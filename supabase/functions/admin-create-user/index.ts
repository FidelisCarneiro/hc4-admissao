import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = auth.replace("Bearer ", "");

    const supa = adminClient();

    // verify caller is admin
    const { data: caller } = await supa.auth.getUser(token);
    if (!caller.user) return json({ error: "Unauthorized" }, 401);

    const { data: callerProfile } = await supa
      .from("profiles")
      .select("role,is_active")
      .eq("user_id", caller.user.id)
      .single();

    if (!callerProfile || callerProfile.is_active === false || callerProfile.role !== "ADMIN") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const cpf = String(body.cpf || "").replace(/\D/g, "").slice(0, 11);
    const role = String(body.role || "PREENCHEDOR");
    const is_active = Boolean(body.is_active);

    if (!name) return json({ error: "Nome obrigatório" }, 400);
    if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

    const email = `${cpf}@hc4.local`;
    const tempPass = cpf.slice(0, 6);

    // create user
    const { data: created, error: createErr } = await supa.auth.admin.createUser({
      email,
      password: tempPass,
      email_confirm: true,
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // upsert profile
    const { error: profErr } = await supa.from("profiles").upsert({
      user_id: created.user.id,
      name,
      cpf,
      role,
      is_active,
      must_change_password: true,
    });
    if (profErr) return json({ error: profErr.message }, 400);

    return json({ ok: true, user_id: created.user.id });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
