import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto('http://localhost:5000/')
            await page.wait_for_timeout(3000)
            await page.screenshot(path='screenshot.png')
            print("Screenshot saved to screenshot.png")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
