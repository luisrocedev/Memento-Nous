# Memento Nous

Proyecto personal del ejercicio Memento (DAM2 - Desarrollo de interfaces).

## Funcionalidades

- Registro de recuerdos semánticos con metadatos (fecha, lugar, emoción, personas, tags y texto).
- Persistencia local en IndexedDB.
- Filtrado en tiempo real por emoción y búsqueda semántica textual.
- Construcción de **sets/conjuntos** de recuerdos por criterio dinámico:
  - emoción,
  - tag principal,
  - persona principal,
  - año.
- Visualización de nodos interrelacionados:
  - grafo 2D en canvas,
  - grafo 3D con Three.js + OrbitControls.
- Relaciones semánticas entre recuerdos por tags compartidos.

## Ejecutar

No requiere backend. Abre `index.html` en navegador moderno.

## Estructura

- `index.html` → interfaz principal
- `assets/styles.css` → diseño visual (Notion-like)
- `assets/app.js` → lógica funcional + IndexedDB + grafos 2D/3D
