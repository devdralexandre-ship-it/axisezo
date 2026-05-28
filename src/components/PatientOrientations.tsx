import { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useMaterials,
  usePackages,
  useAllPackageMaterials,
  usePatientSentMaterials,
  useMarkSent,
  getMaterialFileUrl,
  suggestForPatient,
  Material,
  MaterialKind,
  MaterialPackage,
  MaterialPhase,
} from '@/hooks/useMaterials';
import { Patient } from '@/data/types';
import { FileText, Video, Type as TypeIcon, CheckCircle2, ExternalLink, Send, Package as PackageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const PHASE_LABEL: Record<MaterialPhase, string> = { preop: 'Pré-op', postop: 'Pós-op', general: 'Geral' };

function KindIcon({ kind, className = 'h-3.5 w-3.5' }: { kind: MaterialKind; className?: string }) {
  if (kind === 'text') return <TypeIcon className={className} />;
  if (kind === 'video') return <Video className={className} />;
  return <FileText className={className} />;
}

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

interface Props { patient: Patient }

export function PatientOrientations({ patient }: Props) {
  const { data: materials = [] } = useMaterials();
  const { data: packages = [] } = usePackages();
  const { data: allPM = [] } = useAllPackageMaterials();
  const { data: sent = [] } = usePatientSentMaterials(patient.id);
  const markSent = useMarkSent();

  const [filter, setFilter] = useState<'all' | MaterialPhase | 'packages'>('all');
  const [viewing, setViewing] = useState<Material | null>(null);
  const [viewingPackage, setViewingPackage] = useState<MaterialPackage | null>(null);

  const sortedAll = useMemo(() => suggestForPatient(materials, packages, {
    procedure: patient.procedure,
    surgeon: patient.surgeon,
    stage: patient.stage,
  }), [materials, packages, patient.procedure, patient.surgeon, patient.stage]);

  const sentMaterialIds = useMemo(() => new Set(sent.filter(s => s.material_id).map(s => s.material_id!)), [sent]);
  const sentPackageIds = useMemo(() => new Set(sent.filter(s => s.package_id).map(s => s.package_id!)), [sent]);

  const filteredMaterials = useMemo(() => {
    if (filter === 'all') return sortedAll.materials;
    if (filter === 'packages') return [];
    return sortedAll.materials.filter(m => m.phase === filter);
  }, [sortedAll.materials, filter]);

  const filteredPackages = useMemo(() => {
    if (filter === 'all' || filter === 'packages') return sortedAll.packages;
    return sortedAll.packages.filter(p => p.phase === filter);
  }, [sortedAll.packages, filter]);

  // Proactive suggestion banner
  const suggestion = useMemo(() => {
    if (patient.stage === 'surgery_scheduled' || patient.stage === 'preop_preparation') {
      const pkg = sortedAll.packages.find(p =>
        (p.phase === 'preop') &&
        (!p.procedure || p.procedure === patient.procedure) &&
        !sentPackageIds.has(p.id)
      );
      if (pkg) return { phase: 'pré-op', pkg };
    }
    if (patient.stage === 'surgery_completed') {
      const pkg = sortedAll.packages.find(p =>
        (p.phase === 'postop') &&
        (!p.procedure || p.procedure === patient.procedure) &&
        !sentPackageIds.has(p.id)
      );
      if (pkg) return { phase: 'pós-op', pkg };
    }
    return null;
  }, [patient.stage, patient.procedure, sortedAll.packages, sentPackageIds]);

  const openMaterial = async (m: Material) => {
    if (m.kind === 'pdf' && m.file_path) {
      const url = await getMaterialFileUrl(m.file_path);
      if (url) window.open(url, '_blank');
      else toast.error('Não foi possível abrir o PDF');
      return;
    }
    setViewing(m);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Orientações
        </h3>
      </div>

      {suggestion && (
        <Card className="p-3 bg-warning-bg border-warning/30">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold">Sugerido:</span> enviar pacote {suggestion.phase} —{' '}
              <span className="font-medium">{suggestion.pkg.name}</span>
            </div>
            <Button size="sm" onClick={() => markSent.mutate({ patientId: patient.id, packageId: suggestion.pkg.id })}>
              <Send className="h-3.5 w-3.5" />Marcar enviado
            </Button>
          </div>
        </Card>
      )}

      <div className="flex gap-1 flex-wrap">
        {([
          { k: 'all', label: 'Todos' },
          { k: 'preop', label: 'Pré-op' },
          { k: 'postop', label: 'Pós-op' },
          { k: 'general', label: 'Geral' },
          { k: 'packages', label: 'Pacotes' },
        ] as const).map(opt => (
          <Button
            key={opt.k}
            size="sm"
            variant={filter === opt.k ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setFilter(opt.k as any)}
          >{opt.label}</Button>
        ))}
      </div>

      {filteredPackages.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pacotes</p>
          {filteredPackages.map(p => {
            const items = allPM.filter(pm => pm.package_id === p.id);
            const isSent = sentPackageIds.has(p.id);
            return (
              <Card key={p.id} className="p-2.5">
                <div className="flex items-center gap-2">
                  <PackageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {isSent && <CheckCircle2 className="h-3.5 w-3.5 text-pipeline-green shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">{items.length} mat.</Badge>
                      <Badge variant="outline" className="text-[10px]">{PHASE_LABEL[p.phase]}</Badge>
                      {p.procedure && <Badge variant="secondary" className="text-[10px]">{p.procedure}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewingPackage(p)}>Ver</Button>
                    {!isSent && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => markSent.mutate({ patientId: patient.id, packageId: p.id })}>
                        <Send className="h-3 w-3" />Enviei
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {filter !== 'packages' && (
        <div className="space-y-1.5">
          {filteredPackages.length > 0 && filteredMaterials.length > 0 && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Materiais</p>
          )}
          {filteredMaterials.length === 0 && filteredPackages.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Nenhum material disponível.</p>
          ) : filteredMaterials.map(m => {
            const isSent = sentMaterialIds.has(m.id);
            return (
              <Card key={m.id} className="p-2.5">
                <div className="flex items-center gap-2">
                  <KindIcon kind={m.kind} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.title}</span>
                      {isSent && <CheckCircle2 className="h-3.5 w-3.5 text-pipeline-green shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">{PHASE_LABEL[m.phase]}</Badge>
                      {m.procedure && <Badge variant="secondary" className="text-[10px]">{m.procedure}</Badge>}
                      {m.surgeon && <Badge variant="secondary" className="text-[10px]">{m.surgeon}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openMaterial(m)}>
                      <ExternalLink className="h-3 w-3" />Ver
                    </Button>
                    {!isSent && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => markSent.mutate({ patientId: patient.id, materialId: m.id })}>
                        <Send className="h-3 w-3" />Enviei
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Material viewer */}
      {viewing && (
        <Dialog open onOpenChange={() => setViewing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{viewing.title}</DialogTitle></DialogHeader>
            {viewing.description && <p className="text-sm text-muted-foreground">{viewing.description}</p>}
            {viewing.kind === 'text' && (
              <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: viewing.body_html }} />
            )}
            {viewing.kind === 'video' && viewing.content_url && (
              youtubeEmbed(viewing.content_url) ? (
                <div className="aspect-video">
                  <iframe className="w-full h-full rounded-md" src={youtubeEmbed(viewing.content_url)!} allowFullScreen />
                </div>
              ) : (
                <a href={viewing.content_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                  Abrir vídeo em nova aba
                </a>
              )
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Package viewer */}
      {viewingPackage && (
        <Dialog open onOpenChange={() => setViewingPackage(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{viewingPackage.name}</DialogTitle></DialogHeader>
            {viewingPackage.description && <p className="text-sm text-muted-foreground">{viewingPackage.description}</p>}
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {allPM
                .filter(pm => pm.package_id === viewingPackage.id)
                .map(pm => {
                  const m = materials.find(x => x.id === pm.material_id);
                  if (!m) return null;
                  return (
                    <div key={pm.id} className="flex items-center gap-2 p-2 rounded border border-border">
                      <KindIcon kind={m.kind} />
                      <span className="text-sm flex-1 truncate">{m.title}</span>
                      <Badge variant="outline" className="text-[10px]">{PHASE_LABEL[m.phase]}</Badge>
                    </div>
                  );
                })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
