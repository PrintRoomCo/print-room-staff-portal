import type { ViewType } from './views'
import type { EcommerceGenerationConfig } from './ecommerce'
import type { TechpackAssetType } from './techpacks'
import type { PipelineResult } from './pipeline-results'
import { normalizePipelineResults } from './pipeline-results'

export type JobType = 'view' | 'ecommerce' | 'techpack'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type JobConfig =
  | { views: ViewType[] }
  | EcommerceGenerationConfig
  | { assetTypes: TechpackAssetType[] }

export interface JobProgress {
  completed: number
  total: number
  current_product_id?: string
  current_product_name?: string
}

export interface GenerationJob {
  id: string
  job_type: JobType
  product_ids: string[]
  config: JobConfig
  status: JobStatus
  progress: JobProgress
  results: PipelineResult[]
  error_message?: string
  source: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

type GenerationJobRecord = Omit<GenerationJob, 'results'> & {
  results?: unknown
}

export function normalizeGenerationJob(job: GenerationJobRecord): GenerationJob {
  return {
    ...job,
    results: normalizePipelineResults(job.results),
  }
}

export function normalizeGenerationJobs(jobs: GenerationJobRecord[]): GenerationJob[] {
  return jobs.map(normalizeGenerationJob)
}

export type CreateJobRequest =
  | {
      jobType: 'view'
      productIds: string[]
      config: { views: ViewType[] }
    }
  | {
      jobType: 'techpack'
      productIds: string[]
      config: { assetTypes: TechpackAssetType[] }
    }
  | {
      jobType: 'ecommerce'
      productIds?: string[]
      config: EcommerceGenerationConfig
    }
