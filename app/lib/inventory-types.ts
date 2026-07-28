export type InventoryItem = {
  id: number;
  legacyReference: string;
  supplierCategoryCode: string;
  supplierName: string;
  description: string;
  quantityOnHand: number;
  lastCost: number;
  averageCost: number;
  dealerPrice: number;
  salePrice: number;
  location: string;
  machineModel: string;
  costUnit: string;
  detailUnit: string;
  legacyRawData?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type InventorySummary = {
  productCount: number;
  unitsOnHand: number;
  zeroStockCount: number;
  supplierCount: number;
  inventoryValueAtLastCost: number;
};

export type InventoryChange = {
  id: number;
  inventoryId: number;
  legacyReference: string;
  description: string;
  changeType: string;
  note: string;
  createdAt: string;
};
