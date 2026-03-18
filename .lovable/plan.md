

# Surgical Conversion Pipeline CRM — Implementation Plan

## Summary
Build a 9-stage Kanban-style surgical conversion pipeline CRM with patient cards, filters, and a slide-over patient record panel. All local state with mock data.

## Files to Create/Modify

### 1. Data Layer
- **`src/data/types.ts`** — Types: `PipelineStage`, `DecisionStatus`, `ContactRecord`, `Patient`
- **`src/data/mockPatients.ts`** — 15+ mock patients across 9 stages with follow-up histories and surgery values

### 2. Components
- **`src/components/PipelineDashboard.tsx`** — Main layout: stats bar + filter bar + horizontally scrollable Kanban columns + slide-over
- **`src/components/PipelineColumn.tsx`** — Single column with stage name, count, stacked patient cards
- **`src/components/PatientCard.tsx`** — Compact card: name, procedure, surgeon, value, last interaction, next action
- **`src/components/FilterBar.tsx`** — Filters by stage, surgeon, concierge, search
- **`src/components/PatientPanel.tsx`** — 480px Sheet slide-over: decision status, follow-up timeline, concierge, next action, surgery value
- **`src/components/FollowUpTimeline.tsx`** — Vertical chronological contact history
- **`src/components/AddPatientForm.tsx`** — Dialog form for adding new patients

### 3. Pages
- **`src/pages/Index.tsx`** — Render `PipelineDashboard`

### 4. Styling
- **`src/index.css`** — Add IBM Plex Sans import, custom pipeline colors (surgical blue, conversion green, amber, gray)

## Design Decisions
- 9 columns scroll horizontally with min-width per column (~200px)
- Cards show estimated value formatted as currency (R$)
- Decision status badges: waiting (gray), thinking (amber), negotiating (blue), confirmed (green)
- Sheet component for the patient slide-over panel
- Stats bar: total patients, pipeline value, conversion rate
- All state managed via useState at dashboard level

