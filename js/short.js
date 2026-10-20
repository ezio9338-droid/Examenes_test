// Preguntas de respuesta corta: el alumno escribe una palabra o una fórmula y se corrige sola
// comparándola con las respuestas aceptadas. Función pura.
// La misma lógica está replicada en apps-script/Code.gs: si cambia una, cambia la otra.

export const MAX_SHORT_CHARS = 200; // longitud máxima de la respuesta del alumno
export const MAX_SHORT_ANSWERS = 20; // respuestas aceptadas por pregunta

const NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;

/**
 * ¿Importan las mayúsculas en esta respuesta? Sí si lleva alguna mayúscula que no sea solo la inicial
 * de una palabra de 3 o más letras: NaCl, CO2, H2O, Fe, pH → sí; oxígeno, Oxígeno, Ley de Ohm → no.
 */
export function caseMatters(answer) {
  return String(answer ?? "")
    .normalize("NFKC")
    .split(/\s+/)
    .some((word) => {
      const letters = word.replace(/[^\p{L}]/gu, "");
      if (letters === letters.toLowerCase()) return false;
      const rest = letters.slice(1);
      return rest !== rest.toLowerCase() || letters.length < 3;
    });
}

// Forma comparable: sin espacios de más ni punto final; subíndices (H₂O) como dígitos normales.
// Las tildes cuentan: la ortografía se tiene en cuenta.
function shortKey(text, keepCase) {
  const t = String(text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .trim();
  return keepCase ? t : t.toLowerCase();
}

/** ¿Coincide lo que ha escrito el alumno con alguna de las respuestas aceptadas? */
export function shortAnswerMatches(accepted, given) {
  return (accepted || []).some((answer) => {
    const keep = caseMatters(answer);
    const a = shortKey(answer, keep);
    let b = shortKey(given, keep);
    if (!a) return false;
    if (!a.includes(" ")) b = b.replace(/ /g, ""); // "Na Cl" vale por "NaCl"
    if (NUMBER.test(a) && NUMBER.test(b)) return Number(a.replace(",", ".")) === Number(b.replace(",", "."));
    return a === b;
  });
}
