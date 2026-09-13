import { describe, it, expect } from 'vitest'
import { findInvalidEdges } from './validatePipeline'
import type { ToolNodeType } from '../components/ToolNode'
import type { Edge } from '@xyflow/react'

function node(id: string, toolId: string): ToolNodeType {
  return { id, type: 'tool', position: { x: 0, y: 0 }, data: { toolId, params: {} } }
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

describe('findInvalidEdges', () => {
  it('accepts a real pipeline dependency (fastp -> bowtie2)', () => {
    const nodes = [node('a', 'fastp'), node('b', 'bowtie2')]
    const edges = [edge('e1', 'a', 'b')]
    expect(findInvalidEdges(nodes, edges)).toEqual([])
  })

  it('flags a connection the real pipeline never makes (QUAST -> MaxBin2)', () => {
    const nodes = [node('a', 'quast'), node('b', 'maxbin2')]
    const edges = [edge('e1', 'a', 'b')]
    expect(findInvalidEdges(nodes, edges)).toEqual([{ edgeId: 'e1', sourceToolId: 'quast', targetToolId: 'maxbin2' }])
  })

  it('flags MEGAHIT -> Kraken2 even though it looks plausible (fastq-entry Kraken2 classifies reads, never assembler contigs)', () => {
    const nodes = [node('a', 'megahit'), node('b', 'kraken2')]
    const edges = [edge('e1', 'a', 'b')]
    expect(findInvalidEdges(nodes, edges)).toHaveLength(1)
  })

  it('flags metaSPAdes -> MultiQC (no native MultiQC module for SPAdes, unlike MEGAHIT)', () => {
    const nodes = [node('a', 'metaspades'), node('b', 'multiqc')]
    const edges = [edge('e1', 'a', 'b')]
    expect(findInvalidEdges(nodes, edges)).toHaveLength(1)
  })

  it('accepts MEGAHIT -> MultiQC (MultiQC does have a native MEGAHIT module)', () => {
    const nodes = [node('a', 'megahit'), node('b', 'multiqc')]
    const edges = [edge('e1', 'a', 'b')]
    expect(findInvalidEdges(nodes, edges)).toEqual([])
  })

  it('ignores edges whose endpoints are not both known nodes', () => {
    const nodes = [node('a', 'fastp')]
    const edges = [edge('e1', 'a', 'does-not-exist')]
    expect(findInvalidEdges(nodes, edges)).toEqual([])
  })

  it('a node with no incoming edge is never flagged (every reads stage is independently skippable)', () => {
    const nodes = [node('a', 'megahit')]
    expect(findInvalidEdges(nodes, [])).toEqual([])
  })
})
