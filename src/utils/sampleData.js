import { collectTemplateVariables } from './validation'

const DEFAULT_VALUES = {
  recipient_name: 'Sushmit Morey',
  college_name: 'GMC Alibag',
  event_name: 'Know Sugar, No Diabetes',
  date: '14 June 2026',
  state: 'Maharashtra',
  role: 'Participant',
  organiser_name: 'Organising Committee',
  year: '2026',
}

/** Build a sample data map covering every variable a template uses. */
export function sampleDataForTemplate(template) {
  const vars = collectTemplateVariables(template)
  const data = {}
  for (const v of vars) {
    data[v] = DEFAULT_VALUES[v] ?? `Sample ${v.replace(/_/g, ' ')}`
  }
  return data
}
