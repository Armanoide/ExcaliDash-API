import dagre from 'dagre'
import { randomUUID } from 'crypto'

export interface GraphNode {
  id: string
  label: string
  width?: number
  height?: number
  color?: string
  bg?: string
}

export interface GraphEdge {
  from: string
  to: string
  label?: string
}

export interface GraphInput {
  nodes: GraphNode[]
  edges: GraphEdge[]
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
}

export interface ExcalidrawElement {
  id: string
  type: string
  [key: string]: unknown
}

export function graphToElements(input: GraphInput): ExcalidrawElement[] {
  const { nodes = [], edges = [], direction = 'TB' } = input

  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  })
  g.setDefaultEdgeLabel(() => ({}))

  const NODE_W = 200
  const NODE_H = 60

  for (const n of nodes) {
    g.setNode(n.id, { label: n.label || n.id, width: n.width || NODE_W, height: n.height || NODE_H })
  }
  for (const e of edges) {
    g.setEdge(e.from, e.to, { label: e.label || '' })
  }

  dagre.layout(g)

  const elements: ExcalidrawElement[] = []
  const nodeIds: Record<string, string> = {}
  const nodeRects: Record<string, { x: number; y: number; width: number; height: number }> = {}
  const arrowIds: Record<string, string> = {}

  // Rectangle nodes
  for (const v of g.nodes()) {
    const node = g.node(v) as { label: string; width: number; height: number; x: number; y: number }
    const n = nodes.find(x => x.id === v) as GraphNode
    const x = Math.round(node.x - (node.width / 2))
    const y = Math.round(node.y - (node.height / 2))
    const rectId = randomUUID()
    const textId = randomUUID()
    nodeIds[v] = rectId
    nodeRects[v] = { x, y, width: node.width, height: node.height }

    elements.push({
      id: rectId,
      type: 'rectangle',
      x,
      y,
      width: node.width,
      height: node.height,
      angle: 0,
      strokeColor: n.color || '#1e1e1e',
      backgroundColor: n.bg || '#ffffff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roundness: { type: 3 },
      boundElements: [{ type: 'text', id: textId }],
      frameId: null,
      seed: Math.floor(Math.random() * 2147483647),
      opacity: 100,
      roughness: 1,
      edited: false,
    })

    const label = node.label || ''
    const estimatedWidth = Math.min(label.length * 10, node.width - 20)
    const estimatedHeight = 19.2

    elements.push({
      id: textId,
      type: 'text',
      x: x + (node.width - estimatedWidth) / 2,
      y: y + (node.height - estimatedHeight) / 2,
      width: estimatedWidth,
      height: estimatedHeight,
      angle: 0,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roundness: null,
      boundElements: [],
      frameId: null,
      seed: Math.floor(Math.random() * 2147483647),
      opacity: 100,
      roughness: 1,
      text: label,
      fontSize: 16,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      containerId: rectId,
      originalText: label,
      lineHeight: 1.2,
      autoResize: true,
      edited: false,
    })
  }

  // Arrow edges
  for (const e of g.edges()) {
    const edge = g.edge(e) as Record<string, unknown>
    const edgeLabel = (edge.label as string) || ''
    const fromId = nodeIds[e.v]
    const toId = nodeIds[e.w]
    const arrowId = randomUUID()
    arrowIds[`${e.v}->${e.w}`] = arrowId

    const fromNode = g.node(e.v) as { x: number; y: number }
    const toNode = g.node(e.w) as { x: number; y: number }
    const fromRect = nodeRects[e.v]
    const toRect = nodeRects[e.w]
    const startX = Math.round(fromNode.x)
    const startY = Math.round(fromNode.y + (fromRect.height / 2))
    const endX = Math.round(toNode.x)
    const endY = Math.round(toNode.y - (toRect.height / 2))

    elements.push({
      id: arrowId,
      type: 'arrow',
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      angle: 0,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roundness: { type: 2 },
      boundElements: [],
      frameId: null,
      seed: Math.floor(Math.random() * 2147483647),
      opacity: 100,
      roughness: 1,
      startArrowhead: null,
      endArrowhead: 'arrow',
      lastCommittedPoint: null,
      edited: false,
      points: [[0, 0], [endX - startX, endY - startY]],
      startBinding: { elementId: fromId, focus: 0, gap: 10 },
      endBinding: { elementId: toId, focus: 0, gap: 10 },
    })

    if (edgeLabel) {
      elements.push({
        id: randomUUID(),
        type: 'text',
        x: (startX + endX) / 2,
        y: (startY + endY) / 2 - 10,
        width: 120,
        height: 24,
        angle: 0,
        strokeColor: '#666666',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roundness: null,
        boundElements: [],
        frameId: null,
        seed: Math.floor(Math.random() * 2147483647),
        opacity: 100,
        roughness: 1,
        text: edgeLabel,
        fontSize: 12,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: null,
        originalText: edgeLabel,
        lineHeight: 1.2,
        autoResize: true,
        edited: false,
      })
    }
  }

  // Update rectangle boundElements to include arrows
  for (const e of edges) {
    const fromRect = elements.find(el => el.id === nodeIds[e.from])
    if (fromRect && fromRect.boundElements) {
      ;(fromRect.boundElements as unknown[]).push({ id: arrowIds[`${e.from}->${e.to}`], type: 'arrow' })
    }
    const toRect = elements.find(el => el.id === nodeIds[e.to])
    if (toRect && toRect.boundElements) {
      ;(toRect.boundElements as unknown[]).push({ id: arrowIds[`${e.from}->${e.to}`], type: 'arrow' })
    }
  }

  return elements
}
