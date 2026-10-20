// Preguntas de respuesta corta: comparación, GIFT y servidor (Code.gs simulado).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./fake-gas.js";
import { parseGift } from "../js/gift.js";
import { gradeExam } from "../js/grading.js";
import { caseMatters, shortAnswerMatches } from "../js/short.js";

const plain = (x) => JSON.parse(JSON.stringify(x));

test("caseMatters: fórmulas y símbolos sí; palabras normales no", () => {
  for (const a of ["NaCl", "CO2", "H2O", "Fe", "C", "pH", "Na Cl"]) assert.equal(caseMatters(a), true, a);
  for (const a of ["oxígeno", "Oxígeno", "Ley de Ohm", "cloruro de sodio", "12,5", ""]) assert.equal(caseMatters(a), false, a);
});

test("shortAnswerMatches: lo que vale y lo que no", () => {
  const nacl = ["NaCl"];
  for (const g of ["NaCl", " NaCl ", "NaCl.", "Na Cl"]) assert.equal(shortAnswerMatches(nacl, g), true, g);
  for (const g of ["nacl", "NACL", "KCl", "", "NaCl2"]) assert.equal(shortAnswerMatches(nacl, g), false, g);
  assert.equal(shortAnswerMatches(["H2O"], "H₂O"), true, "subíndices");
  assert.equal(shortAnswerMatches(["CO"], "Co"), false, "monóxido de carbono no es cobalto");
  const palabra = ["cloruro de sodio", "cloruro sódico"];
  for (const g of ["Cloruro de sodio", "CLORURO  DE SODIO", "cloruro sodico", "Cloruro Sódico."]) assert.equal(shortAnswerMatches(palabra, g), true, g);
  assert.equal(shortAnswerMatches(palabra, "clorurodesodio"), false);
  assert.equal(shortAnswerMatches(["Oxígeno"], "oxigeno"), true);
  assert.equal(shortAnswerMatches(["0,5"], "0.5"), true);
  assert.equal(shortAnswerMatches(["0,5"], ".5"), false);
  assert.equal(shortAnswerMatches(["12"], "12,0"), true);
});

test("GIFT: solo respuestas con = es respuesta corta; con ~ sigue siendo test", () => {
  const qs = parseGift("::C1::[valor=0,5] Fórmula del cloruro de sodio{=NaCl}\n\n::C2::Nombre de NaCl{=cloruro de sodio =cloruro sódico#bien =cloruro de sodio}\n\nT{=a~b}");
  assert.deepEqual(plain(qs.map((q) => [q.tipo, q.respuestas, q.options.length, q.valor])), [
    ["corta", ["NaCl"], 0, 0.5],
    ["corta", ["cloruro de sodio", "cloruro sódico"], 0, 1],
    ["test", null, 2, 1],
  ]);
  assert.throws(() => parseGift("A{=x =}"), /Pregunta 1.*vacía/);
  assert.throws(() => parseGift(`A{${Array.from({ length: 21 }, (_, i) => `=r${i}`).join(" ")}}`), /Pregunta 1.*demasiadas/);
});

test("gradeExam: acierto suma, error no resta, vacío es en blanco", () => {
  const qs = parseGift("A{=NaCl}\n\nB{=a~b~c~d}\n\nC{=agua}\n\nD{=CO2}");
  const r = gradeExam(qs, { q1: "Na Cl", q2: "a", q3: "fuego", q4: "   " }, { penalty: { num: 1, den: 3 } });
  assert.deepEqual([r.aciertos, r.errores, r.blancos, r.puntos, r.nota], [2, 1, 1, 2, 5]);
  assert.throws(() => gradeExam(qs, { q1: 3 }), /no válida/);
});

const GIFT = `::T1::Uno{=a~b~c~d}

::C1::[valor=2] Fórmula del cloruro de sodio{=NaCl}

::C2::Nombre del H2O{=agua =monóxido de dihidrógeno}

::A1::Explica algo{}`;

function setup() {
  const env = makeEnv();
  const r = env.post({ action: "createExam", token: "secreto", titulo: "Química", mostrar_nota: true, preguntas: parseGift(GIFT) });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { env, id: r.id };
}

test("el alumno recibe el tipo pero nunca las respuestas aceptadas", () => {
  const { env, id } = setup();
  const got = env.get({ action: "exam", id });
  assert.deepEqual(plain(got.exam.questions.map((q) => q.tipo)), ["test", "corta", "corta", "abierta"]);
  const json = JSON.stringify(got);
  assert.ok(!json.includes("NaCl") && !json.includes("agua") && !json.includes("respuestas"), json);
  assert.ok(env.get({ action: "version" }).funciones.includes("cortas"));
});

test("envío: se corrige solo en el servidor y queda en la hoja", () => {
  const { env, id } = setup();
  const sub = plain(env.post({ action: "submit", examId: id, nombre: "Ana", apellidos: "López", grupo: "B", envioId: "e1", respuestas: { q1: "b", q2: "  Na Cl ", q3: "Agua" }, abiertas: { q4: "x" } }));
  // test: error (−1/3); cortas: 2 + 1 → 3 − 1/3 = 2,67 sobre 4 de la parte corregida sola
  assert.deepEqual([sub.aciertos, sub.errores, sub.blancos, sub.puntos_test, sub.puntos_test_max], [2, 1, 0, 2.67, 4]);
  const rows = env.results(id).rows;
  assert.equal(JSON.parse(rows[1][rows[0].indexOf("respuestas_json")]).q2, "Na Cl");

  // validación: no texto, demasiado largo
  const bad = (respuestas) => env.post({ action: "submit", examId: id, nombre: "Eva", apellidos: "Ruiz", grupo: "B", respuestas });
  assert.equal(bad({ q2: 5 }).error, "invalid_answers");
  assert.equal(bad({ q2: "x".repeat(201) }).error, "invalid_answers");
});

test("revisión: el alumno ve lo que escribió, si acertó y las respuestas aceptadas", () => {
  const { env, id } = setup();
  env.post({ action: "submit", examId: id, nombre: "Ana", apellidos: "López", grupo: "B", envioId: "e1", respuestas: { q1: "a", q2: "nacl", q3: null } });
  env.post({ action: "setReview", token: "secreto", id, revision: true });
  const rev = plain(env.post({ action: "review", examId: id, envioId: "e1" })).review;
  const [, c1, c2] = rev.questions;
  assert.deepEqual([c1.tipo, c1.respuesta, c1.acertada, c1.correctas], ["corta", "nacl", false, ["NaCl"]]);
  assert.deepEqual([c2.respuesta, c2.acertada], [null, false]);
});

test("validación de preguntas de respuesta corta en el servidor", () => {
  const env = makeEnv();
  const create = (q) => env.post({ action: "createExam", token: "secreto", titulo: "X", preguntas: [{ id: "q1", text: "¿?", ...q }] });
  assert.equal(create({ tipo: "corta", respuestas: [] }).error, "invalid_exam");
  assert.equal(create({ tipo: "corta", respuestas: [" "] }).error, "invalid_exam");
  assert.equal(create({ tipo: "corta", respuestas: ["a"], options: [{ id: "a", text: "a" }] }).error, "invalid_exam");
  assert.equal(create({ tipo: "corta", respuestas: ["NaCl"] }).ok, true);
});
