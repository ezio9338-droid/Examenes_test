// Hoja «Examenes»: los exámenes quedan ordenados por grupo (y, dentro de cada grupo, por fecha de creación).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./fake-gas.js";
import { parseGift } from "../js/gift.js";

test("los exámenes se ordenan por grupo y, dentro del grupo, por fecha; se siguen encontrando por su id", () => {
  const env = makeEnv();
  const preguntas = parseGift("::P::Uno{=a~b}");
  const crear = (titulo, grupo) => env.post({ action: "createExam", token: "secreto", titulo, grupo_destino: grupo, preguntas });
  const ids = {};
  for (const [t, g] of [["Química 1", "3B"], ["Física 1", "2A"], ["Química 2", "3B"], ["Física 2", "2A"], ["Repaso", "1C"]]) {
    const r = crear(t, g);
    assert.equal(r.ok, true);
    ids[t] = r.id;
  }
  const rows = env.sheets.get("Examenes").rows.slice(1);
  assert.deepEqual(rows.map((r) => `${r[2]} · ${r[1]}`), ["1C · Repaso", "2A · Física 1", "2A · Física 2", "3B · Química 1", "3B · Química 2"]);
  // Después de mover las filas, cada examen sigue siendo el suyo.
  for (const [t, id] of Object.entries(ids)) {
    const ex = env.get({ action: "exam", id });
    assert.equal(ex.ok, true);
    assert.equal(ex.exam.titulo, t);
  }
  const close = env.post({ action: "setActive", token: "secreto", id: ids["Física 1"], activo: false });
  if (close.ok) assert.equal(env.get({ action: "exam", id: ids["Física 1"] }).ok, false);
});
