export const FONTS = [
  {
    id: 'Garet',
    label: 'Garet',
    category: 'sans',
    css: "'Garet', 'Arial', sans-serif",
    weights: [
      { label: 'Regular', value: 'normal', weight: 400 },
      { label: 'Bold', value: 'bold', weight: 700 },
    ],
  },
  {
    id: 'Droid Serif',
    label: 'Droid Serif',
    category: 'serif',
    css: "'Droid Serif', Georgia, serif",
    weights: [
      { label: 'Regular', value: 'normal', weight: 400 },
      { label: 'Bold', value: 'bold', weight: 700 },
    ],
  },
]

export const FONT_IDS = FONTS.map((f) => f.id)

export function fontLabel(id) {
  const f = FONTS.find((x) => x.id === id)
  return f ? f.label : id
}

export const DEFAULT_TEMPLATE_CANVAS = {
  width: 3508,
  height: 2480,
}

export const DEFAULT_DIMS_LABEL = 'A4 Landscape (3508 × 2480 @300dpi)'

export const COMMON_VARS = ['college_name', 'event_name', 'date', 'state', 'committee_name']

export const COMMON_VAR_LABELS = {
  college_name: 'College Name',
  event_name: 'Event Name',
  date: 'Date',
  state: 'State',
  committee_name: 'Committee Name',
}

export const RECIPIENT_VAR = 'recipient_name'
