import type {Sql} from './database.ts'
/** These are nested spans; percentiles are grouped, never summed into task latency. */
export function readStageMetrics(db:Sql,since=Date.now()-86400_000){
  return db.query(`SELECT provider,
    CASE WHEN step LIKE 'memory-part:%' THEN 'memory-part' WHEN step LIKE 'memory:%' THEN 'memory' ELSE split_part(step,'@',1) END AS stage,
    COALESCE(body->>'kind','provider') AS kind,count(*)::integer AS samples,
    count(*) FILTER (WHERE body->>'result' IN ('failed','cancelled'))::integer AS failures,
    count(*) FILTER (WHERE body->>'cache' IN ('hit','checkpoint'))::integer AS cache_hits,
    percentile_cont(.5) WITHIN GROUP (ORDER BY CASE WHEN jsonb_typeof(body->'durationMs')='number' AND length(body->>'durationMs')<30 THEN (body->>'durationMs')::double precision END) AS p50_ms,
    percentile_cont(.95) WITHIN GROUP (ORDER BY CASE WHEN jsonb_typeof(body->'durationMs')='number' AND length(body->>'durationMs')<30 THEN (body->>'durationMs')::double precision END) AS p95_ms,
    percentile_cont(.95) WITHIN GROUP (ORDER BY CASE WHEN jsonb_typeof(body->'queueMs')='number' AND length(body->>'queueMs')<30 THEN (body->>'queueMs')::double precision END) AS queue_p95_ms,
    sum(CASE WHEN (body->>'modelCalls') ~ '^[0-9]{1,15}$' THEN (body->>'modelCalls')::bigint END) AS summary_model_calls,
    sum(CASE WHEN (body->>'chunkCount') ~ '^[0-9]{1,15}$' THEN (body->>'chunkCount')::bigint END) AS summary_chunks,
    count(*) FILTER (WHERE body->'usage'->>'prompt_tokens' IS NOT NULL)::integer AS reported_usage_samples,
    sum(CASE WHEN (body->'usage'->>'prompt_tokens') ~ '^[0-9]{1,15}$' THEN (body->'usage'->>'prompt_tokens')::bigint END) AS reported_prompt_tokens,
    sum(CASE WHEN (body->'usage'->>'completion_tokens') ~ '^[0-9]{1,15}$' THEN (body->'usage'->>'completion_tokens')::bigint END) AS reported_completion_tokens
    FROM tp_provider_calls WHERE created_at >= $1 GROUP BY 1,2,3 ORDER BY 1,2,3`,[since])
}
