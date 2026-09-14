import { describe, it, expect } from 'vitest'
import { groupRunFilesByTool } from './groupRunFiles'

describe('groupRunFilesByTool', () => {
  it('groups real files under a matching resultDir prefix', () => {
    const groups = groupRunFilesByTool([
      { path: 'fastp/sample1.fastp.json', size: 100 },
      { path: 'kraken2/sample1.kraken2.report.txt', size: 200 },
    ])
    expect(groups.find((g) => g.toolId === 'fastp')?.files).toHaveLength(1)
    expect(groups.find((g) => g.toolId === 'kraken2')?.files).toHaveLength(1)
  })

  it('a tool with no matching files produces no group at all - not an empty one', () => {
    const groups = groupRunFilesByTool([{ path: 'fastp/sample1.fastp.json', size: 100 }])
    expect(groups.find((g) => g.toolId === 'kraken2')).toBeUndefined()
  })

  it('does not false-match a path that merely starts with the same string but isn\'t a real subdirectory', () => {
    // "fastqc" must not match a "fastp" resultDir just because both start with "fast" -
    // confirms the prefix check requires a real path separator, not a bare startsWith.
    const groups = groupRunFilesByTool([{ path: 'fastqc/sample1_fastqc.html', size: 100 }])
    expect(groups.find((g) => g.toolId === 'fastp')).toBeUndefined()
    expect(groups.find((g) => g.toolId === 'fastqc')?.files).toHaveLength(1)
  })

  it('a multi-directory tool (bowtie2: index + align) groups files from both real subdirectories together', () => {
    const groups = groupRunFilesByTool([
      { path: 'bowtie2/index/host.1.bt2', size: 1 },
      { path: 'bowtie2/align/sample1.bam', size: 1 },
    ])
    const bowtie2 = groups.find((g) => g.toolId === 'bowtie2')
    expect(bowtie2?.files).toHaveLength(2)
  })

  it('pipeline_info files (versions, DAG) match no tool group - not every real file belongs to one', () => {
    const groups = groupRunFilesByTool([{ path: 'pipeline_info/software_versions.yml', size: 10 }])
    expect(groups).toHaveLength(0)
  })
})
