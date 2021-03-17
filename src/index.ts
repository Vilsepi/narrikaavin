import puppeteer from 'puppeteer';
const fs = require('fs').promises;

const options = {
  width: 1024,
  height: 768
};

const getNewPage = async (browser: puppeteer.Browser) => {
  const page = await browser.newPage();
  page.setViewport({
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
  });
  return page;
}

const username = process.env.SOURCE_USERNAME as string;
const password = process.env.SOURCE_PASSWORD as string;
const scrapeUrl = process.env.SOURCE_SCRAPE_URL as string;
const user_agent = process.env.USER_AGENT as string;
const loginUrl = process.env.SOURCE_LOGIN_URL as string;
const filePath = "./cookies.json";

const loadCookies = async () => {
  try {
    const cookiesString = await fs.readFile(filePath);
    const cookies = JSON.parse(cookiesString);
    if (cookies.find((cookie: { name: string; }) => cookie.name === 'lastauth' )) {
      console.log("Found existing cookies from storage");
      return cookies;
    }
  } catch (error) {
    console.log("Could not load existing cookies");
    return null;
  }
}

const saveCookies = async (page: puppeteer.Page) => {
  console.log("Successfully logged in, storing cookies for later use.");
  const cookies = await page.cookies();
  await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
}

const login = async (page: puppeteer.Page) => {
  await page.goto(loginUrl);
  await page.waitForSelector('#usernameOrEmail');
  await page.type('#usernameOrEmail', username);
  await page.type('#password', password);
  await page.click('[type="submit"]');
  console.log("Logging in...");
  await page.waitForSelector('#bbn-card-view', {timeout: 10});
  await saveCookies(page);
}

export const main = async (): Promise<void> => {
  const browser = await puppeteer.launch({headless: true});
  const page = await getNewPage(browser);
  await page.setUserAgent(user_agent);

  const cookies = await loadCookies();
  if (cookies) {
    await page.setCookie(...cookies);
    await page.goto(scrapeUrl);
    try {
      await page.waitForSelector('#bbn-card-view', {timeout: 10});
      console.log("Successfully fetched page using existing cookies");
    } catch (error) {
      console.log("Cookie appears to be stale, attempting to login");
      await login(page);
    }
  }
  else {
    await login(page);
  }

  const stocks = await page.$$('.grid-card');
  for(const stock of stocks){
    const name = await stock.$eval('div.card-body > h4 > a', el => el.innerText);
    const ticker = await stock.$eval('div.card-body > h4 > span', el => el.innerText);
    const price = await stock.$eval('div.meta-data > div.left-meta > h5', el => el.innerText);
    const change = await stock.$eval('div.meta-data > div.left-meta > small.price-change > span.price-change-percent', el => el.innerText);
    let category;
    let isNew;
    try {
      category = await stock.$eval('div.meta-data > div.right-meta > small.meta-data', el => el.innerText);
    } catch (error) {
      category = '';
    }
    try {
      isNew = await stock.$eval('div.meta-data > div.right-meta > small.new-stock', el => el.innerText);
    } catch (error) {
      isNew = '';
    }
    console.log(`${name} (${ticker}): ${price} ${change} - ${category} ${isNew}`);
  }

  await browser.close();
};

if (require.main == module) {
  void main();
}
