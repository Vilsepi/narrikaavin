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


export const main = async (): Promise<void> => {
  const browser = await puppeteer.launch({headless: true});
  const page = await getNewPage(browser);
  await page.setUserAgent(user_agent);
  await page.goto(scrapeUrl);

  try {
    const cookiesString = await fs.readFile(filePath);
    const cookies = JSON.parse(cookiesString);

    if (cookies[0].name == "__Secure-fa" && cookies[1].name == "lastauth") {
      console.log("Found existing cookies from storage");
      await page.setCookie(...cookies);
      await page.goto(scrapeUrl);
      await page.waitForSelector('#bbn-card-view');
      console.log("Successfully fetched page using existing cookies");
    }
    else {
      throw new Error('Ate a bad cookie.');
    }
  } catch (error) {
    console.log("Could not find existing cookies from storage.");
  }

  const el = await page.$('body');
  if (el) {
    const classProperty = await el.getProperty('className');
    if (classProperty) {
      const bodyClasses = await classProperty.jsonValue() as string;
      if (bodyClasses.includes('no-access not-registered')) {
        console.log('We are not logged in, attempting login');
        await page.goto(loginUrl);
        await page.waitForSelector('#usernameOrEmail');
        await page.type('#usernameOrEmail', username);
        await page.type('#password', password);
        await page.click('[type="submit"]');
        console.log("Logging in...");
        await page.waitForSelector('#bbn-card-view');
        console.log("Successfully logged in, storing cookies for later use.");
        const cookies = await page.cookies();
        await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
      }
      else {
        const stocks = await page.$$('.grid-card');
        for(const stock of stocks){
          const name = await stock.$eval('div.card-body > h4', el => el.innerText);
          console.log(name);
        }

      }
    }
  }

  await browser.close();
};

if (require.main == module) {
  void main();
}
