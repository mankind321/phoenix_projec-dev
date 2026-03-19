/* eslint-disable @typescript-eslint/no-explicit-any */
export async function executeSearch(supabase: any, rpcParams: any) {
  const { data, error } = await supabase.rpc("search_properties_by_radius", {
    // GEO
    p_lat: rpcParams.p_lat,
    p_lng: rpcParams.p_lng,
    p_radius_m: rpcParams.p_radius_m,
    p_outside_radius: rpcParams.p_outside_radius,
    p_max_radius_m: rpcParams.p_max_radius_m,

    // TYPE
    p_type: rpcParams.p_type,
    p_type_in: rpcParams.p_type_in,
    p_exclude_type_in: rpcParams.p_exclude_type_in,

    // PRICE
    p_min_price: rpcParams.p_min_price,
    p_max_price: rpcParams.p_max_price,
    p_not_min_price: rpcParams.p_not_min_price,
    p_not_max_price: rpcParams.p_not_max_price,

    // ✅ CAP RATE (MOVE THIS HERE — CRITICAL FIX)
    p_min_cap_rate: rpcParams.p_min_cap_rate,
    p_max_cap_rate: rpcParams.p_max_cap_rate,
    p_not_min_cap_rate: rpcParams.p_not_min_cap_rate,
    p_not_max_cap_rate: rpcParams.p_not_max_cap_rate,

    // LOCATION
    p_city: rpcParams.p_city,
    p_state: rpcParams.p_state,

    p_city_in: rpcParams.p_city_in,
    p_state_in: rpcParams.p_state_in,
    p_state_not_in: rpcParams.p_state_not_in,

    // EXCLUSIONS
    p_exclude_city: rpcParams.p_exclude_city,
    p_exclude_address: rpcParams.p_exclude_address,
    p_exclude_type: rpcParams.p_exclude_type,

    // ADDRESS
    p_address: rpcParams.p_address ?? null,
    p_exclude_city_in: rpcParams.p_exclude_city_in,

    // STREET
    p_street_in: rpcParams.p_street_in,
    p_exclude_street_in: rpcParams.p_exclude_street_in,

    // STATUS
    p_status: rpcParams.p_status,
    p_status_in: rpcParams.p_status_in,
    p_status_not_in: rpcParams.p_status_not_in,
  });

  return { data, error };
}