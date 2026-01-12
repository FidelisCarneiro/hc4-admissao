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
    const cpf = String(body.cpf || "").replace(/\D/g, "").slice(0, 11);
    if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

    const email = `${cpf}@hc4.local`;
    const tempPass = cpf.slice(0, 6);

    // find user by email
    const { data: users, error: listErr } = await supa.auth.admin.listUsers({ page: 1, perPage: 2000 });
    if (listErr) return json({ error: listErr.message }, 400);

    const u = users.users.find((x) => x.email === email);
    if (!u) return json({ error: "Usuário não encontrado" }, 404);

    const { error: upErr } = await supa.auth.admin.updateUserById(u.id, { password: tempPass });
    if (upErr) return json({ error: upErr.message }, 400);

    await supa.from("profiles").update({ must_change_password: true }).eq("user_id", u.id);

    return json({ ok: true });
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
