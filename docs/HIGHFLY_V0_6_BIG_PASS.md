# HIGHFLY v0.6 — Big Pass

## Objetivo

Hacer una sola evolución coherente de HIGHFLY sobre ClaudeCraft, sin reescribir sus 9 clases ni su contenido base.

La v0.6 une cuatro frentes que dependen entre sí:

1. **Creador Android estable** — volver al creador completo que mostraba personaje, rol, características y stats, y corregir sólo el encaje S23 horizontal.
2. **Action Combat Core** — control directo, orientación estable, input claro, dash final y ataque móvil sin comportamiento de tab-target rígido.
3. **Targeting Profiles** — cada habilidad usa el tipo de apuntado que realmente le corresponde: instantánea, línea/proyectil, cono, área de suelo o self/friendly.
4. **HIGHFLY Training Progression** — el juego puede progresar sin entrenamiento real, pero entrenar crea una ventaja permanente y validable que sería extremadamente lenta de igualar sólo jugando.

No se implementan combos de ataques básicos en esta fase. ClaudeCraft ya tiene sinergias y secuencias entre habilidades; primero se mejora el control, el apuntado y el impacto.

---

# A. Creador de personaje — rollback funcional + fit S23

## Regla

No volver a comprimir/reemplazar contenido del creador. El creador original de ClaudeCraft ya contiene información útil y debe preservarse.

### Recuperar

- preview 3D completo;
- nombre de clase;
- rol;
- descripción;
- características/stats originales;
- las 9 clases originales;
- todas las pestañas de apariencia.

### Cambiar solamente layout

- dos columnas reales;
- izquierda: nombre, clases, apariencia y acción final;
- derecha: preview + información completa de clase;
- scroll sólo dentro de Apariencia y/o descripción cuando sea necesario;
- nunca scroll global del shell;
- `ENTRAR AL MUNDO` como botón simple, sin dock/recuadro contenedor extra;
- márgenes seguros para S23 horizontal;
- ningún panel puede sangrar fuera del viewport.

La v0.5.5 introdujo un resumen nativo compacto que ocultó información útil. v0.6 debe revertir ese reemplazo y conservar únicamente los arreglos de viewport/canvas que demostraron ser necesarios.

---

# B. Action Combat Core

## B1. Propiedad del input

- mitad izquierda: movimiento exclusivamente;
- mitad derecha libre: cámara;
- botones de skill/dash: su propio pointer owner;
- una skill apuntándose nunca debe girar la cámara accidentalmente;
- el joystick izquierdo nunca debe iniciar cámara.

## B2. Facing del personaje

Estados explícitos:

### Exploración

El personaje mira hacia su dirección real de desplazamiento.

### Idle

Al soltar el joystick conserva su última dirección coherente; no hace snap automático hacia el norte/cámara.

### Cast / ataque

Al ejecutar una habilidad que requiere dirección, el avatar gira hacia la dirección elegida o hacia el objetivo asistido.

### Lock/manual target

Si el jugador usa Objetivo manual, ese lock puede influir en skills compatibles, pero nunca debe sobreescribir un drag manual explícito.

## B3. DASH final

- TAP: dash rápido usando intención actual;
- HOLD/DRAG: dirección 360° cámara-relativa;
- RELEASE: ejecutar exactamente en esa dirección;
- preview visible desde el jugador en el mundo 3D;
- i-frames actuales se conservan;
- la cámara no decide la dirección del dash;
- dash no consume slots de skill.

---

# C. Targeting Profiles

Cada habilidad recibe un perfil de control independiente de su clase.

```ts
type HighflyAimProfile =
  | 'instant'
  | 'line'
  | 'cone'
  | 'ground'
  | 'self'
  | 'friendly';
```

## C1. Instant / smart cast

Ejemplos: golpes directos, algunas skills de melee, buffs rápidos.

- TAP: lanza inmediatamente;
- si requiere enemigo, soft aim busca candidato válido cerca de la intención de cámara;
- lock manual tiene prioridad sólo cuando no hubo input direccional explícito.

## C2. Line / projectile

Ejemplos: bola de fuego, flecha, lanza, onda lineal.

- TAP: semi-auto aim;
- HOLD/DRAG: joystick de intención desde el botón;
- VISUAL: carril/flecha sale desde el jugador en mundo 3D;
- RELEASE: usa la dirección seleccionada;
- asistencia magnética sólo si el enemigo está muy cerca de esa trayectoria;
- no secuestrar un drag claramente fuera del enemigo.

Fase final del perfil `line`: permitir skillshots que puedan fallar físicamente cuando el proyectil no intersecta nada, en vez de convertir todo drag en homing tab-target.

## C3. Cone

- HOLD: preview de cono desde el jugador;
- DRAG: rota el cono;
- RELEASE: cast;
- TAP: cono hacia la mejor intención rápida válida.

## C4. Ground

- retícula de área sobre el terreno;
- mover dentro de rango;
- clamp al rango autoritativo existente de ClaudeCraft;
- RELEASE: cast en ese punto.

## C5. Self / friendly

- self/buff: tap directo;
- friendly: smart-target aliado + selección manual opcional;
- nunca mostrar línea ofensiva innecesaria.

---

# D. Combat Feel — salto de calidad sin combos

Agregar una capa de presentación sin cambiar fórmulas de daño ni kits:

- hit-stop local muy corto en golpes fuertes (aprox. 30–55 ms, nunca congelar Sim);
- pequeño camera impulse en impactos relevantes, configurable;
- reacción/stagger visual de mobs cuando corresponda;
- trails claros para melee/proyectiles;
- telegraphs enemigos para ataques grandes;
- feedback de cooldown y disponibilidad más legible;
- input buffer corto para skills (objetivo inicial: 100–140 ms);
- dash cancel sólo en ventanas permitidas;
- no introducir combo de básicos en v0.6.

La regla es que **Sim sigue autoritativo**. Hit-stop, shake y feedback visual no alteran el tick de daño ni la red.

---

# E. HIGHFLY Training Progression

## Filosofía

HIGHFLY deja de tener dos caminos excluyentes.

### Camino Juego

Un usuario puede jugar normalmente, subir de nivel, conseguir equipo, talentos, loot y completar todo el mundo sin registrar entrenamientos reales.

### Camino Entrenamiento

El entrenamiento real crea una segunda progresión permanente: **Potencial Real**.

A igual nivel/equipo, el jugador que entrena tiene una ventaja tangible. Un jugador que no entrena puede acercarse parcialmente con muchísimas horas de juego, pero no obtiene esa ventaja con la misma eficiencia.

---

# F. Dos progresiones, un solo personaje

## F1. Adventure XP

ClaudeCraft conserva su sistema de XP normal:

- mobs;
- quests;
- dungeons;
- bosses;
- profesiones cuando corresponda;
- rested XP;
- lifetime XP/post-cap.

Esto controla **nivel de aventura, acceso de contenido, talentos, gear y progreso MMO**.

No convertir cada entrenamiento real en niveles de aventura gratis: rompería el pacing de quests y zonas.

## F2. Training XP / Potencial Real

Nuevo estado HIGHFLY:

```ts
interface HighflyTrainingProfile {
  trainingXp: number;
  str: number;
  agi: number;
  vit: number;
  per: number;
  int: number;
  validatedSessions: number;
  weeklyLoad: number;
  lastValidatedAt: number | null;
}
```

Los cinco atributos HIGHFLY son una capa adicional, no un reemplazo de las clases ClaudeCraft.

### Conversión al motor existente

- **STR** → contribución a `str` / Attack Power físico;
- **AGI** → contribución a `agi` + componentes moderados de movilidad/crit/dodge según reglas de clase;
- **VIT** → contribución a `sta` / HP;
- **INT** → contribución a `int` / mana/spell power;
- **PER** → no se disfraza de Spirit: se convierte en precisión/Hit Rating, lectura/crit controlado y sistemas HIGHFLY de percepción.

Mostrar siempre el origen del bonus en UI, por ejemplo:

`FUERZA 38  (+7 ENTRENAMIENTO)`

para que el ejercicio real se sienta validado y visible.

---

# G. Cómo puntuar un entrenamiento real

No premiar sólo “cantidad”. El score de sesión combina:

- trabajo realizado;
- intensidad relativa;
- volumen válido;
- tipo de estímulo;
- progresión respecto del historial;
- finalización de series;
- límites anti-spam y rendimientos decrecientes diarios/semanales.

Ejemplo conceptual de reparto por estímulo:

- fuerza 1–5 reps → STR dominante;
- potencia / HPC / saltos / push press → AGI dominante + STR secundaria;
- hipertrofia 8–12 → VIT dominante;
- espalda / tirón → STR + PER;
- cardio → AGI + VIT;
- core / trabajo técnico → PER + VIT/INT según ejercicio;
- trabajo cognitivo/estudio que HIGHFLY defina más adelante puede alimentar INT sin falsificar entrenamiento físico.

La sesión entrega `Training XP`; los atributos permanentes se obtienen a través de una curva con diminishing returns para impedir que una semana de spam destruya el balance del MMO.

---

# H. Ventaja objetivo

Primer target de balance, ajustable después de test real:

- jugador casual sin entrenamiento: 100% de su power normal de juego;
- jugador consistente que entrena: aproximadamente +12–18% de poder efectivo PvE a igual nivel/equipo;
- techo de largo plazo de Potencial Real: alrededor de +25% equivalente, repartido por stats y no como multiplicador bruto único.

La ventaja debe sentirse, pero no volver inútil jugar sin entrenar.

En PvP competitivo se puede usar una contribución parcial/normalizada del bonus de entrenamiento para evitar que Arena quede matemáticamente cerrada; PvE conserva el bonus completo.

---

# I. “Podés igualarlo jugando, pero te lleva una barbaridad”

ClaudeCraft ya conserva `lifetimeXp` y niveles virtuales post-cap. Actualmente esos niveles virtuales no dan poder.

HIGHFLY puede reutilizar esa progresión como **Veteran Adaptation**:

- después del cap de aventura, lifetime XP sigue creciendo;
- cruzar niveles virtuales entrega una cantidad pequeña de Veteran Adaptation;
- Veteran Adaptation puede reproducir sólo una fracción del techo de Potencial Real;
- la curva post-cap ya es geométrica, por lo que igualar semanas/meses de entrenamiento exige muchas horas de juego;
- target inicial: juego puro puede aproximarse a un 30–40% del techo que ofrece la capa de entrenamiento, no sustituirla rápidamente.

Esto materializa exactamente la filosofía HIGHFLY: **entrenar es el camino eficiente hacia un techo superior; jugar sigue siendo válido y siempre progresa.**

---

# J. Dificultad, XP y entrenamiento

No dar simplemente “más XP porque entrenaste”. La ventaja debe interactuar con dificultad.

## Power Delta / Challenge Bonus

- enemigo claramente inferior → XP/loot con diminishing returns;
- enemigo apropiado → XP normal;
- enemigo por encima del power recomendado → bonus de XP/loot con tope;
- bosses y contenido de rango superior tienen multiplicador controlado.

El jugador que entrena puede afrontar dificultad superior antes y, por mérito indirecto, progresar más rápido en Adventure XP.

Eso hace que entrenamiento + habilidad de juego se potencien sin regalar niveles.

## Momentum post-entreno

Opcional para v0.6.x:

Tras una sesión real validada, conceder un buff corto de motivación, por ejemplo:

- +10% Adventure XP durante una cantidad limitada de tiempo activo o de objetivos;
- bonus pequeño de profesión/recolección;
- nunca un multiplicador de daño enorme.

Debe sentirse como “entrené y ahora quiero salir a cazar”, no como obligación diaria.

---

# K. Hunter Rank

`Nivel` y `Rango de Cazador` no son lo mismo.

El rango HIGHFLY (F → E → D → C → B → A → S → SS → SSS → Nacional) se calcula con un score compuesto:

- nivel/XP de aventura;
- equipo/power;
- progreso de clase/talentos;
- Potencial Real;
- Veteran Adaptation;
- logros/retos clave cuando corresponda.

El entrenamiento tiene peso importante en el rango, pero no bloquea la campaña base.

El rango sirve para:

- contratos de mayor riesgo;
- torre/portales de rango;
- prestigio visual;
- recompensas;
- contenido opcional de dificultad;
- leaderboard HIGHFLY.

---

# L. Orden de implementación v0.6

## Slice 1 — Creator Recovery

- revertir summary compacto v0.5.5;
- restaurar panel original de clase/stats;
- conservar canvas fix;
- layout S23 por contención, no por reducción destructiva.

## Slice 2 — Targeting Profiles

- tipo de perfil por habilidad;
- line / cone / ground / instant / self / friendly;
- TAP smart / HOLD manual / RELEASE cast;
- prioridad absoluta al input manual.

## Slice 3 — Combat Feel

- facing state machine;
- skill buffer;
- impact visual;
- telegraphs;
- stagger presentation;
- dash cancel windows.

## Slice 4 — Training Foundation

- modelo de datos `HighflyTrainingProfile`;
- persistencia offline;
- conversión de atributos a stats finales;
- UI de bonus de entrenamiento en hoja de personaje;
- API interna para registrar una sesión validada;
- sin integrar todavía toda la pantalla fitness histórica hasta que el seam sea estable.

## Slice 5 — Difficulty / Rank

- Challenge Bonus;
- Veteran Adaptation desde lifetime XP post-cap;
- Hunter Power Score;
- mapping de rangos HIGHFLY.

## Slice 6 — APK integral

Un solo build al final de la rama de trabajo para evitar gastar Actions en commits intermedios. Test principal: Samsung S23 Ultra horizontal.

---

# M. Criterios de aceptación

La v0.6 no se considera cerrada hasta que:

1. el creador vuelva a mostrar toda la información útil y entre completo en S23;
2. joystick izquierdo jamás mueva cámara;
3. al frenar el personaje no haga giros arbitrarios;
4. dash manual conserve dirección exacta y preview desde el jugador;
5. skills `line` permitan TAP asistido y HOLD/DRAG manual;
6. skills `cone` y `ground` tengan previews correctos;
7. input manual nunca sea secuestrado por auto-target;
8. el combate tenga impacto visual sin alterar Sim autoritativo;
9. un personaje pueda progresar 100% jugando sin entrenar;
10. entrenar otorgue Potencial Real permanente y visible;
11. el bonus de entrenamiento tenga diminishing returns y límites anti-spam;
12. lifetime XP post-cap permita Veteran Adaptation extremadamente lenta;
13. Nivel, Power y Rango sean conceptos separados;
14. no se cambien ni eliminen las 9 clases originales de ClaudeCraft.
