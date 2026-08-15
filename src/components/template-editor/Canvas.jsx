import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Canvas as FabricCanvas, Textbox, IText, Image, util } from 'fabric'
import { uid } from '../../utils/fileUtils'
import { toFabricCharSpacing, fromFabricCharSpacing, computeBackgroundScale } from '../../services/certificateGenerator'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 1
const ZOOM_STEP = 0.05
const PAD = 28

function makeElement(type, overrides = {}) {
  return {
    id: uid(),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    opacity: 1,
    originX: 'center',
    originY: 'top',
    content: '',
    fontFamily: 'Garet',
    fontSize: 60,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'center',
    lineHeight: 1.3,
    letterSpacing: 0,
    fill: '#1c1c1c',
    assetId: null,
    ...overrides,
  }
}

function textStyle(el) {
  return {
    left: el.x,
    top: el.y,
    angle: el.angle || 0,
    opacity: el.opacity ?? 1,
    originX: el.originX || 'left',
    originY: el.originY || 'top',
    fontFamily: el.fontFamily || 'Garet',
    fontSize: el.fontSize || 60,
    fontWeight: el.fontWeight || 'normal',
    fontStyle: el.fontStyle || 'normal',
    textAlign: el.textAlign || 'center',
    lineHeight: el.lineHeight || 1.3,
    charSpacing: toFabricCharSpacing(el.letterSpacing, el.fontSize || 60),
    fill: el.fill || '#1c1c1c',
  }
}

/**
 * Build fabric per-character styles that make every {{placeholder}} token bold.
 * This is purely visual in the editor; it is derived from the content each time
 * and is never persisted into the template model.
 */
function buildPlaceholderStyles(content = '') {
  const styles = {}
  const lines = content.split('\n')
  const re = /\{\{\s*([^{}]+?)\s*\}\}/g
  for (let line = 0; line < lines.length; line++) {
    const lineStyles = {}
    re.lastIndex = 0
    let m
    while ((m = re.exec(lines[line])) !== null) {
      const start = m.index
      const end = start + m[0].length
      for (let i = start; i < end; i++) {
        lineStyles[i] = { fontWeight: 'bold' }
      }
    }
    if (Object.keys(lineStyles).length > 0) styles[line] = lineStyles
  }
  return styles
}

function applyPlaceholderStyles(obj) {
  if (!obj || (obj.type !== 'i-text' && obj.type !== 'textbox')) return
  obj.set('styles', buildPlaceholderStyles(obj.text || ''))
}

/**
 * Apply a display zoom to the fabric canvas.
 *
 * The certificate keeps its native logical resolution (e.g. 3508x2480);
 * only the *viewport* is scaled. The canvas element is sized to
 * native * zoom and the viewport transform maps native coordinates onto it.
 */
function applyViewport(canvas, native, zoom) {
  const dw = Math.max(1, Math.round(native.width * zoom))
  const dh = Math.max(1, Math.round(native.height * zoom))
  canvas.setDimensions({ width: dw, height: dh })
  canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0])
  canvas.requestRenderAll()
}

const CanvasEditor = forwardRef(function CanvasEditor(
  { template, assets = [], onTemplateChange, onSelectionChange, onError, designKey = 'default' },
  ref,
) {
  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const canvasRef = useRef(null)
  const elementMapRef = useRef(new Map())
  const templateRef = useRef(template)
  const bgRef = useRef(null)
  const onChangeDebounced = useRef(null)
  const containerSizeRef = useRef({ w: 0, h: 0 })
  const zoomRef = useRef(null)

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(null)

  templateRef.current = template
  zoomRef.current = zoom

  const native = template?.canvas
    ? { width: template.canvas.width, height: template.canvas.height }
    : { width: 3508, height: 2480 }

  const fitZoom =
    containerSize.w && containerSize.h
      ? Math.min((containerSize.w - PAD) / native.width, (containerSize.h - PAD) / native.height, MAX_ZOOM)
      : 1

  const effectiveZoom = zoom ?? fitZoom

  const notifyTemplate = (immediate = false) => {
    if (!onTemplateChange) return
    if (onChangeDebounced.current) clearTimeout(onChangeDebounced.current)
    const emit = () => {
      onChangeDebounced.current = null
      onTemplateChange({
        ...templateRef.current,
        background: bgRef.current,
        elements: getSerialized(),
      })
    }
    if (immediate) emit()
    else onChangeDebounced.current = setTimeout(emit, 120)
  }

  const syncElementFromObject = (el, obj) => {
    el.x = Math.round(obj.left)
    el.y = Math.round(obj.top)
    el.angle = Math.round(obj.angle || 0)
    el.opacity = obj.opacity ?? 1
    if (el.type !== 'image') {
      el.content = obj.text
      el.fontSize = obj.fontSize
      el.fontFamily = obj.fontFamily
      el.fontWeight = obj.fontWeight
      el.fontStyle = obj.fontStyle
      el.textAlign = obj.textAlign
      el.lineHeight = obj.lineHeight
      el.letterSpacing = fromFabricCharSpacing(obj.charSpacing, obj.fontSize)
      el.fill = obj.fill
      el.width = Math.round(obj.width)
      el.height = Math.round(obj.height)
    } else {
      el.width = Math.round(obj.getScaledWidth())
      el.height = Math.round(obj.getScaledHeight())
    }
  }

  const fireSelection = () => {
    if (!canvasRef.current) return
    const sel = canvasRef.current.getActiveObject()
    const el = sel && sel._elId ? elementMapRef.current.get(sel._elId) : null
    onSelectionChange && onSelectionChange(el)
  }

  const getSerialized = () => {
    if (!canvasRef.current) return [...elementMapRef.current.values()]
    const canvas = canvasRef.current
    return canvas
      .getObjects()
      .map((o) => {
        const el = elementMapRef.current.get(o._elId)
        if (!el) return null
        syncElementFromObject(el, o)
        return el
      })
      .filter(Boolean)
  }

  const registerObject = (obj, el) => {
    obj.set('_elId', el.id)
    elementMapRef.current.set(el.id, el)
    canvasRef.current.add(obj)
    return obj
  }

  const createObjectFromElement = (el) => {
    if (el.type === 'image') return null
    const style = textStyle(el)
    const placeholderStyles = buildPlaceholderStyles(el.content || '')
    const obj =
      el.type === 'paragraph'
        ? new Textbox(el.content, { ...style, width: el.width || 500, styles: placeholderStyles })
        : new IText(el.content, { ...style, styles: placeholderStyles })
    obj.set({ editable: true })
    return obj
  }

  const createImageFromAsset = (el, asset) => {
    return new Promise((resolve, reject) => {
      util.loadImage(asset.dataUrl).then(
        (img) => {
          const naturalW = img.width
          const naturalH = img.height
          const obj = new Image(img, {
            left: el.x,
            top: el.y,
            angle: el.angle || 0,
            opacity: el.opacity ?? 1,
            originX: el.originX || 'center',
            originY: el.originY || 'top',
          })
          obj._elW = naturalW
          obj._elH = naturalH
          obj.scaleX = (el.width || 300) / naturalW
          obj.scaleY = (el.height || (el.width || 300) * (naturalH / naturalW)) / naturalH
          obj.set({ objectCaching: false })
          resolve(obj)
        },
        (err) => reject(err),
      )
    })
  }

  const loadTemplateIntoCanvas = async (tpl) => {
    const canvas = canvasRef.current
    if (!canvas) return
    bgRef.current = null
    canvas.backgroundImage = undefined
    canvas.clear()
    elementMapRef.current.clear()

    try {
      if (tpl.background) {
        await setBackgroundInternal(tpl.background)
      }

      for (const el of tpl.elements || []) {
        if (el.type === 'image') {
          const asset = assets.find((a) => a.id === el.assetId)
          if (!asset) continue
          try {
            const obj = await createImageFromAsset(el, asset)
            registerObject(obj, { ...el })
          } catch {
            /* skip broken image */
          }
        } else {
          const obj = createObjectFromElement(el)
          if (obj) registerObject(obj, { ...el })
        }
      }
      canvas.requestRenderAll()
      notifyTemplate(true)
    } catch (err) {
      onError && onError(err)
    }
  }

  const setBackgroundInternal = (dataUrl) => {
    return new Promise((resolve, reject) => {
      // Wait for the image to actually finish loading before drawing it.
      util.loadImage(dataUrl).then(
        (img) => {
          bgRef.current = dataUrl
          const tpl = templateRef.current
          const { width, height } = tpl.canvas
          const s = computeBackgroundScale({
            imgW: img.width,
            imgH: img.height,
            canvasW: width,
            canvasH: height,
            fit: tpl.backgroundFit || 'stretch',
          })
          const bg = new Image(img, {
            scaleX: s.scaleX,
            scaleY: s.scaleY,
            left: s.left,
            top: s.top,
            originX: 'left',
            originY: 'top',
          })
          if (canvasRef.current) {
            canvasRef.current.backgroundImage = bg
            canvasRef.current.requestRenderAll()
          }
          resolve(bg)
        },
        (err) => reject(err),
      )
    })
  }

  const initCanvas = (tpl) => {
    const host = hostRef.current
    if (!host) return
    if (canvasRef.current) {
      try {
        canvasRef.current.dispose()
      } catch {
        /* ignore */
      }
      canvasRef.current = null
    }

    const canvas = new FabricCanvas(host, {
      width: 100,
      height: 100,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
      enableRetinaScaling: true,
    })
    canvasRef.current = canvas
    if (typeof window !== 'undefined') {
      window.__certCanvas = canvas
      window.__certBg = () => {
        const c = canvasRef.current
        if (!c) return 'no-canvas'
        const bg = c.backgroundImage
        if (!bg) return 'none'
        return { has: true, w: bg.width, h: bg.height, sx: bg.scaleX, sy: bg.scaleY, l: bg.left, t: bg.top }
      }
      window.__certObjCount = () => (canvasRef.current ? canvasRef.current.getObjects().length : -1)
    }

    const syncHandler = () => {
      const active = canvas.getActiveObject()
      if (active && active.type === 'textbox' && active.scaleX !== 1) {
        active.set('width', Math.round(active.width * active.scaleX))
        active.set('scaleX', 1)
        active.setCoords()
      }
      if (active && (active.type === 'i-text' || active.type === 'text') && active.scaleX !== 1) {
        active.set('fontSize', Math.max(1, Math.round(active.fontSize * active.scaleX)))
        active.set('scaleX', 1)
        active.set('scaleY', 1)
        active.setCoords()
      }
      notifyTemplate()
      fireSelection()
    }

    canvas.on('object:modified', syncHandler)
    canvas.on('object:moving', syncHandler)
    canvas.on('object:scaling', syncHandler)
    canvas.on('object:rotating', syncHandler)
    canvas.on('text:changed', syncHandler)
    canvas.on('text:editing:exited', (opt) => {
      const obj = opt?.target
      if (obj) {
        applyPlaceholderStyles(obj)
        notifyTemplate()
        fireSelection()
      }
    })
    canvas.on('selection:created', () => fireSelection())
    canvas.on('selection:updated', () => fireSelection())
    canvas.on('selection:cleared', () => onSelectionChange && onSelectionChange(null))

    loadTemplateIntoCanvas(tpl)
  }

  // Create (or re-create) the canvas whenever the template identity or design changes.
  const lastTemplateId = useRef(null)
  useEffect(() => {
    if (!template || !template.canvas) return
    const key = (template.id || 'new') + ':' + designKey
    if (canvasRef.current && lastTemplateId.current === key) return
    lastTemplateId.current = key
    initCanvas(template)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, designKey])

  // Observe the fixed-size workspace so resizes re-fit the certificate.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      containerSizeRef.current = { w: r.width, h: r.height }
      setContainerSize({ w: r.width, h: r.height })
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // Apply the current zoom to the viewport whenever it changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!containerSize.w || !containerSize.h) return
    applyViewport(canvas, native, effectiveZoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.w, containerSize.h, zoom])

  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        try {
          canvasRef.current.dispose()
        } catch {
          /* ignore */
        }
        canvasRef.current = null
      }
    }
  }, [])

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round(((z ?? effectiveZoom) + ZOOM_STEP) * 100) / 100))
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Math.round(((z ?? effectiveZoom) - ZOOM_STEP) * 100) / 100))
  const fit = () => setZoom(null)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getSerialized,
    getZoom: () => (zoomRef.current === null ? fitZoom : zoomRef.current),
    fitToViewport: () => setZoom(null),
    flushNow: () => notifyTemplate(true),

    addVariable({ label, variable }) {
      const canvas = canvasRef.current
      const tpl = templateRef.current
      if (!canvas) return
      const el = makeElement('text', {
        content: `{{${variable}}}`,
        name: label || variable,
        x: tpl.canvas.width / 2,
        y: tpl.canvas.height / 2,
        fontSize: 120,
        fontWeight: 'bold',
      })
      const obj = createObjectFromElement(el)
      registerObject(obj, el)
      canvas.setActiveObject(obj)
      canvas.requestRenderAll()
      notifyTemplate()
      fireSelection()
      return el.id
    },

    addParagraph(content) {
      const canvas = canvasRef.current
      const tpl = templateRef.current
      if (!canvas) return
      const el = makeElement('paragraph', {
        content,
        name: 'Paragraph',
        x: tpl.canvas.width / 2,
        y: tpl.canvas.height * 0.42,
        width: Math.min(tpl.canvas.width * 0.7, 2600),
        fontSize: 44,
        fontFamily: 'Droid Serif',
        lineHeight: 1.6,
      })
      const obj = createObjectFromElement(el)
      registerObject(obj, el)
      canvas.setActiveObject(obj)
      canvas.requestRenderAll()
      notifyTemplate()
      fireSelection()
      return el.id
    },

    addStaticText(content) {
      const canvas = canvasRef.current
      const tpl = templateRef.current
      if (!canvas) return
      const el = makeElement('text', {
        content: content || 'Static Text',
        name: 'Static Text',
        x: tpl.canvas.width / 2,
        y: tpl.canvas.height * 0.3,
        fontSize: 70,
      })
      const obj = createObjectFromElement(el)
      registerObject(obj, el)
      canvas.setActiveObject(obj)
      canvas.requestRenderAll()
      notifyTemplate()
      fireSelection()
      return el.id
    },

    async addImage(assetId) {
      const canvas = canvasRef.current
      const tpl = templateRef.current
      if (!canvas) return
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) {
        onError && onError(new Error('Asset not found.'))
        return null
      }
      const targetW = Math.min(tpl.canvas.width * 0.14, 500)
      const el = makeElement('image', {
        assetId,
        name: asset.name,
        x: tpl.canvas.width / 2,
        y: tpl.canvas.height * 0.12,
        width: targetW,
        height: targetW,
      })
      try {
        const obj = await createImageFromAsset(el, asset)
        registerObject(obj, el)
        canvas.setActiveObject(obj)
        canvas.requestRenderAll()
        notifyTemplate()
        fireSelection()
        return el.id
      } catch (err) {
        onError && onError(err)
        return null
      }
    },

    updateSelected(patch) {
      const canvas = canvasRef.current
      const obj = canvas?.getActiveObject()
      if (!obj) return
      const el = elementMapRef.current.get(obj._elId)
      if (!el) return
      const apply = (key, value) => {
        if (value !== undefined) obj.set(key, value)
      }
      if ('x' in patch) apply('left', patch.x)
      if ('y' in patch) apply('top', patch.y)
      if ('angle' in patch) apply('angle', patch.angle)
      if ('opacity' in patch) apply('opacity', patch.opacity)
      if ('fontFamily' in patch) apply('fontFamily', patch.fontFamily)
      if ('fontSize' in patch) apply('fontSize', patch.fontSize)
      if ('fontWeight' in patch) apply('fontWeight', patch.fontWeight)
      if ('fontStyle' in patch) apply('fontStyle', patch.fontStyle)
      if ('textAlign' in patch) apply('textAlign', patch.textAlign)
      if ('lineHeight' in patch) apply('lineHeight', patch.lineHeight)
      if ('fill' in patch) apply('fill', patch.fill)
      if ('letterSpacing' in patch) apply('charSpacing', toFabricCharSpacing(patch.letterSpacing, obj.fontSize || 60))
      if (el.type === 'paragraph' && 'width' in patch) apply('width', patch.width)
      if (el.type === 'image') {
        const naturalW = obj._elW || obj.width
        const naturalH = obj._elH || obj.height
        if ('width' in patch && 'height' in patch) {
          obj.scaleX = patch.width / naturalW
          obj.scaleY = patch.height / naturalH
        } else if ('width' in patch) {
          obj.scaleX = patch.width / naturalW
          obj.scaleY = (patch.width * (naturalH / naturalW)) / naturalH
        } else if ('height' in patch) {
          obj.scaleY = patch.height / naturalH
          obj.scaleX = (patch.height * (naturalW / naturalH)) / naturalW
        }
      }
      if ('content' in patch) {
        apply('text', patch.content)
        applyPlaceholderStyles(obj)
      }
      obj.setCoords()
      canvas.requestRenderAll()
      syncElementFromObject(el, obj)
      notifyTemplate()
      fireSelection()
    },

    deleteSelected() {
      const canvas = canvasRef.current
      const obj = canvas?.getActiveObject()
      if (!obj) return
      canvas.remove(obj)
      elementMapRef.current.delete(obj._elId)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      notifyTemplate()
      fireSelection()
    },

    duplicateSelected() {
      const canvas = canvasRef.current
      const obj = canvas?.getActiveObject()
      if (!obj) return
      const src = elementMapRef.current.get(obj._elId)
      if (!src) return
      const copy = { ...src, id: uid(), x: src.x + 40, y: src.y + 40, name: `${src.name} copy` }
      if (copy.type === 'image') {
        const asset = assets.find((a) => a.id === copy.assetId)
        if (asset) {
          createImageFromAsset(copy, asset).then((newObj) => {
            registerObject(newObj, copy)
            canvas.setActiveObject(newObj)
            canvas.requestRenderAll()
            notifyTemplate()
            fireSelection()
          })
          return
        }
      } else {
        const newObj = createObjectFromElement(copy)
        registerObject(newObj, copy)
        canvas.setActiveObject(newObj)
        canvas.requestRenderAll()
        notifyTemplate()
        fireSelection()
      }
    },

    bringForward() {
      const canvas = canvasRef.current
      const obj = canvas?.getActiveObject()
      if (!obj) return
      obj.bringForward()
      canvas.requestRenderAll()
      notifyTemplate()
    },

    sendBackward() {
      const canvas = canvasRef.current
      const obj = canvas?.getActiveObject()
      if (!obj) return
      obj.sendBackwards()
      canvas.requestRenderAll()
      notifyTemplate()
    },

    selectById(id) {
      const canvas = canvasRef.current
      if (!canvas) return
      const obj = canvas.getObjects().find((o) => o._elId === id)
      if (obj) {
        canvas.setActiveObject(obj)
        canvas.requestRenderAll()
        fireSelection()
      }
    },

    setBackground(dataUrl) {
      return setBackgroundInternal(dataUrl).then(() => notifyTemplate())
    },

    updateBackgroundFit(fit) {
      templateRef.current = { ...templateRef.current, backgroundFit: fit }
      if (bgRef.current) {
        return setBackgroundInternal(bgRef.current).then(() => notifyTemplate())
      }
      return Promise.resolve()
    },

    removeBackground() {
      bgRef.current = null
      if (canvasRef.current) {
        canvasRef.current.backgroundImage = undefined
        canvasRef.current.requestRenderAll()
      }
      notifyTemplate()
    },

    getBackground: () => bgRef.current,
  }))

  return (
    <div ref={wrapRef} className="editor-center">
      <div className="editor-canvas-host">
        <canvas ref={hostRef} />
      </div>
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
        <span className="zoom-value">{Math.round(effectiveZoom * 100)}%</span>
        <button className="zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
        <button
          className={`zoom-btn ${zoom === null ? 'active' : ''}`}
          onClick={fit}
          title="Fit certificate to workspace"
        >
          Fit
        </button>
      </div>
    </div>
  )
})

export default CanvasEditor
