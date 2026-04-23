import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DocumentType,
  TEMPLATE_VARIABLES,
  DEFAULT_TEMPLATE_BODIES,
  DocumentTemplate,
} from '@/data/documents';
import { SURGEONS } from '@/data/constants';
import { useDocumentTemplates, useSaveTemplate, useDeleteTemplate } from '@/hooks/useDocuments';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';

const NO_SURGEON = '__none__';

export default function Templates() {
  const { data: templates = [], isLoading } = useDocumentTemplates();
  const saveMutation = useSaveTemplate();
  const deleteMutation = useDeleteTemplate();
  const [editing, setEditing] = useState<Partial<DocumentTemplate> | null>(null);

  const grouped = useMemo(() => {
    const out: Record<DocumentType, DocumentTemplate[]> = {
      budget: [], surgical_request: [], medical_certificate: [], report: [],
    };
    templates.forEach((t) => out[t.type]?.push(t));
    return out;
  }, [templates]);

  const startNew = (type: DocumentType) => {
    const seed = DEFAULT_TEMPLATE_BODIES[type];
    setEditing({
      type,
      surgeon: null,
      title: seed.title,
      body_html: seed.body,
      header_html: '',
      footer_html: '',
      is_default: false,
    });
  };

  const handleSave = async () => {
    if (!editing?.type || !editing?.title || !editing?.body_html) return;
    await saveMutation.mutateAsync(editing as any);
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Templates de Documentos</h1>
          <p className="text-sm text-muted-foreground">Modelos por tipo e cirurgião usados ao gerar PDFs</p>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          DOCUMENT_TYPES.map((type) => (
            <section key={type} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{DOCUMENT_TYPE_LABELS[type]}</h2>
                <Button size="sm" variant="outline" onClick={() => startNew(type)}>
                  <Plus className="h-4 w-4 mr-1" />Novo template
                </Button>
              </div>

              {grouped[type].length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum template — será usado o padrão.</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {grouped[type].map((t) => (
                  <Card key={t.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {t.surgeon ? (
                            <Badge variant="outline" className="text-[10px]">{t.surgeon}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Genérico</Badge>
                          )}
                          {t.is_default && <Badge className="text-[10px]">Padrão</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm('Excluir este template?')) deleteMutation.mutate(t.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? 'Editar template' : 'Novo template'} — {editing?.type ? DOCUMENT_TYPE_LABELS[editing.type] : ''}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Cirurgião (opcional)</label>
                  <Select
                    value={editing.surgeon ?? NO_SURGEON}
                    onValueChange={(v) => setEditing({ ...editing, surgeon: v === NO_SURGEON ? null : v })}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SURGEON}>Genérico (qualquer cirurgião)</SelectItem>
                      {SURGEONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Marcar como padrão</label>
                  <Select
                    value={editing.is_default ? 'yes' : 'no'}
                    onValueChange={(v) => setEditing({ ...editing, is_default: v === 'yes' })}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Não</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Título</label>
                <Input
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Cabeçalho (opcional)</label>
                <Textarea
                  value={editing.header_html || ''}
                  onChange={(e) => setEditing({ ...editing, header_html: e.target.value })}
                  rows={2}
                  className="text-xs font-mono"
                  placeholder="Ex: Clínica Uro — CNPJ 00.000.000/0001-00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Corpo (HTML)</label>
                <Textarea
                  value={editing.body_html || ''}
                  onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                  rows={12}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Rodapé (opcional)</label>
                <Textarea
                  value={editing.footer_html || ''}
                  onChange={(e) => setEditing({ ...editing, footer_html: e.target.value })}
                  rows={2}
                  className="text-xs font-mono"
                />
              </div>

              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Variáveis disponíveis (clique para copiar):
                </p>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      className="text-[11px] px-2 py-1 rounded bg-background border border-border hover:bg-accent transition-colors font-mono"
                      onClick={() => navigator.clipboard.writeText(`{{${v.key}}}`)}
                      title={v.label}
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
