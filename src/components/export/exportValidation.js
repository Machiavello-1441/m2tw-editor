/**
 * Automated checks run before any mod / campaign files are written.
 * Combines the EDB structural checks with the campaign-map placement checks
 * (city & port markers, impassable ground, broken map_features topology) so a
 * single popup can list everything that should be corrected first.
 *
 * Returns: { errors: Issue[], warnings: Issue[] }
 * Issue:   { id, severity, category, title, detail, context? }
 */
import { validateMod } from './ModValidator';
import { validateLayers } from '../map/mapValidator';
import buildingRequirementValidation from '@/components/edb/buildingRequirementValidation';

export function runExportValidation({ edbData, layers }) {
  const errors = [];
  const warnings = [];
  const add = (issue) => (issue.severity === 'error' ? errors : warnings).push(issue);

  if (edbData) {
    const { errors: edbErrors, warnings: edbWarnings } = validateMod(edbData);
    edbErrors.forEach(add);
    edbWarnings.forEach(add);
    buildingRequirementValidation(edbData).issues.forEach(add);
  }

  const hasPixelData = layers && Object.values(layers).some((l) => l?.data);
  if (hasPixelData) {
    for (const issue of validateLayers(layers, 3)) {
      add({
        id: `map_${issue.id}`,
        severity: issue.severity === 'error' ? 'error' : 'warning',
        category: 'Map placement',
        title: issue.message,
        detail: issue.layer ? `map layer: ${issue.layer}` : '',
        context: issue.x != null ? { x: issue.x, y: issue.y } : undefined,
      });
    }
  }

  return { errors, warnings };
}