import { describe, it, expect } from 'vitest'
import { deriveToolRunStatuses } from './nodeRunStatus'

describe('deriveToolRunStatuses', () => {
  it('a tool with no matching process at all gets no status (not yet started)', () => {
    const statuses = deriveToolRunStatuses({})
    expect(statuses.fastp).toBeUndefined()
  })

  it('matches real workflow-qualified process names (MICROBOX:FASTP), not just bare ones', () => {
    const statuses = deriveToolRunStatuses({ 'MICROBOX:FASTP': 'COMPLETED' })
    expect(statuses.fastp).toBe('completed')
  })

  it('SUBMITTED and RUNNING both count as running', () => {
    expect(deriveToolRunStatuses({ 'MICROBOX:FASTP': 'SUBMITTED' }).fastp).toBe('running')
    expect(deriveToolRunStatuses({ 'MICROBOX:FASTP': 'RUNNING' }).fastp).toBe('running')
  })

  it('FAILED and ABORTED both count as failed, and failed wins over a sibling process still running', () => {
    // bowtie2 maps to two real processes (BOWTIE2_BUILD, BOWTIE2_ALIGN) - one failing
    // should mark the whole tool failed even if the other is still going.
    const statuses = deriveToolRunStatuses({
      'MICROBOX:BOWTIE2_BUILD': 'COMPLETED',
      'MICROBOX:BOWTIE2_ALIGN': 'FAILED',
    })
    expect(statuses.bowtie2).toBe('failed')
  })

  it('CACHED (a -resume\'d task) counts as completed, not running or failed', () => {
    expect(deriveToolRunStatuses({ 'MICROBOX:FASTP': 'CACHED' }).fastp).toBe('completed')
  })

  it('a multi-process tool only reports completed once every one of its processes has run', () => {
    // gatk4 maps to 4 real processes - only the first two having appeared yet must not
    // read as "completed" (it hasn't gotten to the actual variant calling).
    const partial = deriveToolRunStatuses({
      'WGS:GATK4_CREATESEQUENCEDICTIONARY': 'COMPLETED',
      'WGS:SAMTOOLS_FAIDX': 'RUNNING',
    })
    expect(partial.gatk4).toBe('running')
  })

  it('a WGS-aliased include (KRAKEN2_KRAKEN2 as KRAKEN2_KRAKEN2_WGS) matches by its real alias, not the base module name', () => {
    const statuses = deriveToolRunStatuses({ 'WGS:KRAKEN2_KRAKEN2_WGS': 'RUNNING' })
    expect(statuses.kraken2wgs).toBe('running')
    // Must not also cross-match the metagenomics 'kraken2' tool (a different, unaliased
    // process name, KRAKEN2_KRAKEN2) just because both contain the same substring.
    expect(statuses.kraken2).toBeUndefined()
  })
})
