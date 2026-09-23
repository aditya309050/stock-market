export interface StockMeta {
  name: string;
  sector: string;
  industry: string;
}

export const STOCK_DIRECTORY: Record<string, StockMeta> = {
  // Directly from reference image
  TIMEX: {
    name: "Timex Group India",
    sector: "Consumer Durables",
    industry: "Gems, Jewellery And Watches",
  },
  SAMBHV: {
    name: "Sambhv Steel Tubes",
    sector: "Industrial Products",
    industry: "Iron & Steel Products",
  },
  AVALON: {
    name: "Avalon Technologies",
    sector: "Electrical Equipment",
    industry: "Other Electrical Equipment",
  },
  TALBROAUTO: {
    name: "Talbros Automotive Components",
    sector: "Auto Components",
    industry: "Auto Components & Equipments",
  },
  MACPOWER: {
    name: "Macpower CNC Machines",
    sector: "Industrial Manufacturing",
    industry: "Industrial Products",
  },
  CMRGREEN: {
    name: "CMR Green Technologies",
    sector: "Industrial Products",
    industry: "Aluminium, Copper & Zinc Products",
  },

  // Major F&O & Liquid Equities
  RELIANCE: {
    name: "Reliance Industries",
    sector: "Energy",
    industry: "Oil & Gas Refining & Marketing",
  },
  TCS: {
    name: "Tata Consultancy Services",
    sector: "Information Technology",
    industry: "IT Services & Consulting",
  },
  HDFCBANK: {
    name: "HDFC Bank",
    sector: "Financial Services",
    industry: "Private Sector Banks",
  },
  INFY: {
    name: "Infosys",
    sector: "Information Technology",
    industry: "IT Services & Consulting",
  },
  ICICIBANK: {
    name: "ICICI Bank",
    sector: "Financial Services",
    industry: "Private Sector Banks",
  },
  SBIN: {
    name: "State Bank of India",
    sector: "Financial Services",
    industry: "Public Sector Banks",
  },
  BHARTIARTL: {
    name: "Bharti Airtel",
    sector: "Telecommunication",
    industry: "Telecom Services",
  },
  KOTAKBANK: {
    name: "Kotak Mahindra Bank",
    sector: "Financial Services",
    industry: "Private Sector Banks",
  },
  LT: {
    name: "Larsen & Toubro",
    sector: "Construction",
    industry: "Civil Construction & Engineering",
  },
  AXISBANK: {
    name: "Axis Bank",
    sector: "Financial Services",
    industry: "Private Sector Banks",
  },
  ASIANPAINT: {
    name: "Asian Paints",
    sector: "Consumer Durables",
    industry: "Paints & Varnishes",
  },
  MARUTI: {
    name: "Maruti Suzuki India",
    sector: "Automobile",
    industry: "Passenger Cars & Utility Vehicles",
  },
  TITAN: {
    name: "Titan Company",
    sector: "Consumer Durables",
    industry: "Gems, Jewellery And Watches",
  },
  SUNPHARMA: {
    name: "Sun Pharmaceutical Industries",
    sector: "Healthcare",
    industry: "Pharmaceuticals",
  },
  BAJFINANCE: {
    name: "Bajaj Finance",
    sector: "Financial Services",
    industry: "Non-Banking Financial Company (NBFC)",
  },
  TATAMOTORS: {
    name: "Tata Motors",
    sector: "Automobile",
    industry: "Commercial & Passenger Vehicles",
  },
  TATASTEEL: {
    name: "Tata Steel",
    sector: "Metals & Mining",
    industry: "Iron & Steel",
  },
  NTPC: {
    name: "NTPC Limited",
    sector: "Utilities",
    industry: "Electric Utilities",
  },
  POWERGRID: {
    name: "Power Grid Corporation",
    sector: "Utilities",
    industry: "Electric Utilities & Transmission",
  },
  WIPRO: {
    name: "Wipro",
    sector: "Information Technology",
    industry: "IT Services & Consulting",
  },
  HCLTECH: {
    name: "HCL Technologies",
    sector: "Information Technology",
    industry: "IT Services & Consulting",
  },
  TECHM: {
    name: "Tech Mahindra",
    sector: "Information Technology",
    industry: "IT Services & Consulting",
  },
  BEL: {
    name: "Bharat Electronics",
    sector: "Capital Goods",
    industry: "Aerospace & Defense Electronics",
  },
  HAL: {
    name: "Hindustan Aeronautics",
    sector: "Capital Goods",
    industry: "Aerospace & Defense",
  },
  ZOMATO: {
    name: "Zomato",
    sector: "Consumer Services",
    industry: "E-Commerce & Food Delivery",
  },
  JIOFIN: {
    name: "Jio Financial Services",
    sector: "Financial Services",
    industry: "Investment & Holding Companies",
  },
  TRENT: {
    name: "Trent Limited",
    sector: "Consumer Services",
    industry: "Retail & Apparel",
  },
  VBL: {
    name: "Varun Beverages",
    sector: "Fast Moving Consumer Goods",
    industry: "Non-Alcoholic Beverages",
  },
  COALINDIA: {
    name: "Coal India",
    sector: "Energy",
    industry: "Coal & Consumable Fuels",
  },
  ONGC: {
    name: "Oil & Natural Gas Corp",
    sector: "Energy",
    industry: "Oil & Gas Exploration & Production",
  },
  JSWSTEEL: {
    name: "JSW Steel",
    sector: "Metals & Mining",
    industry: "Iron & Steel",
  },
  CIPLA: {
    name: "Cipla",
    sector: "Healthcare",
    industry: "Pharmaceuticals",
  },
  DRREDDY: {
    name: "Dr. Reddy's Laboratories",
    sector: "Healthcare",
    industry: "Pharmaceuticals",
  },
  HINDALCO: {
    name: "Hindalco Industries",
    sector: "Metals & Mining",
    industry: "Aluminium & Copper",
  },
  BPCL: {
    name: "Bharat Petroleum Corp",
    sector: "Energy",
    industry: "Oil & Gas Refining & Marketing",
  },
  DIVISLAB: {
    name: "Divi's Laboratories",
    sector: "Healthcare",
    industry: "Active Pharmaceutical Ingredients",
  },
  EICHERMOT: {
    name: "Eicher Motors",
    sector: "Automobile",
    industry: "Motorcycles & Commercial Vehicles",
  },
  HEROMOTOCO: {
    name: "Hero MotoCorp",
    sector: "Automobile",
    industry: "Motorcycles & Two-Wheelers",
  },
  NESTLEIND: {
    name: "Nestle India",
    sector: "Fast Moving Consumer Goods",
    industry: "Packaged Foods & Dairy",
  },
  BRITANNIA: {
    name: "Britannia Industries",
    sector: "Fast Moving Consumer Goods",
    industry: "Bakery & Confectionery",
  },
  ULTRACEMCO: {
    name: "UltraTech Cement",
    sector: "Construction Materials",
    industry: "Cement & Building Materials",
  },
  GRASIM: {
    name: "Grasim Industries",
    sector: "Diversified",
    industry: "Textiles & Chemicals",
  },
  ADANIENT: {
    name: "Adani Enterprises",
    sector: "Diversified",
    industry: "Trading & Infrastructure",
  },
  ADANIPORTS: {
    name: "Adani Ports & SEZ",
    sector: "Services",
    industry: "Port Operations & Logistics",
  },
  TATACONSUM: {
    name: "Tata Consumer Products",
    sector: "Fast Moving Consumer Goods",
    industry: "Tea, Coffee & Consumer Foods",
  },
  APOLLOHOSP: {
    name: "Apollo Hospitals",
    sector: "Healthcare",
    industry: "Hospital Services & Pharmacies",
  },
  SBILIFE: {
    name: "SBI Life Insurance",
    sector: "Financial Services",
    industry: "Life Insurance",
  },
  HDFCLIFE: {
    name: "HDFC Life Insurance",
    sector: "Financial Services",
    industry: "Life Insurance",
  },
  BAJAJFINSV: {
    name: "Bajaj Finserv",
    sector: "Financial Services",
    industry: "Holding & Investment",
  },
};

export function getStockMetadata(symbol: string): StockMeta {
  const clean = symbol.toUpperCase().replace(".NS", "").replace("-EQ", "").trim();
  if (STOCK_DIRECTORY[clean]) {
    return STOCK_DIRECTORY[clean];
  }

  // Graceful fallback heuristics
  const formattedName = clean
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return {
    name: `${formattedName} Ltd`,
    sector: "Equities & F&O",
    industry: "Industrial & Market Leaders",
  };
}

export function formatVolume(volume: number): string {
  if (!volume || isNaN(volume)) return "0";
  if (volume >= 10000000) {
    return `${(volume / 10000000).toFixed(2)}Cr`;
  }
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toLocaleString("en-IN");
}

export function formatTurnover(turnoverCr: number): string {
  if (!turnoverCr || isNaN(turnoverCr)) return "₹0.00cr/day";
  return `₹${turnoverCr.toFixed(2)}cr/day`;
}
