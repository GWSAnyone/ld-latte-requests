import { defaultPriority, priorities } from './domain';
import type { Priority } from './domain';

export function PriorityTag({ value = defaultPriority }: { value?: Priority }) {
  return <span className={`priority-tag priority-${priorities.indexOf(value)}`}>{value}</span>;
}

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (value: Priority) => void }) {
  return <div className="priority-picker" role="group" aria-label="Срочность заявки">{priorities.map(priority => <button type="button" key={priority} aria-pressed={value === priority} onClick={() => onChange(priority)}><PriorityTag value={priority} /></button>)}</div>;
}
