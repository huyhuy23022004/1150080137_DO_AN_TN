import type { ReactNode } from 'react';

interface TableToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
}

export function TableToolbar({ left, right }: TableToolbarProps) {
  return (
    <div className="table-toolbar">
      <div className="table-toolbar-left">{left}</div>
      <div className="table-toolbar-right">{right}</div>
    </div>
  );
}
