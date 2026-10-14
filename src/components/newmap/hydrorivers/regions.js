export const HYDRO_REGIONS = [
  ['eu', 'Europe and Middle East', 68], ['af', 'Africa', 108],
  ['as', 'Asia', 91], ['si', 'Siberia', 47], ['na', 'North and Central America', 66],
  ['sa', 'South America', 95], ['au', 'Australasia', 49],
  ['ar', 'Arctic (northern Canada)', 22], ['gr', 'Greenland', 9],
].map(([id, label, size]) => ({ id, label, size,
  url: `https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_${id}_shp.zip` }));
export const RIVER_RULES_URL = 'https://wiki.twcenter.net/index.php?title=Map_features.tga';