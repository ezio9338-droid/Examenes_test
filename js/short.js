// Preguntas de respuesta corta: el alumno escribe una palabra o una fórmula y se corrige sola
// comparándola con las respuestas aceptadas. Función pura.
// La misma lógica está replicada en apps-script/Code.gs: si cambia una, cambia la otra.

export const MAX_SHORT_CHARS = 200; // longitud máxima de la respuesta del alumno
export const MAX_SHORT_ANSWERS = 20; // respuestas aceptadas por pregunta

const NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;
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

/**
 * ¿Coincide lo que ha escrito el alumno con alguna de las respuestas aceptadas? Las mayúsculas solo cuentan
 * en los tramos en que importan (símbolos, fórmulas, números romanos): «Óxido de hierro(III)» vale por
 * «óxido de hierro(III)», pero no «óxido de hierro(iii)».
 */
export function shortAnswerMatches(accepted, given) {
  return (accepted || []).some((answer) => {
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

/* ----------------------- varios cuadros por pregunta ----------------------- */

// Una pregunta de respuesta corta puede tener varios cuadros (p. ej. «Prefijos: {…}» y «Stock: {…}»): su enunciado
// lleva esta marca donde va cada cuadro, y sus respuestas aceptadas van en `huecos` (una lista por cuadro).
export const BLANK = "\uE000";
export const MAX_BLANKS = 10;

/** Respuestas aceptadas de cada cuadro: [[…]] si tiene uno solo (`respuestas`), [[…], […]] si tiene varios (`huecos`). */
export const shortBlanks = (q) => (Array.isArray(q?.huecos) ? q.huecos : [q?.respuestas ?? []]);

/** Lo que escribió el alumno en cada cuadro, como lista de textos ("" = vacío). */
export function shortGiven(q, given) {
  const n = shortBlanks(q).length;
  const list = n > 1 ? (Array.isArray(given) ? given : []) : [given];
  return Array.from({ length: n }, (_, i) => (typeof list[i] === "string" ? list[i] : ""));
}

/** ¿Dejó en blanco todos los cuadros? */
export const shortIsBlank = (q, given) => shortGiven(q, given).every((t) => !t.trim());

/** ¿Está bien? Todo o nada: cada cuadro debe coincidir con alguna de sus respuestas aceptadas. */
export function shortAllCorrect(q, given) {
  const vals = shortGiven(q, given);
  return shortBlanks(q).every((accepted, i) => vals[i].trim() !== "" && shortAnswerMatches(accepted, vals[i]));
}

/** Etiqueta de cada cuadro: el texto que lo precede en su línea («Prefijos:» → «Prefijos»), o «Cuadro n». */
export function blankLabels(text) {
  const parts = String(text ?? "").split(BLANK);
  return parts.slice(0, -1).map((p, i) => p.split("\n").pop().replace(/[\s:]+$/, "").trim() || `Cuadro ${i + 1}`);
}
