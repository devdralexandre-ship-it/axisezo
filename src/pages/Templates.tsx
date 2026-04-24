import { useState, useMemo, useRef, useEffect } from 'react';
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
import {
  useDocumentTemplates,
  useSaveTemplate,
  useDeleteTemplate,
  uploadTemplateLogo,
  removeTemplateLogo,
  uploadTemplatePdf,
  getTemplatePdfSignedUrl,
  removeTemplatePdf,
} from '@/hooks/useDocuments';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PdfTemplateEditor } from '@/components/PdfTemplateEditor';
import { ArrowLeft, Plus, Pencil, Trash2, Upload, Image as ImageIcon, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

const NO_SURGEON = '__none__';
const BUCKET = 'patient-documents';

export default function Templates() {
  const { data: templates = [], isLoading } = useDocumentTemplates();
  const saveMutation = useSaveTemplate();
  const deleteMutation = useDeleteTemplate();
  const [editing, setEditing] = useState<Partial<DocumentTemplate> | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Resolve current logo signed URL when editing
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (editing?.logo_path) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(editing.logo_path, 600);
        if (!canceled) setLogoPreviewUrl(data?.signedUrl ?? null);
      } else {
        setLogoPreviewUrl(null);
      }
    })();
    return () => { canceled = true; };
  }, [editing?.logo_path]);

  // Resolve PDF template signed URL
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (editing?.pdf_template_path) {
        const url = await getTemplatePdfSignedUrl(editing.pdf_template_path);
        if (!canceled) setPdfPreviewUrl(url);
      } else {
        setPdfPreviewUrl(null);
      }
    })();
    return () => { canceled = true; };
  }, [editing?.pdf_template_path]);

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
      logo_path: null,
      default_data: {},
      mode: 'html',
      pdf_template_path: null,
      content_box: null,
      signature_box: null,
      continuation_strategy: 'same_page',
    });
  };

  const handleSave = async () => {
    if (!editing?.type || !editing?.title) return;
    await saveMutation.mutateAsync(editing as any);
    setEditing(null);
  };

  const handleLogoUpload = async (file: File) => {
    if (!editing?.id) {
      // Need to save first to obtain an id
      toast.message('Salve o template uma vez antes de enviar a logo.');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Logo deve ter no máximo 1MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const path = await uploadTemplateLogo(editing.id, file);
      const updated = { ...editing, logo_path: path };
      setEditing(updated);
      await saveMutation.mutateAsync(updated as any);
      toast.success('Logo enviada!');
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!editing?.logo_path) return;
    try {
      await removeTemplateLogo(editing.logo_path);
      const updated = { ...editing, logo_path: null };
      setEditing(updated);
      if (editing.id) await saveMutation.mutateAsync(updated as any);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (!editing?.id) {
      toast.message('Salve o template uma vez antes de enviar o PDF timbrado.');
      return;
    }
    if (file.type !== 'application/pdf') {
      toast.error('Envie um arquivo PDF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('PDF deve ter no máximo 5MB');
      return;
    }
    setUploadingPdf(true);
    try {
      const path = await uploadTemplatePdf(editing.id, file);
      const updated = { ...editing, pdf_template_path: path, mode: 'pdf' as const };
      setEditing(updated);
      await saveMutation.mutateAsync(updated as any);
      toast.success('PDF enviado! Agora demarque a área de conteúdo.');
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handlePdfRemove = async () => {
    if (!editing?.pdf_template_path) return;
    try {
      await removeTemplatePdf(editing.pdf_template_path);
      const updated = { ...editing, pdf_template_path: null, content_box: null, signature_box: null };
      setEditing(updated);
      if (editing.id) await saveMutation.mutateAsync(updated as any);
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const isSurgical = editing?.type === 'surgical_request';
  const defaults = (editing?.default_data ?? {}) as any;
  const currentMode: 'html' | 'pdf' = (editing?.mode as any) ?? 'html';

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
                      <div className="min-w-0 flex items-center gap-2">
                        {t.logo_path && (
                          <div className="h-8 w-8 rounded bg-muted shrink-0 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{t.title}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {t.surgeon ? (
                              <Badge variant="outline" className="text-[10px]">{t.surgeon}</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Genérico</Badge>
                            )}
                            {t.is_default && <Badge className="text-[10px]">Padrão</Badge>}
                            {t.mode === 'pdf' && <Badge variant="outline" className="text-[10px] border-primary text-primary">PDF Timbrado</Badge>}
                          </div>
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

              <Tabs value={currentMode} onValueChange={(v) => setEditing({ ...editing, mode: v as any })}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="html">HTML (texto simples)</TabsTrigger>
                  <TabsTrigger value="pdf">PDF Timbrado</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="space-y-4 mt-4">
                  {/* Logo */}
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <label className="text-xs font-semibold text-muted-foreground">Logo do cabeçalho (PNG/JPG, máx 1MB)</label>
                    <div className="flex items-center gap-3">
                      {logoPreviewUrl ? (
                        <img src={logoPreviewUrl} alt="Logo" className="h-16 w-16 object-contain rounded border border-border bg-muted/30" />
                      ) : (
                        <div className="h-16 w-16 rounded border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleLogoUpload(f);
                            e.target.value = '';
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingLogo || !editing.id}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {logoPreviewUrl ? 'Trocar logo' : 'Enviar logo'}
                        </Button>
                        {logoPreviewUrl && (
                          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={handleLogoRemove}>
                            <X className="h-3 w-3 mr-1" />Remover
                          </Button>
                        )}
                      </div>
                    </div>
                    {!editing.id && (
                      <p className="text-[11px] text-muted-foreground">Salve o template uma vez antes de enviar a logo.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Cabeçalho (texto opcional)</label>
                    <Textarea
                      value={editing.header_html || ''}
                      onChange={(e) => setEditing({ ...editing, header_html: e.target.value })}
                      rows={2}
                      className="text-xs font-mono"
                      placeholder="Ex: Clínica Uro — CNPJ 00.000.000/0001-00"
                    />
                  </div>

                  {isSurgical ? (
                    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Padrões do formulário cirúrgico (opcional)
                      </p>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Descrição cirúrgica padrão</label>
                        <Textarea
                          value={defaults.surgicalDescription || ''}
                          onChange={(e) => setEditing({
                            ...editing,
                            default_data: { ...defaults, surgicalDescription: e.target.value },
                          })}
                          rows={4}
                          className="text-sm"
                          placeholder="Texto análogo ao código cirúrgico solicitado…"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">Regime padrão</label>
                          <Select
                            value={defaults.regime || 'inpatient'}
                            onValueChange={(v) => setEditing({
                              ...editing,
                              default_data: { ...defaults, regime: v },
                            })}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inpatient">Hospitalar</SelectItem>
                              <SelectItem value="day_hospital">Hospital-dia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Corpo (HTML)</label>
                        <Textarea
                          value={editing.body_html || ''}
                          onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                          rows={12}
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
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Rodapé (opcional)</label>
                    <Textarea
                      value={editing.footer_html || ''}
                      onChange={(e) => setEditing({ ...editing, footer_html: e.target.value })}
                      rows={2}
                      className="text-xs font-mono"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="pdf" className="space-y-4 mt-4">
                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">PDF timbrado do cirurgião</p>
                        <p className="text-[11px] text-muted-foreground">
                          Suba o PDF com cabeçalho, marca d'água e rodapé já desenhados. O sistema escreverá apenas o conteúdo do documento dentro da área que você demarcar.
                        </p>
                      </div>
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePdfUpload(f);
                          e.target.value = '';
                        }}
                      />
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={uploadingPdf || !editing.id}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {pdfPreviewUrl ? 'Trocar PDF' : 'Enviar PDF'}
                        </Button>
                        {pdfPreviewUrl && (
                          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={handlePdfRemove}>
                            <X className="h-3 w-3 mr-1" />Remover
                          </Button>
                        )}
                      </div>
                    </div>
                    {!editing.id && (
                      <p className="text-[11px] text-muted-foreground">Salve o template uma vez antes de enviar o PDF.</p>
                    )}
                    {pdfPreviewUrl && editing.id && (
                      <div className="pt-2">
                        <PdfTemplateEditor
                          fileUrl={pdfPreviewUrl}
                          contentBox={(editing.content_box as any) ?? null}
                          signatureBox={(editing.signature_box as any) ?? null}
                          onChange={({ contentBox, signatureBox }) =>
                            setEditing({ ...editing, content_box: contentBox, signature_box: signatureBox })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground mt-2">
                          <FileText className="h-3 w-3 inline mr-1" />
                          A caixa verde define onde o conteúdo será escrito. A caixa azul reserva espaço para assinatura digital (usada na próxima etapa).
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Estratégia de continuação (páginas extras)</label>
                    <Select
                      value={editing.continuation_strategy ?? 'same_page'}
                      onValueChange={(v) => setEditing({ ...editing, continuation_strategy: v as any })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same_page">Repetir mesmo timbre em todas as páginas</SelectItem>
                        <SelectItem value="second_page">Usar página 2 do PDF (se existir)</SelectItem>
                        <SelectItem value="blank">Folha em branco</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isSurgical && (
                    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Padrões do formulário cirúrgico (opcional)
                      </p>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Descrição cirúrgica padrão</label>
                        <Textarea
                          value={defaults.surgicalDescription || ''}
                          onChange={(e) => setEditing({
                            ...editing,
                            default_data: { ...defaults, surgicalDescription: e.target.value },
                          })}
                          rows={4}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
