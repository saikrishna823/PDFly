export interface FileRejection {
  file: File;
  reason: string;
}

export interface FileSelection {
  accepted: File[];
  rejected: FileRejection[];
}

/**
 * Filter files against an `accept` string (".pdf,image/png,image/*") and a size cap.
 * This is a convenience check for the UI; processors still verify file contents.
 */
export function partitionFiles(files: readonly File[], accept: string, maxBytes: number): FileSelection {
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  const maxMb = Math.round(maxBytes / (1024 * 1024));
  const selection: FileSelection = { accepted: [], rejected: [] };

  for (const file of files) {
    if (rules.length && !rules.some((rule) => matchesRule(file, rule))) {
      selection.rejected.push({ file, reason: "isn't a supported file type" });
    } else if (file.size > maxBytes) {
      selection.rejected.push({ file, reason: `is larger than ${maxMb} MB` });
    } else if (file.size === 0) {
      selection.rejected.push({ file, reason: 'is empty' });
    } else {
      selection.accepted.push(file);
    }
  }
  return selection;
}

function matchesRule(file: File, rule: string): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (rule.startsWith('.')) {
    return name.endsWith(rule);
  }
  if (rule.endsWith('/*')) {
    return type.startsWith(rule.slice(0, -1));
  }
  return type === rule;
}
