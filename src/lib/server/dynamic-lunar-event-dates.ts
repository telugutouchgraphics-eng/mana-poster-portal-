export interface ResolvedEventDateDef {
  month: number;
  day: number;
  endMonth?: number;
  endDay?: number;
  durationDays?: number;
}

export const RESOLVED_LUNAR_EVENT_DATES: Record<number, Record<string, ResolvedEventDateDef>> = {
  2026: {
    guru_gobind_singh_jayanti: { month: 1, day: 5 },
    nagoba_jatara: { month: 1, day: 18, durationDays: 9 },
    tyagaraja_aradhana: { month: 1, day: 19, durationDays: 7 },
    ratha_saptami: { month: 1, day: 25 },
    sammakka_saralamma_jatara_medaram_jatara: { month: 1, day: 28, durationDays: 4 },
    maha_shivaratri: { month: 2, day: 15 },
    holi: { month: 3, day: 4 },
    ugadi: { month: 3, day: 19 },
    ugadi_panchanga_sravanam: { month: 3, day: 19 },
    sri_rama_navami: { month: 3, day: 27 },
    bhadrachalam_sri_rama_kalyanam: { month: 3, day: 27 },
    sri_ramanavami_sita_rama_kalyanam_usage: { month: 3, day: 27 },
    mahavir_jayanti: { month: 3, day: 31 },
    chaitra_pournami: { month: 4, day: 2 },
    hanuman_jayanthi: { month: 4, day: 2 },
    anjaneya_swamy_jayanti_usage: { month: 4, day: 2 },
    basava_jayanti: { month: 4, day: 20 },
    simhachalam_chandanotsavam: { month: 4, day: 20 },
    narasimha_jayanthi: { month: 4, day: 30 },
    sri_narasimha_jayanti_usage: { month: 4, day: 30 },
    bonalu: { month: 6, day: 26, durationDays: 29 },
    guru_pournima: { month: 7, day: 29 },
    naga_panchami: { month: 8, day: 17 },
    onam: { month: 8, day: 26 },
    polala_amma_vratam: { month: 9, day: 11 },
    varalakshmi_vratham: { month: 8, day: 28 },
    krishna_janmashtami: { month: 9, day: 4 },
    vinayaka_chavithi: { month: 9, day: 14 },
    tirumala_brahmotsavam: { month: 9, day: 15, durationDays: 9 },
    kanaka_durga_temple_dasara: { month: 9, day: 22, endMonth: 10, endDay: 2 },
    bathukamma: { month: 10, day: 12, durationDays: 9 },
    dasara_vijayadashami: { month: 10, day: 20 },
    atla_taddi: { month: 10, day: 28 },
    karwa_chauth: { month: 10, day: 29 },
    kubera_puja: { month: 11, day: 6 },
    deepavali: { month: 11, day: 8 },
    tulasi_vivaham: { month: 11, day: 21 },
    guru_nanak_jayanti: { month: 11, day: 24 },
    karthika_pournami_karthika_deepam: { month: 11, day: 24 },
    dev_diwali: { month: 11, day: 24 },
    datta_jayanthi: { month: 12, day: 23 },
    vaikuntha_ekadashi: { month: 12, day: 20 },
    bhishma_ekadashi: { month: 2, day: 28 },
    sri_panchami_vasanth_panchami: { month: 1, day: 23 },
  },
};
