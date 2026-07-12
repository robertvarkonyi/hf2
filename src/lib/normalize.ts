/**
 * A település-egyeztetés EGYETLEN normalizáló függvénye (AD-2).
 * A seed és minden lookup ezt használja, hogy ne legyen néma divergencia.
 *
 * Lépések rögzített sorrendben:
 *   1. trim (whitespace le)
 *   2. toLowerCase (kis/nagybetű-független)
 *   3. Unicode NFD + diakritikus jelek eltávolítása (ékezetfüggetlen)
 *
 * @returns a normalizált kulcs (üres string, ha nincs bemenet)
 */
export function normalizeTown(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
