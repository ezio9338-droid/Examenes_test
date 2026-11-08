// Preguntas de respuesta corta: el alumno escribe una palabra o una fórmula y se corrige sola
// comparándola con las respuestas aceptadas. Función pura.
// La misma lógica está replicada en apps-script/Code.gs: si cambia una, cambia la otra.

export const MAX_SHORT_CHARS = 200; // longitud máxima de la respuesta del alumno
export const MAX_SHORT_ANSWERS = 20; // respuestas aceptadas por pregunta

const NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;
// Respuesta numérica con margen: «12,5 ±2%» (relativo) o «12,5 ±0,3» (absoluto). También «+-» en vez de «±».
const MARGIN = /^([+-]?\d+(?:[.,]\d+)?) ?(?:±|\+-|\+\/-) ?(\d+(?:[.,]\d+)?) ?(%?)$/;
// Lo que escribe el alumno en una de margen: un número, y detrás, si quiere, la unidad («12,5 g/L», «0,5 M»).
const NUMBER_UNIT = /^([+-]?\d+(?:[.,]\d+)?)(?: ?[\p{L}%°].*)?$/u;
const toNumber = (s) => Number(s.replace(",", "."));
const RUNS = /\p{L}+|[^\p{L}]+/gu; // tramos de letras y de lo demás: "hierro(III)" → hierro, (, III, )

// ¿Cuentan las mayúsculas en este tramo de letras? Sí si lleva alguna que no sea solo la inicial de un
// tramo de 3 o más letras: NaCl, Fe, O, III, pH → sí; óxido, Óxido, Ohm → no.
function runMatters(run) {
  if (run === run.toLowerCase()) return false;
  const rest = run.slice(1);
  return rest !== rest.toLowerCase() || run.length < 3;
}

// Forma comparable: sin espacios de más, sin espacios junto a los paréntesis ni punto final;
// subíndices (H₂O) como dígitos normales. Las tildes cuentan: la ortografía se tiene en cuenta.
function shortKey(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .trim()
    .replace(/\.+$/, "")
    .trim();
}

/** ¿Cuentan las mayúsculas en alguna parte de esta respuesta? (NaCl, CO2, hierro(III) → sí; Oxígeno → no) */
export function caseMatters(answer) {
  return (shortKey(answer).match(RUNS) ?? []).some(runMatters);
}

/** Margen de una respuesta numérica («12,5 ±2%») como {valor, margen, relativo}, o null si no lo es. */
export function numericMargin(answer) {
  const m = MARGIN.exec(shortKey(answer));
  return m ? { valor: toNumber(m[1]), margen: toNumber(m[2]), relativo: m[3] === "%" } : null;
}

// ¿Está el número escrito dentro del margen? Se admite la unidad detrás del número.
function withinMargin(margin, given) {
  const m = NUMBER_UNIT.exec(shortKey(given));
  if (!m) return false;
  const tol = margin.relativo ? (Math.abs(margin.valor) * margin.margen) / 100 : margin.margen;
  return Math.abs(toNumber(m[1]) - margin.valor) <= tol + 1e-9 * Math.max(1, Math.abs(margin.valor));
}

/**
 * ¿Coincide lo que ha escrito el alumno con alguna de las respuestas aceptadas? Las mayúsculas solo cuentan
 * en los tramos en que importan (símbolos, fórmulas, números romanos): «Óxido de hierro(III)» vale por
 * «óxido de hierro(III)», pero no «óxido de hierro(iii)». Una respuesta con margen («12,5 ±2%») vale
 * cualquier número dentro del margen, con o sin la unidad detrás.
 */
export function shortAnswerMatches(accepted, given) {
  return (accepted || []).some((answer) => {
    const margin = numericMargin(answer);
    if (margin) return withinMargin(margin, given);
    const a = shortKey(answer);
    let b = shortKey(given);
    if (!a) return false;
    if (!a.includes(" ")) b = b.replace(/ /g, ""); // "Na Cl" vale por "NaCl"
    if (NUMBER.test(a) && NUMBER.test(b)) return Number(a.replace(",", ".")) === Number(b.replace(",", "."));
    if (a.toLowerCase() !== b.toLowerCase()) return false;
    const ra = a.match(RUNS);
    const rb = b.match(RUNS);
    return ra.length === rb.length && ra.every((run, i) => !runMatters(run) || run === rb[i]);
  });
}
