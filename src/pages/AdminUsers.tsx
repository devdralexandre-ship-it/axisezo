import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole, AppRole, Capability, ALL_CAPABILITIES, CapsMap } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, KeyRound, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface AdminUser {
  user_id: string;
  email: string;
  display_name: string | null;
  surgeon_name: string | null;
  concierge_name: string | null;
  active: boolean;
  roles: AppRole[];
  caps: CapsMap;
}

const ROLE_OPTIONS: AppRole[] = ['admin', 'surgeon', 'concierge', 'call_center', 'intern'];
const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  surgeon: 'Cirurgião',
  concierge: 'Concierge',
  call_center: 'Call Center',
  intern: 'Estagiária',
};

const CAP_LABELS: Record<Capability, { label: string; group: string; hint?: string }> = {
  view_financials:    { group: 'Financeiro', label: 'Ver valores financeiros', hint: 'Honorários, orçamentos, valor estimado, totais' },
  edit_financials:    { group: 'Financeiro', label: 'Editar dados financeiros' },
  edit_clinical:      { group: 'Pacientes', label: 'Editar dados clínicos' },
  move_pipeline:      { group: 'Pacientes', label: 'Mover no Kanban' },
  delete_patients:    { group: 'Pacientes', label: 'Deletar pacientes' },
  assigned_only:      { group: 'Pacientes', label: 'Restringir aos pacientes atribuídos', hint: 'Vê apenas pacientes onde for explicitamente atribuído' },
  generate_documents: { group: 'Documentos & Biblioteca', label: 'Gerar/assinar documentos' },
  manage_templates:   { group: 'Documentos & Biblioteca', label: 'Gerenciar templates de documento' },
  manage_library:     { group: 'Documentos & Biblioteca', label: 'Gerenciar biblioteca de orientações' },
  import_csv:         { group: 'Operacional', label: 'Importar CSV / exportar' },
  view_dashboard:     { group: 'Operacional', label: 'Ver dashboard global' },
  manage_users:       { group: 'Operacional', label: 'Gerenciar usuários' },
};
const CAP_GROUP_ORDER = ['Financeiro', 'Pacientes', 'Documentos & Biblioteca', 'Operacional'];

type Preset = { label: string; caps: Partial<Record<Capability, boolean>> };
const allTrue = () => ALL_CAPABILITIES.reduce((a, c) => ({ ...a, [c]: true }), {} as CapsMap);
const PRESETS: Record<string, Preset> = {
  full:        { label: 'Acesso pleno', caps: { ...allTrue(), assigned_only: false } },
  no_money:    { label: 'Operacional (sem financeiro)', caps: { ...allTrue(), view_financials: false, edit_financials: false, manage_users: false, manage_templates: false, delete_patients: false, assigned_only: false } },
  surgeon:     { label: 'Cirurgião padrão', caps: { view_financials: true, edit_financials: true, edit_clinical: true, move_pipeline: true, generate_documents: true, manage_templates: true, manage_library: true, view_dashboard: true } },
  concierge:   { label: 'Concierge padrão', caps: { edit_clinical: true, move_pipeline: true, generate_documents: true, manage_library: false, view_financials: true } },
  intern:      { label: 'Estagiária restrita', caps: { assigned_only: true, edit_clinical: true, move_pipeline: true } },
  custom:      { label: 'Customizado', caps: {} },
};

async function callAdmin(payload: unknown) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data;
}

export default function AdminUsers() {
  const { isAdmin, can, loading: roleLoading } = useUserRole();
  const allowed = isAdmin || can('manage_users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await callAdmin({ action: 'list' });
      setUsers(data.users ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (allowed) refresh();
  }, [allowed]);

  if (roleLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (!allowed) {
    return (
      <div className="p-8">
        <p className="text-destructive">Acesso negado. Apenas administradores.</p>
        <Link to="/" className="text-primary hover:underline">Voltar</Link>
      </div>
    );
  }

  const handleResetPassword = async (email: string) => {
    try {
      await callAdmin({ action: 'reset_password', email });
      toast.success('Email de recuperação enviado.');
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Deletar permanentemente ${u.display_name || u.email}?`)) return;
    try {
      await callAdmin({ action: 'delete', user_id: u.user_id });
      toast.success('Usuário removido.');
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-semibold">Administração de usuários</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/duplicates">Duplicatas</Link>
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Usuários da clínica</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Capacidades</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const enabledCount = Object.values(u.caps).filter(Boolean).length;
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.display_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && <span className="text-xs text-muted-foreground">sem papel</span>}
                          {u.roles.map((r) => (
                            <Badge key={r} variant="secondary">{ROLE_LABELS[r]}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 text-xs">
                          {u.caps.view_financials && <Badge variant="outline">$</Badge>}
                          {u.caps.delete_patients && <Badge variant="outline">deletar</Badge>}
                          {u.caps.assigned_only && <Badge variant="destructive">restrita</Badge>}
                          {u.caps.manage_users && <Badge variant="outline">usuários</Badge>}
                          <span className="text-muted-foreground">({enabledCount})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.active ? <Badge>Ativo</Badge> : <Badge variant="destructive">Inativo</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(u)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleResetPassword(u.email)} title="Enviar reset de senha"><KeyRound className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} title="Deletar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && <UserDialog onClose={() => { setCreating(false); refresh(); }} />}
      {editing && <UserDialog user={editing} onClose={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function UserDialog({ user, onClose }: { user?: AdminUser; onClose: () => void }) {
  const isCreate = !user;
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [surgeonName, setSurgeonName] = useState(user?.surgeon_name ?? '');
  const [conciergeName, setConciergeName] = useState(user?.concierge_name ?? '');
  const [active, setActive] = useState(user?.active ?? true);
  const [roles, setRoles] = useState<AppRole[]>(user?.roles ?? []);
  const [caps, setCaps] = useState<CapsMap>(user?.caps ?? {});
  const [saving, setSaving] = useState(false);

  const toggleRole = (r: AppRole) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const toggleCap = (c: Capability) =>
    setCaps((prev) => ({ ...prev, [c]: !prev[c] }));

  const applyPreset = (key: keyof typeof PRESETS) => {
    if (key === 'custom') return;
    setCaps(PRESETS[key].caps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Normalize caps to full boolean map
      const fullCaps: CapsMap = ALL_CAPABILITIES.reduce(
        (acc, c) => ({ ...acc, [c]: !!caps[c] }), {} as CapsMap,
      );
      if (isCreate) {
        if (password.length < 8) throw new Error('Senha temporária deve ter ao menos 8 caracteres.');
        if (roles.length === 0) throw new Error('Selecione ao menos um papel.');
        await callAdmin({
          action: 'create',
          email, password, display_name: displayName,
          surgeon_name: roles.includes('surgeon') ? surgeonName || null : null,
          concierge_name: roles.includes('concierge') ? conciergeName || null : null,
          roles,
          caps: fullCaps,
        });
        toast.success('Usuário criado.');
      } else {
        await callAdmin({
          action: 'update',
          user_id: user!.user_id,
          display_name: displayName,
          surgeon_name: roles.includes('surgeon') ? surgeonName || null : null,
          concierge_name: roles.includes('concierge') ? conciergeName || null : null,
          active,
          roles,
          caps: fullCaps,
        });
        toast.success('Usuário atualizado.');
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSaving(false);
  };

  const groupedCaps = CAP_GROUP_ORDER.map((group) => ({
    group,
    items: ALL_CAPABILITIES.filter((c) => CAP_LABELS[c].group === group),
  }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Novo usuário' : `Editar ${user?.display_name}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identity */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome de exibição</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!isCreate} />
            </div>
            {isCreate && (
              <div className="space-y-2">
                <Label>Senha temporária</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                <p className="text-xs text-muted-foreground">O usuário deve trocar no primeiro acesso (use "Esqueci senha").</p>
              </div>
            )}
          </div>

          {/* Roles */}
          <div className="space-y-2 border-t pt-4">
            <Label className="text-base">Papel (define o escopo de pacientes)</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} id={`role-${r}`} />
                  <label htmlFor={`role-${r}`} className="text-sm cursor-pointer">{ROLE_LABELS[r]}</label>
                </div>
              ))}
            </div>
            {roles.includes('surgeon') && (
              <div className="space-y-2 mt-2">
                <Label>Nome do cirurgião (deve bater com o campo "surgeon" dos pacientes)</Label>
                <Input value={surgeonName} onChange={(e) => setSurgeonName(e.target.value)} placeholder="Ex.: Dr Alexandre Ziomkowski" />
              </div>
            )}
            {roles.includes('concierge') && (
              <div className="space-y-2 mt-2">
                <Label>Nome do concierge (deve bater com o campo "concierge" dos pacientes)</Label>
                <Input value={conciergeName} onChange={(e) => setConciergeName(e.target.value)} placeholder="Ex.: Margô" />
              </div>
            )}
          </div>

          {/* Capabilities */}
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label className="text-base">Capacidades (o que pode fazer)</Label>
              <p className="text-xs text-muted-foreground">Aplique um preset ou marque manualmente.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([key, p]) => (
                <Button key={key} type="button" variant="outline" size="sm" onClick={() => applyPreset(key as keyof typeof PRESETS)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {groupedCaps.map(({ group, items }) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                  {items.map((c) => (
                    <div key={c} className="flex items-start gap-2">
                      <Checkbox id={`cap-${c}`} checked={!!caps[c]} onCheckedChange={() => toggleCap(c)} className="mt-0.5" />
                      <label htmlFor={`cap-${c}`} className="text-sm cursor-pointer leading-tight">
                        {CAP_LABELS[c].label}
                        {CAP_LABELS[c].hint && (
                          <span className="block text-xs text-muted-foreground">{CAP_LABELS[c].hint}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {!isCreate && (
            <div className="flex items-center justify-between border-t pt-4">
              <Label>Conta ativa</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
