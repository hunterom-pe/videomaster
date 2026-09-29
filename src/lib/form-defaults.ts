// Blank starting values for the create forms. Kept in a plain module (NOT a "use client" file) so server pages
// can read or spread them; constants exported from client components arrive on the server as opaque references.
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CONCESSION_CATEGORIES,
  type ConcessionFormValues,
  type CustomerFormValues,
  type StoreFormValues,
} from "@/lib/validation";
import { DEFAULT_TIMEZONE } from "@/lib/tz";

export const EMPTY_CUSTOMER: CustomerFormValues = {
  firstName: "", lastName: "", phone: "", email: "", address: "", city: "",
  region: "", postalCode: "", dateOfBirth: "", status: "GOOD", notes: "", collectFee: true, paymentMethod: "CASH",
};

export const EMPTY_CONCESSION: ConcessionFormValues = {
  sku: "", name: "", categoryId: "", retailPrice: "", costPrice: "", quantityOnHand: "0",
  lowStockThreshold: "5", taxable: true, active: true, barcode: "",
};

export const EMPTY_STORE: StoreFormValues = {
  name: "", number: "", address: "", city: "", region: "", postalCode: "", phone: "",
  managerName: "", slogan: "", currency: "USD", timezone: DEFAULT_TIMEZONE, salesTaxPercent: "", storeYear: "",
  onlyMoviesUpToStoreYear: false, rewindFee: "0.00", damageFee: "0.00", lostItemFee: "0.00", replacementFee: "19.99",
  membershipFee: "0.00", membershipTermMonths: "0", maxRentalsOut: "0", defaultLowStock: "5", formatDefaults: {}, functionKeys: false, receiptFooter: "THANK YOU!", formats: ["VHS"], categories: DEFAULT_CATEGORIES, concessionCategories: DEFAULT_CONCESSION_CATEGORIES,
};
