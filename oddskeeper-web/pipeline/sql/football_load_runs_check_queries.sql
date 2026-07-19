-- 1) Son 20 run
select
    id,
    pipeline_name,
    pipeline_version,
    source,
    batch_label,
    status,
    parse_enabled,
    total_steps,
    completed_steps,
    warning_steps,
    failed_steps,
    started_at,
    finished_at,
    round(extract(epoch from (coalesce(finished_at, now()) - started_at))) as duration_seconds
from football.load_runs
order by started_at desc
limit 20;

-- 2) Son run detay
select
    id,
    pipeline_name,
    pipeline_version,
    status,
    total_steps,
    completed_steps,
    warning_steps,
    failed_steps,
    started_at,
    finished_at,
    error_summary,
    run_summary
from football.load_runs
order by started_at desc
limit 1;

-- 3) Son başarısız veya partial run
select
    id,
    pipeline_name,
    pipeline_version,
    status,
    warning_steps,
    failed_steps,
    started_at,
    finished_at,
    error_summary
from football.load_runs
where status in ('failed', 'partial')
order by started_at desc
limit 20;

-- 4) Son run step kırılımı
with last_run as (
    select id, run_summary
    from football.load_runs
    order by started_at desc
    limit 1
)
select
    lr.id as run_id,
    step ->> 'step_name' as step_name,
    step ->> 'status' as step_status,
    step ->> 'critical' as critical,
    step ->> 'returncode' as returncode,
    step ->> 'duration_seconds' as duration_seconds,
    step -> 'summary' as summary_json,
    step ->> 'error_message' as error_message
from last_run lr,
     jsonb_array_elements(coalesce(lr.run_summary -> 'steps', '[]'::jsonb)) as step
order by step_name;

-- 5) Pipeline bazlı özet
select
    pipeline_name,
    count(*) as run_count,
    count(*) filter (where status = 'success') as success_count,
    count(*) filter (where status = 'partial') as partial_count,
    count(*) filter (where status = 'failed') as failed_count,
    round(avg(extract(epoch from (coalesce(finished_at, now()) - started_at)))) as avg_duration_seconds
from football.load_runs
group by pipeline_name
order by run_count desc, pipeline_name;
