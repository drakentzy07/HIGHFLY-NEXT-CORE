# HIGHFLY — Training × Class Model

Status: **DESIGN GATE — no gameplay implementation until this model is accepted.**

## 1. Problema que resolvemos

Dos personas pueden realizar exactamente el mismo entrenamiento real y, sin embargo, usar personajes con builds completamente diferentes.

HIGHFLY no debe cometer ninguno de estos errores:

- hacer que una sentadilla “sea INT” sólo porque el personaje es Mago;
- hacer que el mismo entrenamiento dé exactamente el mismo poder final a Guerrero, Pícaro y Mago;
- permitir cambiar de clase/spec para farmear el atributo más conveniente;
- hacer que una build híbrida gane cinco veces más poder por aprovechar todos los stats;
- volver inútil entrenar un atributo que no sea el primario de la clase.

La solución es separar **lo que el cuerpo entrenó** de **cómo la clase convierte ese potencial en poder de juego**.

---

# 2. Tres capas separadas

## Capa A — Estímulo real (universal)

El ejercicio produce un vector independiente de la clase:

```ts
interface HighflyRawPotential {
  str: number;
  agi: number;
  vit: number;
  per: number;
  int: number;
}
```

Ese vector representa al usuario real y no cambia si cambia de clase o especialización.

Ejemplo conceptual:

- sentadilla pesada 3–5 reps: STR dominante + VIT secundaria + PER pequeña;
- Hang Power Clean: AGI dominante + STR secundaria + PER técnica;
- hipertrofia 8–12: VIT dominante + stat mecánico secundario;
- cardio: AGI + VIT;
- movimientos técnicos / coordinación: PER + AGI;
- adherencia, técnica compleja, precisión de RPE/RIR y aprendizaje: pequeña contribución a INT/PER.

**Regla:** la clase jamás reescribe el estímulo real.

## Capa B — Afinidad de clase/spec (dinámica)

El personaje interpreta el Raw Potential según su clase y spec actual.

```ts
interface HighflySpecAffinity {
  str: number;
  agi: number;
  vit: number;
  per: number;
  int: number;
}
```

La afinidad no se persiste como stat ganado. Se recalcula al cambiar spec.

Por eso:

- el mismo +10 STR es muy valioso para Guerrero Arms;
- útil pero secundario para Pícaro;
- defensivo/terciario para Mago;
- nunca se transforma mágicamente en +10 INT.

## Capa C — Bonus efectivo HIGHFLY

El motor convierte Raw Potential + afinidad en un presupuesto de bonus normalizado.

```ts
interface HighflyDerivedTrainingBonus {
  attackPower: number;
  spellPower: number;
  maxHp: number;
  mobility: number;
  hitRating: number;
  critRating: number;
  dodgeRating: number;
  trainingPowerScore: number;
}
```

La suma de cinco atributos **no puede** permitir que una clase híbrida obtenga cinco veces el poder de una clase especializada.

Se calcula primero un `trainingPowerScore` normalizado y luego se reparte en efectos apropiados para la spec.

---

# 3. Qué significa cada atributo HIGHFLY

## STR — Fuerza

Capacidad de producir fuerza y tensión alta.

Fuentes principales:

- trabajo de 1–5 reps;
- levantamientos pesados;
- variantes de fuerza;
- tirones pesados.

Uso de juego:

- fuerte en specs físicas STR;
- moderado en melee AGI;
- pequeño aporte de robustez/carga en casters, nunca Spell Power directo.

## AGI — Agilidad / Potencia

Velocidad, explosividad, coordinación dinámica y capacidad de producir fuerza rápido.

Fuentes:

- Hang Power Clean;
- saltos;
- sprints;
- push press explosivo;
- trabajo de velocidad;
- conditioning rápido.

Uso:

- altísimo en Pícaro/Cazador;
- importante secundario en melee móviles;
- pequeño aporte de movilidad/supervivencia en casters.

## VIT — Vitalidad

Capacidad de trabajo, robustez, tolerancia al volumen y resistencia.

Fuentes:

- hipertrofia;
- volumen efectivo;
- cardio/conditioning;
- trabajo muscular sostenido.

Uso:

- HP/STA principalmente;
- especialmente valioso en tanks y bruisers;
- siempre útil, pero con rendimiento normalizado.

## PER — Percepción / Control

Precisión, técnica, lectura, control motor y ejecución.

Fuentes:

- ejercicios técnicos;
- estabilidad;
- movimientos coordinativos;
- trabajo de espalda/tirón con control;
- consistencia de ejecución;
- precisión de registro/RPE/RIR.

Uso:

- Hit/precisión;
- parte controlada de crit/targeting;
- gran secundaria en Pícaro/Cazador;
- buena secundaria en casters y healers.

## INT — Inteligencia / Dominio

No significa que “hacer bíceps da magia”. Representa aprendizaje, disciplina técnica, planificación, dominio del sistema y ejecución cognitiva.

Fuentes físicas pequeñas:

- movimientos técnicamente complejos;
- mejora objetiva de ejecución;
- consistencia/adherencia;
- progresión bien planificada;
- precisión al registrar entrenamiento.

Más adelante HIGHFLY puede sumar fuentes no físicas en Academia/estudio.

Uso:

- primaria de casters/healers;
- Spell Power/mana de forma normalizada;
- secundaria pequeña para clases híbridas.

---

# 4. Tipos de ejercicio

No asignar todos los ejercicios de la misma manera.

## PURE / DOMINANTE

>= 75–85% del estímulo cae en un atributo.

Ejemplos conceptuales:

- fuerza máxima -> STR;
- sprint/jump explosivo -> AGI;
- cardio sostenido -> VIT;
- drill técnico/coordinativo -> PER.

No existe un ejercicio físico puro de INT; INT físico proviene de calidad/complexidad/adherencia, no de tonelaje.

## HYBRID

Tiene dos o tres estímulos claros.

Ejemplo:

```text
Hang Power Clean
AGI 55%
STR 30%
PER 15%
```

## SYSTEMIC

Sesiones completas, circuitos o trabajos que distribuyen adaptación entre varias capacidades.

La rutina híbrida semanal debe progresar los cinco atributos, pero **no porque cada ejercicio dé todo**, sino porque la semana contiene estímulos diferentes.

---

# 5. Fuente de verdad de ClaudeCraft

ClaudeCraft ya declara un `primaryStat` por especialización. HIGHFLY debe partir de esa identidad, no inventar otra clase por encima.

Primarios reales del upstream v0.39.0:

| Clase | Spec | Primario upstream |
|---|---|---|
| Warrior | Arms | STR |
| Warrior | Fury | STR |
| Warrior | Prot | STR |
| Paladin | Holy | INT |
| Paladin | Protection | STR |
| Paladin | Retribution | STR |
| Hunter | Beast Mastery | AGI |
| Hunter | Marksmanship | AGI |
| Hunter | Survival | AGI |
| Rogue | Assassination | AGI |
| Rogue | Combat | AGI |
| Rogue | Subtlety | AGI |
| Priest | Discipline | INT |
| Priest | Holy | INT |
| Priest | Shadow | INT |
| Shaman | Elemental | INT |
| Shaman | Enhancement | STR |
| Shaman | Restoration | INT |
| Mage | Fire | INT |
| Mage | Frost | INT |
| Mage | Arcane | INT |
| Warlock | Affliction | INT |
| Warlock | Demonology | INT |
| Warlock | Destruction | INT |
| Druid | Balance | INT |
| Druid | Feral | STR |
| Druid | Restoration | INT |

HIGHFLY añade VIT/PER y afinidades secundarias, pero no contradice el primario de la spec.

---

# 6. Matriz inicial de afinidad HIGHFLY

Estas cifras son **pesos de utilidad**, no multiplicadores directos de daño. Cada fila se normaliza al calcular `trainingPowerScore`.

Escala: 1.00 = máxima afinidad; 0.05 = residual.

| Spec / familia | STR | AGI | VIT | PER | INT |
|---|---:|---:|---:|---:|---:|
| Warrior Arms/Fury | 1.00 | 0.45 | 0.70 | 0.40 | 0.08 |
| Warrior Prot | 0.85 | 0.30 | 1.00 | 0.45 | 0.10 |
| Paladin Holy | 0.20 | 0.12 | 0.55 | 0.55 | 1.00 |
| Paladin Protection | 0.80 | 0.20 | 1.00 | 0.40 | 0.35 |
| Paladin Retribution | 1.00 | 0.35 | 0.60 | 0.35 | 0.25 |
| Hunter BM | 0.25 | 1.00 | 0.50 | 0.70 | 0.12 |
| Hunter Marksmanship | 0.18 | 1.00 | 0.40 | 0.90 | 0.12 |
| Hunter Survival | 0.45 | 1.00 | 0.60 | 0.70 | 0.12 |
| Rogue Assassination | 0.35 | 1.00 | 0.40 | 0.80 | 0.08 |
| Rogue Combat | 0.50 | 1.00 | 0.50 | 0.60 | 0.08 |
| Rogue Subtlety | 0.28 | 1.00 | 0.35 | 0.95 | 0.10 |
| Priest Discipline | 0.08 | 0.12 | 0.55 | 0.65 | 1.00 |
| Priest Holy | 0.06 | 0.10 | 0.50 | 0.60 | 1.00 |
| Priest Shadow | 0.08 | 0.18 | 0.45 | 0.65 | 1.00 |
| Shaman Elemental | 0.18 | 0.22 | 0.50 | 0.55 | 1.00 |
| Shaman Enhancement | 1.00 | 0.60 | 0.65 | 0.45 | 0.25 |
| Shaman Restoration | 0.12 | 0.18 | 0.55 | 0.60 | 1.00 |
| Mage Fire | 0.05 | 0.20 | 0.40 | 0.60 | 1.00 |
| Mage Frost | 0.05 | 0.25 | 0.45 | 0.65 | 1.00 |
| Mage Arcane | 0.05 | 0.15 | 0.40 | 0.75 | 1.00 |
| Warlock Affliction | 0.06 | 0.12 | 0.55 | 0.60 | 1.00 |
| Warlock Demonology | 0.10 | 0.12 | 0.75 | 0.50 | 1.00 |
| Warlock Destruction | 0.06 | 0.15 | 0.50 | 0.55 | 1.00 |
| Druid Balance | 0.12 | 0.25 | 0.55 | 0.55 | 1.00 |
| Druid Feral | 1.00 | 0.65 | 0.90 | 0.50 | 0.18 |
| Druid Restoration | 0.10 | 0.18 | 0.55 | 0.60 | 1.00 |

Estas afinidades se balancean con tests de poder; no deben copiarse directamente a `Entity.stats`.

---

# 7. Fórmula propuesta

## 7.1 Ganancia de sesión

```text
rawGain(stat)
  = stimulus(stat)
  × qualityFactor
  × progressionFactor
  × fatigueValidity
  × antiSpamDiminishingReturns
```

Donde `stimulus(stat)` viene del ejercicio, no de la clase.

## 7.2 Potencial efectivo de una spec

Primero aplicar una curva de rendimiento decreciente a cada raw stat:

```text
curvedStat = cap * (1 - exp(-raw / scale))
```

Luego:

```text
weightedPotential = Σ(curvedStat[i] × normalizedAffinity[i])
```

Después mapear `weightedPotential` a un presupuesto de poder PvE con techo global.

**Importante:** no sumar cinco multiplicadores de daño. Un único presupuesto se redistribuye entre AP/SP/HP/Hit/etc. según la spec.

---

# 8. Ejemplo: mismo entrenamiento, tres personajes

Sesión híbrida ejemplo genera este Raw Gain:

```text
STR +10
AGI +8
VIT +7
PER +5
INT +2
```

Los tres usuarios hicieron el mismo trabajo real; los cinco números son iguales.

## Warrior Arms

La afinidad prioriza STR/VIT. La sesión se traduce principalmente en:

- Attack Power;
- HP/robustez;
- pequeña precisión/movilidad.

## Rogue Subtlety

La misma sesión prioriza AGI/PER:

- precisión/posición;
- daño físico ágil;
- dodge/crit controlado;
- STR aporta, pero no domina.

## Mage Fire

La misma sesión no convierte STR en magia.

- el poco INT/PER ganado es lo más eficiente para Spell Power/control;
- VIT da supervivencia;
- AGI aporta movilidad/evitación pequeña;
- STR tiene utilidad residual.

Un Mago que quiere maximizar Potencial Real no necesita “hacer otro deporte”, pero su semana híbrida se beneficia especialmente de trabajo técnico, conditioning, potencia y calidad/adherencia además del trabajo de fuerza.

---

# 9. Por qué NO damos stats distintos según clase al guardar el entrenamiento

Parece atractivo hacer:

> Sentadilla = +STR para Guerrero, +INT para Mago.

Pero rompe el sistema:

1. falsea el historial real;
2. cambiar spec/clase antes de registrar sería explotable;
3. dos personajes del mismo usuario tendrían cuerpos reales contradictorios;
4. dificulta balancear futuras clases;
5. obliga a migrar datos si una spec cambia de diseño.

Por eso HIGHFLY usa:

> **mismo estímulo real + distinta conversión de clase.**

Esto da exactamente la diferencia de build sin corromper el dato físico.

---

# 10. Account-bound vs character-bound

El entrenamiento pertenece a la **persona**, no al personaje.

Recomendación:

```ts
HighflyTrainingProfile // account/player real
```

compartido por los personajes del mismo usuario.

Cada personaje calcula su propio:

```ts
HighflyDerivedTrainingBonus(class, spec, profile)
```

Resultado:

- cambiar personaje no duplica entrenamientos;
- cambiar spec no borra progreso;
- no existe farming de stats cambiando de clase;
- el mismo usuario puede sentir cómo su Potencial Real se expresa distinto en cada build.

Para el modo offline inicial puede persistirse localmente con un `profileId`; el modelo debe quedar preparado para autoridad de servidor más adelante.

---

# 11. Pure stats + afinidad de clase

La idea del usuario de combinar ejercicios “puros” con ejercicios base/híbridos se conserva así:

- **PURE:** casi todo el Raw Gain va a un stat y la clase no lo altera;
- **HYBRID:** el ejercicio reparte Raw Gain entre 2–3 stats;
- **CLASS AFFINITY:** decide cuánto valor efectivo obtiene la build de esos stats, no cambia qué entrenó el cuerpo.

Así un entrenamiento de fuerza sigue siendo fuerza para todos, pero no significa lo mismo para un Mago que para un Guerrero.

---

# 12. Balance total

Target inicial de largo plazo:

- 0 entrenamiento: 100% power normal de ClaudeCraft;
- entrenamiento consistente: +12–18% equivalente PvE a mismo nivel/equipo;
- techo muy alto: ~+25% equivalente;
- el bonus no se entrega como `damage *= 1.25`;
- tanks convierten más presupuesto a supervivencia;
- healers a throughput/recursos;
- physical DPS a AP/precisión/movilidad;
- casters a SP/precisión/supervivencia;
- PvP puede normalizar parcialmente Training Power.

La matriz se calibra para que ninguna spec alcance el techo mucho antes simplemente porque tiene cinco afinidades altas.

---

# 13. Gate de implementación

Antes de escribir la lógica real deben existir tests de diseño para:

1. misma sesión => mismo Raw Potential sin importar clase;
2. Warrior/Mage/Rogue => Derived Bonus distinto;
3. cambio de spec => Raw Potential intacto;
4. volver a spec anterior => mismo Derived Bonus previo;
5. ninguna spec supera el presupuesto máximo por sumar varios stats;
6. una rutina híbrida progresa todas las builds de forma útil;
7. una rutina hiper-especializada progresa más rápido a builds afines, pero no inutiliza las otras;
8. entrenamientos repetidos idénticos sufren diminishing returns;
9. no se puede duplicar una sesión entre personajes;
10. Adventure XP y Training Potential permanecen separados.

**No conectar todavía este modelo a `recalcPlayerStats()` hasta que estos tests y la matriz sean aceptados.**
