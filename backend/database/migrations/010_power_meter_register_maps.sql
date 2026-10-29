-- Configurable float32 holding-register address for each meter parameter.
ALTER TABLE power_meters ADD COLUMN IF NOT EXISTS register_map JSONB;

UPDATE power_meters AS meter
SET register_map = (
    SELECT jsonb_object_agg(
        parameter.field,
        LEAST(GREATEST(COALESCE(meter.register_address, 0), 0), 65496) + (parameter.ordinality - 1) * 2
    )
    FROM unnest(ARRAY[
        'v_r_v', 'v_s_v', 'v_t_v', 'v_rn_v', 'v_sn_v', 'v_tn_v',
        'i_r_a', 'i_s_a', 'i_t_a', 'i_n_a',
        'p_total_kw', 'q_total_kvar', 's_total_kva', 'power_factor', 'frequency_hz',
        'kwh_del', 'kwh_rec', 'kvarh_del', 'kvarh_rec', 'kvah_del'
    ]::text[]) WITH ORDINALITY AS parameter(field, ordinality)
)
WHERE meter.register_map IS NULL;

ALTER TABLE power_meters
    ALTER COLUMN register_map SET DEFAULT '{
        "v_r_v": 0, "v_s_v": 2, "v_t_v": 4,
        "v_rn_v": 6, "v_sn_v": 8, "v_tn_v": 10,
        "i_r_a": 12, "i_s_a": 14, "i_t_a": 16, "i_n_a": 18,
        "p_total_kw": 20, "q_total_kvar": 22, "s_total_kva": 24,
        "power_factor": 26, "frequency_hz": 28,
        "kwh_del": 30, "kwh_rec": 32, "kvarh_del": 34,
        "kvarh_rec": 36, "kvah_del": 38
    }'::jsonb,
    ALTER COLUMN register_map SET NOT NULL;
