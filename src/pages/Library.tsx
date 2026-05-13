import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useMaterials,
  useSaveMaterial,
  useDeleteMaterial,
  uploadMaterialPdf,
  usePackages,
  useSavePackage,
  useDeletePackage,
  useAllPackageMaterials,
  Material,
  MaterialKind,
  MaterialPackage,
  MaterialPhase,
} from '@/hooks/useMaterials';
import { PROCEDURES, SURGEONS } from '@/data/constants';
import { ArrowLeft, Plus, Pencil, Trash2, FileText, Video, Type as TypeIcon, Upload, Package } from 'lucide-react';
import { toast } from 'sonner';

const NONE = '__none__';

const PHASE_LABEL: Record<MaterialPhase, string> = {
  preop: 'Pré-op',
  postop: 'Pós-op',
  general: 'Geral',
};

const KIND_LABEL: Record<MaterialKind, string> = {
  text: 'Texto',
  video: 'Vídeo',
  pdf: 'PDF',
};

function KindIcon({ kind, className = 'h-3.5 w-3.5' }: { kind: MaterialKind; className?: string }) {
  if (kind === 'text') return <TypeIcon className={className} />;
  if (kind === 'video') return <Video className={className} />;
  return <FileText className={className} />;
}

export default function Library() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Biblioteca de Orientações</h1>
            <p className="text-xs text-muted-foreground">Materiais e pacotes pré/pós-operatórios</p>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto">
        <Tabs defaultValue="materials">
          <TabsList>
            <TabsTrigger value="materials"><FileText className="h-4 w-4 mr-1.5" />Materiais</TabsTrigger>
            <TabsTrigger value="packages"><Package className="h-4 w-4 mr-1.5" />Pacotes</TabsTrigger>
          </TabsList>
          <TabsContent value="materials" className="mt-4"><MaterialsTab /></TabsContent>
          <TabsContent value="packages" className="mt-4"><PackagesTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============= Materials Tab =============

function MaterialsTab() {
  const { data: materials = [], isLoading } = useMaterials();
  const deleteMutation = useDeleteMaterial();
  const [editing, setEditing] = useState<Partial<Material> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{materials.length} material(is)</p>
        <Button size="sm" onClick={() => setEditing({ kind: 'text', phase: 'general' })}>
          <Plus className="h-4 w-4" />Novo material
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : materials.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum material cadastrado. Crie o primeiro para começar.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {materials.map((m) => (
            <Card key={m.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <KindIcon kind={m.kind} />
                    <h3 className="font-semibold text-sm truncate">{m.title}</h3>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                    if (confirm(`Excluir "${m.title}"?`)) deleteMutation.mutate(m.id);
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{KIND_LABEL[m.kind]}</Badge>
                <Badge variant="outline" className="text-[10px]">{PHASE_LABEL[m.phase]}</Badge>
                {m.procedure && <Badge variant="secondary" className="text-[10px]">{m.procedure}</Badge>}
                {m.surgeon && <Badge variant="secondary" className="text-[10px]">{m.surgeon}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <MaterialEditor material={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MaterialEditor({ material, onClose }: { material: Partial<Material>; onClose: () => void }) {
  const [data, setData] = useState<Partial<Material>>(material);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveMutation = useSaveMaterial();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadMaterialPdf(file);
      setData({ ...data, file_path: path });
      toast.success('PDF enviado');
    } catch (e: any) {
      toast.error(e.message || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!data.title) return toast.error('Informe um título');
    if (data.kind === 'video' && !data.content_url) return toast.error('Informe a URL do vídeo');
    if (data.kind === 'pdf' && !data.file_path) return toast.error('Faça upload do PDF');
    if (data.kind === 'text' && !data.body_html) return toast.error('Escreva o conteúdo');
    await saveMutation.mutateAsync(data);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{data.id ? 'Editar material' : 'Novo material'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Título</label>
            <Input value={data.title || ''} onChange={(e) => setData({ ...data, title: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Descrição</label>
            <Textarea rows={2} value={data.description || ''} onChange={(e) => setData({ ...data, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
              <Select value={data.kind || 'text'} onValueChange={(v) => setData({ ...data, kind: v as MaterialKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Fase</label>
              <Select value={data.phase || 'general'} onValueChange={(v) => setData({ ...data, phase: v as MaterialPhase })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preop">Pré-op</SelectItem>
                  <SelectItem value="postop">Pós-op</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Cirurgião</label>
              <Select value={data.surgeon || NONE} onValueChange={(v) => setData({ ...data, surgeon: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Todos</SelectItem>
                  {SURGEONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Procedimento</label>
            <Select value={data.procedure || NONE} onValueChange={(v) => setData({ ...data, procedure: v === NONE ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos (genérico)</SelectItem>
                {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {data.kind === 'text' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Conteúdo (HTML simples)</label>
              <Textarea rows={8} value={data.body_html || ''} onChange={(e) => setData({ ...data, body_html: e.target.value })} placeholder="Texto da orientação..." />
            </div>
          )}
          {data.kind === 'video' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground">URL do vídeo (YouTube, Drive, etc.)</label>
              <Input value={data.content_url || ''} onChange={(e) => setData({ ...data, content_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
            </div>
          )}
          {data.kind === 'pdf' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Arquivo PDF</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4" />{uploading ? 'Enviando...' : data.file_path ? 'Substituir PDF' : 'Selecionar PDF'}
                </Button>
                {data.file_path && <span className="text-xs text-muted-foreground truncate">{data.file_path}</span>}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Packages Tab =============

function PackagesTab() {
  const { data: packages = [], isLoading } = usePackages();
  const { data: allPM = [] } = useAllPackageMaterials();
  const deleteMutation = useDeletePackage();
  const [editing, setEditing] = useState<Partial<MaterialPackage> | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    allPM.forEach(pm => { c[pm.package_id] = (c[pm.package_id] || 0) + 1; });
    return c;
  }, [allPM]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{packages.length} pacote(s)</p>
        <Button size="sm" onClick={() => setEditing({ phase: 'general' })}>
          <Plus className="h-4 w-4" />Novo pacote
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : packages.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum pacote cadastrado.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packages.map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                    if (confirm(`Excluir "${p.name}"?`)) deleteMutation.mutate(p.id);
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{counts[p.id] || 0} materiais</Badge>
                <Badge variant="outline" className="text-[10px]">{PHASE_LABEL[p.phase]}</Badge>
                {p.procedure && <Badge variant="secondary" className="text-[10px]">{p.procedure}</Badge>}
                {p.surgeon && <Badge variant="secondary" className="text-[10px]">{p.surgeon}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <PackageEditor pkg={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PackageEditor({ pkg, onClose }: { pkg: Partial<MaterialPackage>; onClose: () => void }) {
  const { data: materials = [] } = useMaterials();
  const { data: allPM = [] } = useAllPackageMaterials();
  const [data, setData] = useState<Partial<MaterialPackage>>(pkg);
  const initialIds = useMemo(() =>
    pkg.id ? allPM.filter(pm => pm.package_id === pkg.id).map(pm => pm.material_id) : []
  , [pkg.id, allPM]);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const saveMutation = useSavePackage();

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!data.name) return toast.error('Informe um nome');
    await saveMutation.mutateAsync({ pkg: data, materialIds: selected });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{data.id ? 'Editar pacote' : 'Novo pacote'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Nome</label>
            <Input value={data.name || ''} onChange={(e) => setData({ ...data, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Descrição</label>
            <Textarea rows={2} value={data.description || ''} onChange={(e) => setData({ ...data, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Fase</label>
              <Select value={data.phase || 'general'} onValueChange={(v) => setData({ ...data, phase: v as MaterialPhase })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preop">Pré-op</SelectItem>
                  <SelectItem value="postop">Pós-op</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Cirurgião</label>
              <Select value={data.surgeon || NONE} onValueChange={(v) => setData({ ...data, surgeon: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Todos</SelectItem>
                  {SURGEONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Procedimento</label>
              <Select value={data.procedure || NONE} onValueChange={(v) => setData({ ...data, procedure: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Todos</SelectItem>
                  {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Materiais incluídos ({selected.length})</label>
            <div className="border border-border rounded-md max-h-72 overflow-y-auto divide-y divide-border">
              {materials.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Crie materiais primeiro.</p>
              ) : materials.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={selected.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                  <KindIcon kind={m.kind} />
                  <span className="text-sm flex-1 truncate">{m.title}</span>
                  <Badge variant="outline" className="text-[10px]">{PHASE_LABEL[m.phase]}</Badge>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
