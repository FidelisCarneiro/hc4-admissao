import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabaseAdmin.ts";

type ResendResp = { id?: string; error?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = adminClient();

  // We require a valid user JWT; use it only to identify user_id, operations use service role for DB/storage
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.replace("Bearer ", "");

  const { data: udata } = await supa.auth.getUser(token);
  const user = udata.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    const form = await req.formData();
    const payloadRaw = form.get("payload");
    const notifyEmail = String(form.get("notify_email") || Deno.env.get("DEFAULT_NOTIFY_EMAIL") || "");
    const signature = String(form.get("signature") || "");
    if (!payloadRaw) return json({ error: "payload ausente" }, 400);

    const payload = JSON.parse(await (payloadRaw as Blob).text());
    const nome = String(payload?.nome || "Colaborador").trim() || "Colaborador";
    const cpf = String(payload?.cpf || "").replace(/\D/g, "").slice(0, 11);

    // Create submission record
    const storagePrefix = crypto.randomUUID();
    const { data: sub, error: subErr } = await supa.from("submissions").insert({
      user_id: user.id,
      notify_email: notifyEmail,
      storage_prefix: storagePrefix,
      status: "RECEBIDO",
      payload,
    }).select("id").single();

    if (subErr) return json({ error: subErr.message }, 400);
    const submissionId = sub.id as string;

    // Upload all received files to Storage bucket hc4-docs
    const bucket = "hc4-docs";
    const uploads: string[] = [];

    // PDFs
    await uploadFile(form, "pdfCadastro", `pdf/${safeFile(`${nome} - Ficha Cadastral.pdf`)}`, bucket, storagePrefix, uploads);
    await uploadFile(form, "pdfPlano", `pdf/${safeFile(`${nome} - Plano de Saude.pdf`)}`, bucket, storagePrefix, uploads);

    // docs
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("doc_")) continue;
      const file = value as File;
      const docKey = key.replace("doc_", "");
      await uploadRaw(file, `docs/${docKey}/${safeFile(file.name)}`, bucket, storagePrefix, uploads, supa);
    }

    // Build zip (optional) - for simplicity, we won't zip server-side here; attachments can be downloaded from storage prefix.
    // If you need ZIP in email, implement zip generation with JSZip on edge (possible but heavier).

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    const resendFrom = Deno.env.get("RESEND_FROM") || "onboarding@resend.dev";
    const to = notifyEmail || "";
    if (!to) {
      await supa.from("submissions").update({ status: "EMAIL_FALHOU", error_message: "notify_email vazio" }).eq("id", submissionId);
      return json({ error: "notify_email vazio" }, 400);
    }

    const subject = `HC4 • Admissão: ${nome}`;
    const html = buildEmailHtml({ nome, cpf, notifyEmail: to, storagePrefix, signature, payload });

    let resendId = "";
    let emailErr = "";

    if (!resendKey) {
      emailErr = "RESEND_API_KEY não configurada";
    } else {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          html,
        }),
      });

      const rr: ResendResp = await r.json().catch(() => ({}));
      if (!r.ok) {
        emailErr = JSON.stringify(rr?.error || rr);
      } else {
        resendId = rr.id || "";
      }
    }

    if (emailErr) {
      await supa.from("submissions").update({ status: "EMAIL_FALHOU", error_message: emailErr }).eq("id", submissionId);
      return json({ ok: true, submission_id: submissionId, status: "EMAIL_FALHOU", error: emailErr, storagePrefix, uploads }, 200);
    }

    await supa.from("submissions").update({ status: "EMAIL_ENVIADO", resend_id: resendId }).eq("id", submissionId);

    return json({ ok: true, submission_id: submissionId, status: "EMAIL_ENVIADO", resend_id: resendId, storagePrefix, uploads });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function uploadFile(form: FormData, field: string, destName: string, bucket: string, prefix: string, uploads: string[]) {
  const v = form.get(field);
  if (!v) return;
  await uploadRaw(v as File, destName, bucket, prefix, uploads, adminClient());
}

async function uploadRaw(file: File, destName: string, bucket: string, prefix: string, uploads: string[], supa: ReturnType<typeof adminClient>) {
  const path = `${prefix}/${destName}`;
  const { error } = await supa.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  uploads.push(path);
}

function safeFile(name: string) {
  return name.replace(/\s+/g, " ").replace(/[/\\?%*:|"<>]/g, "-").trim();
}

function buildEmailHtml(params: any) {
  const p = params.payload || {};
  const rows = [
    ["Nome", p.nome],
    ["CPF", p.cpf],
    ["Nascimento", p.nascimento],
    ["E-mail", p.email],
    ["Telefone", p.telefone],
    ["Estado civil", p.estadoCivil],
    ["Endereço", `${p.endRua||""}, ${p.endNumero||""} ${p.endCompl||""}`],
    ["Cidade/UF", `${p.endCidade||""}/${p.endUf||""}`],
    ["CEP", p.endCep],
    ["Itaú Agência", p.itauAg],
    ["Itaú Conta", p.itauConta],
    ["Plano (Operadora)", p.psOperadora],
    ["Plano (Nome)", p.psPlano],
    ["Plano (Tipo)", p.psTipo],
  ].filter(r => r[1]);

  const table = rows.map(([k,v]) => `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb"><b>${k}</b></td><td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(String(v))}</td></tr>`).join("");

  return `
  <div style="font-family:Arial,sans-serif">
    <h2>HC4 • Pacote de Admissão</h2>
    <p><b>Colaborador:</b> ${escapeHtml(params.nome || "")}</p>
    <p><b>Storage prefix:</b> ${escapeHtml(params.storagePrefix || "")}</p>
    <p>Os PDFs e documentos foram armazenados no bucket <b>hc4-docs</b> com o prefixo acima.</p>
    <table style="border-collapse:collapse;width:100%;max-width:720px">${table}</table>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
