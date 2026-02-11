import type { DayEvent, TrainingSession } from './playbook';

export type SessionBillingEffect = {
  status: 'normal' | 'rain' | 'cancelled';
  charge: number;
  credit: number;
  net: number;
  involvedCount: number;
};

export function getDayEventTypeForDate(dayEvents: DayEvent[] = [], date: string): DayEvent['type'] | undefined {
  return dayEvents.find((event) => event.date === date)?.type;
}

export function getSessionBillingForClient(
  session: TrainingSession,
  clientPlayerIds: Set<string>,
  dayEvents: DayEvent[] = []
): SessionBillingEffect {
  const involvedCount = session.participantIds.filter((pid) => clientPlayerIds.has(pid)).length;
  if (involvedCount === 0) {
    return { status: 'normal', charge: 0, credit: 0, net: 0, involvedCount: 0 };
  }

  const baseCharge = (session.price || 0) * involvedCount;
  const dayType = getDayEventTypeForDate(dayEvents, session.date);

  if (dayType === 'Rain') {
    return { status: 'rain', charge: 0, credit: 0, net: 0, involvedCount };
  }
  if (dayType === 'Coach Cancelled') {
    return { status: 'cancelled', charge: 0, credit: baseCharge, net: -baseCharge, involvedCount };
  }
  return { status: 'normal', charge: baseCharge, credit: 0, net: baseCharge, involvedCount };
}
