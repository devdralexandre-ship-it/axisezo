# Plano: SLA, Sobrecarga da Concierge e Documentos com Sync Google Drive

Quatro frentes integradas. Posso entregar em uma única iteração ou faseado — recomendo a ordem abaixo.

---

## 1. SLA por ação/tarefa com escalonamento

**Objetivo:** garantir que nenhuma tarefa fique parada além do prazo combinado, com aviso automático quando a concierge não responde.

### Schema
- `tasks`: adicionar `sla_hours` (int, default por preset), `sla_breached_at` (timestamptz), `escalated_at` (timestamptz), `escalated_to` (text).
- Nova tabela `sla_policies` (admin configura): `preset` (matches taskPresets), `hours_to_due`, `hours_to_escalate`, `escalate_to_role` (admin/surgeon).
- Seed inicial com defaults razoáveis por tipo de ação (contato inicial 4h, agendamento 24h, follow-up autorização 48h, etc.).

### Lógica
- Cron edge function (a cada 15 min) varre tarefas não concluídas:
  - `due_date+due_time` ultrapassado e `sla_breached_at` nulo → marca breach + cria notificação.
  - Se `now() - due > escalate_hours` e sem `escalated_at` → escala (notifica admin + cirurgião responsável), grava `escalated_at`.
- Notificações reaproveitam o sino existente (`NotificationBell`).

### UI
- Card no Kanban: badge "SLA -2h", "Atrasada 3h", "Escalada".
- `PatientPanel`: tarefas atrasadas no topo em vermelho.
- Filtro "Apenas SLA estourado" no `FilterBar`.

---

## 2. Visibilidade da carga da concierge

**Objetivo:** admin enxerga quem está sobrecarregado e quais pacientes estão "esquecidos".

### Dashboard de carga (nova rota `/admin/workload`, só admin)
Tabela por concierge:
- Pacientes ativos
- Tarefas abertas / atrasadas / escaladas
- Tempo médio de resposta (intervalo entre criação da tarefa e conclusão, últimos 30 dias)
- Pacientes parados há >7 dias na etapa atual

Permite drag-and-drop de pacientes entre concierges (atualiza `patients.concierge`).

### Alertas automáticos de inatividade
- Mesmo cron do SLA: se `patients.last_interaction_date < now() - 7 dias` e estágio ≠ terminal, marca como "inativo".
- Nova coluna virtual no Kanban: badge "🔔 Inativo há Xd" no card.
- Seção "Precisa de atenção" colapsável no topo da dashboard pessoal de cada concierge.

---

## 3. Upload de documentos pelo paciente (arquivo + câmera)

**Objetivo:** call center anexa documentos no cadastro; concierge complementa depois pelo painel.

### Schema
Nova tabela `patient_uploads`:
- `patient_id`, `category` (rg, exame, laudo, autorizacao, foto_clinica, outro), `file_name`, `storage_path`, `mime_type`, `size_bytes`, `uploaded_by`, `drive_file_id` (nullable), `drive_synced_at` (nullable).

Bucket `patient-uploads` (privado), pasta `{patient_id}/{category}/{uuid}_{filename}`.

RLS: `can_access_patient(patient_id)`.

### UI
- **Cadastro inicial (`AddPatientForm`)**: novo bloco "Anexos" — múltiplos arquivos, categoria por arquivo, drag-and-drop. Arquivos são bufferizados em memória e enviados após o paciente ser salvo (já temos id).
- **`PatientPanel`**: nova aba/seção "Documentos do paciente" (separada da seção atual "Documentos gerados"). Lista por categoria, preview de imagem/PDF, download, exclusão.
- **Captura de câmera**: input `<input type="file" accept="image/*" capture="environment">` em mobile abre câmera direto; em desktop, fallback para seletor de arquivo. Botão dedicado "Tirar foto".
- Limites: 20 MB/arquivo, formatos aceitos PDF/JPG/PNG/HEIC.

---

## 4. Sincronização opcional com Google Drive

**Objetivo:** documentos vivem no storage interno (fonte da verdade); cópia espelhada no Drive da clínica para a secretária manipular/encaminhar.

### Conexão
Conector Google Drive (conta única da clínica, via OAuth do builder). Pasta raiz configurável (ex.: "AxisCRM Pacientes").

### Estrutura no Drive
```text
AxisCRM Pacientes/
  {Nome do Paciente} - {id curto}/
    Documentos do Paciente/
      RG/
      Exames/
      Laudos/
      Autorizações/
      Fotos clínicas/
      Outros/
    Documentos Gerados/
      Solicitações cirúrgicas/
      Receitas/
      Atestados/
      Laudos/
      Orçamentos/
```

### Sync
- Edge function `sync-to-drive` chamada:
  - Após upload em `patient_uploads` (assíncrona, fire-and-forget).
  - Após geração ou assinatura de documento em `patient_documents` (substitui versão anterior, mantém o assinado como definitivo).
- Idempotente: cria pastas se não existirem, atualiza arquivo se `drive_file_id` já existe.
- Configuração admin: ligar/desligar sync global, ver status (último sync, falhas), botão "Resincronizar paciente".
- Falha de sync **não** bloqueia a operação no CRM — registra erro e mostra ícone de aviso no item.

### Acesso da secretária
- Ela acessa direto o Drive da clínica (fora do CRM) para encaminhar por email/WhatsApp.
- Bonus opcional: link "Abrir no Drive" em cada arquivo no CRM.

---

## Ordem de entrega sugerida

1. **Uploads + bucket + UI** (mais isolado, valor imediato).
2. **SLA + cron + notificações** (mexe em tarefas, base para o painel).
3. **Painel de carga + alertas de inatividade** (consome dados do passo 2).
4. **Sync Google Drive** (depende dos passos 1 e dos documentos já existentes; precisa do conector conectado).

Posso começar pelo passo 1 ou fazer tudo numa sequência longa — me diga a preferência. Se "tudo", sigo na ordem acima.
