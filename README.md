# ExpensasPlus

PWA para la gestión de expensas de un consorcio: carga de gastos por servicio y período, liquidación de expensas por inquilino, estado de cuenta con alquiler y mora, historial y exportación a PDF. Funciona 100% offline — todos los datos se guardan localmente en el dispositivo (IndexedDB).

## Stack

- **React 19 + Vite** — UI y build
- **Dexie** — base de datos local (IndexedDB)
- **jsPDF + jspdf-autotable** — generación de PDFs
- **vite-plugin-pwa** — instalable como app, actualización automática

## Secciones

| Sección | Función |
|---|---|
| Inicio | Dashboard con resumen por período: expensas, alquiler, mora y pagos |
| Gastos | Carga de cargos generales (prorrateo) y particulares por servicio |
| Expensas | Previsualización y exportación del PDF de liquidación por inquilino |
| Inquilinos | ABM de inquilinos, contrato y precios de alquiler por período |
| Cuenta | Estado de cuenta por inquilino: pagos (totales o parciales) y mora |
| Historial | Detalle de períodos pasados, exportación y borrado |
| Configuración | Datos del administrador (pie de los PDFs), TEM de mora y backup JSON |

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción (dist/)
npm run lint     # eslint
```

## Deploy

Cada push a `main` se deploya automáticamente a GitHub Pages mediante GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). La app se sirve bajo el path `/expensas-plus/`.

## Backup

Desde **Configuración → Copia de Seguridad** se puede exportar/importar un JSON con todos los datos. La importación reemplaza por completo los datos locales.
