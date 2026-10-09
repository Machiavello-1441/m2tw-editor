export default function portraitPaths(character) {
  if (!character?.portrait) return [];
  const folder = character.portrait.toLowerCase().replace(/\.tga$/i, '');
  return ['portrait_young', 'portrait_old', 'portrait_dead'].map(variant => `ui/custom_portraits/${folder}/${variant}.tga`);
}