# HIGHFLY v0.6 — Reglas cerradas de cazador, entrenamiento y poder

Estas reglas quedan como contrato de diseño para la implementación v0.6.

## 1. Un cazador = una vida de progreso

- Un personaje nuevo empieza con nivel, Training XP y Potencial Real en cero.
- El entrenamiento previo del usuario NO transfiere poder a un personaje recién creado.
- Crear otro personaje significa un nuevo nacimiento de cazador.
- El historial personal del usuario puede existir fuera del personaje, pero no concede poder retroactivo.

## 2. Cambio de clase conserva el entrenamiento

- Si el MISMO cazador obtiene y consume en el futuro un objeto de cambio de clase, conserva todo su progreso de entrenamiento.
- Se conservan: Training XP, sesiones validadas, composición STR/AGI/VIT/PER/INT y fecha de última sesión.
- La nueva clase reinterpreta el Potencial Real mediante su afinidad; NO se vuelve a otorgar entrenamiento.
- Cambiar de clase nunca crea XP ni duplica stats.

## 3. Máximo una sesión de entrenamiento por día

- Un cazador puede validar como máximo una sesión de entrenamiento por día calendario.
- No existe `Sesión 2` el mismo día.
- Una sesión debe cumplir duración, recuperación y consistencia mínimas antes de ser válida.
- El motor rechaza fechas iguales o anteriores a la última sesión validada, evitando duplicados y retroceso simple del reloj.
- La futura autoridad online sustituirá la fecha local por fecha de servidor.

## 4. El entrenamiento tiene efecto REAL en combate

STR/AGI/VIT/PER/INT no son cosméticos.

La capa HIGHFLY entra antes de las derivaciones finales de ClaudeCraft, por lo que modifica stats que el combate ya consume:

- STR -> Strength real -> Attack Power físico.
- AGI -> Agility real -> las derivaciones originales de Agility de la clase.
- VIT -> Stamina real -> HP real.
- INT -> Intellect real -> mana/spell power según las reglas originales.
- PER -> Hit Rating + componente pequeño de Crit Rating; no se falsifica como Spirit.

Por lo tanto Training Power modifica daño, supervivencia, precisión, recursos y el Power final del personaje a través del mismo motor de stats, no mediante un número decorativo separado.

## 5. Adventure Power + Training Power = un solo personaje

El personaje final se construye con todas sus fuentes reales:

- clase;
- nivel;
- equipo;
- talentos/especialización;
- buffs;
- Potencial Real HIGHFLY;
- más adelante Veteran Adaptation y Segunda Clase.

Hunter Power debe calcularse desde los stats de combate resultantes y su progresión, no desde una etiqueta independiente sin efecto.

## 6. El ejercicio determina el estímulo; la clase determina la eficiencia

Nunca se convierte una sentadilla en INT sólo porque el personaje sea Mago.

Cada sesión produce un vector físico/técnico real:

`STR / AGI / VIT / PER / INT`

Luego existen dos tipos de recompensa:

### Pure Potential

Parte del estímulo que permanece en el mismo atributo sin importar la clase.

Ejemplo: un estímulo de fuerza pura sigue siendo STR en Guerrero, Mago o Pícaro.

### Adaptive Potential

Parte del estímulo que la clase aprovecha de manera distinta.

Se pondera por afinidad de clase, PERO se normaliza a un presupuesto fijo para que dos clases no reciban cantidades globales radicalmente distintas por el mismo esfuerzo.

Esto permite especialización sin castigar injustamente a una clase.

## 7. Balance por construcción

Para un mismo entrenamiento adaptativo y mismo score de sesión:

- todas las clases reciben el mismo presupuesto total de Training Power;
- cambia la DISTRIBUCIÓN de ese presupuesto según afinidad;
- un Guerrero convierte más hacia STR/VIT;
- un Pícaro/Cazador convierte más hacia AGI/PER;
- un Mago/Sacerdote/Brujo convierte más hacia INT/PER;
- híbridos distribuyen con mayor equilibrio.

Los ejercicios/piezas `pure` pueden favorecer naturalmente unas builds sobre otras, pero no deben dominar toda una rutina.

## 8. HIGHFLY Híbrido

La rutina HIGHFLY no recibe un multiplicador secreto por nombre.

Su ventaja surge de que una sesión realmente más completa/difícil puede obtener mejor score y un vector más amplio por:

- fuerza;
- potencia;
- hipertrofia;
- tirón;
- estabilidad/técnica;
- acondicionamiento;
- adherencia y progresión.

Por diseño, una rutina híbrida desarrolla más dimensiones del cazador. Una rutina específica puede maximizar una o dos dimensiones.

## 9. Curva de largo plazo

- Una sesión válida siempre progresa más que no entrenar.
- El progreso usa una curva asintótica/diminishing returns de largo plazo, no un cap semanal artificial.
- Objetivo inicial de tuning: 6+ meses de consistencia para acercarse al techo de Training Power.
- Una semana de spam no puede romper el balance porque sólo existe una sesión válida por día y el crecimiento marginal baja con el tiempo.

## 10. Primera y Segunda Clase

### Primer Despertar

Se reutilizarán las especializaciones reales de ClaudeCraft como Primer Despertar cuando el sistema se formalice.

### Segundo Despertar

Más adelante podrá elegirse UNA afinidad/subclase secundaria.

- no copia una segunda clase completa;
- no duplica Training Power;
- concede slots limitados de habilidades/pasivas de otra clase;
- combinaciones como Guerrero + Mago serán posibles sin destruir el recurso/kit de la clase principal.

## 11. Gates obligatorios antes de balance final

La implementación no se considera balanceada hasta que CI pruebe:

1. una segunda sesión del mismo día es rechazada;
2. un personaje nuevo comienza con Training XP 0;
3. un cambio de clase conserva exactamente el perfil de entrenamiento;
4. el mismo perfil adaptativo conserva el mismo presupuesto total entre las 9 clases;
5. las afinidades cambian distribución, no crean poder adicional;
6. el bonus HIGHFLY aumenta stats reales usados por combate;
7. cada una de las 9 clases recibe mejora útil de una sesión híbrida válida;
8. el entrenamiento nunca reduce stats base;
9. saves antiguos sin HIGHFLY Training siguen cargando con perfil cero;
10. guardar/cargar conserva el perfil sin duplicarlo.

Estos tests son parte del producto, no documentación opcional.