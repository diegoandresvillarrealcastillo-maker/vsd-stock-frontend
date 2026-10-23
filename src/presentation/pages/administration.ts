// Las pantallas del marco de administracion (C4-R0). Este archivo es lo UNICO que las rutas importan con `import()`: todas juntas son
// un solo archivo que baja la primera vez que alguien entra a cualquiera de ellas. Cada una por su lado eran 21 archivos de JavaScript
// (la mayoria de 2 a 8 KB, comprimidos sin el diccionario de los demas) y el total subia de 173,0 a 190,5 KB (ver `docs/rendimiento.md`). Nadie mas debe importar
// este archivo: si el arranque lo trae, la administracion vuelve a viajar con el mostrador y `npm run budget` lo dice.
export { AdjustStockPage } from './AdjustStockPage';
export { CatalogPage } from './CatalogPage';
export { CategoriesPage } from './CategoriesPage';
export { EditProductPage } from './EditProductPage';
export { HomePage } from './HomePage';
export { InvitePage } from './InvitePage';
export { NewProductPage } from './NewProductPage';
export { NewPurchasePage } from './NewPurchasePage';
export { PeoplePage } from './PeoplePage';
export { PersonPage } from './PersonPage';
export { PurchasesPage } from './PurchasesPage';
export { StockHistoryPage } from './StockHistoryPage';
export { StockPage } from './StockPage';
export { SuppliersPage } from './SuppliersPage';
