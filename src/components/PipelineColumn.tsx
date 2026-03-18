import { Patient, PipelineStage, STAGE_LABELS } from '@/data/types';
import { PatientCard } from './PatientCard';
import { Badge } from '@/components/ui/badge';
import { Droppable, Draggable } from '@hello-pangea/dnd';

interface PipelineColumnProps {
  stage: PipelineStage;
  patients: Patient[];
  onPatientClick: (patient: Patient) => void;
  onCompleteTask: (patientId: string, taskId: string) => void;
}

export function PipelineColumn({ stage, patients, onPatientClick, onCompleteTask }: PipelineColumnProps) {
  const totalValue = patients.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px] shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide leading-tight">
          {STAGE_LABELS[stage]}
        </h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
          {patients.length}
        </Badge>
      </div>
      {totalValue > 0 && (
        <p className="text-[10px] text-muted-foreground mb-2 px-1">{formatCurrency(totalValue)}</p>
      )}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 flex-1 overflow-y-auto pr-1 pb-2 min-h-[80px] rounded-lg transition-colors ${
              snapshot.isDraggingOver ? 'bg-primary/5' : ''
            }`}
          >
            {patients.map((p, index) => (
              <Draggable key={p.id} draggableId={p.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={snapshot.isDragging ? 'opacity-90 rotate-1' : ''}
                  >
                    <PatientCard patient={p} onClick={onPatientClick} onCompleteTask={onCompleteTask} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {patients.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
                Nenhum paciente
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
