export interface Settings {
  locale: string;
  theme: string;
}

export interface DegiroConfig {
  tradingUrl: string;
  paUrl: string;
  reportingUrl: string;
  paymentServiceUrl: string;
  productSearchUrl: string;
  dictionaryUrl: string;
  productTypesUrl: string;
  companiesServiceUrl: string;
  i18nUrl: string;
  vwdQuotecastServiceUrl: string;
  vwdNewsUrl: string;
  vwdGossipsUrl: string;
  taskManagerUrl: string;
  refinitivNewsUrl: string;
  refinitivAgendaUrl: string;
  refinitivCompanyProfileUrl: string;
  refinitivCompanyRatiosUrl: string;
  refinitivFinancialStatementsUrl: string;
  refinitivClipsUrl: string;
  refinitivInvestorUrl: string;
  refinitivInsiderTransactionsUrl: string;
  refinitivInsidersReportUrl: string;
  refinitivShareholdersUrl: string;
  productNotesUrl: string;
  latestSearchedProductsUrl: string;
  landingPath: string;
  betaLandingPath: string;
  mobileLandingPath: string;
  loginUrl: string;
  sessionId: string;
  clientId: number;
}

export interface DegiroClient {
  id: number;
  intAccount: number;
  loggedInPersonId: number;
  clientRole: string;
  effectiveClientRole: string;
  contractType: string;
  username: string;
  displayName: string;
  email: string;
  firstContact: {
    firstName: string;
    lastName: string;
    displayName: string;
    nationality: string;
    gender: string;
    dateOfBirth: string;
    placeOfBirth: string;
    countryOfBirth: string;
  };
  address: {
    streetAddress: string;
    streetAddressNumber: string;
    zip: string;
    city: string;
    country: string;
  };
  cellphoneNumber: string;
  locale: string;
  language: string;
  culture: string;
  bankAccount: {
    bankAccountId: number;
    bic: string;
    iban: string;
    status: string;
  };
  flatexBankAccount: { bic: string };
  memberCode: string;
  isWithdrawalAvailable: boolean;
  isAllocationAvailable: boolean;
  isIskClient: boolean;
  isCollectivePortfolio: boolean;
  isAmClientActive: boolean;
  canUpgrade: boolean;
}

export function getRandomColor() {
  const hexChars = "0123456789ABCDEF";
  let randomColor = "#";

  for (let i = 0; i < 6; i++) {
    randomColor += hexChars[Math.floor(Math.random() * 16)];
  }

  return randomColor;
}

export function hasProperty(obj: object, prop: string): boolean {
  return Boolean(Reflect.getOwnPropertyDescriptor(obj, prop));
}

export function fetchFresh(url: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: {
      pragma: "no-cache",
      "Cache-Control": "no-cache",
    },
  });
}

/*
function setNoCacheControlHeader(
  detail: WebRequest.OnBeforeSendHeadersDetailsType
) {
  const headers = (detail.requestHeaders || []).filter(
    (header) => header.name.toLowerCase() !== "cache-control"
  );
  headers.push({ name: "Cache-Control", value: "no-cache" });
  return { requestHeaders: headers };
}

let noCacheTimeout = null;

function disableNoCache() {
  if (
    browser.webRequest.onBeforeSendHeaders.hasListener(setNoCacheControlHeader)
  ) {
    if (noCacheTimeout) clearTimeout(noCacheTimeout);
    browser.webRequest.onBeforeSendHeaders.removeListener(
      setNoCacheControlHeader
    );
  }
}

function enableNoCache() {
  const hasListener = browser.webRequest.onBeforeSendHeaders.hasListener(
    setNoCacheControlHeader
  );
  if (!hasListener) {
    browser.webRequest.onBeforeSendHeaders.addListener(
      setNoCacheControlHeader,
      { urls: ["<all_urls>"] },
      ["blocking", "requestHeaders"]
    );
    noCacheTimeout = setTimeout(disableNoCache, 5000);
  }
}
*/
