/** Curated Trinidad & Tobago financial institutions for payroll bank selection. */

export const TT_FINANCIAL_INSTITUTION_CATEGORIES = [
  { id: "COMMERCIAL_BANKS", label: "Commercial banks" },
  { id: "LICENSED_NON_BANK", label: "Licensed non-bank financial institutions" },
  { id: "INVESTMENT_MORTGAGE_DEVELOPMENT", label: "Investment, mortgage and development institutions" },
  { id: "CREDIT_UNIONS", label: "Credit unions" },
  { id: "CREDIT_UNION_SUPPORT", label: "Credit-union support organisations" },
  { id: "PAYMENT_PROVIDERS", label: "Payment providers / e-money" },
] as const;

export type TtFinancialInstitutionCategoryId =
  (typeof TT_FINANCIAL_INSTITUTION_CATEGORIES)[number]["id"];

export type TtFinancialInstitution = {
  id: string;
  name: string;
  shortName: string;
  category: TtFinancialInstitutionCategoryId;
};

export const OTHER_FINANCIAL_INSTITUTION_ID = "other" as const;

export const TT_FINANCIAL_INSTITUTIONS: readonly TtFinancialInstitution[] = [
  { id: "ansa-bank", name: "ANSA Bank Limited", shortName: "ANSA Bank", category: "COMMERCIAL_BANKS" },
  { id: "cibc", name: "CIBC Caribbean Bank (Trinidad and Tobago) Limited", shortName: "CIBC", category: "COMMERCIAL_BANKS" },
  { id: "citi", name: "Citibank (Trinidad & Tobago) Limited", shortName: "Citi", category: "COMMERCIAL_BANKS" },
  { id: "fcb", name: "First Citizens Bank Limited", shortName: "FCB", category: "COMMERCIAL_BANKS" },
  { id: "jmmb-bank", name: "JMMB Bank (T&T) Limited", shortName: "JMMB Bank", category: "COMMERCIAL_BANKS" },
  { id: "rbc", name: "RBC Royal Bank (Trinidad & Tobago) Limited", shortName: "RBC", category: "COMMERCIAL_BANKS" },
  { id: "rbl", name: "Republic Bank Limited", shortName: "RBL", category: "COMMERCIAL_BANKS" },
  { id: "scotia", name: "Scotiabank Trinidad and Tobago Limited", shortName: "Scotia", category: "COMMERCIAL_BANKS" },
  { id: "ambl", name: "ANSA Merchant Bank Limited", shortName: "AMBL", category: "LICENSED_NON_BANK" },
  { id: "cfc", name: "Caribbean Finance Company Limited", shortName: "CFC", category: "LICENSED_NON_BANK" },
  { id: "cmbl", name: "Citicorp Merchant Bank Limited", shortName: "CMBL", category: "LICENSED_NON_BANK" },
  { id: "dfl", name: "Development Finance Limited", shortName: "DFL", category: "LICENSED_NON_BANK" },
  { id: "fflc", name: "Fidelity Finance and Leasing Company Limited", shortName: "FFLC", category: "LICENSED_NON_BANK" },
  { id: "fcdsl", name: "First Citizens Depository Services Limited", shortName: "FCDSL", category: "LICENSED_NON_BANK" },
  { id: "fctsl", name: "First Citizens Trustee Services Limited", shortName: "FCTSL", category: "LICENSED_NON_BANK" },
  { id: "ggtl", name: "Guardian Group Trust Limited", shortName: "GGTL", category: "LICENSED_NON_BANK" },
  { id: "island-finance", name: "Island Finance Trinidad & Tobago Limited", shortName: "Island Finance", category: "LICENSED_NON_BANK" },
  { id: "jmmb-express-finance", name: "JMMB Express Finance (T&T) Limited", shortName: "JMMB Express Finance", category: "LICENSED_NON_BANK" },
  { id: "massy-finance", name: "Massy Finance GFC Limited", shortName: "Massy Finance", category: "LICENSED_NON_BANK" },
  { id: "ncbmbtt", name: "NCB Merchant Bank (Trinidad and Tobago) Limited", shortName: "NCBMBTT", category: "LICENSED_NON_BANK" },
  { id: "rbcimc", name: "RBC Investment Management (Caribbean) Limited", shortName: "RBCIMC", category: "LICENSED_NON_BANK" },
  { id: "rbcmb", name: "RBC Merchant Bank (Caribbean) Limited", shortName: "RBCMB", category: "LICENSED_NON_BANK" },
  { id: "rbc-trust", name: "RBC Trust (Trinidad & Tobago) Limited", shortName: "RBC Trust", category: "LICENSED_NON_BANK" },
  { id: "sittl", name: "Scotia Investments Trinidad and Tobago Limited", shortName: "SITTL", category: "LICENSED_NON_BANK" },
  { id: "utc", name: "Trinidad and Tobago Unit Trust Corporation", shortName: "UTC", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "ttmb", name: "Trinidad and Tobago Mortgage Bank Limited", shortName: "TTMB", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "hmb", name: "Home Mortgage Bank", shortName: "HMB", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "ttmf", name: "Trinidad and Tobago Mortgage Finance Company Limited", shortName: "TTMF", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "nif", name: "National Investment Fund Holding Company Limited", shortName: "NIF", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "nel", name: "National Enterprises Limited", shortName: "NEL", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "eximbank", name: "Export-Import Bank of Trinidad and Tobago Limited", shortName: "EXIMBANK", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "adb", name: "Agricultural Development Bank of Trinidad and Tobago", shortName: "ADB", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "bdc", name: "Business Development Company Limited", shortName: "BDC", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "nedco", name: "National Entrepreneurship Development Company Limited", shortName: "NEDCO", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "ttifc", name: "Trinidad and Tobago International Financial Centre", shortName: "TTIFC", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "dic", name: "Deposit Insurance Corporation of Trinidad and Tobago", shortName: "DIC", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "ttsec", name: "Trinidad and Tobago Securities and Exchange Commission", shortName: "TTSEC", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "ttse", name: "Trinidad and Tobago Stock Exchange Limited", shortName: "TTSE", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "cbtt", name: "Central Bank of Trinidad and Tobago", shortName: "CBTT", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "nibtt", name: "National Insurance Board of Trinidad and Tobago", shortName: "NIBTT", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "tatil", name: "Trinidad and Tobago Insurance Limited", shortName: "TATIL", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "fcis", name: "First Citizens Investment Services Limited", shortName: "FCIS", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "rwm", name: "Republic Wealth Management Limited", shortName: "RWM", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "rsl", name: "Republic Securities Limited", shortName: "RSL", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "jmmb-investments", name: "JMMB Investments (Trinidad and Tobago) Limited", shortName: "JMMB Investments", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "cmmb", name: "Caribbean Money Market Brokers Limited", shortName: "CMMB", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "bourse", name: "Bourse Securities Limited", shortName: "Bourse", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "wise", name: "West Indies Stockbrokers Limited", shortName: "WISE", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "firstline", name: "Firstline Securities Limited", shortName: "Firstline", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "ssl", name: "Sheppard Securities Limited", shortName: "SSL", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "ksbm", name: "KSBM Asset Management Limited", shortName: "KSBM", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "aic-finance", name: "AIC Finance Trinidad and Tobago Limited", shortName: "AIC Finance", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "cdb", name: "Caribbean Development Bank", shortName: "CDB", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "idb", name: "Inter-American Development Bank", shortName: "IDB", category: "INVESTMENT_MORTGAGE_DEVELOPMENT" },
  { id: "aegis-cu", name: "AEGIS Credit Union Co-operative Society Limited", shortName: "AEGIS CU", category: "CREDIT_UNIONS" },
  { id: "ascu", name: "Aero Services Credit Union Co-operative Society Limited", shortName: "ASCU", category: "CREDIT_UNIONS" },
  { id: "aatt-cu", name: "African Association of Trinidad & Tobago Credit Union", shortName: "AATT CU", category: "CREDIT_UNIONS" },
  { id: "agape-cu", name: "Agape Credit Union Co-operative Society Limited", shortName: "AGAPE CU", category: "CREDIT_UNIONS" },
  { id: "agricola-cu", name: "Agricola Credit Union Co-operative Society Limited", shortName: "Agricola CU", category: "CREDIT_UNIONS" },
  { id: "aattcu", name: "Airports Authority of Trinidad and Tobago Credit Union", shortName: "AATTCU", category: "CREDIT_UNIONS" },
  { id: "arcu", name: "Anglais Road Credit Union", shortName: "ARCU", category: "CREDIT_UNIONS" },
  { id: "agecu", name: "Angostura Group Employees' Credit Union", shortName: "AGECU", category: "CREDIT_UNIONS" },
  { id: "amgecu", name: "ANSA McAL Group Employees' Credit Union", shortName: "AMGECU", category: "CREDIT_UNIONS" },
  { id: "aecu", name: "Antilles Employees Credit Union", shortName: "AECU", category: "CREDIT_UNIONS" },
  { id: "apex-cu", name: "APEX Credit Union Co-operative Society Limited", shortName: "APEX CU", category: "CREDIT_UNIONS" },
  { id: "aebc-cu", name: "Association of Evangelical Bible Churches Credit Union", shortName: "AEBC CU", category: "CREDIT_UNIONS" },
  { id: "bgwu-cu", name: "Bank and General Workers' Union Credit Union", shortName: "BGWU CU", category: "CREDIT_UNIONS" },
  { id: "becu", name: "Bank Employees Credit Union", shortName: "BECU", category: "CREDIT_UNIONS" },
  { id: "bethel-cu", name: "Bethel Credit Union", shortName: "Bethel CU", category: "CREDIT_UNIONS" },
  { id: "cannings-cu", name: "Cannings Employees Co-operative Credit Union", shortName: "Cannings CU", category: "CREDIT_UNIONS" },
  { id: "cathedral-cu", name: "Cathedral Credit Union", shortName: "Cathedral CU", category: "CREDIT_UNIONS" },
  { id: "cawecu", name: "CAWECU Co-operative Society Limited", shortName: "CAWECU", category: "CREDIT_UNIONS" },
  { id: "ccngecu", name: "CCN Group Employees Credit Union", shortName: "CCNGECU", category: "CREDIT_UNIONS" },
  { id: "cemcu", name: "CEMCU Credit Union", shortName: "CEMCU", category: "CREDIT_UNIONS" },
  { id: "cbecu", name: "Central Bank Employees Credit Union", shortName: "CBECU", category: "CREDIT_UNIONS" },
  { id: "central-community-cu", name: "Central Community Credit Union", shortName: "Central Community CU", category: "CREDIT_UNIONS" },
  { id: "cga-cu", name: "CGA Credit Union", shortName: "CGA CU", category: "CREDIT_UNIONS" },
  { id: "chaguanas-cu", name: "Chaguanas Credit Union", shortName: "Chaguanas CU", category: "CREDIT_UNIONS" },
  { id: "cimpex-cu", name: "CIMPEX Credit Union", shortName: "CIMPEX CU", category: "CREDIT_UNIONS" },
  { id: "citadel-cu", name: "Citadel Credit Union", shortName: "Citadel CU", category: "CREDIT_UNIONS" },
  { id: "clico-cu", name: "CLICO Credit Union", shortName: "CLICO CU", category: "CREDIT_UNIONS" },
  { id: "community-care-cu", name: "Community Care Credit Union", shortName: "Community Care CU", category: "CREDIT_UNIONS" },
  { id: "ctcu", name: "Consolidated Telephones Credit Union", shortName: "CTCU", category: "CREDIT_UNIONS" },
  { id: "copos-cu", name: "COPOS Credit Union", shortName: "COPOS CU", category: "CREDIT_UNIONS" },
  { id: "coryal-cu", name: "Coryal Credit Union", shortName: "Coryal CU", category: "CREDIT_UNIONS" },
  { id: "dmcu", name: "Diego Martin Credit Union", shortName: "DMCU", category: "CREDIT_UNIONS" },
  { id: "dvcu", name: "Duncan Village Credit Union", shortName: "DVCU", category: "CREDIT_UNIONS" },
  { id: "ecu", name: "Eastern Credit Union", shortName: "ECU", category: "CREDIT_UNIONS" },
  { id: "fncu", name: "First National Credit Union", shortName: "FNCU", category: "CREDIT_UNIONS" },
  { id: "ftgscu", name: "Furness Trinidad Group Staff Credit Union", shortName: "FTGSCU", category: "CREDIT_UNIONS" },
  { id: "gordonius-cu", name: "Gordonius Credit Union", shortName: "Gordonius CU", category: "CREDIT_UNIONS" },
  { id: "gpcu", name: "Government Printery Credit Union", shortName: "GPCU", category: "CREDIT_UNIONS" },
  { id: "gsecu", name: "Guardia Security Employees Credit Union", shortName: "GSECU", category: "CREDIT_UNIONS" },
  { id: "gcu", name: "Guardian Credit Union", shortName: "GCU", category: "CREDIT_UNIONS" },
  { id: "gacu", name: "Guaymay Alliance Credit Union", shortName: "GACU", category: "CREDIT_UNIONS" },
  { id: "hacu", name: "Hand Arnold Credit Union", shortName: "HACU", category: "CREDIT_UNIONS" },
  { id: "hcu", name: "Huggins Credit Union", shortName: "HCU", category: "CREDIT_UNIONS" },
  { id: "iccu", name: "Independent Community Credit Union", shortName: "ICCU", category: "CREDIT_UNIONS" },
  { id: "iicu", name: "Insurance Industry Credit Union", shortName: "IICU", category: "CREDIT_UNIONS" },
  { id: "lambeau-cu", name: "Lambeau Credit Union", shortName: "Lambeau CU", category: "CREDIT_UNIONS" },
  { id: "lsecu", name: "Lazzari & Sampson Employees Credit Union", shortName: "LSECU", category: "CREDIT_UNIONS" },
  { id: "lwcu", name: "Living Word Credit Union", shortName: "LWCU", category: "CREDIT_UNIONS" },
  { id: "louwill-cu", name: "Louwill Credit Union", shortName: "Louwill CU", category: "CREDIT_UNIONS" },
  { id: "mhcu", name: "Mason Hall Credit Union", shortName: "MHCU", category: "CREDIT_UNIONS" },
  { id: "mpcu", name: "Mt. Pleasant Credit Union", shortName: "MPCU", category: "CREDIT_UNIONS" },
  { id: "mcu", name: "Muslim Credit Union", shortName: "MCU", category: "CREDIT_UNIONS" },
  { id: "mecu", name: "Myerson Employees Credit Union", shortName: "MECU", category: "CREDIT_UNIONS" },
  { id: "nfmecu", name: "National Flour Mills Employees Credit Union", shortName: "NFMECU", category: "CREDIT_UNIONS" },
  { id: "nhacu", name: "National Housing Authority Credit Union", shortName: "NHACU", category: "CREDIT_UNIONS" },
  { id: "nmncu", name: "Neal & Massy North Credit Union", shortName: "NMNCU", category: "CREDIT_UNIONS" },
  { id: "nestl-tt-cu", name: "Nestlé Trinidad and Tobago Credit Union", shortName: "Nestlé TT CU", category: "CREDIT_UNIONS" },
  { id: "nexus-cu", name: "NEXUS Credit Union", shortName: "NEXUS CU", category: "CREDIT_UNIONS" },
  { id: "oiccu", name: "O'Meara Industrial and Community Credit Union", shortName: "OICCU", category: "CREDIT_UNIONS" },
  { id: "palo-seco-cu", name: "Palo Seco Credit Union", shortName: "Palo Seco CU", category: "CREDIT_UNIONS" },
  { id: "peakes-cu", name: "Peake's Credit Union", shortName: "Peake's CU", category: "CREDIT_UNIONS" },
  { id: "pentecostal-cu", name: "Pentecostal Credit Union", shortName: "Pentecostal CU", category: "CREDIT_UNIONS" },
  { id: "peoples-cu", name: "People's Credit Union", shortName: "People's CU", category: "CREDIT_UNIONS" },
  { id: "perseverance-cu", name: "Perseverance Credit Union", shortName: "Perseverance CU", category: "CREDIT_UNIONS" },
  { id: "pbdjcu", name: "Pollonais, Blanc, de la Bastide & Jacelon Credit Union", shortName: "PBDJCU", category: "CREDIT_UNIONS" },
  { id: "pecu", name: "Port Employees Credit Union", shortName: "PECU", category: "CREDIT_UNIONS" },
  { id: "ptcecu", name: "Princes Town Community and Environs Credit Union", shortName: "PTCECU", category: "CREDIT_UNIONS" },
  { id: "progressive-cu", name: "Progressive Credit Union", shortName: "Progressive CU", category: "CREDIT_UNIONS" },
  { id: "pscu", name: "PSCU Credit Union Co-operative Society Limited", shortName: "PSCU", category: "CREDIT_UNIONS" },
  { id: "rhand", name: "RHAND Credit Union", shortName: "RHAND", category: "CREDIT_UNIONS" },
  { id: "rehab-cu", name: "REHAB Credit Union", shortName: "REHAB CU", category: "CREDIT_UNIONS" },
  { id: "rcu", name: "Runnemede Credit Union", shortName: "RCU", category: "CREDIT_UNIONS" },
  { id: "sfcecu", name: "San Fernando Corporation Employees Credit Union", shortName: "SFCECU", category: "CREDIT_UNIONS" },
  { id: "secu", name: "SECU Credit Union", shortName: "SECU", category: "CREDIT_UNIONS" },
  { id: "servol-cu", name: "SERVOL Credit Union", shortName: "SERVOL CU", category: "CREDIT_UNIONS" },
  { id: "sfccu", name: "SFCCU Credit Union", shortName: "SFCCU", category: "CREDIT_UNIONS" },
  { id: "shalom-cu", name: "Shalom Credit Union", shortName: "Shalom CU", category: "CREDIT_UNIONS" },
  { id: "seposcu", name: "South-East Port of Spain Credit Union", shortName: "SEPOSCU", category: "CREDIT_UNIONS" },
  { id: "scpcu", name: "St. Charles Parish Credit Union", shortName: "SCPCU", category: "CREDIT_UNIONS" },
  { id: "sscu", name: "St. Stephen's Credit Union", shortName: "SSCU", category: "CREDIT_UNIONS" },
  { id: "stwcu", name: "St. Theresa's Woodbrook Credit Union", shortName: "STWCU", category: "CREDIT_UNIONS" },
  { id: "sohcu", name: "Staff of Hope Credit Union", shortName: "SOHCU", category: "CREDIT_UNIONS" },
  { id: "spcu", name: "Susamachar Presbyterian Credit Union", shortName: "SPCU", category: "CREDIT_UNIONS" },
  { id: "sbcu", name: "Sweet Briar Credit Union", shortName: "SBCU", category: "CREDIT_UNIONS" },
  { id: "tggcu", name: "T.G.G. Credit Union", shortName: "TGGCU", category: "CREDIT_UNIONS" },
  { id: "tateco-arima", name: "TATECO Arima Credit Union", shortName: "TATECO Arima", category: "CREDIT_UNIONS" },
  { id: "tateco-pos", name: "TATECO Port of Spain Credit Union", shortName: "TATECO POS", category: "CREDIT_UNIONS" },
  { id: "tateco-sf", name: "TATECO San Fernando Credit Union", shortName: "TATECO SF", category: "CREDIT_UNIONS" },
  { id: "teachers-cu", name: "Teachers Credit Union", shortName: "Teachers CU", category: "CREDIT_UNIONS" },
  { id: "tecu", name: "TECU Credit Union", shortName: "TECU", category: "CREDIT_UNIONS" },
  { id: "twcu", name: "Telephone Workers Credit Union", shortName: "TWCU", category: "CREDIT_UNIONS" },
  { id: "textel-cu", name: "TEXTEL Credit Union", shortName: "TEXTEL CU", category: "CREDIT_UNIONS" },
  { id: "thawecu", name: "Tobago House of Assembly Works Employees Credit Union", shortName: "THAWECU", category: "CREDIT_UNIONS" },
  { id: "tpcu", name: "Toco Progressive Credit Union", shortName: "TPCU", category: "CREDIT_UNIONS" },
  { id: "tranquillity-cu", name: "Tranquillity Credit Union", shortName: "Tranquillity CU", category: "CREDIT_UNIONS" },
  { id: "transcorp-cu", name: "Transcorp Credit Union", shortName: "Transcorp CU", category: "CREDIT_UNIONS" },
  { id: "ttcicu", name: "Trinidad and Tobago Coconut Industry Credit Union", shortName: "TTCICU", category: "CREDIT_UNIONS" },
  { id: "ttfscu", name: "Trinidad and Tobago Fire Service Credit Union", shortName: "TTFSCU", category: "CREDIT_UNIONS" },
  { id: "ttpccu", name: "Trinidad and Tobago Police Credit Union", shortName: "TTPCCU", category: "CREDIT_UNIONS" },
  { id: "trintoc-penal-cu", name: "TRINTOC Penal Credit Union", shortName: "TRINTOC Penal CU", category: "CREDIT_UNIONS" },
  { id: "usmcu", name: "Usine Ste. Madeleine Credit Union", shortName: "USMCU", category: "CREDIT_UNIONS" },
  { id: "uwi-cu", name: "UWI Credit Union", shortName: "UWI CU", category: "CREDIT_UNIONS" },
  { id: "venture-cu", name: "Venture Credit Union", shortName: "Venture CU", category: "CREDIT_UNIONS" },
  { id: "vocu", name: "Victory Outreach Credit Union", shortName: "VOCU", category: "CREDIT_UNIONS" },
  { id: "wucu", name: "Western United Credit Union", shortName: "WUCU", category: "CREDIT_UNIONS" },
  { id: "whim-cu", name: "Whim Credit Union", shortName: "Whim CU", category: "CREDIT_UNIONS" },
  { id: "witco-cu", name: "WITCO Credit Union", shortName: "WITCO CU", category: "CREDIT_UNIONS" },
  { id: "works-cu", name: "Works Credit Union", shortName: "Works CU", category: "CREDIT_UNIONS" },
  { id: "zcu", name: "Zenith Credit Union", shortName: "ZCU", category: "CREDIT_UNIONS" },
  { id: "zsbcu", name: "Zionite Spiritual Baptist Credit Union", shortName: "ZSBCU", category: "CREDIT_UNIONS" },
  { id: "ccultt", name: "Co-operative Credit Union League of Trinidad and Tobago", shortName: "CCULTT", category: "CREDIT_UNION_SUPPORT" },
  { id: "ttcudif", name: "Trinidad and Tobago Credit Union Deposit Insurance Fund Co-operative Society Limited", shortName: "TTCUDIF", category: "CREDIT_UNION_SUPPORT" },
  { id: "cff", name: "Central Finance Facility Co-operative Society of Trinidad and Tobago Limited", shortName: "CFF", category: "CREDIT_UNION_SUPPORT" },
  { id: "cccu", name: "Caribbean Confederation of Credit Unions", shortName: "CCCU", category: "CREDIT_UNION_SUPPORT" },
  { id: "endcash", name: "Republic Bank Limited – Endcash", shortName: "Endcash", category: "PAYMENT_PROVIDERS" },
  { id: "bill-express", name: "GraceKennedy Trinidad and Tobago Limited – Bill Express", shortName: "Bill Express", category: "PAYMENT_PROVIDERS" },
  { id: "paywise", name: "PayWise Limited", shortName: "PayWise", category: "PAYMENT_PROVIDERS" },
  { id: "surepay", name: "PBS Technologies Limited – SurePay", shortName: "SurePay", category: "PAYMENT_PROVIDERS" },
  { id: "via", name: "Brightstar Lottery Cyprus Limited – VIA", shortName: "VIA", category: "PAYMENT_PROVIDERS" },
  { id: "wipay", name: "WiPay Payment Solutions Limited", shortName: "WiPay", category: "PAYMENT_PROVIDERS" },
  { id: "convenience-pay", name: "Convenience Pay Technologies Limited", shortName: "Convenience Pay", category: "PAYMENT_PROVIDERS" },
] as const;

const institutionsById = new Map(
  TT_FINANCIAL_INSTITUTIONS.map((institution) => [institution.id, institution]),
);

const institutionsByName = new Map(
  TT_FINANCIAL_INSTITUTIONS.map((institution) => [
    institution.name.toLowerCase(),
    institution,
  ]),
);

const institutionsByShortName = new Map<string, TtFinancialInstitution | null>();
for (const institution of TT_FINANCIAL_INSTITUTIONS) {
  const key = institution.shortName.toLowerCase();
  if (institutionsByShortName.has(key)) {
    // Mark ambiguous short names so free-text migration stays deterministic.
    institutionsByShortName.set(key, null);
    continue;
  }
  institutionsByShortName.set(key, institution);
}

export function getTtFinancialInstitutionById(
  id: string,
): TtFinancialInstitution | undefined {
  return institutionsById.get(id);
}

export function findTtFinancialInstitutionByName(
  name: string,
): TtFinancialInstitution | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return undefined;
  }

  const key = trimmed.toLowerCase();
  return institutionsByName.get(key) ?? institutionsByShortName.get(key) ?? undefined;
}

export function formatTtFinancialInstitutionLabel(
  institution: Pick<TtFinancialInstitution, "name" | "shortName">,
): string {
  return `${institution.name} (${institution.shortName})`;
}

export function getTtFinancialInstitutionsGrouped(): {
  categoryId: TtFinancialInstitutionCategoryId;
  label: string;
  institutions: readonly TtFinancialInstitution[];
}[] {
  return TT_FINANCIAL_INSTITUTION_CATEGORIES.map((category) => ({
    categoryId: category.id,
    label: category.label,
    institutions: TT_FINANCIAL_INSTITUTIONS.filter(
      (institution) => institution.category === category.id,
    ),
  }));
}

