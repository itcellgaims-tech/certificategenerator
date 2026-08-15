import { uid } from '../utils/fileUtils'
import { templateService } from './templateService'
import { DEFAULT_TEMPLATE_CANVAS } from '../constants/config'

function textEl(overrides) {
  return {
    id: uid(),
    type: 'text',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    opacity: 1,
    originX: 'center',
    originY: 'top',
    content: 'Text',
    fontFamily: 'Garet',
    fontSize: 60,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 2,
    fill: '#1c1c1c',
    ...overrides,
  }
}

function paragraphEl(overrides) {
  return {
    id: uid(),
    type: 'paragraph',
    x: 0,
    y: 0,
    width: 2400,
    height: 0,
    angle: 0,
    opacity: 1,
    originX: 'center',
    originY: 'top',
    content: 'Paragraph text with {{variables}}.',
    fontFamily: 'Droid Serif',
    fontSize: 38,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'center',
    lineHeight: 1.6,
    letterSpacing: 0,
    fill: '#1c1c1c',
    ...overrides,
  }
}

function buildVolunteerElements() {
  const W = DEFAULT_TEMPLATE_CANVAS.width
  return [
    textEl({ y: 380, fontSize: 110, fontWeight: 'bold', letterSpacing: 6, content: 'CERTIFICATE OF APPRECIATION' }),
    textEl({ y: 820, fontFamily: 'Droid Serif', fontSize: 44, letterSpacing: 0, content: 'This certificate is proudly presented to' }),
    textEl({ y: 1000, fontSize: 140, fontWeight: 'bold', letterSpacing: 1, content: '{{recipient_name}}' }),
    paragraphEl({
      y: 1380,
      content:
        'This certificate is proudly presented to {{recipient_name}} for serving as a Volunteer during {{event_name}} at {{college_name}} on {{date}}.',
    }),
    textEl({ y: 1980, fontFamily: 'Droid Serif', fontSize: 40, letterSpacing: 0, content: '{{date}} · {{state}}' }),
  ]
}

function buildOrganiserElements() {
  return buildVolunteerElements().map((el) => {
    if (el.type === 'paragraph') {
      return {
        ...el,
        id: uid(),
        content:
          'This certificate is proudly presented to {{recipient_name}} for serving as an Organiser during {{event_name}} at {{college_name}} on {{date}}.',
      }
    }
    return { ...el, id: uid() }
  })
}

/** Build one example template that holds both the Volunteer and Organiser designs. */
function buildExampleTemplate() {
  const volunteer = buildVolunteerElements()
  const organizer = buildOrganiserElements()
  return {
    id: uid(),
    name: 'Volunteer & Organiser Certificate',
    type: 'Certificate',
    canvas: { ...DEFAULT_TEMPLATE_CANVAS },
    background: null,
    backgroundFit: 'stretch',
    elements: volunteer,
    designs: {
      volunteer: { elements: volunteer, background: null, backgroundFit: 'stretch' },
      organizer: { elements: organizer, background: null, backgroundFit: 'stretch' },
    },
  }
}

/** Seed an example template (Volunteer + Organiser designs) on first run. */
export async function seedExampleTemplates() {
  const existing = await templateService.list()
  if (existing.length === 0) {
    await templateService.save(buildExampleTemplate())
  }
}
