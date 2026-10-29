ALTER TABLE power_meters ADD COLUMN IF NOT EXISTS register_config JSONB;
ALTER TABLE energy_readings ADD COLUMN IF NOT EXISTS register_values JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE power_meters AS meter
SET register_config = (
    SELECT jsonb_agg(
        defaults.item || jsonb_build_object(
            'address',
            COALESCE(
                (meter.register_map ->> (defaults.item ->> 'key'))::integer,
                (defaults.item ->> 'address')::integer
            )
        )
        ORDER BY defaults.ordinality
    )
    FROM jsonb_array_elements('[
        {"key":"v_r_v","parameter":"V_R (V_L1)","unit":"V","register_type":"holding","address":0,"data_type":"float32"},
        {"key":"v_s_v","parameter":"V_S (V_L2)","unit":"V","register_type":"holding","address":2,"data_type":"float32"},
        {"key":"v_t_v","parameter":"V_T (V_L3)","unit":"V","register_type":"holding","address":4,"data_type":"float32"},
        {"key":"v_rn_v","parameter":"V_RN (V_L1N)","unit":"V","register_type":"holding","address":6,"data_type":"float32"},
        {"key":"v_sn_v","parameter":"V_SN (V_L2N)","unit":"V","register_type":"holding","address":8,"data_type":"float32"},
        {"key":"v_tn_v","parameter":"V_TN (V_L3N)","unit":"V","register_type":"holding","address":10,"data_type":"float32"},
        {"key":"i_r_a","parameter":"I_R (I_L1)","unit":"A","register_type":"holding","address":12,"data_type":"float32"},
        {"key":"i_s_a","parameter":"I_S (I_L2)","unit":"A","register_type":"holding","address":14,"data_type":"float32"},
        {"key":"i_t_a","parameter":"I_T (I_L3)","unit":"A","register_type":"holding","address":16,"data_type":"float32"},
        {"key":"i_n_a","parameter":"I_N","unit":"A","register_type":"holding","address":18,"data_type":"float32"},
        {"key":"p_total_kw","parameter":"P_Total (kW_Total)","unit":"kW","register_type":"holding","address":20,"data_type":"float32"},
        {"key":"q_total_kvar","parameter":"Q_Total (kVAR_Total)","unit":"kVAR","register_type":"holding","address":22,"data_type":"float32"},
        {"key":"s_total_kva","parameter":"S_Total (kVA_Total)","unit":"kVA","register_type":"holding","address":24,"data_type":"float32"},
        {"key":"power_factor","parameter":"PF (Power_Factor)","unit":"","register_type":"holding","address":26,"data_type":"float32"},
        {"key":"frequency_hz","parameter":"Freq (Frequency)","unit":"Hz","register_type":"holding","address":28,"data_type":"float32"},
        {"key":"kwh_del","parameter":"kWh_Del (E_Act_Del / Import)","unit":"kWh","register_type":"holding","address":30,"data_type":"float32"},
        {"key":"kwh_rec","parameter":"kWh_Rec (E_Act_Rec / Export)","unit":"kWh","register_type":"holding","address":32,"data_type":"float32"},
        {"key":"kvarh_del","parameter":"kVARh_Del (E_React_Del)","unit":"kVARh","register_type":"holding","address":34,"data_type":"float32"},
        {"key":"kvarh_rec","parameter":"kVARh_Rec (E_React_Rec)","unit":"kVARh","register_type":"holding","address":36,"data_type":"float32"},
        {"key":"kvah_del","parameter":"kVAh_Del (E_App_Del)","unit":"kVAh","register_type":"holding","address":38,"data_type":"float32"}
    ]'::jsonb) WITH ORDINALITY AS defaults(item, ordinality)
)
WHERE meter.register_config IS NULL;

ALTER TABLE power_meters ALTER COLUMN register_config SET NOT NULL;
