import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
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
}

const ROLE_OPTIONS: AppRole[] = ['admin', 'surgeon', 'concierge', 'call_center'];
const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  surgeon: 'Cirurgião',
  concierge: 'Concierge',
  call_center: 'Call Center',
};

async function callAdmin(payload: unknown) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data;
}

export default function AdminUsers() {
  const { isAdmin, loading: roleLoading } = useUserRole();
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
    if (isAdmin) refresh();
  }, [isAdmin]);

  if (roleLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (!isAdmin) {
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
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
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
                  <TableHead>Identidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
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
                    <TableCell className="text-sm">
                      {u.surgeon_name && <div>cir: {u.surgeon_name}</div>}
                      {u.concierge_name && <div>conc: {u.concierge_name}</div>}
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
                ))}
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
  const [saving, setSaving] = useState(false);

  const toggleRole = (r: AppRole) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isCreate) {
        if (password.length < 8) throw new Error('Senha temporária deve ter ao menos 8 caracteres.');
        if (roles.length === 0) throw new Error('Selecione ao menos um papel.');
        await callAdmin({
          action: 'create',
          email, password, display_name: displayName,
          surgeon_name: roles.includes('surgeon') ? surgeonName || null : null,
          concierge_name: roles.includes('concierge') ? conciergeName || null : null,
          roles,
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
        });
        toast.success('Usuário atualizado.');
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Novo usuário' : `Editar ${user?.display_name}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="space-y-2">
            <Label>Papéis</Label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} id={`role-${r}`} />
                  <label htmlFor={`role-${r}`} className="text-sm cursor-pointer">{ROLE_LABELS[r]}</label>
                </div>
              ))}
            </div>
          </div>
          {roles.includes('surgeon') && (
            <div className="space-y-2">
              <Label>Nome do cirurgião (deve bater com o campo "surgeon" dos pacientes)</Label>
              <Input value={surgeonName} onChange={(e) => setSurgeonName(e.target.value)} placeholder="Ex.: Dr Alexandre Ziomkowski" />
            </div>
          )}
          {roles.includes('concierge') && (
            <div className="space-y-2">
              <Label>Nome do concierge (deve bater com o campo "concierge" dos pacientes)</Label>
              <Input value={conciergeName} onChange={(e) => setConciergeName(e.target.value)} placeholder="Ex.: Margô" />
            </div>
          )}
          {!isCreate && (
            <div className="flex items-center justify-between">
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
