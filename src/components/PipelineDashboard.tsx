import { useState, useMemo } from 'react';
import { Patient, PIPELINE_STAGES, DecisionStatus } from '@/data/types';
import { mockPatients } from '@/data/mockPatients';
import { PipelineColumn } from './PipelineColumn';
import { PatientPanel } from './PatientPanel';
import { FilterBar } from './FilterBar';
import { AddPatientForm } from './AddPatientForm';
import { Button } from '@/components/ui/button';
import { Plus, Users, DollarSign, TrendingUp } from 'lucide-react';

export function PipelineDashboard() {
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [surgeonFilter, setSurgeonFilter] = useState('all');
  const [conciergeFilter, setConciergeFilter] = useState('all');

  const surgeons = useMemo(() => [...new Set(patients.map((p) => p.surgeon))], [patients]);
  const concierges = useMemo(() => [...new Set(patients.map((p) => p.concierge))], [patients]);

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.procedure.toLowerCase().includes(search.toLowerCase())) return false;
      if (surgeonFilter !== 'all' && p.surgeon !== surgeonFilter) return false;
      if (conciergeFilter !== 'all' && p.concierge !== conciergeFilter) return false;
      return true;
    });
  }, [patients, search, surgeonFilter, conciergeFilter]);

  const totalValue = useMemo(() => filtered.reduce((s, p) => s + (p.estimatedValue || 0), 0), [filtered]);
  const completedCount = filtered.filter((p) => p.stage === 'surgery_completed').length;
  const conversionRate = filtered.length > 0 ? Math.round((completedCount / filtered.length) * 100) : 0;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setPanelOpen(true);
  };

  const handleUpdateDecision = (patientId: string, status: DecisionStatus) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, decisionStatus: status } : p))
    );
    setSelectedPatient((prev) => (prev && prev.id === patientId ? { ...prev, decisionStatus: status } : prev));
  };

  const handleAddPatient = (patient: Patient) => {
    setPatients((prev) => [...prev, patient]);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Pipeline Cirúrgico</h1>
            <p className="text-sm text-muted-foreground">Gestão de conversão de pacientes</p>
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Novo Paciente
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Pacientes:</span>
            <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Pipeline:</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Conversão:</span>
            <span className="font-semibold text-foreground">{conversionRate}%</span>
          </div>
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          surgeon={surgeonFilter}
          onSurgeonChange={setSurgeonFilter}
          concierge={conciergeFilter}
          onConciergeChange={setConciergeFilter}
          surgeons={surgeons}
          concierges={concierges}
        />
      </header>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {PIPELINE_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              patients={filtered.filter((p) => p.stage === stage)}
              onPatientClick={handlePatientClick}
            />
          ))}
        </div>
      </div>

      {/* Patient Panel */}
      <PatientPanel
        patient={selectedPatient}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onUpdateDecision={handleUpdateDecision}
      />

      {/* Add Patient Dialog */}
      <AddPatientForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddPatient}
        surgeons={surgeons}
        concierges={concierges}
      />
    </div>
  );
}
