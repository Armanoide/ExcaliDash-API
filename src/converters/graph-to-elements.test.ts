import { describe, it, expect } from 'vitest'
import { graphToElements, GraphInput, ExcalidrawElement } from './graph-to-elements'

describe('graphToElements', () => {
  it('creates elements for a simple graph', () => {
    const input: GraphInput = {
      nodes: [{ id: 'a', label: 'Node A' }, { id: 'b', label: 'Node B' }],
      edges: [{ from: 'a', to: 'b', label: 'Edge' }],
      direction: 'TB',
    }

    const elements = graphToElements(input)
    expect(elements).toHaveLength(6)
    expect(elements.filter((e: ExcalidrawElement) => e.type === 'rectangle')).toHaveLength(2)
    expect(elements.filter((e: ExcalidrawElement) => e.type === 'arrow')).toHaveLength(1)
    expect(elements.filter((e: ExcalidrawElement) => e.type === 'text')).toHaveLength(3)
  })

  it('handles single node without edges', () => {
    const input: GraphInput = {
      nodes: [{ id: 'solo', label: 'Solo' }],
      edges: [],
    }

    const elements = graphToElements(input)
    expect(elements).toHaveLength(2)
    expect(elements.filter((e: ExcalidrawElement) => e.type === 'rectangle')).toHaveLength(1)
    expect(elements.filter((e: ExcalidrawElement) => e.type === 'text')).toHaveLength(1)
  })

  it('respects custom node sizes', () => {
    const input: GraphInput = {
      nodes: [{ id: 'big', label: 'Big', width: 300, height: 100 }],
      edges: [],
    }

    const elements = graphToElements(input)
    const rect = elements.find((e: ExcalidrawElement) => e.type === 'rectangle')
    expect(rect?.width).toBe(300)
    expect(rect?.height).toBe(100)
  })

  it('respects custom colors', () => {
    const input: GraphInput = {
      nodes: [{ id: 'colored', label: 'X', color: '#ff0000', bg: '#ffff00' }],
      edges: [],
    }

    const elements = graphToElements(input)
    const rect = elements.find((e: ExcalidrawElement) => e.type === 'rectangle')
    expect(rect?.strokeColor).toBe('#ff0000')
    expect(rect?.backgroundColor).toBe('#ffff00')
  })

  it('handles multiple edges', () => {
    const input: GraphInput = {
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }],
    }

    const elements = graphToElements(input)
    expect(elements.filter((e: ExcalidrawElement) => e.type === 'arrow')).toHaveLength(3)
  })

  it('generates unique IDs for all elements', () => {
    const input: GraphInput = {
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
    }

    const elements = graphToElements(input)
    const ids = elements.map((e: ExcalidrawElement) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('supports LR direction', () => {
    const input: GraphInput = {
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      edges: [{ from: 'a', to: 'b' }],
      direction: 'LR',
    }

    const elements = graphToElements(input)
    expect(elements.length).toBeGreaterThan(0)
  })
})
