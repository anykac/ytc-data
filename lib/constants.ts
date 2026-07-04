export const PERIOD_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'OT'] as const
export type Period = (typeof PERIOD_ORDER)[number]

export const DEFAULT_CUSTOMER_NAME = 'Meanwell'
