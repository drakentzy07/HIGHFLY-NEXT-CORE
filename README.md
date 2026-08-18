# HIGHFLY NEXT CORE

Base de desarrollo de HIGHFLY sobre World of ClaudeCraft `release/v0.39.0`.

## Regla de arquitectura

ClaudeCraft se conserva por defecto y HIGHFLY modifica o agrega solamente lo que aporte valor real. Las nueve clases originales permanecen intactas: Warrior, Paladin, Hunter, Rogue, Priest, Shaman, Mage, Warlock y Druid.

## v0.4 — Native Mobility

- Entrada Android directa al creador local/offline, sin selector online/offline en la app HIGHFLY.
- Layout del creador adaptado a móvil horizontal.
- Branding visible HIGHFLY en el shell nativo.
- Movimiento visual 360°: al viajar hacia atrás/lateral el personaje mira hacia su desplazamiento en vez de presentar backpedal clásico.
- Backpedal sin penalización de velocidad.
- Botón DASH independiente de los slots de habilidades.
- Dash direccional con dirección fijada al pulsarlo, cooldown propio y colisión física normal del mundo.
- Sin cambios en clases, árboles, personajes ni contenido de ClaudeCraft.

## Build

El repositorio funciona como overlay: GitHub Actions clona ClaudeCraft v0.39.0, aplica la capa HIGHFLY y genera la APK. La PC local no necesita Android Studio ni espacio de build.
