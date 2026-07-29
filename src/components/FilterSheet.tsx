import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { FilterBar } from './FilterBar';
import { ComponentProps } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

type FilterBarProps = ComponentProps<typeof FilterBar>;

export function FilterSheet(props: FilterBarProps) {
  const isMobile = useIsMobile();
  const activeCount = [
    props.surgeon !== 'all', props.concierge !== 'all', props.procedure !== 'all',
    props.patientType !== 'all', props.surgicalApproach !== 'all', props.payer !== 'all',
    props.billingType !== 'all', props.hospital !== 'all', props.indicationSource !== 'all',
    !!props.indicationFrom, !!props.indicationTo,
  ].filter(Boolean).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-8 text-xs px-2.5">
          <Filter className="h-3.5 w-3.5 mr-1" />
          Filtros
          {activeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={isMobile ? 'h-[85vh] overflow-y-auto' : 'w-[480px] sm:max-w-[480px] overflow-y-auto'}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        <FilterBar {...props} hideSearch={!isMobile} />
      </SheetContent>
    </Sheet>
  );
}
