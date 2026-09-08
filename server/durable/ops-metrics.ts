import type {Sql} from './database.ts'
/** These are nested spans; percentiles are grouped, never summed into task latency. */
export function readStageMetrics(db:Sql,since=Date.now()-86400_000){
  return db.query(`SELECT provider,
    CASE WHEN step LIKE 'memory-part:%' THEN 'memory-part' WHEN step LIKE 'memory:%' THEN 'memory' ELSE split_part(step,'@',1) END AS stage,
    COALESCE(body->>'kind','provider') AS kind,count(*)::integer AS samples,
    count(*) FILTER (WHERE body->>'result' IN ('failed','cancelled'))::integer AS failures,
    count(*) FILTER (WHERE body->>'cache' IN ('hit','checkpoint'))::integer AS cache_hits,
    percentile_cont(.5) WITHIN GROUP (ORDER BY (body->>'durationMs')::double precision) AS p50_ms,
    percentile_cont(.95) WITHIN GROUP (ORDER BY (body->>'durationMs')::double precision) AS p95_ms,
    percentile_cont(.95) WITHIN GROUP (ORDER BY (body->>'queueMs')::double precision) AS queue_p95_ms,
    sum((body->>'modelCalls')::bigint) AS summary_model_calls,
    sum((body->>'chunkCount')::bigint) AS summary_chunks,
    count(*) FILTER (WHERE body->'usage'->>'prompt_tokens' IS NOT NULL)::integer AS reported_usage_samples,
    sum((body->'usage'->>'prompt_tokens')::bigint) AS reported_prompt_tokens,
    sum((body->'usage'->>'completion_tokens')::bigint) AS reported_completion_tokens
    FROM tp_provider_calls WHERE created_at >= $1 GROUP BY 1,2,3 ORDER BY 1,2,3`,[since])
}
