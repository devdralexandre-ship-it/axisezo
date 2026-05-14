import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["admin", "surgeon", "concierge", "call_center", "intern"] as const;

const CAPABILITIES = [
  "view_financials", "edit_financials",
  "edit_clinical", "move_pipeline", "delete_patients", "assigned_only",
  "generate_documents", "manage_templates", "manage_library",
  "import_csv", "view_dashboard", "manage_users",
] as const;

const CapsSchema = z.record(z.enum(CAPABILITIES), z.boolean()).optional();

const CreateSchema = z.object({
  action: z.literal("create"),
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(120),
  surgeon_name: z.string().max(120).nullable().optional(),
  concierge_name: z.string().max(120).nullable().optional(),
  roles: z.array(z.enum(ROLES)).min(1),
  caps: CapsSchema,
});

const UpdateSchema = z.object({
  action: z.literal("update"),
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(120).optional(),
  surgeon_name: z.string().max(120).nullable().optional(),
  concierge_name: z.string().max(120).nullable().optional(),
  active: z.boolean().optional(),
  roles: z.array(z.enum(ROLES)).optional(),
  caps: CapsSchema,
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  user_id: z.string().uuid(),
});

const ResetSchema = z.object({
  action: z.literal("reset_password"),
  email: z.string().email(),
});

const ListSchema = z.object({ action: z.literal("list") });

const BodySchema = z.discriminatedUnion("action", [
  CreateSchema,
  UpdateSchema,
  DeleteSchema,
  ResetSchema,
  ListSchema,
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      console.error("auth error", userErr);
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    if (body.action === "list") {
      const [{ data: profiles }, { data: roles }, { data: capsRows }, listRes] = await Promise.all([
        admin.from("profiles").select("user_id, display_name, surgeon_name, concierge_name, active"),
        admin.from("user_roles").select("user_id, role"),
        admin.from("user_capabilities").select("user_id, caps"),
        admin.auth.admin.listUsers(),
      ]);
      const emailByUser = new Map(
        (listRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
      );
      const rolesByUser = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role as string);
        rolesByUser.set(r.user_id, arr);
      }
      const capsByUser = new Map<string, Record<string, boolean>>();
      for (const c of capsRows ?? []) {
        capsByUser.set(c.user_id, (c.caps ?? {}) as Record<string, boolean>);
      }
      const users = (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        email: emailByUser.get(p.user_id) ?? "",
        display_name: p.display_name,
        surgeon_name: p.surgeon_name,
        concierge_name: p.concierge_name,
        active: p.active,
        roles: rolesByUser.get(p.user_id) ?? [],
        caps: capsByUser.get(p.user_id) ?? {},
      }));
      return json({ users });
    }

    if (body.action === "create") {
      const created = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { display_name: body.display_name },
      });
      if (created.error || !created.data.user) {
        return json({ error: created.error?.message ?? "Failed to create user" }, 400);
      }
      const newId = created.data.user.id;

      await admin
        .from("profiles")
        .update({
          display_name: body.display_name,
          surgeon_name: body.surgeon_name ?? null,
          concierge_name: body.concierge_name ?? null,
          active: true,
        })
        .eq("user_id", newId);

      if (body.roles.length) {
        await admin
          .from("user_roles")
          .insert(body.roles.map((role) => ({ user_id: newId, role })));
      }

      if (body.caps) {
        await admin
          .from("user_capabilities")
          .upsert({ user_id: newId, caps: body.caps }, { onConflict: "user_id" });
      }
      return json({ ok: true, user_id: newId });
    }

    if (body.action === "update") {
      const update: Record<string, unknown> = {};
      if (body.display_name !== undefined) update.display_name = body.display_name;
      if (body.surgeon_name !== undefined) update.surgeon_name = body.surgeon_name;
      if (body.concierge_name !== undefined) update.concierge_name = body.concierge_name;
      if (body.active !== undefined) update.active = body.active;
      if (Object.keys(update).length) {
        await admin.from("profiles").update(update).eq("user_id", body.user_id);
      }
      if (body.roles) {
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        if (body.roles.length) {
          await admin
            .from("user_roles")
            .insert(body.roles.map((role) => ({ user_id: body.user_id, role })));
        }
      }
      if (body.caps) {
        await admin
          .from("user_capabilities")
          .upsert({ user_id: body.user_id, caps: body.caps }, { onConflict: "user_id" });
      }
      return json({ ok: true });
    }

    if (body.action === "delete") {
      if (body.user_id === callerId) {
        return json({ error: "Você não pode deletar a própria conta." }, 400);
      }
      await admin.from("user_capabilities").delete().eq("user_id", body.user_id);
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      await admin.from("profiles").delete().eq("user_id", body.user_id);
      const del = await admin.auth.admin.deleteUser(body.user_id);
      if (del.error) return json({ error: del.error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "reset_password") {
      const { error } = await admin.auth.resetPasswordForEmail(body.email);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-users error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
